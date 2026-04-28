# WaveLink Roadmap

> Last updated: 2026-04-27
> See [WAVELINK_AUDIT_2026-04-27.md](WAVELINK_AUDIT_2026-04-27.md) for the audit that informed this update.

---

## Completed (v0.1.0)

| Area | Features |
|------|----------|
| **Data Push** | Insert/Update/Upsert/Delete via REST + Bulk API 2.0; auto-strategy; retry failed rows; type-to-confirm deletes; push history with error grouping and export |
| **Import / Export** | CSV/JSON/Excel import; multi-format export with column selector |
| **Data Cleanser** | Column rename/drop/reorder; bulk field updates with formula interpolation and conditional rules |
| **SOQL Query** | Builder with aggregates (COUNT/SUM/AVG/MIN/MAX), GROUP BY, date literals, subqueries, syntax highlighting, autocomplete, history, explain plans |
| **Schema & Analytics** | Schema comparison with diff export; field usage analytics; relationship explorer; API usage dashboard |
| **Data Generation** | Test data generator (faker.js); template library |
| **Advanced Ops** | Duplicate detection (exact / Levenshtein / Soundex) with merge wizard; cross-object cloning *(see open bug — placeholders still in code)*; bulk object operations; data quality scorecards; undo/redo |
| **Pipelines** | Visual transformation pipeline builder (filter, transform, lookup, aggregate, join) |
| **Cross-Org** | Multi-org support with org switcher; cross-org data comparison with selective sync; schema comparison across orgs |
| **UX** | Dark mode; command palette; customizable keyboard shortcuts; onboarding wizard; contextual help tooltips |

---

## Phase 1 — Migration Core   *(shipped: 2026-03-22 → 2026-04-27, partial)*

| # | Feature | Status |
|---|---------|--------|
| 1.1 | Migration Project Workspace | ✅ Done |
| 1.2 | Multi-Object Orchestration | ⚠️ UI ready; per-object execution driver still partial |
| 1.3 | Generalised Dependency Graph | ⚠️ Types defined; no tests; cycle-break behaviour unverified |
| 1.4 | Persistent ID Map | ✅ Done (viewer + storage round-trip) |
| 1.5 | Navigation Restructure | ✅ Done (Migration is default landing) |

---

## Phase 0 — Stabilise Before Pushing Forward   *(NEW — must clear before Phase 2 work)*

These are the regressions and gaps surfaced by the 2026-04-27 audit. None of the Phase 2+ work should start until this is done.

| # | Item | Severity |
|---|------|----------|
| 0.1 | Cleanser Bulk Update applies to full dataset, not first 100 rows. `DataCleanserScreen.tsx:573` passes `previewSourceRows` — should be `dataset.sourceRecords`. | High |
| 0.2 | Data Push object dropdown filters by operation, not hard-coded `createable`. `DataPushScreen.tsx:437`. | High |
| 0.3 | DataPushScreen MessageBus cleanup. `useEffect` at `DataPushScreen.tsx:112` must return a function that calls `bus.off(...)` for the three handlers. | High |
| 0.4 | Clone Wizard: select all configured fields in source SOQL (currently `SELECT Id` only); use real inserted IDs instead of `pending_*` placeholders; finish cross-org tab selection in step 4. | High |
| 0.5 | Delete `.eslintrc.cjs` (keep `.eslintrc.js`); fix 7 lint errors; wire `npm run lint` into CI as a required gate. | High |
| 0.6 | Replace 13 silent `} catch {}` blocks in `Migration*Screen.tsx` with toast surfacing. | Medium |
| 0.7 | Migration test suite — minimum: dependency graph cycle break, ID-map round-trip, project CRUD, template apply. Target: 30+ tests. | High |
| 0.8 | Repo hygiene — remove committed `wavelink-0.1.0.zip`, fix `manifest.json` `homepage_url` (currently `jc-wave/wave-link`, should be `exotic209093/wavelink`), extend `.gitignore` (`*.zip`, `*.crx`, `.idea/`). | Low |
| 0.9 | `tsconfig.json` `baseUrl` deprecation — add `ignoreDeprecations: "6.0"` or restructure paths. | Low |

---

## Phase 2 — Migration Validation & Reporting

| # | Feature | Status | Priority |
|---|---------|--------|----------|
| 2.1 | Pre-Migration Validation Flow (schema gap + data quality scoring in one screen, run before execution) | ⚠️ Schema gap done; data quality scoring not wired | High |
| 2.2 | Post-Migration Validation (record counts source vs target; field-level spot check) | ❌ Tab stub only | High |
| 2.3 | Migration Progress Dashboard (real-time per-object progress bars, ETA, per-object status) | ❌ Type defined, no UI | **Highest** |
| 2.4 | Migration Summary Report (records per object, success rates, error summary, ID-map stats; HTML/CSV export) | ⚠️ Screen exists; population unverified | Medium |
| 2.5 | Migration-Level Rollback (delete all inserted records in reverse topological order) | ❌ | **Highest** |

---

## Phase 3 — Migration Templates & Field Mapping

| # | Feature | Status | Priority |
|---|---------|--------|----------|
| 3.1 | Migration Templates (save / list / apply) | ✅ Done | — |
| 3.2 | Cross-Org Field Mapping UI (visual source→target pairing, drag-and-drop, name-similarity auto-suggest, unmapped-required warnings) | ❌ | **Highest** |
| 3.3 | Selective Migration Filters (per-object WHERE clause, date-based incremental filter, record-set preview) | ❌ | High |
| 3.4 | Migration-Specific Transformations (`id_remap`, `picklist_map`, `org_specific_default` pipeline steps) | ❌ | Medium |

---

## Phase 4 — Advanced Migration

| # | Feature | Priority |
|---|---------|----------|
| 4.1 | Incremental / Delta Migration (cutoff date, last-migration timestamp per object) | Medium |
| 4.2 | Parallel Object Migration (independent objects run concurrently) | Medium |
| 4.3 | Advanced Rollback (capture pre-update field values, true restore not just delete) | Medium |
| 4.4 | Push Dry Run (simulate without committing; report would-succeed vs would-fail) | High |

---

## Phase 5 — Enterprise & Integrations

| # | Feature | Priority |
|---|---------|----------|
| 5.1 | CLI / Headless Mode for CI/CD (`npx wavelink migrate --project … --source … --target …`) | Medium |
| 5.2 | Webhook Notifications (Slack / Teams / custom on complete/fail) | Medium |
| 5.3 | Comprehensive Audit Trail (every migration / push / delete / rollback with user, timestamp, org, count; exportable) | Medium |
| 5.4 | Push Approval Workflow (require confirmation for pushes to PROD above record threshold) | Low |
| 5.5 | Sensitive Field Masking (PII detection + masking on export and in UI) | Low |

---

## Phase 6 — Performance & Scale

| # | Feature | Priority |
|---|---------|----------|
| 6.1 | Streaming Large Files (chunked reads, raise 25,000-record limit) | High |
| 6.2 | Parallel Bulk Jobs (split large datasets across multiple Bulk API 2.0 jobs) | Medium |
| 6.3 | **Offscreen Document** — keep migrations alive across service-worker eviction. Now blocking for credible multi-hour migrations. | **Highest** |
| 6.4 | Incremental Schema Cache (re-describe only changed objects) | Low |
| 6.5 | Code-split Migration screens out of the main `app/index.js` bundle (currently 747 KiB, limit 244 KiB) | Medium |
| 6.6 | Refactor `src/background/index.ts` (1,825 lines) into `auth/`, `push/`, `cache/`, `router.ts` modules | Medium |

---

## Phase 7 — Targeted Inspector Parity

The 2026-03-02 audit listed broad Salesforce Inspector parity gaps. With WaveLink's pivot to data-migration positioning (df1291b), most are out of scope. The single item worth keeping:

| # | Feature | Priority |
|---|---------|----------|
| 7.1 | API Explorer (REST / Tooling endpoint runner with headers / body / history) — cheap to bolt onto `src/ui/api/sf.ts`, genuinely useful during migration debugging | Medium |

---

## Ideas Backlog

| Idea | Notes |
|------|-------|
| Firefox / Edge Extension | Port to WebExtension manifest |
| Google Sheets Import | OAuth, sheet+range picker, live sync or one-time import |
| AI-Assisted Field Mapping | Use field names, types, sample data to auto-suggest source→target mappings |
| Git Integration for Data Versioning | Version-control datasets alongside code |
| Sandbox Seeding Profiles | Pre-built profiles (dev / QA / UAT) with object sets and record counts |
| Salesforce Flow Trigger on Migration Complete | |
| GraphQL API Support | Use Salesforce GraphQL for read operations |
| Apex Log Viewer | View / search debug logs in-extension |
| Permission Set Viewer | Browse and compare permission sets and profiles |
| Chrome Sync for Settings + Templates | Sync across devices via `chrome.storage.sync` |

---

## Suggested Sequencing for the Next Cycle

1. **Phase 0** end-to-end (one focused PR per item, all behind regression tests).
2. **2.3 Progress Dashboard + 2.5 Migration-Level Rollback** — together these turn the migration UI from "demo" into "trustable".
3. **3.2 Cross-Org Field Mapping UI** — visible win for the migration narrative.
4. **6.3 Offscreen Document** in parallel with the above (no UI overlap).
5. Then re-evaluate against actual user feedback before opening Phase 4.
