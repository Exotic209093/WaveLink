# WaveLink Roadmap

> Last updated: 2026-03-21

---

## Completed (v0.1.0)

Everything below shipped in the initial release:

| Area | Features |
|------|----------|
| **Data Push** | Insert, Update, Upsert, Delete via REST + Bulk API 2.0; auto-strategy selection; retry failed rows; type-to-confirm deletes; push history with error grouping and export |
| **Import / Export** | Drag-and-drop CSV/JSON/Excel import; multi-format export (CSV, JSON, Excel, XML) with column selector |
| **Data Cleanser** | Column rename, drop, reorder (drag-and-drop); bulk field updates with formula interpolation and conditional rules |
| **SOQL Query** | SOQL builder + autocomplete parser; query folders, favorites, tags, fuzzy search; performance metrics; import/export queries |
| **Schema & Analytics** | Schema comparison with diff export; field usage analytics with recommendations; visual relationship explorer; API usage dashboard |
| **Data Generation** | Test data generator (faker.js); data templates library with categories and usage tracking |
| **Advanced Ops** | Duplicate detection (exact/Levenshtein/Soundex) with merge wizard; cross-object cloning with dependency graph; bulk object operations; data quality scorecards; undo/redo |
| **Pipelines** | Visual transformation pipeline builder (filter, transform, lookup, aggregate, join steps) |
| **UX** | Dark mode (light/dark/auto); command palette; customizable keyboard shortcuts; onboarding wizard; contextual help tooltips; Preact popup UI |

---

## Roadmap

### Phase 1 — Collaboration

| # | Feature | Description | Priority | Status |
|---|---------|-------------|----------|--------|
| ~~1.1~~ | ~~**Multi-Org Workspace**~~ | ~~Switch between connected Salesforce orgs without re-authenticating; org switcher in the header; org-specific settings and schema caches; side-by-side org comparison view~~ | ~~High~~ | **Shipped in v0.1.0** |
| ~~1.2~~ | ~~**Data Comparison Between Orgs**~~ | ~~Diff records of the same object across sandbox and production; highlight field-level differences; selective sync (push specific records from one org to another)~~ | ~~High~~ | **Shipped in v0.1.0** |
| 1.3 | **Team Sharing** | Export/import queries, templates, pipelines, and quality rule sets as shareable JSON bundles; clipboard-friendly single-click copy | Medium | Planned |

---

### Phase 2 — Smarter Push & Recovery

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 2.1 | **Dependency-Aware Push** | Analyze lookup/master-detail relationships in the dataset and auto-order inserts so parent records are created before children; show dependency graph before push | High |
| 2.2 | **Rollback for All Operations** | Extend undo support beyond inserts — capture original field values for updates, store deleted records for restore; increase TTL and entry limit in settings | High |
| 2.3 | **Push Scheduling** | Queue a push to execute at a specific time (e.g. after a deployment); recurring pushes on a schedule; background execution with notification on completion | Medium |
| 2.4 | **Push Dry Run** | Simulate a push without committing — validate all records against the target org, report what would succeed/fail, and show governor limit impact estimates | Medium |

---

### Phase 3 — Query & Exploration

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 3.1 | **Query Results Inline Editing** | Edit field values directly in the query results table; batch-save changes as an update push | High |
| 3.2 | **Query Chaining** | Run a sequence of SOQL queries where each query can reference results from the previous one (e.g. get Account IDs, then query related Contacts) | Medium |
| 3.3 | **Query Diff** | Compare results of the same query run at two different points in time; highlight added, removed, and changed records | Medium |
| 3.4 | **SOSL Support** | Add Salesforce Object Search Language support alongside SOQL for full-text search across multiple objects | Low |

---

### Phase 4 — External Integrations

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 4.1 | **Google Sheets Import** | Connect to Google Sheets via OAuth; select sheet and range; live sync or one-time import — no CSV download step | Medium |
| 4.2 | **Webhook Notifications** | Fire a webhook (Slack, Teams, custom URL) when a long-running push completes or fails; configurable per-org | Medium |
| 4.3 | **CLI / Headless Mode** | Node.js CLI wrapper that reuses WaveLink's push engine for CI/CD pipelines; `npx wavelink push --file data.csv --object Account --org my-sandbox` | Medium |
| 4.4 | **Custom Scripting Hooks** | JavaScript pre-push and post-push hooks with a sandboxed execution environment; access to the current dataset and push result for advanced transformations | Low |

---

### Phase 5 — Developer Tools

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 5.1 | **Apex Log Viewer** | View and search Salesforce debug logs in-extension; filter by user, type, and time range; syntax highlighting; download logs | Medium |
| 5.2 | **Permission Set Viewer** | Browse and compare permission sets and profiles; diff two permission sets side by side; identify missing object/field permissions for a given user | Medium |
| 5.3 | **Metadata Quick Deploy** | Deploy small metadata changes (custom fields, validation rules, layouts) directly from WaveLink without a full SFDX round-trip | Low |
| 5.4 | **Backup & Restore** | One-click export of all records from an object; versioned backups stored locally; point-in-time restore before deployments | Low |

---

### Phase 6 — Performance & Scale

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 6.1 | **Streaming Large Files** | Stream-parse files larger than 10 MB using chunked reads instead of loading the full file into memory; raise the record limit above 25,000 | High |
| 6.2 | **Parallel Bulk Jobs** | Split large datasets across multiple Bulk API 2.0 jobs running in parallel; configurable concurrency; merged result reporting | Medium |
| 6.3 | **Offscreen Document for Long Pushes** | Use Chrome's Offscreen API to keep long-running Bulk API jobs alive independently of the service worker lifecycle | Medium |
| 6.4 | **Incremental Schema Cache** | Only re-describe objects whose metadata has changed (via `LastModifiedDate` on `EntityDefinition`) instead of full re-fetch | Low |

---

### Phase 7 — Data Governance

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 7.1 | **Audit Trail** | Log every push, delete, and undo operation with user, timestamp, org, object, and record count; exportable audit log; retention settings | Medium |
| 7.2 | **Sensitive Field Masking** | Detect and mask PII fields (email, phone, SSN patterns) during export and in the UI; configurable masking rules per field | Medium |
| 7.3 | **Push Approval Workflow** | Require a second confirmation step for pushes to production orgs above a configurable record threshold; optional reviewer notes | Low |
| 7.4 | **Data Retention Policies** | Auto-purge push history, undo transactions, and cached schemas after configurable retention periods; storage usage dashboard | Low |

---

## Ideas Backlog

> Not scheduled — captured here so nothing gets lost.

| Idea | Notes |
|------|-------|
| **Firefox / Edge Extension** | Port to cross-browser extension APIs (WebExtension manifest) |
| **Git Integration for Data Versioning** | Version-control datasets alongside code; branch-based data management |
| **Record-Level Change Tracking** | Track which fields changed across pushes for the same record (via external ID) |
| **Relationship Bulk Reparenting** | Mass-update lookup/master-detail fields to reparent records in bulk |
| **AI-Assisted Field Mapping** | Use field names, types, and sample data to auto-suggest source-to-target mappings |
| **Collaborative Data Review** | Share a dataset via link for team review with inline comments and approval |
| **Sandbox Seeding Profiles** | Pre-built "seeding profiles" per sandbox type (dev, QA, UAT) with object sets and record counts |
| **Salesforce Flow Integration** | Trigger a Salesforce Flow after a push completes (e.g. for post-processing or notifications) |
| **GraphQL API Support** | Use Salesforce's GraphQL API as an alternative to REST for read operations |
| **Extension Sync via Chrome Sync Storage** | Sync settings, templates, and saved queries across devices via Chrome's sync storage |
