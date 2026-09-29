/**
 * YAUP - Admin Policy Builder & Exporter Controller
 */

import { DEFAULT_POLICY, getActivePolicy } from "../shared/policy.js";
import { parseMarkdown } from "../shared/markdown.js";

let currentPolicy = { ...DEFAULT_POLICY };

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Load active policy configuration
  currentPolicy = await getActivePolicy();

  // 2. Populate form fields
  populateForm(currentPolicy);

  // 3. Setup tabs
  setupTabs();

  // 4. Setup version incrementer & expiration presets
  setupVersioningControls();

  // 5. Setup Markdown toolbar
  setupMarkdownToolbar();

  // 6. Setup live preview listener
  setupLivePreview();

  // 7. Setup Webhook tester
  setupWebhookTester();

  // 8. Setup save and export actions
  setupExportActions();

  // 9. Setup unmanaged test mode controls
  setupTestModeControls();

  // Initial preview render
  updatePreview();
});

function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetId = `tab-${btn.dataset.tab}`;
      document.getElementById(targetId)?.classList.add("active");

      if (btn.dataset.tab === "export") {
        updateJsonView();
      }
    });
  });
}

function populateForm(policy) {
  document.getElementById("organizationName").value = policy.organizationName || "";
  document.getElementById("policyTitle").value = policy.policyTitle || "";
  document.getElementById("logoUrl").value = policy.logoUrl || "";
  document.getElementById("aupVersion").value = policy.aupVersion || "1.0";
  document.getElementById("expirationDays").value = policy.expirationDays ?? 0;
  document.getElementById("policyMarkdown").value = policy.policyMarkdown || "";

  // Trigger scope
  const scopeRadios = document.getElementsByName("triggerScope");
  for (const radio of scopeRadios) {
    radio.checked = radio.value === (policy.triggerScope || "all");
  }

  // Patterns
  document.getElementById("triggerPatterns").value = (policy.triggerPatterns || []).join("\n");
  document.getElementById("whitelistPatterns").value = (policy.whitelistPatterns || []).join("\n");

  // Signature & Webhook
  document.getElementById("requireInitials").checked = policy.requireInitials ?? true;
  document.getElementById("requireScrollToBottom").checked = policy.requireScrollToBottom ?? true;
  document.getElementById("webhookUrl").value = policy.webhookUrl || "";
  document.getElementById("webhookAuthHeader").value = policy.webhookAuthHeader || "";
}

function collectFormData() {
  const scopeRadios = document.getElementsByName("triggerScope");
  let selectedScope = "all";
  for (const r of scopeRadios) {
    if (r.checked) selectedScope = r.value;
  }

  const triggerLines = document.getElementById("triggerPatterns").value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const whitelistLines = document.getElementById("whitelistPatterns").value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    organizationName: document.getElementById("organizationName").value.trim() || DEFAULT_POLICY.organizationName,
    policyTitle: document.getElementById("policyTitle").value.trim() || DEFAULT_POLICY.policyTitle,
    logoUrl: document.getElementById("logoUrl").value.trim(),
    aupVersion: document.getElementById("aupVersion").value.trim() || "1.0",
    expirationDays: parseInt(document.getElementById("expirationDays").value, 10) || 0,
    policyMarkdown: document.getElementById("policyMarkdown").value,
    triggerScope: selectedScope,
    triggerPatterns: triggerLines,
    whitelistPatterns: whitelistLines,
    requireInitials: document.getElementById("requireInitials").checked,
    requireScrollToBottom: document.getElementById("requireScrollToBottom").checked,
    webhookUrl: document.getElementById("webhookUrl").value.trim(),
    webhookAuthHeader: document.getElementById("webhookAuthHeader").value.trim()
  };
}

function setupVersioningControls() {
  const bumpBtn = document.getElementById("bumpVersionBtn");
  const versionInput = document.getElementById("aupVersion");

  bumpBtn.addEventListener("click", () => {
    const val = versionInput.value.trim();
    // Parse version as numeric or decimal
    const parts = val.split(".");
    if (parts.length >= 2 && !isNaN(parts[parts.length - 1])) {
      parts[parts.length - 1] = parseInt(parts[parts.length - 1], 10) + 1;
      versionInput.value = parts.join(".");
    } else if (!isNaN(val)) {
      versionInput.value = (parseFloat(val) + 1).toFixed(0);
    } else {
      versionInput.value = `${val}.1`;
    }
    updatePreview();
  });

  // Expiration presets
  const chips = document.querySelectorAll(".btn-chip");
  const expirationInput = document.getElementById("expirationDays");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      expirationInput.value = chip.dataset.days;
      updatePreview();
    });
  });
}

function setupMarkdownToolbar() {
  const textarea = document.getElementById("policyMarkdown");
  const tools = document.querySelectorAll(".tool-btn");

  tools.forEach((btn) => {
    btn.addEventListener("click", () => {
      const snippet = btn.dataset.insert;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      textarea.value = text.substring(0, start) + snippet + text.substring(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
      updatePreview();
    });
  });
}

function setupLivePreview() {
  const form = document.getElementById("policyForm");
  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);
}

function updatePreview() {
  const data = collectFormData();

  // Mockup Header
  document.getElementById("prevOrg").textContent = data.organizationName;
  document.getElementById("prevTitle").textContent = data.policyTitle;
  document.getElementById("prevVersion").textContent = `v${data.aupVersion}`;

  const logoEl = document.getElementById("prevLogo");
  if (data.logoUrl) {
    logoEl.src = data.logoUrl;
    logoEl.onerror = () => {
      logoEl.src = "../icons/icon-128.png";
    };
  } else {
    logoEl.src = "../icons/icon-128.png";
  }

  // Mockup Body
  document.getElementById("prevContent").innerHTML = parseMarkdown(data.policyMarkdown);

  // Mockup Initials
  const initialsRow = document.getElementById("prevInitialsRow");
  initialsRow.style.display = data.requireInitials ? "block" : "none";

  // Also refresh JSON view if export tab is active
  updateJsonView();
}

function updateJsonView() {
  const data = collectFormData();
  // Filter out internal flags
  const jsonExport = {
    aupVersion: { Value: data.aupVersion },
    expirationDays: { Value: data.expirationDays },
    policyTitle: { Value: data.policyTitle },
    policyMarkdown: { Value: data.policyMarkdown },
    organizationName: { Value: data.organizationName },
    logoUrl: { Value: data.logoUrl },
    triggerScope: { Value: data.triggerScope },
    triggerPatterns: { Value: data.triggerPatterns },
    whitelistPatterns: { Value: data.whitelistPatterns },
    requireInitials: { Value: data.requireInitials },
    requireScrollToBottom: { Value: data.requireScrollToBottom },
    webhookUrl: { Value: data.webhookUrl },
    webhookAuthHeader: { Value: data.webhookAuthHeader }
  };

  const formattedJson = JSON.stringify(jsonExport, null, 2);
  const codeEl = document.getElementById("jsonCodeView");
  if (codeEl) {
    codeEl.textContent = formattedJson;
  }
}

function setupWebhookTester() {
  const testBtn = document.getElementById("testWebhookBtn");
  const resultEl = document.getElementById("webhookTestResult");

  testBtn.addEventListener("click", async () => {
    const data = collectFormData();
    if (!data.webhookUrl) {
      resultEl.textContent = "Please enter a Webhook URL first.";
      resultEl.className = "test-result error";
      return;
    }

    testBtn.disabled = true;
    resultEl.textContent = "Sending test ping...";
    resultEl.className = "test-result";

    const testPayload = {
      event: "aup_test_ping",
      timestamp: new Date().toISOString(),
      user: {
        email: "admin-tester@organization.com",
        directoryId: "test-admin-id"
      },
      policy: {
        version: data.aupVersion,
        title: data.policyTitle,
        organization: data.organizationName
      },
      signature: {
        type: "initials_drawing",
        format: "image/png;base64",
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        width: 160,
        height: 80,
        approxBytes: 68
      },
      client: {
        test: true,
        extensionVersion: chrome.runtime.getManifest().version
      }
    };

    const startTime = performance.now();
    try {
      const headers = { "Content-Type": "application/json" };
      if (data.webhookAuthHeader) {
        headers["Authorization"] = data.webhookAuthHeader;
      }

      const res = await fetch(data.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload)
      });

      const elapsed = Math.round(performance.now() - startTime);
      if (res.ok) {
        resultEl.textContent = `Success! HTTP ${res.status} (${elapsed}ms)`;
        resultEl.className = "test-result success";
      } else {
        resultEl.textContent = `Server responded with HTTP ${res.status} ${res.statusText} (${elapsed}ms)`;
        resultEl.className = "test-result error";
      }
    } catch (err) {
      resultEl.textContent = `Connection error: ${err.message}`;
      resultEl.className = "test-result error";
    } finally {
      testBtn.disabled = false;
    }
  });
}

function setupExportActions() {
  const saveDraftBtn = document.getElementById("saveDraftBtn");
  const exportJsonBtn = document.getElementById("exportJsonBtn");
  const downloadPolicyJsonBtn = document.getElementById("downloadPolicyJsonBtn");
  const copyPolicyJsonBtn = document.getElementById("copyPolicyJsonBtn");

  // Save local draft
  const saveDraft = async () => {
    const data = collectFormData();
    await chrome.storage.local.set({ adminPolicy: data });
    alert("Draft policy saved locally in extension storage!");
  };

  saveDraftBtn.addEventListener("click", saveDraft);

  // Generate downloadable JSON
  const downloadJson = () => {
    const data = collectFormData();
    const jsonPolicy = {
      aupVersion: { Value: data.aupVersion },
      expirationDays: { Value: data.expirationDays },
      policyTitle: { Value: data.policyTitle },
      policyMarkdown: { Value: data.policyMarkdown },
      organizationName: { Value: data.organizationName },
      logoUrl: { Value: data.logoUrl },
      triggerScope: { Value: data.triggerScope },
      triggerPatterns: { Value: data.triggerPatterns },
      whitelistPatterns: { Value: data.whitelistPatterns },
      requireInitials: { Value: data.requireInitials },
      requireScrollToBottom: { Value: data.requireScrollToBottom },
      webhookUrl: { Value: data.webhookUrl },
      webhookAuthHeader: { Value: data.webhookAuthHeader }
    };

    const blob = new Blob([JSON.stringify(jsonPolicy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yaup-policy-v${data.aupVersion}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  downloadPolicyJsonBtn.addEventListener("click", downloadJson);
  exportJsonBtn.addEventListener("click", () => {
    // Switch to export tab and download
    document.querySelector('.tab-btn[data-tab="export"]')?.click();
    downloadJson();
  });

  // Copy to clipboard
  copyPolicyJsonBtn.addEventListener("click", async () => {
    const codeEl = document.getElementById("jsonCodeView");
    if (codeEl) {
      await navigator.clipboard.writeText(codeEl.textContent);
      copyPolicyJsonBtn.textContent = "Copied to Clipboard!";
      setTimeout(() => {
        copyPolicyJsonBtn.textContent = "Copy JSON to Clipboard";
      }, 2000);
    }
  });
}

function setupTestModeControls() {
  const testAupBtn = document.getElementById("testAupScreenBtn");
  const testToggle = document.getElementById("testInterceptionToggle");
  const unmanagedCard = document.getElementById("unmanagedTestingCard");

  if (currentPolicy.isManaged) {
    if (unmanagedCard) unmanagedCard.style.display = "none";
  }

  // Launch test AUP screen in a new tab
  if (testAupBtn) {
    testAupBtn.addEventListener("click", async () => {
      // Automatically save current draft so test tab sees the latest inputs
      const data = collectFormData();
      await chrome.storage.local.set({ adminPolicy: data });
      chrome.tabs.create({
        url: chrome.runtime.getURL("pages/aup.html?mode=test&redirect=" + encodeURIComponent("https://example.com"))
      });
    });
  }

  // Load and bind local simulation toggle
  if (testToggle) {
    chrome.storage.local.get(["testInterceptionEnabled"]).then((res) => {
      testToggle.checked = Boolean(res.testInterceptionEnabled);
    });

    testToggle.addEventListener("change", async (e) => {
      await chrome.storage.local.set({ testInterceptionEnabled: e.target.checked });
      if (e.target.checked) {
        alert("Live browsing interception simulation is now ENABLED for this browser.\nMatching web navigation will redirect to the AUP until agreed.");
      } else {
        alert("Live browsing interception simulation is now DISABLED. Normal browsing is uninterrupted.");
      }
    });
  }
}

