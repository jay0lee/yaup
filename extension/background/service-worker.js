/**
 * YAUP - Background Service Worker
 * Intercepts navigation, checks AUP agreement status (version + expiration),
 * and redirects to the AUP agreement page if not signed.
 */

import { getActivePolicy, isAgreementValid, shouldInterceptUrl } from "../shared/policy.js";

// Keep track of tabs currently showing AUP to prevent redundant updates
const aupTabs = new Set();

/**
 * Check tab navigation and enforce AUP if needed
 */
async function checkNavigation(details) {
  // Only intercept top-level frame navigation
  if (details.frameId !== 0) return;

  const url = details.url;
  if (!url) return;

  // Don't intercept the AUP page itself or extension pages
  const aupPageBase = chrome.runtime.getURL("pages/aup.html");
  const adminPageBase = chrome.runtime.getURL("pages/admin.html");
  if (url.startsWith(aupPageBase) || url.startsWith(adminPageBase)) {
    return;
  }

  try {
    const policy = await getActivePolicy();

    // When running unmanaged (no cloud policy), do NOT enforce or block browsing
    // unless the admin explicitly turned on local test interception
    if (!policy.isManaged) {
      const { testInterceptionEnabled } = await chrome.storage.local.get(["testInterceptionEnabled"]);
      if (!testInterceptionEnabled) {
        return; // Allow uninterrupted browsing in unmanaged mode
      }
    }

    const { agreementState } = await chrome.storage.local.get(["agreementState"]);

    // If agreement is valid (correct version and not expired), allow navigation
    if (isAgreementValid(agreementState, policy)) {
      return;
    }

    // Check if the target URL matches the interception policy (scope, patterns, whitelist)
    if (shouldInterceptUrl(url, policy)) {
      const aupUrl = `${aupPageBase}?redirect=${encodeURIComponent(url)}`;
      aupTabs.add(details.tabId);
      chrome.tabs.update(details.tabId, { url: aupUrl });
    }
  } catch (err) {
    console.error("[YAUP] Error checking navigation:", err);
  }
}

// Intercept before navigation begins
chrome.webNavigation.onBeforeNavigate.addListener(checkNavigation);

// Cleanup tab tracking when closed
chrome.tabs.onRemoved.addListener((tabId) => {
  aupTabs.delete(tabId);
});

// Extension icon click action: Open admin / policy builder in unmanaged mode, or AUP status
chrome.action.onClicked.addListener(async (tab) => {
  const policy = await getActivePolicy();
  if (!policy.isManaged) {
    // Unmanaged mode: open admin dashboard to configure and export policy
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/admin.html") });
  } else {
    // Managed mode: open AUP review page
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/aup.html?mode=review") });
  }
});

// Notify when policy or agreement changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log(`[YAUP] Storage changed in ${areaName}:`, Object.keys(changes));
});

console.log("[YAUP] Background service worker initialized.");
