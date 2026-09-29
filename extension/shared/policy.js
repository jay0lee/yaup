/**
 * YAUP - Policy Schema, Defaults, and Verification Logic
 */

export const DEFAULT_POLICY = {
  aupVersion: "1.0",
  expirationDays: 0, // 0 = never expires (valid until aupVersion increments)
  policyTitle: "Acceptable Use Policy",
  organizationName: "Your Organization",
  logoUrl: "",
  policyMarkdown: `# Acceptable Use Policy (AUP)

Welcome to the **Organization Network and Computing Resources**.

Please review the following standards regarding your access and use of systems, devices, and internet connections provided or managed by the organization.

### 1. Authorized Purpose
Organization systems and network access are provided for legitimate business, academic, and administrative purposes. Incidental personal use is permitted provided it does not interfere with productivity, violate policies, or consume excessive resources.

### 2. Security and Data Protection
* Users must protect credentials and never share passwords or access tokens.
* Confidential and proprietary organization data must not be transferred to unauthorized personal devices, unauthorized cloud services, or public AI services.
* Any suspected security incident or lost device must be reported immediately to the IT/Security team.

### 3. Prohibited Activities
Users may not:
* Attempt to bypass security controls, firewalls, or monitoring tools.
* Download, store, or distribute malicious software, pirated media, or illicit material.
* Engage in harassment, unauthorized commercial activities, or violation of intellectual property.

### 4. Monitoring and Privacy Notice
The organization reserves the right to monitor, audit, and log network activity and system use in accordance with applicable laws and corporate governance standards.

---
By checking the box and drawing your initials below, you acknowledge that you have read, understood, and agree to adhere to this policy.`,
  triggerScope: "all", // "all" | "pattern"
  triggerPatterns: [
    "*://*.corp/*",
    "*://*.corp.*/*",
    "*://internal.*/*"
  ],
  whitelistPatterns: [
    "https://accounts.google.com/*",
    "https://login.microsoftonline.com/*",
    "https://*.okta.com/*"
  ],
  requireInitials: true,
  requireScrollToBottom: true,
  webhookUrl: "",
  webhookAuthHeader: ""
};

/**
 * Retrieve the active policy.
 * Managed storage takes highest precedence. If running unmanaged/sideloaded,
 * falls back to local storage configured by the admin, or default policy.
 */
export async function getActivePolicy() {
  let managed = null;
  try {
    if (chrome.storage.managed) {
      managed = await chrome.storage.managed.get(null);
    }
  } catch (err) {
    // Expected when running unmanaged or sideloaded without managed policy
    console.debug("No managed policy found or not running in managed mode:", err);
  }

  // Check if managed policy has meaningful settings
  if (managed && Object.keys(managed).length > 0 && managed.policyMarkdown) {
    return {
      ...DEFAULT_POLICY,
      ...managed,
      isManaged: true
    };
  }

  // Fallback to local admin configuration (used in unmanaged / sideload testing mode)
  try {
    const local = await chrome.storage.local.get(["adminPolicy"]);
    if (local.adminPolicy) {
      return {
        ...DEFAULT_POLICY,
        ...local.adminPolicy,
        isManaged: false
      };
    }
  } catch (err) {
    console.error("Error reading local policy:", err);
  }

  return {
    ...DEFAULT_POLICY,
    isManaged: false
  };
}

/**
 * Check if the user's agreement is currently valid.
 * 1. Checks if user signed.
 * 2. Checks AUP version: If admin incremented aupVersion, older signatures are invalid.
 * 3. Checks expirationDays: If expirationDays > 0 and elapsed time exceeds N days, invalid.
 *
 * @param {Object} agreement - Saved agreement state from chrome.storage.local
 * @param {Object} policy - The currently active policy
 * @returns {boolean}
 */
export function isAgreementValid(agreement, policy) {
  if (!agreement || !agreement.signed) {
    return false;
  }

  // Requirement 1: Version check
  if (agreement.version !== (policy.aupVersion || DEFAULT_POLICY.aupVersion)) {
    return false;
  }

  // Requirement 2: Expiration check (N days)
  const expirationDays = Number(policy.expirationDays) || 0;
  if (expirationDays > 0) {
    const signedAt = Number(agreement.signedAt) || 0;
    if (!signedAt) return false;

    const maxAgeMs = expirationDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now - signedAt > maxAgeMs) {
      return false; // Signature expired
    }
  }

  return true;
}

/**
 * Convert Chrome match pattern or glob to RegExp
 */
export function patternToRegex(pattern) {
  if (!pattern) return null;
  try {
    // Handle standard chrome match pattern e.g. *://*.corp/*
    let escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp("^" + escaped + "$", "i");
  } catch (e) {
    console.warn("Invalid pattern:", pattern, e);
    return null;
  }
}

/**
 * Determine whether a given target URL should trigger the AUP block/screen
 */
export function shouldInterceptUrl(rawUrl, policy) {
  if (!rawUrl) return false;

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  // Never intercept internal or extension URLs
  if (["chrome:", "chrome-extension:", "about:", "edge:", "devtools:"].includes(url.protocol)) {
    return false;
  }

  // Only intercept standard web protocols
  if (!["http:", "https:"].includes(url.protocol)) {
    return false;
  }

  // Whitelist Webhook URL origin & path to prevent blocking POST requests
  if (policy.webhookUrl) {
    try {
      const webhook = new URL(policy.webhookUrl);
      if (url.origin === webhook.origin && url.pathname.startsWith(webhook.pathname)) {
        return false;
      }
    } catch {}
  }

  // Check explicit whitelist patterns (e.g. SSO providers)
  if (Array.isArray(policy.whitelistPatterns)) {
    for (const pattern of policy.whitelistPatterns) {
      const reg = patternToRegex(pattern.trim());
      if (reg && reg.test(rawUrl)) {
        return false;
      }
    }
  }

  // Check scope
  if (policy.triggerScope === "all") {
    return true;
  }

  if (policy.triggerScope === "pattern") {
    if (!Array.isArray(policy.triggerPatterns) || policy.triggerPatterns.length === 0) {
      return false;
    }
    for (const pattern of policy.triggerPatterns) {
      const reg = patternToRegex(pattern.trim());
      if (reg && reg.test(rawUrl)) {
        return true;
      }
    }
    return false;
  }

  return true;
}
