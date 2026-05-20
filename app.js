const PMT = (() => {
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwIcDannoUEUFBXBb_0kGL8atZBFv8U-cwsGN516g_kVBbQoGpMRPzXhNeUfcu1YkO1Mg/exec";

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

  const LABELS = {
    hostName: "Host Name",
    engineerName: "Engineer Name",
    crq: "CRQ",
    crqCreateDate: "CRQ Create Date",
    workArea: "Work Area",
    finalTier: "Final Tier",
    teamLeader: "Team Leader",
    engineerNumber: "Engineer Number",
    productName: "Product Name",
    city: "City",
    state: "State",
    tngCircle: "TNG Circle",
    region: "Region",
    address: "Address"
  };

  const VALUE_IDS = {
    crq: "val-crq",
    crqCreateDate: "val-crq-date",
    workArea: "val-work-area",
    finalTier: "val-tier",
    teamLeader: "val-tl",
    engineerNumber: "val-eng-num",
    productName: "val-product",
    city: "val-city",
    state: "val-state",
    tngCircle: "val-circle",
    region: "val-region",
    address: "val-address"
  };

  let currentNode = null;

  function assertAppsScriptUrl() {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("PASTE_YOUR")) {
      throw new Error("Paste your Apps Script Web App URL in app.js first.");
    }
  }

  function appsScriptGetUrl(action, params = {}) {
    assertAppsScriptUrl();
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
    return url.toString();
  }

  async function apiGet(action, params = {}) {
    const response = await fetch(appsScriptGetUrl(action, params));
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function apiPost(action, payload) {
    assertAppsScriptUrl();
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        ...payload
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || "Request failed.");
    return data;
  }

  function endpointToAction(endpoint) {
    if (endpoint.includes("complete")) return "complete";
    if (endpoint.includes("attempted")) return "attempted";
    if (endpoint.includes("conveyance")) return "conveyance";
    return endpoint;
  }

  function getHostFromUrl() {
    return new URLSearchParams(window.location.search).get("host") || "";
  }

  function setStatus(element, message, type = "info") {
    if (!element) return;
    const colors = {
      info: "text-sm font-medium text-amber-600",
      ok: "text-sm font-medium text-emerald-600",
      error: "text-sm font-medium text-red-600"
    };
    element.className = colors[type] || colors.info;
    element.textContent = message;
  }

  function renderNode(node) {
    currentNode = node;
    Object.entries(VALUE_IDS).forEach(([field, id]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = node?.[field] || "-";
    });

    document.querySelectorAll("[data-node-field]").forEach(element => {
      const field = element.dataset.nodeField;
      if ("value" in element) element.value = node?.[field] || "";
      else element.textContent = node?.[field] || "-";
    });
  }

  function clearNode() {
    currentNode = null;
    renderNode({});
  }

  function serializeForm(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (data[key] === undefined) {
        data[key] = value;
      } else if (Array.isArray(data[key])) {
        data[key].push(value);
      } else {
        data[key] = [data[key], value];
      }
    });
    return data;
  }

  async function fillSelects({ hostSelect, engineerSelect }) {
    const { nodes = [] } = await apiGet("nodes");
    if (!Array.isArray(nodes)) {
      throw new Error("Apps Script returned invalid node data. Expected a nodes array.");
    }

    const uniqueEngineers = [...new Set(nodes.map(node => node.engineerName).filter(Boolean))].sort();

    if (engineerSelect) {
      engineerSelect.innerHTML = '<option value="">-- Select Engineer --</option>';
      uniqueEngineers.forEach(engineer => {
        engineerSelect.add(new Option(engineer, engineer));
      });
    }

    if (hostSelect) {
      hostSelect.innerHTML = '<option value="">-- Select Hostname --</option>';
      nodes.forEach(node => {
        hostSelect.add(new Option(node.hostName, node.hostName));
      });
    }

    return nodes;
  }

  function makeNodeInfoBox() {
    const box = document.createElement("div");
    box.className = "card";
    box.innerHTML = `
      <h2>Node Information</h2>
      <div class="meta-grid">
        ${NODE_FIELDS.map(field => `
          <div class="meta-item">
            <label>${LABELS[field]} :</label>
            <input type="text" data-node-field="${field}" readonly>
          </div>
        `).join("")}
      </div>
    `;
    return box;
  }

  function selectedNode() {
    return currentNode || JSON.parse(sessionStorage.getItem("selectedNode") || "null") || {};
  }

  async function loadNodeByHost(host) {
    const { node } = await apiGet("node", { host });
    if (!node) throw new Error("Host was not found in the Google Sheet.");
    sessionStorage.setItem("selectedNode", JSON.stringify(node));
    renderNode(node);
    return node;
  }

  async function submit(endpoint, form, submitButton) {
    const originalText = submitButton?.textContent;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }
    try {
      await apiPost(endpointToAction(endpoint), {
        node: selectedNode(),
        form: serializeForm(form)
      });
      alert("Submitted successfully.");
      form.reset();
    } catch (error) {
      alert(error.message);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  return {
    fillSelects,
    loadNodeByHost,
    renderNode,
    clearNode,
    setStatus,
    makeNodeInfoBox,
    getHostFromUrl,
    selectedNode,
    submit
  };
})();
