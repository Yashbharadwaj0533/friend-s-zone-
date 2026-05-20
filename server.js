const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const SOURCE_SHEET_NAME = process.env.SOURCE_SHEET_NAME || "Node Details";
const COMPLETE_SHEET_NAME = process.env.COMPLETE_SHEET_NAME || "complete node";
const ATTEMPTED_SHEET_NAME = process.env.ATTEMPTED_SHEET_NAME || "attempted node";
const CONVEYANCE_SHEET_NAME = process.env.CONVEYANCE_SHEET_NAME || "coveyence";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const NODE_FIELDS = [
  "hostName",
  "engineerName",
  "crq",
  "crqCreateDate",
  "workArea",
  "finalTier",
  "teamLeader",
  "engineerNumber",
  "productName",
  "city",
  "state",
  "tngCircle",
  "region",
  "address"
];

let tokenCache = null;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  if (!SHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    throw new Error("Google Sheets settings are missing. Create .env from .env.example.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsignedJwt).sign(PRIVATE_KEY, "base64");
  const jwt = `${unsignedJwt}.${signature.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Could not get Google access token.");
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000
  };
  return tokenCache.accessToken;
}

async function sheetsRequest(pathname, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "Google Sheets request failed.";
    throw new Error(message);
  }
  return data;
}

function sheetRange(sheetName, range = "A:ZZ") {
  return `/values/${encodeURIComponent(`${sheetName}!${range}`)}`;
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getValue(row, aliases) {
  const wanted = aliases.map(normalizeKey);
  const match = Object.entries(row).find(([key]) => wanted.includes(normalizeKey(key)));
  return match ? match[1] : "";
}

function rowToNode(headers, values) {
  const raw = {};
  headers.forEach((header, index) => {
    raw[header] = values[index] || "";
  });

  return {
    hostName: getValue(raw, ["Host Name", "Hostname", "Host", "Node", "Node Name"]),
    engineerName: getValue(raw, ["Engineer Name", "Engineer", "FE Name"]),
    crq: getValue(raw, ["CRQ", "CRQ No", "CRQ Number"]),
    crqCreateDate: getValue(raw, ["CRQ Create Date", "CRQ Date"]),
    workArea: getValue(raw, ["Work Area", "Area"]),
    finalTier: getValue(raw, ["Final Tier", "Tier"]),
    teamLeader: getValue(raw, ["Team Leader", "TL"]),
    engineerNumber: getValue(raw, ["Engineer Number", "Engineer Mobile", "Mobile Number", "FE Number"]),
    productName: getValue(raw, ["Product Name", "Product"]),
    city: getValue(raw, ["City"]),
    state: getValue(raw, ["State"]),
    tngCircle: getValue(raw, ["TNG Circle", "Circle"]),
    region: getValue(raw, ["Region"]),
    address: getValue(raw, ["Address", "Site Address"]),
    raw
  };
}

async function getNodes() {
  const data = await sheetsRequest(sheetRange(SOURCE_SHEET_NAME));
  const rows = data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows
    .slice(1)
    .map(row => rowToNode(headers, row))
    .filter(node => node.hostName);
}

async function ensureSheetExists(sheetName) {
  const spreadsheet = await sheetsRequest("?fields=sheets.properties.title");
  const titles = (spreadsheet.sheets || []).map(sheet => sheet.properties.title);
  if (titles.includes(sheetName)) return;

  await sheetsRequest(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: sheetName } } }]
    })
  });
}

async function ensureHeaderRow(sheetName) {
  const data = await sheetsRequest(sheetRange(sheetName, "A1:ZZ1"));
  if (data.values && data.values.length) return;

  const headers = ["submittedAt", ...NODE_FIELDS, "formData"];
  await sheetsRequest(sheetRange(sheetName, "A1:ZZ1") + ":append?valueInputOption=USER_ENTERED", {
    method: "POST",
    body: JSON.stringify({ values: [headers] })
  });
}

async function appendRow(sheetName, payload) {
  await ensureSheetExists(sheetName);
  await ensureHeaderRow(sheetName);

  const node = payload.node || {};
  const form = payload.form || {};
  const row = [
    new Date().toISOString(),
    ...NODE_FIELDS.map(field => node[field] || ""),
    JSON.stringify(form)
  ];

  await sheetsRequest(sheetRange(sheetName, "A:ZZ") + ":append?valueInputOption=USER_ENTERED", {
    method: "POST",
    body: JSON.stringify({ values: [row] })
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/nodes") {
    const nodes = await getNodes();
    sendJson(res, 200, { nodes });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/node") {
    const host = url.searchParams.get("host") || "";
    const nodes = await getNodes();
    const node = nodes.find(item => item.hostName === host);
    if (!node) return sendJson(res, 404, { error: "Host was not found in the source sheet." });
    sendJson(res, 200, { node });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/submit/complete") {
    await appendRow(COMPLETE_SHEET_NAME, await readRequestBody(req));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/submit/attempted") {
    await appendRow(ATTEMPTED_SHEET_NAME, await readRequestBody(req));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/submit/conveyance") {
    await appendRow(CONVEYANCE_SHEET_NAME, await readRequestBody(req));
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`PMT backend running at http://localhost:${PORT}`);
});
