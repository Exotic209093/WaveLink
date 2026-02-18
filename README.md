# WaveLink

**Your Salesforce data workbench — right in the browser.**

WaveLink is a free, open-source Chrome extension that gives Salesforce admins, developers, and consultants a complete toolkit for pushing, querying, comparing, cleaning, and managing data across orgs. It piggybacks on your existing Salesforce session — no OAuth apps, no connected apps, no setup. Just install and go.

> **Why open source?** Salesforce tooling shouldn't be locked behind paywalls. WaveLink was built because every team deserves powerful data tools without per-seat pricing or enterprise gates. Fork it, improve it, make it yours. Contributions, bug reports, and feature ideas are all welcome.

---

## Quick Start

```bash
git clone https://github.com/jc-wave/wave-link.git
cd wave-link
npm install
npm run build
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
4. Open any Salesforce org in a tab — WaveLink is ready

No API keys. No OAuth. No configuration files. If you're logged into Salesforce, WaveLink works.

---

## Features

### Data Push

Push records into any Salesforce object with full control over the operation.

- **Insert, Update, Upsert, Delete** — all four DML operations
- **Smart API selection** — automatically uses REST API for small datasets (< 2,000 records) and Bulk API 2.0 for large ones
- **REST batching** — SObject Collections (200/req) for insert/update/delete, Composite API (25/req) for upsert
- **Retry logic** — transient failures retry up to 3 times with exponential backoff
- **Safety first** — type-to-confirm modal for destructive delete operations
- **Retry failed rows** — generates a new dataset from only the records that failed so you can fix and re-push
- **Push history** — sortable, filterable table of every push with error grouping and CSV/JSON export

### Data Import & Export

Get data in and out of WaveLink with drag-and-drop simplicity.

- **Import** — drag-and-drop CSV, JSON, or Excel files directly into the app
- **Export** — CSV, JSON, Excel (auto-sized columns), and Salesforce-compatible XML
- **Column selector** — choose exactly which fields to include in exports
- **Format options** — configure delimiters, encodings, and format-specific settings

### SOQL Query Editor

A full-featured query editor with autocomplete and history.

- **SOQL builder** — structured SELECT / FROM / WHERE / ORDER BY / LIMIT interface
- **Smart autocomplete** — context-aware parser that detects which clause you're editing and suggests fields, objects, and operators
- **Query history** — organized with folders, favorites, tags, and fuzzy search; drag queries between folders
- **Performance metrics** — execution time, record count, and API cost estimates for every query
- **Import/export** — save and share queries as JSON bundles

### Data Cleanser

Clean and transform datasets before pushing them to Salesforce.

- **Column operations** — rename, drop, and reorder columns (drag-and-drop or Alt+Up/Down keyboard shortcuts)
- **Bulk field updates** — formula interpolation (`{FirstName} {LastName}`) and conditional rules (IF / THEN / ELSE)
- **Pipeline builder** — chain filter, transform, lookup, aggregate, and join steps in a visual flow

### Multi-Org Workspace

Work across multiple Salesforce orgs without juggling browser profiles.

- **Org switcher** — click the org indicator in the topbar to switch between connected orgs instantly
- **Connect from tab** — open a Salesforce org in any browser tab and connect it to WaveLink with one click
- **Nicknames & colors** — assign custom names and color dots to each org for quick visual identification
- **Environment badges** — production orgs show a red PROD badge, sandboxes show amber SBX
- **Per-org isolation** — each org maintains its own schema cache and session

### Data Comparison Between Orgs

Diff records between two orgs and selectively sync differences.

- **Side-by-side org selection** — pick any two connected orgs as source and target
- **Object intersection** — automatically shows only objects that exist in both orgs
- **Field-level diff** — compare records field by field, matched by Name, External ID, or any field you choose
- **Color-coded results** — added (green), removed (red), changed (blue), unchanged (gray)
- **Changed cell highlights** — see old value (strikethrough) and new value side by side in each cell
- **Selective sync** — checkbox individual records and push them from source to target
- **Export diff** — download comparison results as CSV
- **Filters & pagination** — filter by status (All / Added / Removed / Changed) with 100-record pages

### Schema Comparison

Compare the structure of two objects side by side.

- **Field-level diff** — see which fields exist in one object but not the other, and which have different types or configurations
- **Export** — download schema diffs as CSV, JSON, or HTML

### Field Usage Analytics

Understand how your data is actually being used.

- **Population rates** — see what percentage of records have values for each field
- **Uniqueness analysis** — identify fields with high or low cardinality
- **Optimization recommendations** — get suggestions for fields that could be removed, indexed, or required

### Visual Relationship Explorer

Navigate your data model as an interactive graph.

- **Object graph** — see how objects relate through lookups and master-detail relationships
- **Depth control** — expand or collapse relationship depth to focus on what matters
- **Interactive** — click nodes to explore, zoom and pan to navigate

### API Usage Dashboard

Monitor your org's API consumption at a glance.

- **Org limits** — color-coded bars showing consumption vs. limits for all Salesforce governor limits
- **Search & filter** — find specific limits quickly across the full list

### Test Data Generator

Generate realistic test data for any Salesforce object.

- **Smart field mapping** — maps Salesforce field types to appropriate faker.js generators automatically
- **Configurable** — set null rates, static values, formula-based values, and relationship ID injection per field
- **Bulk generation** — generate hundreds or thousands of records in seconds

### Data Templates

Save and reuse field mapping configurations.

- **Template library** — save any field mapping as a reusable template
- **Categories & search** — organize templates by category, search by name
- **Usage tracking** — see which templates are used most and when they were last applied

### Duplicate Detection & Merging

Find and merge duplicate records with precision.

- **Multiple algorithms** — exact match, Levenshtein (fuzzy), or Soundex (phonetic) matching
- **3-step merge wizard** — identify duplicates, review matches, merge with field-level control
- **Configurable thresholds** — tune matching sensitivity to reduce false positives

### Cross-Object Data Cloning

Clone records and their related children across objects or orgs.

- **Dependency graph** — automatically detects lookup and master-detail relationships
- **Topological sort** — inserts records in the right order so parents exist before children
- **ID remapping** — updates relationship fields to point to newly created records
- **Circular reference detection** — identifies and handles circular dependencies gracefully

### Bulk Object Operations

Perform object-level operations across your org.

- **Record counts** — quickly count records in any object
- **Bulk delete** — delete all records from an object with safety confirmation and production org warnings

### Data Quality Scorecards

Score your data against defined rules before pushing.

- **Rule types** — required fields, format validation (regex), range checks, picklist enforcement, uniqueness constraints
- **Dataset scoring** — run rules against your dataset and get a quality score with per-record detail
- **Pre-push validation** — catch data issues before they become Salesforce errors

### Undo / Redo

Recover from mistakes with automatic rollback capture.

- **Auto-capture** — rollback data is saved automatically for insert operations
- **Quick undo** — revert a push with one click from the undo panel (`Ctrl+Z`)
- **History** — browse and restore from the last 10 operations (1-hour TTL)

---

## User Interface

WaveLink runs in three modes to fit your workflow:

| Mode | Access | Best for |
|------|--------|----------|
| **Popup** | Click the WaveLink icon in Chrome's toolbar | Quick pushes, checking templates, viewing history |
| **Side Panel** | `Ctrl+Shift+L` on any Salesforce page | Working alongside Salesforce without switching tabs |
| **Full App** | Click "Full App" in the popup or panel | Complex workflows — queries, comparisons, pipelines, analytics |

- **Dark mode** — light, dark, or auto (follows system preference)
- **Command palette** — `Ctrl+K` to fuzzy-search and jump to any screen
- **Keyboard shortcuts** — fully customizable in Settings with conflict detection
- **Onboarding wizard** — step-by-step tutorial for first-time users

---

## Authentication

WaveLink reads your active Salesforce session cookie (`sid`) from the browser. There is nothing to configure:

- Works with **production** and **sandbox** orgs
- Auto-detects the org from the instance URL
- Tokens refresh automatically with a 5-minute buffer before expiry
- Multiple orgs can be connected simultaneously — just open each org in a tab and connect via the org switcher

---

## Architecture

```
src/
├── background/          Service worker (MV3) — push orchestration, message routing
├── popup/               Preact popup entry point
├── content/             Content script injected into Salesforce pages
├── app/                 Full-page app (app.html)
├── services/
│   ├── salesforce/      Auth, REST, Bulk API 2.0, Tooling API
│   ├── messaging/       Chrome extension message bus
│   └── storage/         Chrome storage wrapper (local + session)
├── data/
│   ├── mappers/         Field mapping with transformations
│   ├── validators/      Schema-aware validation
│   └── templates/       Data template definitions
├── core/
│   ├── types/           TypeScript type definitions
│   ├── errors/          Error hierarchy (Auth, API, Validation, Push)
│   ├── constants/       Configuration constants
│   └── utils/           Shared utilities
└── ui/
    ├── screens/         19 screen components
    ├── components/      Reusable UI components (OrgSwitcher, DataDiffView, etc.)
    ├── utils/           SOQL builder, export, theme, data diff, analytics
    ├── hooks/           Custom Preact hooks
    ├── api/             UI-specific API wrappers
    └── styles/          CSS-in-JS with dark mode and design tokens
```

---

## Limits

| Constraint | Value |
|-----------|-------|
| Max records per push | 25,000 |
| Max file size | ~10 MB |
| Bulk API threshold | 2,000 records (auto-switch) |
| REST batch size | 200 records (insert/update/delete) |
| Composite batch size | 25 subrequests (upsert) |
| Bulk API poll timeout | ~10 minutes (5s interval) |
| REST retry attempts | 3 (exponential backoff) |
| Schema cache TTL | 30 minutes |
| Undo history | 10 entries, 1-hour TTL |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | Preact 10 |
| Language | TypeScript 5.5 |
| Bundler | Webpack 5 |
| Testing | Jest 29 (JSDOM) |
| CSV Parsing | Papa Parse |
| Excel Export | SheetJS (xlsx) |
| Test Data | @faker-js/faker |
| Extension | Chrome Manifest V3 |
| Salesforce API | REST v59.0, Bulk API 2.0, Composite, Tooling |

---

## Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Watch mode (development) |
| `npm run build` | Production build |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Lint TypeScript files |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run typecheck` | Type check without emitting |
| `npm run clean` | Remove dist/ |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+L` | Toggle WaveLink side panel |
| `Ctrl+K` | Open command palette |
| `Ctrl+Shift+Q` | Navigate to Query |
| `Ctrl+Shift+P` | Navigate to Data Push |
| `Ctrl+Z` | Open undo panel |

All shortcuts are customizable in Settings > Keyboard Shortcuts.

---

## Contributing

WaveLink is open source under the MIT license. Contributions are welcome — whether it's a bug fix, a new feature, better docs, or just an idea.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and run `npm run build` to verify
4. Open a pull request

If you find a bug or have a feature request, [open an issue](https://github.com/jc-wave/wave-link/issues). No contribution is too small.

---

## License

MIT — use it, modify it, share it. See [LICENSE](LICENSE) for details.

---

Built with care for the Salesforce community. If WaveLink saves you time, give it a star and share it with your team.
