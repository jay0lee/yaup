# YAUP - Your Acceptable Use Policy

[![Build and Publish YAUP](https://github.com/jay0lee/yaup/actions/workflows/publish.yaml/badge.svg)](https://github.com/jay0lee/yaup/actions/workflows/publish.yaml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**YAUP** (*Your Acceptable Use Policy*) is an enterprise Chrome extension (Manifest V3) that presents an organization's Acceptable Use Policy to users and enforces signed agreement before allowing them to browse.

YAUP is engineered for seamless deployment via Google Chrome Enterprise cloud policy across managed devices and managed BYOD profiles.

---

## Key Capabilities

- **Enforced Browsing Protection**: Intercepts web navigation and presents the organization's AUP. Access is blocked until the policy is affirmatively signed.
- **Affirmative Consent & Drawn Initials**: Requires checking an agreement box and drawing initials on a canvas pad with touch, stylus, or mouse.
- **Ultra-Compact Low-Res Monochrome Signature**: Thresholds and compresses drawn initials into a crisp 1-bit black-and-white PNG (~1–3 KB) to minimize storage and webhook bandwidth.
- **AUP Version Tracking & Re-signing**: Administrators can increment `aupVersion` (e.g. `1.0` &rarr; `1.1`). Any user who signed an older version is immediately required to review and re-sign upon their next session.
- **Signature Expiration**: Configure signature validity in days (e.g. `30`, `90`, `365`, or `0` for never). Expired agreements automatically trigger a re-signing prompt.
- **Flexible Trigger Scopes**:
  - **All Internet Access**: Blocks all external web browsing until accepted.
  - **Pattern Matching**: Enforces policy only when navigating to specific internal or corporate domains (e.g. `*://*.corp/*`, `*://internal.*/*`).
- **Whitelisting**: Exempts critical identity providers (e.g., Google Workspace SSO, Okta, Microsoft Entra), company help desks, and the webhook submission endpoint.
- **User Identity Capture**: Automatically queries `chrome.identity` to bind the agreement to the user's managed Google Workspace email.
- **Webhook Dispatch**: POSTs the full agreement record (user identity, timestamp, policy version, and signature image) to an admin-configured webhook.
- **Sideload Policy Builder**: Administrators can sideload the extension unmanaged in Developer Mode to access an interactive policy editor, test webhooks, and export a ready-to-upload `yaup-policy.json`.
- **Automated Enterprise CI/CD**: Based on [jay0lee/chrome-extension-dev-template](https://github.com/jay0lee/chrome-extension-dev-template), GitHub Actions automatically packs the extension (`.crx`), updates `update.xml`, and hosts it on GitHub Pages for instant rollout without Chrome Web Store review delays.

---

## Architecture & How It Works

```
                                Admin Workflow
  ┌────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
  │ Sideload YAUP          │ ───> │ Configure Policy,       │ ───> │ Export Policy JSON &    │
  │ Unmanaged (Developer)  │      │ Triggers & Expiration   │      │ Upload to Google Admin  │
  └────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘

                                User Experience
  ┌────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
  │ User navigates to web  │ ───> │ Service Worker checks   │ ───> │ Intercepted & redirected│
  │ or corporate intranet  │      │ valid & unexpired sign  │      │ to aup.html if unsigned │
  └────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
                                                                                │
                                                                                ▼
  ┌────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
  │ Redirected to original │ <─── │ POST payload & B/W      │ <─── │ User reviews Markdown,  │
  │ destination URL        │      │ initials to Webhook     │      │ checks box & draws sign │
  └────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

---

## Setup & Deployment Guide

### 1. Generate Extension Signing Key

Generate an RSA private key used to sign your `.crx` package:

```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
```

> [!IMPORTANT]
> **Keep `key.pem` secure and backed up!** The extension's unique Chrome Extension ID is derived directly from this key. If the key is lost, future updates cannot be delivered to managed browsers.

### 2. Determine Your Extension ID

Run the included helper script to obtain your 32-character extension ID:

```bash
./get-extension-id.sh key.pem
# Example output: ejmndkmhhfoggmodjgdeahkmfkeffknj
```

### 3. Configure GitHub Secrets & GitHub Pages

1. In your GitHub repository (`jay0lee/yaup`), navigate to **Settings > Secrets and variables > Actions**.
2. Create a new repository secret named `EXTENSION_KEY` and paste the full contents of `key.pem`.
3. In repository **Settings > Pages**, set the Source to **Deploy from a branch** and select branch `main` with folder `/ (root)`.
4. Ensure GitHub Actions write permissions: navigate to **Settings > Actions > General > Workflow permissions** and select **Read and write permissions**.

### 4. Build and Publish

Push a commit to `main` (or run **Workflow dispatch** under the Actions tab). The workflow will:
1. Bump the extension version timestamp.
2. Sign and package `hosted/extension.crx`.
3. Generate `hosted/update.xml` pointing to `https://jay0lee.github.io/yaup/hosted/extension.crx`.
4. Publish the build to GitHub Pages.

---

## Admin Policy Configuration (Sideload Mode)

1. Open Chrome and go to `chrome://extensions`.
2. Toggle on **Developer mode** in the top right.
3. Click **Load unpacked** and select the `extension/` directory.
4. Click the YAUP extension icon or open its Options page to open the **YAUP Policy Builder & Admin Console**.
5. Customize:
   - **Organization Name & Logo**: Your company branding.
   - **Policy Version**: Current version (e.g. `1.0`). Use the `+ Increment` button when policy updates require users to re-sign.
   - **Signature Expiration**: Number of days before the signature expires (`0` = never expires).
   - **AUP Text**: Write your policy using the built-in Markdown editor with live preview.
   - **Trigger Scope**: Select *Any Internet Browsing* or *Specific URL Patterns Only* (e.g., `*://*.corp/*`).
   - **Whitelisted URLs**: Add identity provider domains (e.g., `https://accounts.google.com/*`, `https://*.okta.com/*`).
   - **Webhook URL & Auth**: Set your HTTPS endpoint to receive signed agreement events. Click **Send Test Webhook Ping** to verify receipt.
6. Switch to the **5. Deploy to Google Admin** tab and click **Download yaup-policy.json** (or **Copy JSON**).

---

## Force-Installing in Google Admin Console

1. Log in to [admin.google.com](https://admin.google.com).
2. Go to **Devices > Chrome > Apps & extensions > Users & browsers**.
3. Select the organizational unit (OU) you wish to target.
4. Click the yellow **+** button in the bottom right and select **Add Chrome app or extension by ID**.
5. Select **From a custom URL**:
   - **Extension ID**: Enter your 32-character extension ID from Step 2.
   - **URL**: `https://jay0lee.github.io/yaup/hosted/update.xml`
6. Click **Save**.
7. In the policy dropdown, change from *Allow install* to **Force install**.
8. In the right-hand panel under **Policy for extensions**, paste the contents of `yaup-policy.json` (or upload the file).
9. Click **Save** in the top bar.

Chrome will automatically force-install YAUP on all managed browsers and profiles, load the managed policy, and begin enforcing the AUP.

---

## Webhook Agreement Payload

When a user signs the AUP, a `POST` request with `Content-Type: application/json` is sent to the configured `webhookUrl`:

```json
{
  "event": "aup_agreement",
  "timestamp": "2026-09-29T13:42:00.000Z",
  "user": {
    "email": "alex.user@organization.com",
    "directoryId": "108392019283746"
  },
  "policy": {
    "version": "1.0",
    "title": "Corporate Acceptable Use Policy",
    "organization": "Acme Corporation"
  },
  "signature": {
    "type": "initials_drawing",
    "format": "image/png;base64",
    "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAB4CAYAAAB1ovlvAAA...",
    "width": 160,
    "height": 60,
    "approxBytes": 1420
  },
  "client": {
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
    "platform": "MacIntel",
    "extensionVersion": "2026.0929.1342.00"
  },
  "targetUrl": "https://intranet.corp.acme.com/dashboard"
}
```

---

## Policy Configuration Reference

| Parameter | Type | Default | Description |
|:---|:---|:---|:---|
| `aupVersion` | String | `"1.0"` | Policy version string. Incrementing this invalidates existing agreements and requires all users to re-sign. |
| `expirationDays` | Integer | `0` | Days until an agreement expires. `0` = never expires (valid until version bump). |
| `policyTitle` | String | `"Acceptable Use Policy"` | Display title of the policy. |
| `organizationName` | String | `"Your Organization"` | Organization name displayed in header and legal notices. |
| `logoUrl` | String | `""` | Direct HTTPS URL or base64 image data URI for the organization logo. |
| `policyMarkdown` | String | *Default Policy* | The full policy text supporting Markdown (headers, lists, bold, links, quotes). |
| `triggerScope` | Enum | `"all"` | `"all"` intercepts all web browsing; `"pattern"` only intercepts matching URLs. |
| `triggerPatterns` | Array | `["*://*.corp/*", ...]` | URL match patterns when `triggerScope` is `"pattern"`. |
| `whitelistPatterns` | Array | `["https://accounts.google.com/*", ...]` | URLs exempt from interception (e.g. SSO endpoints). |
| `requireInitials` | Boolean | `true` | Requires drawing initials on canvas before agreeing. |
| `requireScrollToBottom` | Boolean | `true` | Requires user to scroll through the full text of the policy before unlocking agreement. |
| `webhookUrl` | String | `""` | HTTPS endpoint where agreement records are POSTed. |
| `webhookAuthHeader` | String | `""` | Optional authorization header value (e.g., `Bearer <token>`). |

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
