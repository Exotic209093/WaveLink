# Changelog

All notable changes to WaveLink are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
WaveLink uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned (see [roadmap.md](../roadmap.md) for full details)
- Dependency-aware push — topological ordering of related object inserts
- Push dry run — validate without committing
- Query results inline editing
- Streaming large file import (> 10 MB)
- CLI / headless mode for CI/CD

---

## [0.1.0] — 2026-02-17

Initial public release. All features below shipped in v0.1.0.

### Added

#### Data Push
- Insert, Update, Upsert, and Delete operations for any Salesforce SObject
- Automatic API strategy selection: REST Collections (≤ 2,000 records) vs Bulk API 2.0 (> 2,000 records)
- REST batching via SObject Collections API (200 records/request for insert/update/delete)
- Composite API batching for upsert (25 subrequests/request)
- Retry logic with exponential backoff (up to 3 attempts per batch)
- Type-to-confirm modal for delete operations; additional warning for production orgs
- Retry Failed — generates a new dataset from only the failed records after a partial push
- Real-time push progress updates (records processed, success/failure counts)

#### Push History
- Sortable, filterable push history table (up to 100 entries, configurable)
- Error grouping — failures with the same error message are grouped with a count
- CSV and JSON export of push history
- Per-entry detail view showing individual record errors

#### Undo / Rollback
- Automatic capture of inserted record IDs for rollback
- One-click undo from `Ctrl+Z` or the undo panel
- Up to 10 undo entries with 1-hour TTL
- Undo history browse and restore

#### Data Import & Export
- Drag-and-drop CSV, JSON, and Excel (.xlsx) file import
- Auto-detection of file format and delimiter
- Export as CSV, JSON, auto-sized Excel (.xlsx), and Salesforce-compatible XML
- Column selector — choose which fields to include in exports
- Format-specific options (delimiter, encoding)

#### SOQL Query Editor
- Structured SOQL builder: SELECT / FROM / WHERE / ORDER BY / LIMIT interface
- Context-aware autocomplete: detects which clause is being edited and suggests appropriate values
- Raw SOQL text editing mode
- Query execution with real-time results table
- Performance metrics: execution time, record count, estimated API call cost
- Query library: save queries with name, tags, and notes
- Folder organisation: create folders, drag queries between folders
- Favourites: star queries for quick access
- Fuzzy search across saved queries
- Import/export query library as JSON bundles

#### Data Cleanser
- Column rename, drop, and reorder (drag-and-drop or `Alt+↑`/`Alt+↓` keyboard shortcuts)
- Bulk field updates with formula interpolation (`{FirstName} {LastName}`)
- Conditional update rules (IF / THEN / ELSE)
- Live preview of changes before applying

#### Pipeline Builder
- Visual step-chain builder for data transformation
- Step types: Filter, Transform, Lookup, Aggregate, Join
- Step-by-step preview of intermediate results
- Save and reload pipeline definitions

#### Multi-Org Workspace
- Connect multiple Salesforce orgs simultaneously (open each in a browser tab)
- Org switcher in the app header — switch with a single click
- Custom nickname and colour dot per org for visual identification
- PROD (red) and SBX (amber) environment badges
- Per-org schema cache and session isolation
- Auto-detection of org from the active Salesforce tab

#### Data Comparison Between Orgs
- Side-by-side org selection (any two connected orgs)
- Object intersection — only objects present in both orgs are shown
- Field-level record comparison matched by Name, External ID, or any chosen field
- Colour-coded diff results: added (green), removed (red), changed (blue), unchanged (grey)
- Old value (strikethrough) and new value shown in each changed cell
- Selective sync — check individual records and push them from source to target
- Export diff as CSV
- Filter by status (All / Added / Removed / Changed) with 100-record pagination

#### Schema Comparison
- Field-level diff between any two SObjects (same or different orgs)
- Shows fields only in source, only in target, and fields with different types or configuration
- Export schema diff as CSV, JSON, or HTML

#### Field Usage Analytics
- Population rate per field — percentage of records with a non-null value
- Uniqueness / cardinality analysis
- Optimisation recommendations (unused fields, candidates for indexing or required constraint)
- Sort and filter analytics results

#### Visual Relationship Explorer
- Interactive object relationship graph (lookups and master-detail)
- Depth control — expand or collapse levels of related objects
- Click nodes to explore; zoom and pan
- Export graph as PNG

#### API Usage Dashboard
- All Salesforce governor limits displayed with colour-coded consumption bars
- Search and filter across the full limits list
- Refresh on demand

#### Test Data Generator
- Auto-maps Salesforce field types to appropriate faker.js generators
- Configurable per field: null rate, static value, formula-based value, relationship ID injection
- Generate hundreds or thousands of records in seconds
- Preview generated data before pushing

#### Data Templates
- Save any field mapping configuration as a named template
- Template categories and search
- Usage tracking (last used, use count)
- Apply a template to new datasets

#### Duplicate Detection & Merging
- Three matching algorithms: exact, Levenshtein (fuzzy), Soundex (phonetic)
- Configurable match threshold per algorithm
- 3-step merge wizard: identify → review → merge
- Field-level control over which values to keep during merge

#### Cross-Object Data Cloning
- Automatic dependency graph detection via relationship metadata
- Topological sort to insert parents before children
- ID remapping — updates lookup fields to point to newly created records
- Circular reference detection and graceful handling

#### Bulk Object Operations
- Record count for any SObject
- Bulk delete all records from an object
- Safety confirmation for all delete operations; extra warning for production orgs

#### Data Quality Scorecards
- Define rule sets: required fields, regex format checks, range checks, picklist enforcement, uniqueness constraints
- Score a dataset against rules before pushing
- Per-record detail view showing which rules each record passed or failed
- Quality score summary (pass/fail counts, overall percentage)

#### User Interface
- Three UI modes: popup, in-page side panel, full-page app
- Dark mode: light, dark, or auto (follows OS preference)
- Accent colour customisation (multiple colour options)
- Command palette (`Ctrl+K`) with fuzzy search across all screens and actions
- Keyboard shortcuts with full rebinding support and conflict detection
- Onboarding wizard for first-time users
- Contextual help tooltips throughout the UI
- Resizable in-page side panel (drag left edge; width persisted in storage)
- Shadow DOM isolation for in-page panel (no style conflicts with Salesforce)

#### Settings
- Theme and accent colour
- Schema cache TTL
- Push history limit
- Undo TTL and entry limit
- Keyboard shortcut editor
- Storage management (clear cache, history, undo data)
- Import/export all WaveLink data as a single JSON bundle

#### Developer Experience
- TypeScript 5.5 with strict mode
- Webpack 5 build with four entry point bundles
- Jest 29 + JSDOM test suite (25+ unit tests)
- ESLint with TypeScript plugin
- Path aliases (`@core/`, `@services/`, etc.) for clean imports
- Source maps in development builds

---

## Version History Summary

| Version | Date | Notes |
|---------|------|-------|
| 0.1.0 | 2026-02-17 | Initial public release |

---

[Unreleased]: https://github.com/jc-wave/wave-link/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jc-wave/wave-link/releases/tag/v0.1.0
