# WaveLink — Salesforce Data Migration & Management Tool

Migrate data between Salesforce orgs, compare schemas and records across environments, transform and validate data, and manage multi-object migrations with dependency ordering and ID remapping — all from your browser.

---

## Features

### Migration
- **Migration Projects** — Plan, configure, and execute multi-object data migrations between Salesforce orgs. Automatic dependency graph detection, topological ordering, and ID remapping for lookups and master-detail relationships.
- **Schema Gap Analysis** — Diff fields across objects or orgs side-by-side before migration. Detect field type mismatches, missing fields, and configuration differences. Export to CSV, JSON, or HTML.
- **Pre/Post Migration Validation** — Data quality scorecards with rule sets (required fields, regex, range, picklist, uniqueness). Record count verification and field-level data comparison after migration.
- **Migration Templates** — Save and reuse complete migration configurations: object lists, field mappings, transformation rules, and filters. Replay across different org pairs.

### Data Operations
- **Data Push** — Upload CSV, JSON, or Excel files and push records into any Salesforce object using the REST Collections API or Bulk API 2.0. Supports field mapping, data transformation, retry on failure, and type-to-confirm deletes.
- **SOQL Query Editor** — Visual query builder with aggregate functions (COUNT, SUM, AVG, MIN, MAX), GROUP BY, date literals, subqueries, syntax highlighting, autocomplete, query history, and explain plans.
- **Data Cleanser** — Rename, drop, and reorder columns. Apply bulk field updates with formula interpolation and conditional rules. Preview changes before applying.
- **Pipeline Builder** — Visual step-chain builder for data transformation (filter, transform, lookup, aggregate, join steps) with intermediate result preview.
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

1. Clone the repo: `git clone https://github.com/jc-wave/wave-link.git`
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

WaveLink stores all data locally on your device using `chrome.storage.local`. No data is sent to any server other than your Salesforce orgs. No analytics, telemetry, or crash reporting is collected. See the full [Privacy Policy](public/privacy.html).

---

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines on pull requests, coding style, and how to run tests.

---

## Security

To report a security vulnerability, please open a private security advisory on GitHub. See [SECURITY.md](docs/SECURITY.md) for details.

---

## License

MIT © James C
