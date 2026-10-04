# Chrome Web Store release kit

This file is the source of truth for the WaveLink 0.7.0 listing and privacy declarations. Copy text exactly unless the Chrome Web Store dashboard requires a shorter value.

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

Upload `wavelink-0.7.0.zip`. The package contains the compiled Manifest V3 extension, icons, and bundled privacy page; it excludes source, tests, and build-only files.

## Store listing

### Product name

> WaveLink — Salesforce SOQL Export & Data Import Tool

The product name comes from `public/manifest.json` and is 52 characters (limit 75).

### Summary

> Export Salesforce data with SOQL to CSV, Excel, JSON or XML right in Chrome. No Java, no install, no server. Free and open source.

The summary comes from `public/manifest.json` and is 130 characters, below Chrome's 132-character limit.

### Detailed description

> Get Salesforce data out in seconds — straight from the browser tab you're already logged into.
>
> WaveLink is a free, open-source data workspace for Salesforce admins, developers, and consultants. Write or build a SOQL query, preview the records, pick your columns, and download CSV, Excel, JSON, or XML. No Java runtime, no desktop Data Loader install, no third-party server holding your data.
>
> EXPORT
>
> • SOQL editor with autocomplete, plus a visual query builder for fields, filters, GROUP BY, and aggregates
> • REST for quick queries, Bulk API 2.0 for large objects — with progress and cancel
> • CSV, Excel (XLSX), JSON, or XML with only the columns you choose
> • Save queries as reusable jobs and re-run them in one click
>
> SNAPSHOTS AND COMPARE
>
> • Schedule recurring local snapshots of key objects
> • Compare two files, two snapshots, or two connected orgs field-by-field
>
> IMPORT
>
> • Guided CSV, JSON, and Excel import with field mapping, validation, and dry runs
> • Production warnings and typed confirmation before writes
>
> ADVANCED
>
> • Record Inspector, object and field browser, REST/Tooling API explorer, anonymous Apex, and API usage
>
> PRIVATE BY DESIGN
>
> WaveLink has no analytics, telemetry, advertising, or WaveLink backend. Your records stay in your browser and are exchanged only with the Salesforce orgs you select. Source code: https://github.com/Exotic209093/WaveLink
>
> Uses your existing Salesforce browser session. WaveLink is independent and is not affiliated with or endorsed by Salesforce, Inc.

### Localised listing

Add **Español** in the dashboard with the Spanish summary and description in
[`launch-kit.md`](launch-kit.md#spanish-listing-store-listing--add-language--español).

### Category and language

- Category: **Developer Tools**
- Language: **English**

### Release notes

> WaveLink 0.7.0 is the "data you can trust" release — every known data-corruption, automation, and security defect from the August audit is fixed:
>
> • Imports push exactly the file and rows you reviewed; retry and error files target the right rows
> • Bulk imports keep every column, clear fields correctly, and report per-row results
> • Production typed confirmation on every write route; relationship lookups validate
> • Undo, Copy between orgs, and Compare sync work correctly (no duplicates)
> • Schedules survive browser restarts and fire on time in your time zone
> • Session tokens no longer stored at rest; exports neutralise spreadsheet formulas
> • Exports keep every column, non-ASCII text, and REST-consistent value types

If no release-notes field is shown, keep this text for the submission notes rather than appending it to the permanent description.

## Visual assets

Upload in this order:

| Order | File | Dimensions | Purpose |
|---:|---|---:|---|
| Icon | `public/icons/icon-128.png` | 128×128 | Store and install icon |
| 1 | `screenshots/screenshot-02-export.png` | 1280×800 | SOQL export and results |
| 2 | `screenshots/screenshot-01-home.png` | 1280×800 | Connected Home workspace |
| 3 | `screenshots/screenshot-04-compare.png` | 1280×800 | Compare workspace |
| 4 | `screenshots/screenshot-05-activity.png` | 1280×800 | Jobs and activity history |
| 5 | `screenshots/screenshot-03-import-review.png` | 1280×800 | Production-aware import review |
| Small promo | `screenshots/promo-small-440x280.png` | 440×280 | Required promotional tile |
| Marquee promo | `screenshots/promo-marquee-1400x560.png` | 1400×560 | Optional large promotional tile |

All screenshots are captures of v0.6.0 at the required dimensions; the 0.7.0 changes are fixes with no visible layout change on these screens. Organisation, user, and record identifiers are redacted. Regenerate promotional graphics with `npm run assets:store`.

## Privacy practices

### Single purpose

> WaveLink provides a local-first workspace for authenticated Salesforce users to export, import, compare, schedule, and repeat data jobs against organisations they explicitly select.

### Permission justifications

**storage**

> Saves selected Salesforce org connections (without access tokens, which are kept only in memory-backed session storage), queries, mappings, reusable jobs, schedules, snapshots, results, activity history, checkpoints, undo information, and preferences in Chrome extension storage. This keeps the workspace available across extension sessions without a WaveLink backend.

**cookies**

> Reads the Salesforce `sid` session cookie from supported Salesforce domains so the user can connect an already authenticated org and make requested API calls. WaveLink does not read cookies from unrelated domains.

**unlimitedStorage**

> Lets locally retained snapshots, job checkpoints, and result files exceed Chrome's default 10 MB extension-storage quota so scheduled snapshots and large jobs are not silently truncated. All of this data stays on the user's device and can be purged from Settings.

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

- [ ] Push the v0.7.0 code and public privacy policy to `main`.
- [ ] Confirm the privacy-policy URL loads while signed out of GitHub.
- [ ] Upload `wavelink-0.7.0.zip` and confirm version 0.7.0 is detected.
- [ ] Replace the description with the text in this file.
- [ ] Upload all five screenshots in the documented order.
- [ ] Upload the icon and promotional tiles.
- [ ] Verify category, language, homepage, support URL, and privacy URL.
- [ ] Reconfirm every permission and data-use declaration against the uploaded package.
- [ ] Add the v0.7.0 release notes where the dashboard permits.
- [ ] Preview the public listing at desktop width and check every image crop.
- [ ] Save the draft, review the dashboard's warnings, and submit only after a final joint check.
