# WaveLink Roadmap

> Last updated: 2026-03-22

---

## Completed (v0.1.0)

Everything below shipped in the initial release:

| Area | Features |
|------|----------|
| **Data Push** | Insert, Update, Upsert, Delete via REST + Bulk API 2.0; auto-strategy selection; retry failed rows; type-to-confirm deletes; push history with error grouping and export |
| **Import / Export** | Drag-and-drop CSV/JSON/Excel import; multi-format export (CSV, JSON, Excel, XML) with column selector |
| **Data Cleanser** | Column rename, drop, reorder (drag-and-drop); bulk field updates with formula interpolation and conditional rules |
| **SOQL Query** | SOQL builder with aggregates (COUNT, SUM, AVG, MIN, MAX), GROUP BY, date literals, subqueries, syntax highlighting, autocomplete, query history, explain plans |
| **Schema & Analytics** | Schema comparison with diff export; field usage analytics with recommendations; visual relationship explorer; API usage dashboard |
| **Data Generation** | Test data generator (faker.js); data templates library with categories and usage tracking |
| **Advanced Ops** | Duplicate detection (exact/Levenshtein/Soundex) with merge wizard; cross-object cloning with dependency graph; bulk object operations; data quality scorecards; undo/redo |
| **Pipelines** | Visual transformation pipeline builder (filter, transform, lookup, aggregate, join steps) |
| **Cross-Org** | Multi-org support with org switcher; cross-org data comparison with selective sync; schema comparison across orgs |
| **UX** | Dark mode (light/dark/auto); command palette; customizable keyboard shortcuts; onboarding wizard; contextual help tooltips |

---

## Roadmap

### Phase 1 — Migration Core

The central pivot: introduce Migration Projects as a first-class concept that ties together existing features into a cohesive migration workflow.

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 1.1 | **Migration Project Workspace** | New top-level entity: plan, configure, and track multi-object migrations between source and target orgs. Wizard-driven project creation. | High |
| 1.2 | **Multi-Object Orchestration** | Execute migrations across multiple objects in dependency order. Sequential push with automatic ID map accumulation between objects. | High |
| 1.3 | **Generalised Dependency Graph** | Extend `buildDependencyGraph()` from single-root cloning to arbitrary multi-object sets. Detect circular references with resolution strategy (null-then-backfill). | High |
| 1.4 | **Persistent ID Map** | Store old-ID-to-new-ID mapping in `chrome.storage.local` across objects and sessions. View, search, and export the ID map. | High |
| 1.5 | **Navigation Restructure** | Reorganise nav around migration workflows: Migration, Schema, Data Ops, Quality, Monitoring. Default landing page becomes Migration Projects. | High |

---

### Phase 2 — Migration Validation & Reporting

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 2.1 | **Pre-Migration Validation Flow** | Unified screen combining schema gap analysis + data quality scoring. Run automatically before migration execution. | High |
| 2.2 | **Post-Migration Validation** | Automatic record count comparison (source vs target). Field-level data comparison for spot-check verification. | High |
| 2.3 | **Migration Progress Dashboard** | Real-time per-object progress bars during execution. ETA based on throughput. Object-level status (pending/running/done/failed). | High |
| 2.4 | **Migration Summary Report** | Generated at completion: records migrated per object, success rates, error summary, duration, ID map statistics. Exportable as HTML/CSV. | Medium |
| 2.5 | **Migration-Level Rollback** | Delete all inserted records across all objects in reverse topological order. Increased undo limits for migration scenarios. | High |

---

### Phase 3 — Migration Templates & Field Mapping

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 3.1 | **Migration Templates** | Save complete migration configurations (objects, mappings, filters, pipelines) and replay across different org pairs. | Medium |
| 3.2 | **Cross-Org Field Mapping UI** | Visual source-to-target field pairing with drag-and-drop. Auto-suggestion based on name similarity + type compatibility. Unmapped required field warnings. | Medium |
| 3.3 | **Selective Migration Filters** | Per-object WHERE clause configuration. Date-based filtering for incremental/delta migration. Record set preview before execution. | Medium |
| 3.4 | **Migration-Specific Transformations** | New pipeline steps: `id_remap`, `picklist_map`, `org_specific_default`. Conditional rules based on target org environment. | Medium |

---

### Phase 4 — Advanced Migration

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 4.1 | **Incremental / Delta Migration** | Migrate only records created or modified after a cutoff date. Track last migration timestamp per object. | Medium |
| 4.2 | **Parallel Object Migration** | Execute independent objects (no mutual dependencies) in parallel for faster migration throughput. | Medium |
| 4.3 | **Advanced Rollback** | Capture original field values for update operations. Restore to pre-migration state, not just delete inserts. | Medium |
| 4.4 | **Push Dry Run** | Simulate migration without committing. Validate all records against target org and report what would succeed/fail. | Medium |

---

### Phase 5 — Enterprise & Integrations

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 5.1 | **CLI / Headless Mode** | Node.js CLI wrapper for CI/CD pipelines: `npx wavelink migrate --project my-migration --source dev --target uat` | Medium |
| 5.2 | **Webhook Notifications** | Fire webhooks (Slack, Teams, custom URL) when migrations complete or fail. | Medium |
| 5.3 | **Audit Trail** | Comprehensive log of every migration, push, delete, and rollback with user, timestamp, org, and record count. Exportable. | Medium |
| 5.4 | **Push Approval Workflow** | Require confirmation for pushes to production orgs above a configurable record threshold. | Low |
| 5.5 | **Sensitive Field Masking** | Detect and mask PII fields during export and in the UI. Configurable masking rules. | Low |

---

### Phase 6 — Performance & Scale

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 6.1 | **Streaming Large Files** | Stream-parse files larger than 10 MB using chunked reads; raise the record limit above 25,000 | High |
| 6.2 | **Parallel Bulk Jobs** | Split large datasets across multiple Bulk API 2.0 jobs running in parallel | Medium |
| 6.3 | **Offscreen Document** | Use Chrome's Offscreen API to keep long-running migrations alive independently of the service worker lifecycle | Medium |
| 6.4 | **Incremental Schema Cache** | Only re-describe objects whose metadata has changed | Low |

---

## Ideas Backlog

> Not scheduled — captured here so nothing gets lost.

| Idea | Notes |
|------|-------|
| **Firefox / Edge Extension** | Port to cross-browser extension APIs (WebExtension manifest) |
| **Google Sheets Import** | Connect to Google Sheets via OAuth; select sheet and range; live sync or one-time import |
| **AI-Assisted Field Mapping** | Use field names, types, and sample data to auto-suggest source-to-target mappings |
| **Git Integration for Data Versioning** | Version-control datasets alongside code |
| **Sandbox Seeding Profiles** | Pre-built profiles per sandbox type (dev, QA, UAT) with object sets and record counts |
| **Salesforce Flow Integration** | Trigger a Flow after a migration completes |
| **GraphQL API Support** | Use Salesforce's GraphQL API for read operations |
| **Apex Log Viewer** | View and search debug logs in-extension |
| **Permission Set Viewer** | Browse and compare permission sets and profiles |
| **Extension Sync via Chrome Sync Storage** | Sync settings and templates across devices |
