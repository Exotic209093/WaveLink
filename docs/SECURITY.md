# WaveLink — Security

> Version 0.1.0 · Last reviewed: 2026-03-21

---

## Table of Contents

1. [Security Model Summary](#1-security-model-summary)
2. [What Data WaveLink Accesses](#2-what-data-wavelink-accesses)
3. [Where Data Is Stored](#3-where-data-is-stored)
4. [Authentication & Session Handling](#4-authentication--session-handling)
5. [Network Communications](#5-network-communications)
6. [Chrome Permissions Justification](#6-chrome-permissions-justification)
7. [Threat Model](#7-threat-model)
8. [Safe Configuration Guidance](#8-safe-configuration-guidance)
9. [Production Org Safety Features](#9-production-org-safety-features)
10. [Known Limitations](#10-known-limitations)
11. [Third-Party Dependencies](#11-third-party-dependencies)
12. [Responsible Disclosure](#12-responsible-disclosure)

---

## 1. Security Model Summary

| Property | Status |
|----------|--------|
| Data sent to third-party servers | **Never** |
| Data sent outside your Salesforce org | **Never** |
| Credentials stored in plaintext | **No** — tokens are stored in `chrome.storage.local` (Chrome's encrypted profile store) |
| OAuth connected app required | **No** — uses existing browser session |
| Network requests outside Salesforce domains | **None** |
| Content Security Policy | Strict (`script-src 'self'; object-src 'self'`) |
| Manifest V3 | **Yes** — no persistent background page, no remote code loading |

---

## 2. What Data WaveLink Accesses

### Salesforce Data

WaveLink accesses whatever your logged-in Salesforce user account can access. It makes API calls on your behalf using your session token. It does **not** escalate privileges beyond your Salesforce user's permissions.

Specifically, WaveLink can:

- Read and write SObject records via the REST API
- Read SObject metadata (field names, types, relationships)
- Read Salesforce governor limits
- Submit and monitor Bulk API 2.0 jobs
- Read debug logs and metadata via the Tooling API (if your user has access)

### Browser Data

WaveLink reads:

- The `sid` session cookie for `*.salesforce.com` and `*.force.com` domains
- The current tab's URL to detect the org instance URL
- The active tab's DOM (content script) to extract org ID from Salesforce page headers

WaveLink does **not** read cookies or DOM from any non-Salesforce site.

---

## 3. Where Data Is Stored

All WaveLink data is stored in **`chrome.storage.local`**:

- Scoped to your Chrome profile on this device
- Encrypted at rest by Chrome/OS using your OS user account key
- **Never** synced to Chrome Sync (WaveLink does not request the `storage` sync permission quota)
- Never written to disk by WaveLink directly (Chrome manages the storage file)

### Data stored

| Data | Location | Sensitive? | Notes |
|------|----------|-----------|-------|
| Salesforce session token (`sid`) | `chrome.storage.local → wl_orgs[].accessToken` | **Yes** | Equivalent to being logged in; cleared on org removal |
| Org metadata (ID, instance URL, label) | `chrome.storage.local → wl_orgs` | Low | No credentials |
| Saved SOQL queries | `chrome.storage.local → wl_queries` | Low | Query text only; no result data |
| Push history | `chrome.storage.local → wl_history` | Medium | Includes record counts and error messages, no record payloads |
| Undo transactions | `chrome.storage.local → wl_undo_txns` | **High** | Contains actual Salesforce record IDs for rollback |
| Data templates | `chrome.storage.local → wl_templates` | Low | Field mapping config only |
| Schema cache | `chrome.storage.local → wl_schema_cache` | Low | Public field metadata |
| User settings | `chrome.storage.local → wl_settings` | None | Theme, shortcuts, etc. |

### Undo Transaction Data

Undo transactions store Salesforce **record IDs** (18-char Salesforce IDs) for inserted records. They do **not** store full record payloads. These expire after 1 hour (configurable) and are capped at 10 entries. You can clear them at any time from **Settings → Clear Undo History**.

---

## 4. Authentication & Session Handling

WaveLink uses **session-cookie extraction** rather than OAuth:

1. When you open a Salesforce org in Chrome, Salesforce sets a `sid` cookie for that domain
2. WaveLink reads this cookie via `chrome.cookies.get` — the same value the Salesforce UI uses for its own API calls
3. The token is stored in `chrome.storage.local` associated with the org ID
4. WaveLink checks token validity before each push and refreshes if within 5 minutes of expiry

### Token Security

- Tokens are never logged to the console or written to any file
- Tokens are never included in error reports
- Tokens are scoped to `chrome.storage.local` — other browser extensions cannot read WaveLink's storage unless granted explicit access
- Removing an org from WaveLink's org list clears its token from storage

### Multi-Org Safety

Each org's session is isolated. Switching orgs does not mix sessions. API calls always use the token for the currently selected org.

---

## 5. Network Communications

WaveLink only communicates with:

```
https://*.salesforce.com
https://*.force.com
https://*.lightning.force.com
https://*.my.salesforce.com
https://login.salesforce.com
https://test.salesforce.com
```

These domains are declared in `host_permissions` in `manifest.json`. Chrome's extension sandbox enforces this — WaveLink **cannot** make requests to any other host.

No analytics, telemetry, crash reporting, or update checks are sent to any external server.

---

## 6. Chrome Permissions Justification

| Permission | Why It's Needed |
|-----------|----------------|
| `storage` | Persists org sessions, queries, templates, history, and settings in `chrome.storage.local` |
| `cookies` | Reads the Salesforce `sid` session cookie to authenticate API calls without requiring OAuth setup |
| `activeTab` | Reads the current tab's URL to detect which Salesforce org is open |
| `tabs` | Lists open Salesforce tabs so the popup can show available orgs and the full app can pin to a specific tab |
| `host_permissions: *.salesforce.com/*` etc. | Required to read cookies and inject the content script into Salesforce pages |

WaveLink does **not** request: `<all_urls>`, `webRequest`, `declarativeNetRequest`, `history`, `bookmarks`, `downloads`, `geolocation`, `notifications`, `identity`, `management`, or any other sensitive permission.

---

## 7. Threat Model

### In scope

| Threat | Mitigation |
|--------|-----------|
| Session token theft by malicious extension | Each extension's `chrome.storage.local` is isolated by Chrome. Malicious extensions cannot read WaveLink's storage without special permissions. |
| XSS via Salesforce record data displayed in WaveLink UI | Preact escapes all dynamic content by default. WaveLink does not use `dangerouslySetInnerHTML` or `innerHTML` with untrusted data. |
| Push to wrong org (prod vs sandbox confusion) | Production orgs show a red **PROD** badge. Delete operations require typing a confirmation phrase. The org switcher shows all connected orgs clearly. |
| Accidental bulk delete | Delete operations require type-to-confirm. Production orgs show an additional warning modal. Undo captures insert rollback IDs. |
| Stale session token used after logout | Tokens are validated before each push. 401 responses trigger a re-authentication prompt. |
| Schema cache poisoning | Cache entries include a `fetchedAt` timestamp and are invalidated after the TTL. Cache can be manually cleared. |
| Content Security Policy bypass | MV3 CSP: `script-src 'self'; object-src 'self'`. No `eval()`, no remote scripts, no inline event handlers. |

### Out of scope

- **Salesforce platform security**: WaveLink operates within your org's existing permission model. It cannot bypass Salesforce object-level security, field-level security, or sharing rules.
- **Chrome browser vulnerabilities**: WaveLink relies on Chrome's extension sandbox. Vulnerabilities in Chrome itself are out of scope.
- **Network-level attacks**: WaveLink uses HTTPS exclusively. Man-in-the-middle attacks on TLS are out of scope.
- **Physical access to device**: If an attacker has physical access to your unlocked computer, they could read `chrome.storage.local` directly.

---

## 8. Safe Configuration Guidance

### General

- **Only connect orgs you intend to modify.** Removing an org from the org list clears its stored token.
- **Use the Side Panel on production** rather than bulk operations. Reserve bulk push for sandboxes during development.
- **Enable the API Usage Dashboard** to monitor API consumption and avoid hitting governor limits.

### Production Orgs

- WaveLink displays a red **PROD** badge on production orgs to prevent accidental pushes.
- Consider using a **dedicated Integration User** with minimal permissions for pushes rather than your admin account. WaveLink respects all Salesforce FLS and OLS settings.
- Set `chrome.storage.local` to auto-clear via browser policies if operating in a shared workstation environment.

### Undo Data

- Undo data contains record IDs of inserted records. These expire after 1 hour but can be cleared earlier from **Settings → Security → Clear Undo History**.
- Do not share your Chrome profile or user account with others if you regularly push sensitive data.

### Schema Cache

- The schema cache stores object and field metadata. This is not sensitive (field names/types are the same as visible in Salesforce Setup), but you can clear it at any time from **Settings → Schema → Clear Schema Cache**.

---

## 9. Production Org Safety Features

| Feature | How It Works |
|---------|-------------|
| **PROD badge** | Red badge on all production orgs in the org switcher and push header |
| **Delete confirmation** | Must type the object name to confirm any delete operation |
| **Production delete warning** | Extra warning modal appears before deleting from a production org |
| **API limit monitoring** | API Usage Dashboard shows current consumption vs. limits |
| **Push dry run** (roadmap) | Simulate a push without committing — planned for a future release |
| **Push approval workflow** (roadmap) | Require second confirmation above a record count threshold — planned |

---

## 10. Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| Session tokens stored in `chrome.storage.local` | Token is accessible to other extensions that share the Chrome profile if they use `storage` permission cross-extension APIs (non-default) | Use a dedicated Chrome profile for WaveLink |
| Undo only covers insert operations | Update and delete operations cannot be automatically rolled back | Take a backup before bulk updates/deletes |
| Max 10 MB file import | Larger files cannot be imported | Split files before import; streaming support is on the roadmap |
| Chrome MV3 service worker lifecycle | The background worker can be terminated by Chrome; long Bulk API polls resume on relaunch but can miss intermediate status updates | Progress is re-fetched from the Bulk API job status endpoint on relaunch |
| No audit log | WaveLink does not currently maintain a tamper-evident audit trail | An audit trail feature is planned in Phase 7 of the roadmap |

---

## 11. Third-Party Dependencies

All dependencies are open source with permissive licenses.

| Package | Version | License | Used For |
|---------|---------|---------|---------|
| `preact` | ^10.27.0 | MIT | UI framework |
| `papaparse` | ^5.5.2 | MIT | CSV parsing |
| `xlsx` | ^0.18.5 | Apache 2.0 | Excel import/export |
| `typescript` | ^5.5.0 | Apache 2.0 | Language (dev only) |
| `webpack` | ^5.93.0 | MIT | Bundler (dev only) |
| `jest` | ^29.7.0 | MIT | Testing (dev only) |
| `eslint` | ^8.57.0 | MIT | Linting (dev only) |

No runtime dependencies call external servers. All dependencies are bundled into the extension at build time.

### SheetJS (xlsx) License Note

SheetJS `xlsx` version 0.18.x is distributed under the Apache 2.0 license. Versions 0.19.x and later changed to a dual commercial/community license. WaveLink pins to 0.18.5 to remain on the Apache 2.0 license. Review SheetJS licensing before upgrading.

---

## 12. Responsible Disclosure

If you discover a security vulnerability in WaveLink, please report it by:

1. Opening a **private** security advisory on GitHub: [Security Advisories](https://github.com/jc-wave/wave-link/security/advisories)
2. Or open an issue tagged **security** on the GitHub repository

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix if known

We aim to acknowledge reports within 48 hours and provide a fix within 30 days for confirmed issues.
