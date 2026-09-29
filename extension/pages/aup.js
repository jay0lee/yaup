/**
 * YAUP - AUP Signing Page Controller
 */

import { getActivePolicy, isAgreementValid } from "../shared/policy.js";
import { parseMarkdown } from "../shared/markdown.js";
import { initSignaturePad, exportMonochromeImage, hasDrawnContent } from "../shared/image-utils.js";

let activePolicy = null;
let signaturePad = null;
let userProfile = { email: "", id: "" };
let redirectUrl = "";

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  redirectUrl = urlParams.get("redirect") || "";

  // 1. Load active policy
  activePolicy = await getActivePolicy();

  // 2. Render Policy UI
  document.getElementById("policyTitle").textContent = activePolicy.policyTitle || "Acceptable Use Policy";
  document.getElementById("orgName").textContent = activePolicy.organizationName || "Organization";
  document.getElementById("versionBadge").textContent = `v${activePolicy.aupVersion || "1.0"}`;

  if (activePolicy.logoUrl) {
    const logoEl = document.getElementById("orgLogo");
    logoEl.src = activePolicy.logoUrl;
    logoEl.onerror = () => {
      logoEl.src = "../icons/icon-128.png";
    };
  }

  // Render markdown content
  const contentEl = document.getElementById("policyContent");
  contentEl.innerHTML = parseMarkdown(activePolicy.policyMarkdown);

  // 3. Check previous agreement state (for update/expiration notices)
  const { agreementState } = await chrome.storage.local.get(["agreementState"]);
  const alertBanner = document.getElementById("alertBanner");
  const alertText = document.getElementById("alertText");

  if (agreementState && agreementState.signed) {
    if (agreementState.version !== activePolicy.aupVersion) {
      alertBanner.style.display = "flex";
      alertText.textContent = `Notice: The policy has been updated from v${agreementState.version} to v${activePolicy.aupVersion}. Please re-sign to continue.`;
    } else if (!isAgreementValid(agreementState, activePolicy)) {
      alertBanner.style.display = "flex";
      alertText.textContent = `Notice: Your previous agreement has expired (valid for ${activePolicy.expirationDays} days). Please re-sign to continue.`;
    }
  }

  // 4. Resolve User Identity
  await resolveUserIdentity();

  // 5. Initialize Signature Pad
  const canvas = document.getElementById("initialsCanvas");
  const canvasHint = document.getElementById("canvasHint");
  const thumbCanvas = document.getElementById("thumbCanvas");
  const signatureStatus = document.getElementById("signatureStatus");

  signaturePad = initSignaturePad(canvas, () => {
    const hasStrokes = hasDrawnContent(canvas);
    if (hasStrokes) {
      canvasHint.style.display = "none";
      // Update monochrome preview
      const mono = exportMonochromeImage(canvas, 160, 60);
      const thumbCtx = thumbCanvas.getContext("2d");
      const img = new Image();
      img.onload = () => thumbCtx.drawImage(img, 0, 0);
      img.src = mono.dataUrl;

      signatureStatus.textContent = `Initials captured (${mono.approxBytes} bytes)`;
      signatureStatus.className = "signature-status valid";
    } else {
      signatureStatus.textContent = "Waiting for initials";
      signatureStatus.className = "signature-status";
    }
    updateSubmitState();
  });

  document.getElementById("clearCanvasBtn").addEventListener("click", () => {
    signaturePad.clear();
    canvasHint.style.display = "block";
    const thumbCtx = thumbCanvas.getContext("2d");
    thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
    signatureStatus.textContent = "Waiting for initials";
    signatureStatus.className = "signature-status";
    updateSubmitState();
  });

  // 6. Checkbox & Form Controls
  document.getElementById("agreeCheckbox").addEventListener("change", updateSubmitState);
  document.getElementById("userEmail").addEventListener("input", updateSubmitState);

  // 7. Form Submission
  document.getElementById("agreementForm").addEventListener("submit", handleSubmit);
});

async function resolveUserIdentity() {
  const emailInput = document.getElementById("userEmail");
  const managedTag = document.getElementById("managedTag");

  try {
    if (chrome.identity && chrome.identity.getProfileUserInfo) {
      const info = await chrome.identity.getProfileUserInfo({ accountStatus: "ANY" });
      if (info && info.email) {
        userProfile.email = info.email;
        userProfile.id = info.id || "";
        emailInput.value = info.email;
        emailInput.readOnly = true;
        managedTag.textContent = "Managed Account";
        return;
      }
    }
  } catch (err) {
    console.debug("[YAUP] Profile user info not available:", err);
  }

  // Fallback: Check local storage or prompt user
  const { lastUserEmail } = await chrome.storage.local.get(["lastUserEmail"]);
  if (lastUserEmail) {
    emailInput.value = lastUserEmail;
  }
  emailInput.readOnly = false;
  managedTag.textContent = "User Specified";
  managedTag.style.backgroundColor = "#e2e8f0";
  managedTag.style.color = "#475569";
}

function updateSubmitState() {
  const checkbox = document.getElementById("agreeCheckbox");
  const canvas = document.getElementById("initialsCanvas");
  const emailInput = document.getElementById("userEmail");
  const submitBtn = document.getElementById("submitBtn");

  const isChecked = checkbox.checked;
  const hasStrokes = hasDrawnContent(canvas);
  const hasEmail = emailInput.value.trim().length > 0;

  submitBtn.disabled = !(isChecked && hasStrokes && hasEmail);
}

async function handleSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById("submitBtn");
  const btnSpinner = document.getElementById("btnSpinner");
  const errorMessage = document.getElementById("errorMessage");
  const emailInput = document.getElementById("userEmail");
  const canvas = document.getElementById("initialsCanvas");

  submitBtn.disabled = true;
  btnSpinner.style.display = "inline-block";
  errorMessage.style.display = "none";

  const email = emailInput.value.trim();
  userProfile.email = email;

  // Generate low-res B/W initials image
  const mono = exportMonochromeImage(canvas, 160, 60);

  const agreementPayload = {
    event: "aup_agreement",
    timestamp: new Date().toISOString(),
    user: {
      email: email,
      directoryId: userProfile.id || null
    },
    policy: {
      version: activePolicy.aupVersion || "1.0",
      title: activePolicy.policyTitle || "Acceptable Use Policy",
      organization: activePolicy.organizationName || "Organization"
    },
    signature: {
      type: "initials_drawing",
      format: "image/png;base64",
      data: mono.dataUrl,
      width: mono.width,
      height: mono.height,
      approxBytes: mono.approxBytes
    },
    client: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      extensionVersion: chrome.runtime.getManifest().version
    },
    targetUrl: redirectUrl || null
  };

  // POST agreement to Admin webhook if configured
  if (activePolicy.webhookUrl) {
    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (activePolicy.webhookAuthHeader) {
        headers["Authorization"] = activePolicy.webhookAuthHeader;
      }

      const res = await fetch(activePolicy.webhookUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(agreementPayload)
      });

      if (!res.ok) {
        throw new Error(`Webhook returned HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      console.error("[YAUP] Failed to POST agreement to webhook:", err);
      errorMessage.textContent = `Warning: Could not record agreement with organization server (${err.message}). Please contact your administrator or try again.`;
      errorMessage.style.display = "block";
      submitBtn.disabled = false;
      btnSpinner.style.display = "none";
      return;
    }
  }

  // Save successful agreement state
  const agreementState = {
    signed: true,
    version: activePolicy.aupVersion || "1.0",
    signedAt: Date.now(),
    userEmail: email
  };

  await chrome.storage.local.set({
    agreementState: agreementState,
    lastUserEmail: email
  });

  // Redirect to original target URL or show completion
  if (redirectUrl) {
    window.location.replace(redirectUrl);
  } else {
    document.querySelector(".signing-section").innerHTML = `
      <div style="text-align: center; padding: 32px 0;">
        <div style="font-size: 3rem; margin-bottom: 12px;">✅</div>
        <h2 style="font-size: 1.5rem; margin-bottom: 8px;">Agreement Signed Successfully</h2>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">
          You have successfully agreed to the Acceptable Use Policy (v${activePolicy.aupVersion}). You may now close this window or continue browsing.
        </p>
      </div>
    `;
  }
}
