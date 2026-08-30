# Roadmap conformance ledger

Last audited: 2026-08-30

This ledger maps each roadmap release to executable evidence and separates work
that can be completed in the repository from evidence that requires Salesforce
orgs, owner walkthroughs, or publication assets. A green build is not treated as
proof of an external release gate.

## v0.2.1 — Trust and polish

| Requirement | Repository evidence | Status |
|---|---|---|
| Correct Compare semantics and key selection | `localDataDiff`, Compare UI, and diff unit tests | Complete |
| Correct routes, Org Health link, four-format exports, selected columns, schedule handoff | route, export, schedule-draft, and screen interaction tests | Complete |
| Keyboard/accessibility pass | named controls, modal focus handling, `jest-axe` component/primary-screen tests | Complete internally |
| Secure spreadsheet handling | SheetJS 0.20.3, lazy Excel import, audit gate | Complete |
| Primary interaction coverage and performance budgets | AppRoot renders every canonical destination with connected mocked boundaries; Jest plus CI coverage, entrypoint, lazy-asset, audit, and package-smoke gates | Complete |
| Real-org and production-warning packaged-extension matrix | full service and packaged Chromium evidence recorded in `docs/release-validation.md`, including typed production confirmation and rollback | Complete on maintainer dev box |

## v0.3 — Guided product and UI rework

| Requirement | Repository evidence | Status |
|---|---|---|
| Task-first shell, one-row navigation, Advanced separation, stable routes/back behavior | `AppRoot`, `AppShell`, route tests | Complete |
| Shared semantic visual system, themes, focus/reduced motion, responsive panel behavior, local SVG icons | shared CSS/tokens, `Icon`, accessibility tests, production preview | Complete internally |
| Stateful Export workspace | named reorderable tabs, per-tab columns/output, parameters, REST/Bulk choice, org-scoped persistence | Complete |
| Seven-stage Guided Import | Upload through Results stages, contextual help, mapping confidence, dry run and validation | Complete |
| Lookup resolution and blank semantics | ID/external-ID/related-field mapping and per-field ignore/clear controls with mapper tests | Complete |
| Full source-preserving success/error downloads and failed-row retry | push outcome dataset builder, Results actions, tests | Complete |
| Unified Activity and recovery | imports, scheduled runs, export/import checkpoints, filters, results, grouped errors, retry/resume/cancel/download/undo | Complete |
| Contextual onboarding with safe examples | onboarding examples preload bounded query/import data and completion is explicit | Complete |
| Maintainer-authorized walkthrough and refreshed store screenshots | `docs/release-validation.md`; five redacted 1280x800 PNGs in `screenshots/` | Complete |

## v0.4 — Scale and reliability

| Requirement | Repository evidence | Status |
|---|---|---|
| Bulk Query 2.0 and large exports | Bulk query API/UI, paged retrieval, chunked text downloads | Complete |
| Bounded parsing and writes | input limits, chunked parsing/output, REST batches, Bulk ingest, offscreen finalization | Complete |
| Durable status and recovery | persistent write and query checkpoints, Activity resume/cancel entry points, checkpoint tests | Complete internally |
| Progress, serial/concurrent modes, limits, timeouts | processed/failed progress, clamped concurrency, cancellation, polling bounds | Complete |
| Scheduling reliability | time zones, next-run preview, bounded run history, failure/reconnect state, storage forecast | Complete |
| Measured limits | `docs/large-job-limits.md` and guarded 100,000-row performance test | Complete |
| Worker/extension reload against Salesforce | Bulk Query resume passed after recreating the WaveLink service; the packaged extension was reloaded and successfully reconnected/query-ran afterward | Complete on maintainer dev box |

## v0.5 — Repeatable workflows

| Requirement | Repository evidence | Status |
|---|---|---|
| One versioned Saved Job definition | export/import/schedule legacy migration, revisions, duplication, favourites, run handoff | Complete |
| Credential-free org roles and portability | source/target runtime roles plus whitelist sanitizer that strips org IDs, secrets, records, and literal defaults | Complete |
| Full reusable configuration | object/operation/query/source, columns, transforms/lookups/null rules, API/safety/output/schedule/retention | Complete |
| Snapshot Center | job/org/object/status timeline, supported downloads, two-snapshot/live comparison, pinning, storage forecast, reviewed Import handoff | Complete |
| Three-click weekly workflow | Saved Job was created, opened, replayed, and returned a live result in the packaged build | Complete |

## v0.6 — Migration decision

The decision is implemented: the former multi-screen migration suite is removed
from normal navigation and lazy loading. **Copy between orgs** is a bounded,
one-object workflow with system-field stripping, dry-run review, explicit
external-ID handling, typed confirmation, and stated dependency/rollback limits.
Relationship-aware migration remains conditional on validated demand.

## Later differentiation

These items are intentionally not implementation commitments. The dated issue
audit in `docs/demand-research.md` found zero repository signals. An item moves
into a release only through a dated roadmap decision backed by a concrete
workflow, workaround, frequency, consequence, and evidence source. The evidence
queue is in `docs/release-validation.md`; no demand is inferred from repository
work and no tester count blocks the current release.
