# WaveLink

A Chrome extension for seeding, transforming, and managing data in Salesforce orgs — directly from your browser.

WaveLink reuses your active Salesforce session (no OAuth setup) and gives you a full data workbench: push records via REST or Bulk API, run SOQL queries, clean and transform datasets, generate test data, compare schemas, detect duplicates, and more.

## Install

```bash
npm install
npm run build        # production build → dist/
npm run dev          # watch mode for development
```

Load the `dist/` folder as an unpacked extension in `chrome://extensions`.

## Key Features

### Data Push
- **Insert, Update, Upsert, Delete** operations on any SObject
- Auto-selects REST API (< 2,000 records) or Bulk API 2.0 (2,000+)
- REST batching: SObject Collections (200/req) for insert/update/delete, Composite API (25/req) for upsert
- Retry transient failures up to 3 times with exponential backoff
- Type-to-confirm safety modal for destructive delete operations
- Retry failed rows — generates a new dataset from only the records that failed
- Push history with sortable/filterable table, error grouping, and CSV/JSON export

### Data Import & Export
- **Import:** Drag-and-drop CSV, JSON, or Excel files
- **Export:** CSV, JSON, Excel (auto-sized columns), and Salesforce-compatible XML
- Column selector and format-specific options in the export modal

### Data Cleanser
- Column renaming, dropping, and reordering (drag-and-drop or Alt+Up/Down)
- Bulk field updates with formula interpolation (`{FirstName} {LastName}`) or conditional rules (IF/THEN/ELSE)
- Transformation pipeline: filter, transform, lookup, aggregate, and join steps in a visual builder

### SOQL Query
- SOQL builder with structured SELECT/FROM/WHERE/ORDER BY/LIMIT
- Autocomplete-aware SOQL parser (detects clause context and partial tokens)
- Query history with folders, favorites, tags, fuzzy search, and drag-to-folder
- Query performance metrics (execution time, record count, API cost estimate)
- Import/export queries as JSON

### Schema & Analytics
- **Schema Comparison** — diff two objects side by side, export to CSV/JSON/HTML
- **Field Usage Analytics** — population rates, uniqueness, and optimization recommendations
- **Visual Relationship Explorer** — interactive graph of object relationships with depth control
- **API Usage Dashboard** — color-coded org limit bars with search and filtering

### Data Generation & Templates
- **Test Data Generator** — maps Salesforce field types to faker.js generators; configurable null rates, static values, formulas, and relationship ID injection
- **Data Templates Library** — save and reuse field mapping configurations; search, filter by category, usage tracking

### Advanced Operations
- **Duplicate Detection & Merging** — exact, Levenshtein, or Soundex matching; 3-step merge wizard
- **Cross-Object Data Cloning** — dependency graph with topological sort, ID remapping, circular reference detection, cross-org support
- **Bulk Object Operations** — count records, delete all with safety confirmation, production org warnings
- **Data Quality Scorecards** — define rules (required, format, range, picklist, unique), score datasets before pushing
- **Undo/Redo** — auto-captures rollback data for insert operations (10 entries, 1-hour TTL)

### UX
- Dark mode with light/dark/auto toggle (respects system preference)
- Command palette (`Ctrl+K`) with fuzzy search
- Customizable keyboard shortcuts with conflict detection
- Onboarding wizard with step-by-step tutorial and contextual help tooltips
- Popup UI (Preact) with compact nav: Data Push, Templates, History, Settings
- Full-page app with 18+ screens

## Authentication

WaveLink reads your active Salesforce session cookie (`sid`) from the browser — no OAuth configuration needed. It works with both production and sandbox orgs, and auto-detects the org from the instance URL. Tokens refresh automatically with a 5-minute buffer before expiry.

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
│   ├── errors/          Error hierarchy (Auth, API, Validation, Push, etc.)
│   ├── constants/       Configuration constants
│   └── utils/           Shared utilities
└── ui/
    ├── screens/         18+ screen components
    ├── components/      Reusable UI components
    ├── utils/           SOQL builder, export, theme, analytics, etc.
    ├── hooks/           Custom Preact hooks
    ├── api/             UI-specific API wrappers
    └── styles/          CSS-in-JS styles with dark mode support
```

## Current Limits

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

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+L` | Toggle WaveLink panel (global) |
| `Ctrl+K` | Open command palette |
| `Ctrl+Shift+Q` | Navigate to queries |
| `Ctrl+Shift+P` | Navigate to push |
| `Ctrl+Z` | Undo last operation |

Shortcuts are customizable in Settings.

## License

MIT
