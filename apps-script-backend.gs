const SPREADSHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";

const SOURCE_SHEET = "Node Details";
const COMPLETE_SHEET = "complete node";
const ATTEMPTED_SHEET = "attempted node";
const CONVEYANCE_SHEET = "coveyence";

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

function authorizeSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return `Authorized for spreadsheet: ${ss.getName()}`;
}

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "nodes") {
      return json({ nodes: getNodes() });
    }

    if (action === "node") {
      const host = e.parameter.host || "";
      const node = getNodes().find(item => item.hostName === host);
      return json({ node: node || null });
    }

    return json({ error: "Invalid action." });
  } catch (error) {
    return json({ error: error.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");

    if (body.action === "complete") {
      appendSubmission(COMPLETE_SHEET, body);
      return json({ ok: true });
    }

    if (body.action === "attempted") {
      appendSubmission(ATTEMPTED_SHEET, body);
      return json({ ok: true });
    }

    if (body.action === "conveyance") {
      appendSubmission(CONVEYANCE_SHEET, body);
      return json({ ok: true });
    }

    return json({ error: "Invalid submit action." });
  } catch (error) {
    return json({ error: error.message });
  }
}

function getNodes() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SOURCE_SHEET);
  if (!sheet) throw new Error(`Source sheet "${SOURCE_SHEET}" was not found.`);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values.shift();
  return values
    .map(row => rowToNode(headers, row))
    .filter(node => node.hostName);
}

function rowToNode(headers, row) {
  const raw = {};
  headers.forEach((header, index) => {
    raw[header] = row[index] || "";
  });

  return {
    hostName: pick(raw, ["Host Name", "Hostname", "Host", "Node", "Node Name"]),
    engineerName: pick(raw, ["Engineer Name", "Engineer", "FE Name"]),
    crq: pick(raw, ["CRQ", "CRQ No", "CRQ Number"]),
    crqCreateDate: pick(raw, ["CRQ Create Date", "CRQ Date"]),
    workArea: pick(raw, ["Work Area", "Area"]),
    finalTier: pick(raw, ["Final Tier", "Tier"]),
    teamLeader: pick(raw, ["Team Leader", "TL"]),
    engineerNumber: pick(raw, ["Engineer Number", "Engineer Mobile", "Mobile Number", "FE Number"]),
    productName: pick(raw, ["Product Name", "Product"]),
    city: pick(raw, ["City"]),
    state: pick(raw, ["State"]),
    tngCircle: pick(raw, ["TNG Circle", "Circle"]),
    region: pick(raw, ["Region"]),
    address: pick(raw, ["Address", "Site Address"]),
    raw
  };
}

function appendSubmission(sheetName, body) {
  const sheet = getOrCreateSheet(sheetName);
  ensureHeader(sheet);

  const node = body.node || {};
  const form = body.form || {};

  sheet.appendRow([
    new Date(),
    ...NODE_FIELDS.map(field => node[field] || ""),
    JSON.stringify(form)
  ]);
}

function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(["submittedAt", ...NODE_FIELDS, "formData"]);
}

function pick(row, aliases) {
  const normalizedAliases = aliases.map(normalize);
  const key = Object.keys(row).find(header => normalizedAliases.includes(normalize(header)));
  return key ? row[key] : "";
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
