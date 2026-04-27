# WaveLink Product Audit — 2026-04-27

> Previous audit: 2026-03-02. Roadmap last updated: 2026-03-22. 56 days have elapsed; Migration Phases 1–3 (5bb6511, b014564) and a SOQL builder overhaul (a87c3a9) shipped in that window.

---

## Build & Quality Snapshot

| Check | Result | Notes |
|-------|--------|-------|
| `npm run typecheck` | PASS | 0 errors |
| `npm test` | PASS | 26 suites, 346 tests |
| `npm run build` | PASS with warnings | `app/index.js` 747 KiB, `popup/index.js` 451 KiB (limit 244 KiB) |
| `npm run lint` | **FAIL** | 7 errors, 14 warnings (all in new Migration screens + query-builder) |

---

## 1. Regression: Previous "Fixes" Did Not Land

The 2026-03-02 audit listed five fixes as completed. Re-checking the source: **four of the five are still broken** in the current tree. Each was likely descoped, reverted, or never committed.

### 1.1 Cleanser Bulk Update — still updates only the first 100 rows

`src/ui/screens/DataCleanserScreen.tsx:208,573-580`

```ts
const previewSourceRows = useMemo(() => (dataset?.sourceRecords ?? []).slice(0, 100), …);
…
<BulkUpdateModal records={previewSourceRows}
  onApply={(updatedRecords) => {
    const recs = [...dataset.sourceRecords];
    for (let i = 0; i < Math.min(updatedRecords.length, recs.length); i++) {
      recs[i] = { ...recs[i], ...updatedRecords[i] };
    }
```

Modal receives 100 preview rows, computes 100 updated rows, and the merge loop bounds itself by `updatedRecords.length` — so rows 101+ are never touched. The "Apply to N records" label is misleading.

### 1.2 Data Push object dropdown — still hard-filters to `createable`

`src/ui/screens/DataPushScreen.tsx:436-437`

```ts
{availableObjects
  .filter(o => o.createable)
```

The `targetableFields` selector at line 203 was correctly generalised per operation, but the **object** dropdown was missed. update / upsert / delete cannot target objects that are not `createable`.

### 1.3 MessageBus listener leak in Data Push — no cleanup

`src/ui/screens/DataPushScreen.tsx:112-152`

`useEffect(() => { busRef.current = new MessageBus('app'); bus.on(...) }, [])` returns no cleanup. `MessageBus.off()` exists but is never called. On screen remount, listeners and bus instances accumulate.

### 1.4 Clone Wizard — placeholders still in place

`src/ui/screens/CloneWizardScreen.tsx`
- L8 header comment still reads "Step 4: Cross-org toggle - placeholder info about two-tab cross-org cloning."
- L191 source query is still `SELECT Id FROM ${objectName}` only — no field selection, so non-Id data is never cloned.
- L240 still uses `idMap.set(oldId, \`pending_${pushResult.pushId}_${i}\`)` — fake IDs persisted to the map.

### 1.5 ESLint config — present, but doubled

`.eslintrc.cjs` AND `.eslintrc.js` both exist with **conflicting rules** (the `.cjs` allows `any` and warns on unused vars; the `.js` warns on `any` and errors on unused vars). ESLint v8 picks `.eslintrc.js` first, so the stricter config wins — but the duplicate is a footgun for any future contributor.

---

## 2. New Issues from Migration Phases 1–3

### 2.1 Lint errors in new screens

```
MigrationProjectsScreen.tsx:39      unused param `tabId`         (rename to _tabId)
MigrationTemplatesScreen.tsx:19     unused param `tabId`
MigrationWorkspaceScreen.tsx:43     unused var   `describes`
MigrationWorkspaceScreen.tsx:363    unused param `i`
IdMapViewerScreen.tsx:11            unused type  `IdMapEntry`
SubqueryBuilder.tsx:35              unused param `childObject`   (pre-existing, slipped in)
WhereBuilder.tsx:152                unused var   `simpleLiterals`
```

Plus 14 `@typescript-eslint/no-explicit-any` warnings concentrated in the same files. CI (if added) will fail on errors.

### 2.2 Silent error swallowing across Migration screens

13 `} catch { /* nothing */ }` blocks across `MigrationProjectsScreen`, `MigrationTemplatesScreen`, `MigrationReportsScreen`, `MigrationValidationScreen`. Failures (Salesforce auth, network, storage quota) leave the user staring at an empty list or a stuck spinner with no toast. The other screens use `setToast({ title, body })` — the migration screens should match.

### 2.3 Roadmap Phase 1–3 status, verified

| Roadmap item | Implemented | Notes |
|---|---|---|
| 1.1 Migration Project Workspace | ✅ | `MigrationProjectsScreen.tsx`, `MigrationWorkspaceScreen.tsx` |
| 1.2 Multi-Object Orchestration | ⚠️ Partial | UI flow exists; per-object execute path not yet wired to a real driver |
| 1.3 Generalised Dependency Graph | ⚠️ Partial | Types defined (`src/core/types/migration.ts:131`), no tests, cycle-resolution behaviour unverified |
| 1.4 Persistent ID Map | ✅ | Viewer at `IdMapViewerScreen.tsx`, storage round-trip exists |
| 1.5 Navigation Restructure | ✅ | Migration is the default landing route |
| 2.1 Pre-Migration Validation | ⚠️ Partial | Schema-gap path implemented; data-quality scoring not wired |
| 2.2 Post-Migration Validation | ❌ | Tab stub only; no record-count comparison |
| 2.3 Migration Progress Dashboard | ❌ | Type defined, no UI |
| 2.4 Migration Summary Report | ⚠️ Partial | Screen exists; report population unverified |
| 2.5 Migration-Level Rollback | ❌ | Not implemented |
| 3.1 Migration Templates | ✅ | Save/list/apply working |
| 3.2 Cross-Org Field Mapping UI | ❌ | Type only; no visual mapper |
| 3.3 Selective Migration Filters | ❌ | `filter` field exists; no UI |
| 3.4 Migration-Specific Transformations | ❌ | No `id_remap` / `picklist_map` / `org_specific_default` steps |

---

## 3. Test Coverage Gap

346 tests pass and unit-test coverage of the legacy product is solid (cleanser, mapper, validator, push results, SOQL parser, undo, formulas, duplicates, …). **Zero tests exercise the migration code path.** No test for `buildMigrationGraph`, project CRUD, ID-map round-trip, validation flow, or template apply. This is the largest single quality risk in the repo right now.

---

## 4. Repo Hygiene

- **`wavelink-0.1.0.zip` (410 KiB) is committed at repo root.** It's a build artifact produced by `npm run package` and should be in `.gitignore` and `dist/` only. Same for `package-lock.json` churn from rebuilds (kept, but watch).
- **`public/manifest.json` `homepage_url` points to `jc-wave/wave-link`** — the actual repo is `exotic209093/wavelink`. Update before the next Web Store submission.
- `.gitignore` is missing: `*.zip`, `*.crx`, `.idea/`, build artifacts.
- Two ESLint configs (see 1.5).
- `tsconfig.json` uses deprecated `baseUrl` (TS 7.0 will reject without `ignoreDeprecations: "6.0"`). Not urgent but loud in the next major bump.

---

## 5. Tech Debt Hotspots

| File | Lines | Concern |
|---|---|---|
| `src/background/index.ts` | 1,825 | One service worker handling auth + push + cache + 60+ message handlers. Hard to test, hard to reason about lifecycle. Ripe for a split into `auth/`, `push/`, `cache/`, `router.ts`. |
| `src/ui/styles/uiCss.ts` | 1,630 | CSS-in-JS, OK for now but candidate for chunk-splitting via lazy load. |
| `src/ui/screens/RelationshipExplorerScreen.tsx` | 939 | Graph rendering + filtering + querying in one file. Split graph view from controls. |
| `src/ui/screens/DataPushScreen.tsx` | 852 | Mapping + validation + push + retry in one component. Listener leak (1.3) lives here. |

Bundle size remains the same as last audit — no progress on roadmap item 6 (Performance & Scale). With migration features now in scope, lazy-loading migration screens out of the main `app/index.js` chunk would be the cheapest win.

---

## 6. Manifest V3 Lifecycle Risk

The service worker can be evicted after ~30 s of idle. Long migrations rely on it staying alive. The roadmap captures this (item 6.3 Offscreen Document) but it's still untouched. With Migration Projects now the headline feature, this moves up the priority list — a multi-hour cross-org migration that dies mid-flight is a worse demo than not having migrations at all.

---

## 7. Salesforce Inspector Parity

No movement on the parity gaps the previous audit listed (Data Inspect panel, API Explorer, Metadata retrieve, Event monitoring, Flow Scanner, Field creator, Admin shortcuts). With WaveLink's pivot to data-migration positioning (df1291b), most of these are explicitly out of scope — except possibly **API Explorer**, which is genuinely useful during migration debugging and would be cheap to bolt onto the existing `sf` API wrapper.

---

## 8. Recommended Priority Order

1. **Land the four still-broken fixes from the previous audit** (Bulk Update scope, object filter, MessageBus cleanup, Clone Wizard correctness). Add a regression test for each.
2. **Delete `.eslintrc.cjs`**, fix the 7 lint errors, get the lint gate to zero so it can go in CI.
3. **Add migration tests** — at minimum: dependency graph cycle-break, ID-map round-trip, project CRUD, template apply.
4. **Replace silent `} catch {}` in migration screens** with toast surfacing.
5. **Phase 2.3 Progress Dashboard + Phase 2.5 Migration-Level Rollback** — both are blockers for a credible "real migration" demo.
6. **Phase 3.2 Cross-Org Field Mapping UI** — closes the most visible gap in the migration workspace.
7. **Phase 6.3 Offscreen Document** — required for migrations of any meaningful size to survive SW eviction.
8. **Repo hygiene**: drop `wavelink-0.1.0.zip`, fix manifest `homepage_url`, expand `.gitignore`, address `baseUrl` deprecation.
