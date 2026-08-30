# WaveLink Privacy Policy

Effective date: 31 August 2026  
Last updated: 31 August 2026

**In short:** WaveLink is local-first. It has no advertising, analytics, telemetry, or developer-operated backend. Information is kept in your browser and sent only to Salesforce domains you explicitly use, as needed to perform the data work you request.

WaveLink ("the Extension") helps authenticated Salesforce users export, import, compare, schedule, and repeat data jobs against organisations they select. This policy explains the information WaveLink handles, why it is needed, where it goes, and how you can delete it.

## 1. Information WaveLink handles

Depending on the features you use, WaveLink processes and may retain the following information locally on your device:

- **Account and organisation details:** Salesforce organisation IDs, instance URLs, usernames, display names, and environment type.
- **Authentication information:** Salesforce session identifiers or access tokens needed to authenticate API requests.
- **Salesforce content and metadata:** object and field schemas, query results, records selected for import or comparison, result files, record IDs, and operation errors.
- **User-provided content:** uploaded CSV, JSON, or XLSX data; saved SOQL queries; mappings; reusable job definitions; and schedule settings.
- **Operational history:** job status, timestamps, file names, record counts, checkpoints, snapshots, and supported undo information.
- **Salesforce tab information:** URLs of open tabs are checked only to identify Salesforce tabs and let you choose an organisation. WaveLink does not build a browsing history.
- **Preferences:** theme, layout, onboarding state, and other Extension settings.

## 2. How the information is used

WaveLink uses this information only to provide its user-facing data workflow features:

- Authenticate requests to an organisation you selected.
- Query, export, validate, import, compare, or inspect Salesforce records and metadata at your direction.
- Run schedules you created and recover eligible long-running jobs after Chrome suspends the background worker.
- Display connected organisations, saved jobs, snapshots, results, activity, and preferences in the Extension.

## 3. Storage and transfers

WaveLink stores its working data in Chrome extension storage on your device. Some authentication information is also held in Chrome session storage while the browser session is active. This information is not synced through Chrome Sync.

When you request an operation, the necessary authentication information, Salesforce content, metadata, or uploaded records are transmitted over HTTPS directly between the Extension and the Salesforce domains listed in its manifest. WaveLink does not send this information to a WaveLink server or any advertising, analytics, or data-broker service.

## 4. Limited use and sharing

- WaveLink does not sell personal information or user data.
- WaveLink does not use or transfer information for advertising, profiling, creditworthiness, lending, or purposes unrelated to its single purpose.
- WaveLink does not allow humans to read your data. It has no developer-operated backend through which the developer could access it.
- WaveLink shares information only with the Salesforce organisation you explicitly select and only to complete the action you request.

## 5. Chrome permission explanations

- **storage:** saves organisation connections, tokens, queries, mappings, jobs, schedules, snapshots, results, activity, and preferences locally.
- **cookies:** reads the `sid` cookie from supported Salesforce domains to authenticate to an existing Salesforce session.
- **activeTab:** identifies the Salesforce context in the tab where you invoke WaveLink.
- **tabs:** finds open Salesforce tabs, lets you choose a connected organisation, and opens the full Extension workspace.
- **alarms:** wakes the Extension to run locally configured export schedules.
- **offscreen:** provides a local extension document for eligible long-running job and file-processing work when a visible page is not available.
- **Salesforce host permissions:** run the Salesforce page integration and make authenticated REST, Bulk API 2.0, and metadata requests only on supported Salesforce domains.

## 6. Remote code

WaveLink does not download or execute remote code. Its executable JavaScript is bundled in the reviewed Extension package.

## 7. Retention and deletion

Locally retained information remains until you remove it. WaveLink provides controls to disconnect organisations and delete saved jobs, schedules, snapshots, history, and other local records. You may also remove all locally stored information by clearing the Extension's storage or uninstalling it. Revoking the relevant Salesforce session or connected-app access invalidates the associated authentication token.

## 8. Security

Requests to Salesforce use HTTPS. WaveLink restricts network access to declared Salesforce hosts and applies a Manifest V3 content security policy. No method of local storage or network transmission is guaranteed to be completely secure, so users should follow their organisation's security and data-handling requirements.

## 9. Children

WaveLink is intended for professional use and is not directed to children under 13.

## 10. Changes and contact

Material changes will be reflected by the “Last updated” date on this page. Questions or privacy requests can be submitted through [WaveLink's GitHub issue tracker](https://github.com/Exotic209093/WaveLink/issues).

WaveLink is independent and is not affiliated with or endorsed by Salesforce, Inc.
