# WaveLink Product Audit - 2026-03-02

## Implementation Status (Updated 2026-03-02)

### Completed in this pass
1. Fixed Cleanser bulk update to apply across the full dataset (not just first 100 rows).
2. Hardened Clone Wizard:
- Added real cross-org source/target tab selection (Step 4).
- Switched execution to use real push-result polling and ID remapping.
- Removed placeholder ID mapping (`pending_*`) behavior.
3. Fixed Data Push object eligibility list by operation:
- insert -> createable
- update -> updateable
- upsert -> createable or updateable
- delete -> deletable
4. Added MessageBus cleanup on Data Push screen unmount to prevent listener accumulation.
5. Restored lint command execution:
- Added ESLint config and `eslint-plugin-react-hooks`.
- `npm run lint` now runs and exits successfully (currently with warnings).

### Still pending from this audit
1. Resolve existing lint warnings (121 warnings currently).
2. Build parity features still missing vs Salesforce Inspector (Data Inspect panel, API Explorer, metadata retrieve, etc.).
3. README/doc cleanup to remove outdated "not implemented yet" items.

## 1) Current State (What We Have Today)

### Build and quality snapshot
- `npm run typecheck`: pass
- `npm test`: pass (26 suites, 313 tests)
- `npm run build`: pass (bundle size warnings only)
- `npm run lint`: fails (no ESLint config file in repo)

### Product surface implemented

#### Full app (`src/ui/app/AppRoot.tsx`)
- Query + autocomplete + query builder + saved queries/folders
- Objects/fields explorer
- Data push (insert/update/upsert/delete), REST/Bulk auto strategy, retry failed rows
- Push history and detail modal
- Data cleanser (column transforms, validation, export), Org Health, Coverage
- Templates library
- Test data generator
- Schema comparison
- Field analytics
- Duplicate detection + merge wizard
- Pipeline builder
- Clone wizard (partially placeholder, see bugs section)
- Data quality scorecards
- API usage dashboard
- Bulk object operations
- Relationship explorer
- Help + onboarding
- Settings (theme, storage, backup/restore, keyboard shortcuts, advanced tuning)

#### Popup (`src/ui/popup/PopupRoot.tsx`)
- Data push, templates, history, settings
- Quick actions: open full app, toggle in-page panel

#### In-page panel (`src/ui/panel/PanelRoot.tsx`)
- Query, objects, settings

## 2) Confirmed Bugs and Product Gaps

### High severity
1. **Bulk Update in Cleanser only updates the first 100 records**
- Evidence:
  - Modal is passed `previewSourceRows` (first 100): `src/ui/screens/DataCleanserScreen.tsx:209`, `src/ui/screens/DataCleanserScreen.tsx:574`
  - Modal UI says "Apply to N records": `src/ui/components/BulkUpdateModal.tsx:192`
- Impact: user expects full dataset update but only a subset is mutated.

2. **Clone Wizard is not functionally complete for real cloning**
- Evidence:
  - Cross-org step is explicitly placeholder: `src/ui/screens/CloneWizardScreen.tsx:409-412`
  - Source query only selects `Id`, so non-Id field data is not cloned: `src/ui/screens/CloneWizardScreen.tsx` (SOQL in `executeClone`)
  - Id remapping uses temporary `pending_*` placeholders instead of real inserted Ids: `src/ui/screens/CloneWizardScreen.tsx:240`
- Impact: cross-object clone can fail or produce invalid references; roadmap status overstates readiness.

### Medium severity
3. **Data Push object list filters to `createable` objects for all operations**
- Evidence: `src/ui/screens/DataPushScreen.tsx:438`
- Impact: update/delete flows cannot target valid non-createable objects.

4. **Potential message-listener leak in Data Push screen**
- Evidence: new `MessageBus('app')` and handlers are registered in `useEffect`, with no cleanup/destroy call shown before unmount: `src/ui/screens/DataPushScreen.tsx:113-153`
- Impact: if screen remounts, duplicate listeners can accumulate and duplicate progress updates.

5. **Lint pipeline is configured but non-functional**
- Evidence:
  - lint scripts exist: `package.json:12-13`
  - no `.eslintrc*` or `eslint.config.*` file present in repo
- Impact: code-style/static-quality gate cannot run in CI or local workflows.

### Low severity
6. **Docs drift between README and implemented product**
- Evidence:
  - README marks features as "not implemented yet": `README.md:16+`
  - same capabilities exist in code (retry rows, typed confirm, push history detail, column reordering, org health, coverage)
- Impact: planning confusion and inaccurate stakeholder expectations.

## 3) Salesforce Inspector Parity Gaps (Features We Still Need)

Based on Salesforce Inspector Reloaded feature docs/repo, these are notable gaps in WaveLink:

1. **Data Inspect panel on record pages**
- Need: one-click inspection of current record data/metadata from page context.

2. **Metadata download/retrieve workflow**
- Need: retrieve metadata in extension (and ideally store/export selected metadata bundles).

3. **API Explorer (REST/SOAP/Tooling call builder)**
- Need: generic endpoint runner with headers/body/history.

4. **Event monitoring tooling**
- Need: inspect platform events and event logs in-app.

5. **Flow Scanner / flow diagnostics**
- Need: flow inventory + dependency/risk scanner.

6. **Field creator/editor utilities**
- Need: create/adjust fields from UI, including common templates.

7. **Admin shortcuts and setup jump tools**
- Need: quick links/actions for common Salesforce setup/admin pages.

8. **User/permission/connected-app admin utilities (if in scope)**
- Need: parity with Inspector-style admin tabs only if WaveLink is targeting admin workflows beyond data operations.

## 4) Features to Build That Are Likely Not in Current Inspector-Style Tools

These are candidate differentiators that appear uncommon in current browser-extension tooling:

1. **Deterministic seed snapshots with replay guarantees**
- Capture dataset + mapping + transforms + schema fingerprint so test data can be replayed exactly across orgs.

2. **Org drift auto-repair for templates/pipelines**
- Auto-detect missing/renamed fields and suggest safe remaps before push.

3. **Policy-as-code preflight rules**
- Team-level push policies (forbidden objects/fields, production safety gates, PII guards).

4. **End-to-end dry run with impact simulation**
- Simulate writes and produce a "would change" report before execution.

5. **Recoverable transaction bundles for multi-object operations**
- Extend undo from simple insert rollback to coordinated multi-object rollback plans.

6. **Scenario runner for synthetic data environments**
- Named repeatable scenarios (small/medium/large datasets, edge-case generators, expected outcome checks).

## 5) Recommended Priority Order

1. Fix high-severity functional bugs (Bulk Update scope, Clone Wizard correctness).
2. Restore engineering hygiene (ESLint config + lint gate).
3. Deliver top Inspector parity items (Data Inspect, API Explorer, Metadata retrieve).
4. Build 1-2 differentiator features (org drift auto-repair + policy-as-code preflight).

## Sources (Inspector / market reference)
- Salesforce Inspector Reloaded README and feature set: https://github.com/tprouvot/Salesforce-Inspector-reloaded
- Salesforce Inspector Reloaded docs: https://tprouvot.github.io/Salesforce-Inspector-reloaded/
- Inspector release notes (feature evolution): https://github.com/tprouvot/Salesforce-Inspector-reloaded/releases
- Salesforce Inspector (original) README: https://github.com/sorenkrabbe/Chrome-Salesforce-inspector
- Example public Inspector issues (for known pain points):
  - https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/765
  - https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/541
