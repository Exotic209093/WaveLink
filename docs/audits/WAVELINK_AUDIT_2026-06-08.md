> **Historical document.** This audit predates the v0.6.0 rework and describes superseded behavior. It is preserved for project history; see [roadmap.md](../../roadmap.md) for current status.

# WaveLink Product Audit — 2026-06-08

> Previous audit: 2026-04-27. Since then WaveLink shipped **v0.2.0**, repositioned
> from a migration tool to a focused **data export & import** tool, and is now
> **published on the Chrome Web Store**. This audit re-runs every quality gate
> against the current tree rather than trusting prior reports.

---

## Build & Quality Snapshot

| Check | 2026-04-27 | **2026-06-08** | Notes |
|-------|-----------|----------------|-------|
| `npm run typecheck` | PASS | ✅ PASS | 0 errors |
| `npm test` | 346 tests | ✅ **397 tests, 31 suites** | all green, ~2.6 s |
| `npm run lint` | **FAIL** (7 err, 14 warn) | ✅ **0 errors, 14 warnings** | warnings all `@typescript-eslint/no-explicit-any` |
| `npm run build` | `app` 747 KiB / `popup` 451 KiB | ⚠️ **`app` 949 KiB / `popup` 478 KiB** | both ~4× the 244 KiB budget; **regressed**, no code-splitting |

---

## 1. April "Phase 0" — what landed

The 2026-04-27 audit opened a Phase 0 stabilisation list. Re-checking the tree:

| Item | Status |
|------|--------|
| 0.5 Delete duplicate `.eslintrc.cjs`; fix 7 lint errors | ✅ Single `.eslintrc.js`; lint at 0 errors |
| 0.8 Remove committed `wavelink-0.1.0.zip`; fix manifest `homepage_url` | ✅ Zip gone; `homepage_url` now `Exotic209093/WaveLink` |
| 0.4 Clone Wizard `pending_*` placeholders | ✅ No `pending_*` IDs remain in `CloneWizardScreen.tsx` |
| 0.6 Silent `} catch {}` in migration screens | ◐ Partially — many screens now surface toasts; not re-verified exhaustively |
| 0.1 / 0.2 / 0.3 Cleanser scope / object filter / MessageBus cleanup | ◐ Not re-verified line-by-line this pass; legacy screens now sit behind Advanced |

Net: the repo-hygiene and lint blockers are cleared. The product moved on from
"migration core" to the export/import pivot, which reframed several of the old
items as Advanced-tier concerns.

---

## 2. The 0.2.0 repositioning

- **Manifest & store**: name is *"WaveLink — Salesforce Data Export & Import"*, version `0.2.0`, published.
- **Navigation** (`src/ui/app/AppRoot.tsx`): Home / Export / Import / Convert are the primary Workflow group; Templates / Schedules / Compare under Library; the full migration suite under a Migration group; 13 power-user tools behind the Advanced hub (reachable via command palette).
- **New screens**: `HomeScreen`, `ExportScreen`, `ImportScreen`, `ConvertScreen`, `SchedulesScreen`, `CompareScreen` (merges the former Diff + Data Comparison), `AdvancedLabScreen`.

### Metadata drift fixed in this pass
- `package.json` was still `0.1.0` + the old *"Salesforce Data Migration & Management Tool"* description while the manifest said `0.2.0`. **Corrected** to `0.2.0` and the export/import description.
- `README.md` still **led with Migration**. **Rewritten** to lead with Export / Import / Convert / Compare and note the live Web Store listing; migration demoted to an Advanced section.
- `roadmap.md` was the April migration-first plan and contradicted the pivot. **Replaced** with an export/import-focused roadmap.

---

## 3. Largest current risks

### 3.1 Bundle size (regressed) — highest technical-debt item
`app/index.js` is **949 KiB** (was 747) and `popup/index.js` **478 KiB** (was 451),
both far over the 244 KiB recommendation. `AppRoot.tsx` eagerly imports all 37
screens — including 13 Advanced tools and the entire migration suite — into the
main chunk. A typical export/import user downloads all of it. Dynamic `import()`
for the Advanced/Migration screens is the cheapest, highest-impact win and would
likely halve the main chunk.

### 3.2 Test coverage skewed to the legacy product
397 tests cover cleanser, mapper, validator, push results, SOQL parser/builder,
undo, formulas, duplicates, dependency graph, schema diff, push dry-run, metrics,
etc. — solid. But the **new 0.2 headline flows** (scheduled snapshots, Convert,
Compare modes, import dry-run end-to-end) and the **migration code paths** are
thin to untested. The features users now touch most are the least covered.

### 3.3 Migration suite: shipped but barely tested
The migration screens remain in the bundle and navigation but aren't part of the
narrative and lack a trustable test bar. Decide: test it up, or gate it behind an
explicit experimental flag.

### 3.4 MV3 service-worker lifecycle
Scheduled snapshots run in the background worker via `chrome.alarms`; large
pushes also rely on the worker. The worker can be evicted while idle. No
offscreen document yet — a real reliability gap for scheduled/long jobs now that
scheduling is a shipped feature.

---

## 4. Tech-debt hotspots (unchanged from April)

| File | ~Lines | Concern |
|---|---|---|
| `src/background/index.ts` | ~1,825 | Auth + push + cache + schedules + many message handlers in one worker. Split into modules. |
| `src/ui/styles/uiCss.ts` | ~1,630 | CSS-in-JS; candidate for lazy-load chunk-splitting. |
| `src/ui/screens/RelationshipExplorerScreen.tsx` | ~939 | Graph + filtering + querying in one file. |
| `src/ui/screens/DataPushScreen.tsx` | ~852 | Mapping + validation + push + retry in one component. |

---

## 5. Recommended priority order

1. **Code-split** the Advanced/Migration screens out of `app/index.js`; bring the bundle back toward budget.
2. **Lock CI gates** (lint 0-errors, typecheck, test) and clear the 14 `any` warnings.
3. **Test the 0.2 flows** — schedules, Convert, Compare, import dry-run.
4. **Resolve the migration suite** — test up or flag as experimental.
5. **Offscreen Document + streaming** for reliable scheduled snapshots and large jobs.
6. **Refactor `src/background/index.ts`** as it keeps growing.
