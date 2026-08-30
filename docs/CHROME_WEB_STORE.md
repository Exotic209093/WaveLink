# Chrome Web Store release kit

This file is the source of truth for the WaveLink 0.6.0 listing and privacy declarations. Copy text exactly unless the Chrome Web Store dashboard requires a shorter value.

## Dashboard and public links

- Developer dashboard: https://chrome.google.com/webstore/devconsole
- Extension ID: `ccknhhibbedolfnbgnenomdohlmojblo`
- Store listing: https://chromewebstore.google.com/detail/wavelink/ccknhhibbedolfnbgnenomdohlmojblo
- Homepage/source: https://github.com/Exotic209093/WaveLink
- Privacy policy: https://github.com/Exotic209093/WaveLink/blob/main/PRIVACY.md
- Support: https://github.com/Exotic209093/WaveLink/issues

## Package

```powershell
npm run assets:store
npm run package
```

Upload `wavelink-0.6.0.zip`. The package contains the compiled Manifest V3 extension, icons, and bundled privacy page; it excludes source, tests, and build-only files.

## Store listing

### Product name

> WaveLink — Salesforce Data Export & Import

The product name comes from `public/manifest.json` and is 42 characters.

### Summary

> Safely export, import, compare, schedule, and repeat Salesforce data jobs—directly from your browser.

The summary comes from `public/manifest.json` and is 101 characters, below Chrome's 132-character limit.

### Detailed description

> Move data in and out of your org with confidence.
>
> WaveLink is a local-first data workspace for administrators, developers, and consultants. Query and export records, validate imports before they run, compare snapshots, schedule recurring exports, and replay saved jobs—all without sending customer data to a WaveLink server.
>
> WHAT YOU CAN DO
>
> • Export with SOQL through REST or Bulk API 2.0
> • Download CSV, JSON, Excel, or XML with only the columns you choose
> • Import CSV, JSON, and XLSX through a guided mapping and validation flow
> • Preview impact with dry runs, production warnings, and typed confirmation
> • Retry failed rows, download results, and undo supported inserts
> • Save reusable jobs and schedule local snapshots
> • Compare files, snapshots, or connected orgs
> • Copy a reviewed single-object dataset between connected orgs
> • Inspect objects, records, API usage, and schemas in Advanced tools
>
> BUILT FOR SAFER DATA WORK
>
> The target org, environment, operation, and record count remain visible before a write. Bulk jobs keep resumable checkpoints, and unified activity history makes results and eligible recovery actions easy to find.
>
> LOCAL-FIRST PRIVACY
>
> WaveLink has no analytics, telemetry, advertising, or developer-operated backend. Data is stored in your browser and exchanged only with Salesforce domains selected by you. Uploaded records, query results, snapshots, job history, account details, and authentication information are handled only to provide the features you request. See the privacy policy for complete handling and deletion details.
>
> Requires an active Salesforce browser session. WaveLink is independent and is not affiliated with or endorsed by Salesforce, Inc.

### Category and language

- Category: **Developer Tools**
- Language: **English**

### Release notes

> WaveLink 0.6.0 is a major workflow, safety, and reliability update:
>
> • New task-first interface and seven-stage Guided Import
> • Unified Saved Jobs, Schedules, Snapshots, and Activity
> • Bulk API 2.0 query support and resumable job checkpoints
> • CSV, JSON, Excel, and XML exports with selected-column support
> • Production typed confirmation and clearer org context
> • Improved accessibility, performance budgets, and package security
> • A focused, single-object Copy flow replaces the former migration suite

If no release-notes field is shown, keep this text for the submission notes rather than appending it to the permanent description.

## Visual assets

Upload in this order:

| Order | File | Dimensions | Purpose |
|---:|---|---:|---|
| Icon | `public/icons/icon-128.png` | 128×128 | Store and install icon |
| 1 | `screenshots/screenshot-01-home.png` | 1280×800 | Connected Home workspace |
| 2 | `screenshots/screenshot-02-export.png` | 1280×800 | SOQL export and results |
| 3 | `screenshots/screenshot-03-import-review.png` | 1280×800 | Production-aware import review |
| 4 | `screenshots/screenshot-04-compare.png` | 1280×800 | Compare workspace |
| 5 | `screenshots/screenshot-05-activity.png` | 1280×800 | Jobs and activity history |
| Small promo | `screenshots/promo-small-440x280.png` | 440×280 | Required promotional tile |
| Marquee promo | `screenshots/promo-marquee-1400x560.png` | 1400×560 | Optional large promotional tile |

All screenshots are captures of v0.6.0 at the required dimensions. Organisation, user, and record identifiers are redacted. Regenerate promotional graphics with `npm run assets:store`.

## Privacy practices

### Single purpose

> WaveLink provides a local-first workspace for authenticated Salesforce users to export, import, compare, schedule, and repeat data jobs against organisations they explicitly select.

### Permission justifications

**storage**

> Saves selected Salesforce org connections and authentication information, queries, mappings, reusable jobs, schedules, snapshots, results, activity history, checkpoints, undo information, and preferences in Chrome extension storage. This keeps the workspace available across extension sessions without a WaveLink backend.

**cookies**

> Reads the Salesforce `sid` session cookie from supported Salesforce domains so the user can connect an already authenticated org and make requested API calls. WaveLink does not read cookies from unrelated domains.

**activeTab**

> Identifies the Salesforce context in the tab where the user invokes WaveLink. It is not used to inspect unrelated page content.

**tabs**

> Finds open Salesforce tabs, lets the user select which authenticated org to connect, and opens the full extension workspace. Tab URLs are checked only to recognise supported Salesforce domains; WaveLink does not build a browsing history.

**alarms**

> Wakes the Manifest V3 background worker to run export schedules that the user explicitly created and to update their local status.

**offscreen**

> Creates a local extension document for eligible long-running job and file-processing work when no visible extension page is available. It is not used for hidden browsing, advertising, analytics, or tracking.

**Host permissions**

> Allow the Salesforce page integration and authenticated REST, Bulk API 2.0, and metadata requests on supported Salesforce domains only: `*.salesforce.com`, `*.force.com`, `*.lightning.force.com`, `*.my.salesforce.com`, `login.salesforce.com`, and `test.salesforce.com`. No other network hosts are permitted by the manifest.

### Remote code

Select **No, I am not using remote code**.

> WaveLink does not download or execute remote code. All executable JavaScript is bundled in the submitted extension package. Network requests exchange data with Salesforce APIs but do not retrieve executable code.

### Data categories

Disclose the following categories because Chrome considers locally processed information to be collected:

- **Personally identifiable information:** Salesforce username, display name, organisation/account identifiers, and instance details.
- **Authentication information:** Salesforce session cookies and access tokens.
- **Website content:** Salesforce records, query results, object metadata, and API results requested by the user.
- **User-generated content:** uploaded data files, saved queries, mappings, job definitions, schedules, and snapshots.
- **Web history / browsing activity:** only the URLs of open tabs checked to locate supported Salesforce pages; no browsing profile or history is retained.

Do not select financial information, health information, personal communications, location, or unrelated categories unless the dashboard groups Salesforce record content into one of them and the extension is being marketed for that specific use.

For each disclosed category, select the product-functionality purpose only. The information is not used for advertising, analytics, personalisation outside WaveLink, creditworthiness, or unrelated purposes.

### Limited-use certifications

Certify that:

- Data is not sold or transferred to third parties outside the approved use case.
- Data is not used or transferred for purposes unrelated to WaveLink's single purpose.
- Data is not used or transferred to determine creditworthiness or for lending.
- Humans do not read the data; there is no developer-operated backend through which the developer can access it.
- All collection and transfer is prominently disclosed in the listing and privacy policy.

### Privacy policy URL

Use:

> https://github.com/Exotic209093/WaveLink/blob/main/PRIVACY.md

The repository must be pushed before saving this URL so reviewers can reach the current policy without installing the extension.

## Final submission checklist

- [ ] Push the v0.6.0 code and public privacy policy to `main`.
- [ ] Confirm the privacy-policy URL loads while signed out of GitHub.
- [ ] Upload `wavelink-0.6.0.zip` and confirm version 0.6.0 is detected.
- [ ] Replace the description with the text in this file.
- [ ] Upload all five screenshots in the documented order.
- [ ] Upload the icon and promotional tiles.
- [ ] Verify category, language, homepage, support URL, and privacy URL.
- [ ] Reconfirm every permission and data-use declaration against the uploaded package.
- [ ] Add the v0.6.0 release notes where the dashboard permits.
- [ ] Preview the public listing at desktop width and check every image crop.
- [ ] Save the draft, review the dashboard's warnings, and submit only after a final joint check.
