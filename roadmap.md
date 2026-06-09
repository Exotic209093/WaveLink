# WaveLink Roadmap

> Last updated: 2026-06-08
> Status: **Live on the Chrome Web Store** (v0.2.0)
> See [WAVELINK_AUDIT_2026-06-08.md](WAVELINK_AUDIT_2026-06-08.md) for the audit that informed this update.

---

## Where we are

WaveLink shipped **v0.2.0** and is **published on the Chrome Web Store**. The
product repositioned from a broad "Salesforce data migration" tool to a focused
**fast Salesforce data export & import** tool. The front door is now a Home hub
with **Export / Import / Convert / Compare / Templates / Schedules** as the
primary flows; the 20+ power-user screens and the full migration suite are still
shipped but live behind the **Advanced** hub and the **Migration** section.

Everything runs locally — the only network calls are to the user's own
Salesforce orgs. No telemetry, no backend.

### Health snapshot (re-run 2026-06-08)

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ PASS (0 errors) |
| `npm run lint` | ✅ 0 errors, 14 `any` warnings |
| `npm test` | ✅ 397 tests, 31 suites, all green |
| `npm run build` | ⚠️ builds, but `app/index.js` is **949 KiB** and `popup/index.js` **478 KiB** (limit 244 KiB) — no code-splitting |

The April "Phase 0" stabilisation work largely landed: single ESLint config,
corrected manifest `homepage_url`, removed the committed build zip, cleared the
7 lint errors, and the Clone Wizard `pending_*` placeholder bug is gone.

---

## Completed

### v0.2.0 — Export / Import pivot *(2026-06-08, on the Web Store)*

| Area | Features |
|------|----------|
| **Export** | SOQL export with preview; multi-format download (CSV / JSON / Excel / XML); query builder with aggregates, GROUP BY, subqueries, highlighting, autocomplete, history, explain plans |
| **Scheduled snapshots** | Recurring exports via `chrome.alarms`, configurable interval + retention, captured in the background worker |
| **Import** | Push CSV / JSON / Excel via REST Collections or Bulk API 2.0; field mapping; transforms; retry; type-to-confirm deletes; **import dry-run pre-flight**; **live push-progress dashboard** with cancel / retry / stored-ID views |
| **Convert** | Offline CSV ↔ JSON ↔ Excel ↔ XML converter (no org connection needed) |
| **Compare** | Unified diff screen — local files / snapshots offline, or two live orgs field-by-field with selective sync |
| **Cleanser** | Column rename / drop / reorder; bulk updates with formula interpolation + conditional rules; data-quality scoring |
| **UX** | Home hub; Advanced hub; refreshed in-page panel; consistent button system; in-app dialogs replacing native prompts; accessibility pass (labelled icon controls, dialog roles) |

### v0.1.0 — Foundation

Data push (REST + Bulk 2.0); CSV/JSON/Excel import & multi-format export;
cleanser; SOQL builder; schema comparison & field analytics; relationship
explorer; API usage dashboard; test data generator; template library;
duplicate detection + merge wizard; cross-object cloning; bulk object ops;
data-quality scorecards; undo/redo; visual pipeline builder; multi-org support;
dark mode; command palette; customizable shortcuts; onboarding; help tooltips.

### Migration suite — present, demoted to Advanced

Migration Projects, persistent ID maps, migration templates, schema gap
analysis, and a validation/reports surface all ship today but sit behind the
Advanced/Migration navigation. They are **lightly tested** (see Audit §
Test gaps) and not part of the headline narrative.

---

## Now — Stabilise the shipped product

These harden what's already in users' hands. Nothing below requires new product
scope.

| # | Item | Why | Effort |
|---|------|-----|--------|
| N.1 | ~~**Code-split the bundle.**~~ ✅ Done — app `949→738 KiB` (#26), popup `478→190 KiB`. Advanced/Migration screens (app) and the non-default popup tabs lazy-load from `dist/chunks/`. | `app` was 949 KiB / `popup` 478 KiB vs a 244 KiB budget. | M |
| N.2 | ~~**Clear the `any` warnings + CI gates.**~~ ✅ Done (#26) — 0 lint warnings; `typecheck`/`lint --max-warnings=0`/`test`/`build` run in CI. | Locked in before it regresses. | S |
| N.3 | **Tests for the new 0.2 flows** — Convert round-trips, Compare, export multi-format, file parsing ✅ (#26); streaming capture ✅; still want scheduled-snapshot scheduling/retention + import dry-run. | These are the features users actually touch now. | M |
| N.4 | ~~**Decide the migration suite's fate.**~~ ✅ Done — gated behind an **experimental** flag in Settings (default off). The Migration nav hides unless opted in, and direct navigation shows an opt-in notice. Testing it to a trustable bar remains optional future work if it graduates. | Shipping barely-tested complex code was the biggest correctness risk. | S |

---

## Next — Sharpen the export/import core

The features that deepen the new positioning.

| # | Feature | Notes | Priority |
|---|---------|-------|----------|
| E.1 | **Streaming large exports/imports** | ◐ Scheduled capture now pages through the full result set (`queryAllRecords`) instead of keeping only the first ~2000 rows. Still want chunked file reads/writes and to raise the 25,000-record import ceiling. | High |
| E.2 | **Offscreen Document for long-running jobs** | ◐ Implemented for scheduled capture (worker delegates the query to an offscreen document, falls back to the worker if unavailable). Pending a browser smoke-test; extend to large pushes next. | High |
| E.3 | **Saved/parameterised export queries** | Named queries with `:bind` parameters reusable across Export, Schedules, and Templates. | Medium |
| E.4 | **Snapshot management UX** | Browse, restore, re-download, and diff historical snapshots from one place; storage-quota awareness. | Medium |
| E.5 | **Import field-mapping polish** | Name-similarity auto-suggest, unmapped-required warnings, and reusable mapping profiles. | Medium |
| E.6 | **API Explorer** | REST / Tooling endpoint runner (headers / body / history) bolted onto `src/ui/api/sf.ts` — cheap and genuinely useful for debugging exports/imports. | Low |

---

## Later — Platform & reach

| # | Item | Notes |
|---|------|-------|
| P.1 | **Refactor `src/background/index.ts`** (~1,825 lines) into `auth/`, `push/`, `cache/`, `schedules/`, `router.ts`. | Hard to test/reason about as one worker; growing. |
| P.2 | **Incremental schema cache** | Re-describe only changed objects. |
| P.3 | **Firefox / Edge port** | WebExtension manifest. |
| P.4 | **Chrome Sync for settings + templates** | Sync across devices via `chrome.storage.sync`. |
| P.5 | **Google Sheets import** | OAuth + sheet/range picker, one-time or live. |
| P.6 | **Sensitive-field masking** | PII detection + masking on export and in the UI. |

---

## Ideas Backlog

| Idea | Notes |
|------|-------|
| AI-assisted field mapping | Use field names, types, and sample data to auto-suggest source→target mappings on import. |
| Git integration for data versioning | Version-control exported snapshots alongside code. |
| Sandbox seeding profiles | Pre-built dev / QA / UAT object sets + record counts. |
| GraphQL read support | Use Salesforce GraphQL for export reads. |
| Apex log viewer | View / search debug logs in-extension. |
| Permission set / profile viewer | Browse and compare. |

---

## Suggested sequencing for the next cycle

1. **N.1 Code-split** + **N.2 CI gates** — ship a measurably lighter, regression-protected build first.
2. **N.3 Tests for the 0.2 flows** + **N.4 migration decision** — make what we shipped trustable.
3. **E.2 Offscreen Document** + **E.1 Streaming** — the two that make scheduled snapshots and large jobs actually reliable.
4. **E.3–E.5** export/import depth, then re-evaluate against Web Store reviews and real user feedback before opening the "Later" tier.
