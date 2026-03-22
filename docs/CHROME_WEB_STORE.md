# Chrome Web Store Submission Guide

This document contains all the information needed to publish and update WaveLink on the Chrome Web Store.

---

## Dashboard

- **Developer Dashboard**: https://chrome.google.com/webstore/devconsole
- **Extension ID**: *(fill in after first publish)*
- **Store Listing URL**: *(fill in after first publish)*

---

## Build & Package

```bash
# Build production bundle
npm run build

# Create store-ready zip (outputs wavelink-<version>.zip)
npm run package

# Regenerate icons from SVG (requires sharp)
node scripts/generate-icons.js
```

The zip includes only what Chrome needs:
- `manifest.json`
- `app/index.js` + `app/app.html`
- `popup/index.js` + `popup/popup.html`
- `background/index.js`
- `content/index.js`
- `icons/` (16, 32, 48, 128 PNG)
- `privacy.html`

Excluded from zip: `src/`, `tests/`, `.d.ts`, `.d.ts.map`, `.LICENSE.txt`

---

## Store Listing Tab

### Description

> Migrate data between Salesforce orgs with dependency ordering, ID remapping, schema comparison, data validation, and transformation pipelines — all from your browser.
>
> Features:
> - Migration Projects — Plan and execute multi-object data migrations with automatic dependency ordering and ID remapping
> - Schema Gap Analysis — Diff fields across orgs to catch mismatches before migration
> - Data Push — Upload CSV, JSON, or Excel files and push records via REST or Bulk API 2.0
> - SOQL Query Editor — Visual query builder with aggregates, GROUP BY, date literals, subqueries, syntax highlighting, and explain plans
> - Data Validation — Pre/post migration validation with quality scorecards and record count comparison
> - Pipeline Builder — Visual step-chain for data transformation during migration
> - Multi-Org Support — Connect and switch between multiple Salesforce orgs
> - Data Comparison — Compare records across orgs with colour-coded diffs and selective sync
> - Cross-Object Cloning — Clone records with dependency graph detection and ID remapping
> - Duplicate Detection — Find duplicates using exact, fuzzy, or phonetic matching
> - Audit Trail & Rollback — Full operation log with one-click undo
> - Dark mode, command palette (Ctrl+K), keyboard shortcuts
>
> All data stays on your device. No analytics, telemetry, or external servers.

### Category

**Developer Tools**

### Language

**English**

### Icon

Upload `public/icons/icon-128.png` (128x128 PNG)

### Screenshots

Upload from `screenshots/` directory. Requirements:
- 1-5 images
- Exactly 1280x800 or 640x400 pixels
- PNG or JPEG

Resize command (PowerShell):
```powershell
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile("path\to\screenshot.png")
$dst = New-Object System.Drawing.Bitmap(1280, 800)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, 0, 0, 1280, 800)
$g.Dispose(); $src.Dispose()
$dst.Save("screenshots\screenshot-01.png", [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
```

---

## Privacy Practices Tab

### Single Purpose Description

> WaveLink helps Salesforce developers and admins migrate data between Salesforce orgs, compare schemas, validate data, and manage multi-object migrations — all from the browser.

### Permission Justifications

**activeTab**
> Required to detect whether the current browser tab is a logged-in Salesforce org. WaveLink reads the tab URL and cookies to establish an authenticated API connection to the user's Salesforce instance. No data is accessed on non-Salesforce tabs.

**cookies**
> Required to read the Salesforce session ID (sid cookie) from authenticated Salesforce tabs. This token is used to make REST API calls to the user's own Salesforce org. No cookies are read from any non-Salesforce domains.

**host permissions (*.salesforce.com, *.force.com, etc.)**
> Required to make Salesforce REST API calls (SOQL queries, record CRUD, metadata describe) to the user's connected Salesforce orgs. Host permissions are restricted exclusively to Salesforce domains. No requests are made to any other hosts.

**storage**
> Required to persist user data locally on the device: connected org credentials, saved SOQL queries, query folders, push history, data templates, and UI settings. All data is stored in chrome.storage.local and never transmitted to external servers.

**tabs**
> Required to list open browser tabs to identify which ones are logged-in Salesforce orgs. This allows the user to select which Salesforce tab/org to connect to. Tab URLs are only checked against Salesforce domains.

**Remote code**
> WaveLink does not use any remote code. All JavaScript is bundled locally in the extension package. No scripts are fetched or executed from external servers.

### Data Use Certification

Check the compliance box. WaveLink:
- Stores all data locally via `chrome.storage.local`
- Only communicates with the user's own Salesforce orgs
- Collects no analytics, telemetry, or crash reports
- Has no external server or backend

---

## Version Bumping

When releasing a new version:

1. Update version in `package.json`
2. Update version in `public/manifest.json`
3. Run `npm run package`
4. Upload the new zip to the developer dashboard
5. Fill in "Changes in this version" notes

Chrome Web Store version must be higher than the previous published version.

---

## Review Process

- Review typically takes **1-3 business days**
- Common rejection reasons:
  - Insufficient permission justifications
  - Missing privacy policy
  - Requesting unnecessary permissions
  - Inline code / remote code violations
- WaveLink has none of these issues

---

## Privacy Policy

Bundled at `public/privacy.html` and included in the extension package.

Covers:
- All data stored locally, none transmitted to external servers
- Permission justifications for each Chrome permission
- OAuth token handling
- Data deletion instructions
- Contact information (GitHub issues)

---

## Assets & Icons

| File | Size | Purpose |
|------|------|---------|
| `public/icons/icon-16.png` | 16x16 | Toolbar |
| `public/icons/icon-32.png` | 32x32 | Taskbar |
| `public/icons/icon-48.png` | 48x48 | Extensions page |
| `public/icons/icon-128.png` | 128x128 | Store listing + install dialog |
| `public/icons/wavelink-icon.svg` | Vector | Source SVG for regeneration |
| `screenshots/screenshot-01.png` | 1280x800 | Store listing screenshot |

To regenerate icons: `node scripts/generate-icons.js`

---

## Links

- **Source Code**: https://github.com/jc-wave/wave-link
- **Privacy Policy**: Bundled in extension (`privacy.html`)
- **Bug Reports**: https://github.com/jc-wave/wave-link/issues
- **Homepage**: https://github.com/jc-wave/wave-link
