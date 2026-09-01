# WaveLink — Fast Salesforce Data Export & Import

[![CI](https://github.com/Exotic209093/WaveLink/actions/workflows/ci.yml/badge.svg)](https://github.com/Exotic209093/WaveLink/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-WaveLink-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/wavelink/ccknhhibbedolfnbgnenomdohlmojblo)

Get data in and out of Salesforce right from your browser — query records out to CSV/JSON/Excel/XML, push files in via REST or Bulk API, schedule recurring snapshots, and diff exports side by side. Everything runs locally; nothing leaves your device except calls to your own Salesforce orgs.

> **[Add WaveLink to Chrome →](https://chromewebstore.google.com/detail/wavelink/ccknhhibbedolfnbgnenomdohlmojblo)**

---

## Features

### Export
- **SOQL Export** — Run a SOQL query, preview the results, and download as CSV, JSON, Excel, or XML. Visual query builder with aggregate functions (COUNT, SUM, AVG, MIN, MAX), GROUP BY, date literals, subqueries, syntax highlighting, autocomplete, query history, and explain plans.
- **Scheduled Snapshots** — Schedule recurring exports (backed by `chrome.alarms`) so you always have a fresh copy of key objects, with configurable interval and retention.
- **Multi-format Output** — Export query results to CSV, JSON, Excel, or XML with a column selector.

### Import
- **Data Push** — Upload CSV, JSON, or Excel files and push records into any Salesforce object using the REST Collections API or Bulk API 2.0. Supports field mapping, data transformation, retry on failure, type-to-confirm deletes, and an **import dry-run pre-flight** that simulates a push before it commits.
- **Live Push Progress** — Real-time progress dashboard with cancel, retry, and stored-ID views.
- **Data Cleanser** — Rename, drop, and reorder columns. Apply bulk field updates with formula interpolation and conditional rules, plus data-quality scoring. Preview changes before applying.

### Convert & Compare
- **Convert** — Offline converter between CSV, JSON, Excel, and XML. No Salesforce connection required.
- **Compare** — One screen, two sources: diff two exported files or scheduled-export snapshots offline, or query two connected orgs and diff records field-by-field with optional selective sync to the target.

### Migration (Advanced)
- **Migration Projects** — Plan, configure, and execute multi-object data migrations between Salesforce orgs. Dependency graph detection, topological ordering, and ID remapping for lookups and master-detail relationships.
- **Schema Gap Analysis** — Diff fields across objects or orgs side-by-side. Detect field type mismatches, missing fields, and configuration differences. Export to CSV, JSON, or HTML.
- **Pre/Post Migration Validation** — Data quality scorecards with rule sets (required fields, regex, range, picklist, uniqueness). Record count verification and field-level data comparison.
- **Migration Templates** — Save and reuse complete migration configurations and replay them across different org pairs.

### Power Tools (Advanced)
- **Pipeline Builder** — Visual step-chain builder for data transformation (filter, transform, lookup, aggregate, join) with intermediate result preview.
- **Test Data Generator** — Auto-generate test data using faker.js. Configure null rates, static values, formulas, and relationship ID injection per field.

### Schema & Analytics
- **Schema Explorer** — Browse Salesforce object schemas, view field metadata, and explore object relationships as an interactive graph.
- **Dependency Visualiser** — Interactive graph of object relationships showing lookup and master-detail dependencies. Understand migration ordering at a glance.
- **Field Usage Analytics** — Population rate, cardinality analysis, and optimisation recommendations per field.
- **API Usage Dashboard** — View all Salesforce governor limits with colour-coded consumption bars.
- **Org Health** — Monitor org health metrics at a glance.

### Cross-Org
- **Multi-Org Support** — Connect and switch between multiple Salesforce orgs. Custom nicknames, colour dots, and PROD/SBX badges for visual identification.
- **Data Comparison** — Compare record-level data across orgs. Colour-coded diff with selective sync to push specific records from source to target.

### Advanced Operations
- **Duplicate Detection & Merging** — Find duplicates using exact, Levenshtein (fuzzy), or Soundex (phonetic) matching. 3-step merge wizard with field-level control.
- **Cross-Object Cloning** — Clone records with automatic dependency graph detection, topological ordering, and ID remapping for lookups.
- **Bulk Object Operations** — Record counts, bulk delete with safety confirmations, and production org warnings.

### History & Recovery
- **Migration Audit Trail** — Sortable, filterable log of all push and migration operations with error grouping and CSV/JSON export.
- **Rollback** — Automatic capture of inserted record IDs. One-click undo via `Ctrl+Z` or the undo panel. Migration-level rollback deletes all inserted records in reverse dependency order.

### User Interface
- Three UI modes: popup, in-page side panel, and full-page app
- Dark mode (light, dark, or auto)
- Command palette (`Ctrl+K`) with fuzzy search
- Customisable keyboard shortcuts with conflict detection
- Onboarding wizard and contextual help tooltips
- Shadow DOM isolation for the in-page panel

---

## Installation

### From the Chrome Web Store

Search for **WaveLink** in the Chrome Web Store and click **Add to Chrome**.

### From Source

1. Clone the repo: `git clone https://github.com/Exotic209093/WaveLink.git`
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` folder.

---

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Watch mode — rebuilds on file changes |
| `npm run build` | Production build |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Watch mode for tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint TypeScript source |
| `npm run lint:fix` | Lint with auto-fix |
| `npm run typecheck` | Type-check without emitting |
| `npm run package` | Create a store-ready zip |

---

## Privacy

WaveLink stores all data locally on your device using `chrome.storage.local`. No data is sent to any server other than your Salesforce orgs. No analytics, telemetry, or crash reporting is collected. See the full [Privacy Policy](PRIVACY.md).

---

## Roadmap

Development is planned and tracked in the open: see [roadmap.md](roadmap.md)
for the current audit status, the v0.7 → v1.0 trust milestones, and the
evidence-gated arc through 3.0. Work in progress lives on the
[issue tracker](https://github.com/Exotic209093/WaveLink/issues) under
[milestones](https://github.com/Exotic209093/WaveLink/milestones).

---

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines on pull requests, coding style, and how to run tests. All participation is covered by the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Security

To report a security vulnerability, please use the private reporting channel described in [SECURITY.md](SECURITY.md). The full security architecture and local-data inventory are documented in [docs/SECURITY.md](docs/SECURITY.md).

---

## License

MIT © James C
