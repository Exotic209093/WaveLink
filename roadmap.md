# WaveLink Feature Roadmap

> Last updated: 2026-02-17

---

## Progress Overview

| Batch | Feature | Status |
|-------|---------|--------|
| 1.1 | Dark Mode & Theme System | ✅ Complete |
| 1.2 | Multi-Format Export Infrastructure | ✅ Complete |
| 1.3 | Drag-and-Drop File Import | ✅ Complete |
| 2.1 | Retry Failed Rows | ✅ Complete |
| 2.2 | Safer Delete Confirmations | ✅ Complete |
| 2.3 | Push History Detail View | ✅ Complete |
| 3.1 | Enhanced Query History with Folders | 🔄 In Progress |
| 3.2 | Cleanser Column Reordering | ⏳ Pending |
| 3.3 | Bulk Field Updates | ⏳ Pending |
| 4.1 | Advanced Keyboard Shortcuts | ⏳ Pending |
| 5.1 | Test Data Generator | ⏳ Pending |
| 5.2 | Data Templates Library | ⏳ Pending |
| 5.3 | Schema Comparison | ⏳ Pending |
| 5.4 | Field Usage Analytics | ⏳ Pending |
| 6.1 | Duplicate Detection & Merging | ⏳ Pending |
| 6.2 | Undo/Redo Operations | ⏳ Pending |
| 7.1 | Data Transformation Pipelines | ⏳ Pending |
| 7.2 | Cross-Object Data Cloning | ⏳ Pending |

---

## BATCH 1: Core Infrastructure ✅

### 1.1 Dark Mode & Theme System ✅
**What was built:**
- `src/ui/utils/theme.ts` — theme management utilities (resolveTheme, applyTheme, watchSystemTheme)
- `src/ui/components/ThemeToggle.tsx` — cycles through light / dark / auto
- Dark CSS variables in `src/ui/styles/uiCss.ts` (`data-theme="dark"` on `:host` / `:root`)
- Theme persisted to `UiSettings.theme` in chrome.storage
- Auto-detects system preference when set to `auto`
- Integrated into `AppShell.tsx`, `AppRoot.tsx`, and `PanelRoot.tsx`

---

### 1.2 Multi-Format Export Infrastructure ✅
**What was built:**
- `src/ui/utils/export.ts` — unified export service (CSV, JSON, Excel, XML)
- `src/ui/utils/excel.ts` — SheetJS-based Excel export with auto-sized columns
- `src/ui/utils/xml.ts` — Salesforce-compatible XML with proper character escaping
- `src/ui/components/ExportModal.tsx` — format picker, filename input, column selector, format-specific options
- `src/ui/utils/download.ts` — in-memory Blob download helper

**Dependencies added:** `xlsx`

---

### 1.3 Drag-and-Drop File Import ✅
**What was built:**
- `src/ui/components/DropZone.tsx` — reusable drag-drop zone with visual overlay, file-type validation, keyboard accessibility
- Integrated into `DataPushScreen.tsx` (empty state)
- Integrated into `DatasetHeader.tsx` in the Cleanser screen
- CSS styles added to `uiCss.ts`

---

## BATCH 2: Quick Wins ✅

### 2.1 Retry Failed Rows ✅
**What was built:**
- `src/ui/utils/pushRetry.ts` — buildRetryDataset(), groupErrorsByMessage(), getTopErrors()
- `src/ui/components/RetryModal.tsx` — shows top-3 error messages with counts, "Generate Retry Dataset" CTA
- `DataPushScreen.tsx` — saves push config (sourceRecords + mappings) on push start; shows "Retry Failed Rows" button when push completes with failures; restores field mappings on retry
- `background/index.ts` — DATA_PUSH_COMPLETE broadcast now includes `errors[]`
- `messaging.ts` — `DataPushProgressPayload` extended with optional `errors` field

---

### 2.2 Safer Delete Confirmations ✅
**What was built:**
- `src/ui/components/TypedConfirmModal.tsx` — type-to-confirm modal; confirm button locked until phrase matches exactly; auto-focuses input
- `DataPushScreen.tsx` — delete operations now use TypedConfirmModal with phrase `DELETE N RECORDS`
- `SettingsScreen.tsx` — "Clear Saved Queries" uses TypedConfirmModal with phrase `CLEAR QUERIES`

---

### 2.3 Push History Detail View ✅
**What was built:**
- `src/ui/screens/PushHistoryScreen.tsx` — table view with sort (click column header) and filter (operation type, object name search)
- `src/ui/components/PushHistoryDetail.tsx` — modal showing full entry: chips summary, error groups sorted by count, per-group record indices, export errors to CSV/JSON
- `src/ui/app/AppRoot.tsx` — "Push History" added to nav
- `messaging.ts` — added `PUSH_HISTORY_GET` message type + `PushHistoryGetResponse`
- `sf.ts` (SfApi) — added `getPushHistory()` method
- `background/index.ts` — added `PUSH_HISTORY_GET` handler
- CSS — added `--wl-success`, `--wl-success-bg`, `--wl-danger-bg`, `--wl-accent-bg`, `.wl-rowHighlight`

---

## BATCH 3: Power User Features Part 1 🔄

### 3.1 Enhanced Query History with Folders 🔄
**Progress: Storage layer complete, UI pending**

**Completed:**
- `storage.ts` — `SavedQuery` extended with `folderId`, `favorite`, `tags`, `executionCount`, `lastExecutedAt`
- `storage.ts` — new `QueryFolder` interface (`id`, `name`, `parentId`, `createdAt`)
- `LocalStorageSchema` — added `queryFolders` field
- `constants/index.ts` — added `QUERY_FOLDERS` storage key
- `StorageService` — `upsertSavedQuery` preserves new fields; added `incrementQueryExecution()`, `getQueryFolders()`, `upsertQueryFolder()`, `deleteQueryFolder()`

**Still to do:**
- `src/ui/components/QueryManager.tsx` — sidebar panel: folder tree + query list, favorites filter, search, drag-to-folder
- `src/ui/components/QueryFolderTree.tsx` — collapsible folder tree with create/rename/delete
- Add `QUERY_FOLDERS_GET`, `QUERY_FOLDERS_UPSERT`, `QUERY_FOLDERS_DELETE` message types + background handlers
- Add `listQueryFolders()`, `upsertQueryFolder()`, `deleteQueryFolder()` to `SfApi`
- Integrate QueryManager into `QueryScreen.tsx`
- Import/export queries as JSON

---

### 3.2 Cleanser Column Reordering ⏳
**Plan:**
- `src/ui/utils/dragDrop.ts` — reusable drag-drop utilities (HTML5 DnD)
- `ColumnList.tsx` — drag handle on each row, drop indicator between rows
- Keyboard accessibility: Alt+Up / Alt+Down to move columns
- CSS styles in `uiCss.ts`

---

### 3.3 Bulk Field Updates ⏳
**Plan:**
- `src/ui/components/cleanser/BulkUpdateModal.tsx` — select target columns, choose transformation, apply
- `src/ui/components/cleanser/ConditionalBuilder.tsx` — build IF col == value THEN apply logic
- `src/ui/utils/formulas.ts` — template interpolation e.g. `{FirstName} {LastName}`
- Hook into existing cleanser `BulkActions.tsx`
- Preview affected rows before applying

---

## BATCH 4: Power User Features Part 2

### 4.1 Advanced Keyboard Shortcuts ⏳
**Plan:**
- `src/ui/utils/shortcuts.ts` — shortcut registry, conflict detection, persistence
- `src/ui/components/CommandPalette.tsx` — fuzzy-searchable command list, triggered by `Ctrl+K`
- `src/ui/components/ShortcutEditor.tsx` — customisation UI in Settings
- Default shortcuts: `Ctrl+K` (palette), `Ctrl+Enter` (run query), `Ctrl+P` (push), `Ctrl+T` (theme toggle)
- Persist custom bindings to `UiSettings`

---

## BATCH 5: Developer Productivity

### 5.1 Test Data Generator ⏳
**Plan:**
- `src/ui/utils/testDataGenerator.ts` — maps Salesforce field types to @faker-js/faker generators; relationship-aware (child IDs match parent)
- `src/ui/components/TestDataGeneratorModal.tsx` — configure record count, null %, per-field generator
- `src/ui/components/FieldGeneratorConfig.tsx` — per-field type/pattern override
- `src/ui/components/RelationshipConfig.tsx` — parent ID injection for lookups
- Button in `ObjectsScreen` + `DataPushScreen`

**Dependencies to add:** `@faker-js/faker`

---

### 5.2 Data Templates Library ⏳
**Plan:**
- `src/ui/screens/TemplatesScreen.tsx` — grid of template cards; search, filter by object
- `src/ui/components/TemplateEditor.tsx` — edit name, description, field mappings, sample data
- `src/ui/components/TemplateCard.tsx` — card showing object, last used, usage count
- Extend `DataTemplate` in `storage.ts` with `category`, `usageCount`, `lastUsedAt`
- Save/load buttons in `DataPushScreen`

---

### 5.3 Schema Comparison ⏳
**Plan:**
- `src/ui/utils/schemaDiff.ts` — diff two describe results; classify each field as added/removed/changed/same
- `src/ui/screens/SchemaComparisonScreen.tsx` — pick two objects (same or different orgs), run comparison
- `src/ui/components/SchemaDiffView.tsx` — colour-coded diff table
- `src/ui/components/FieldDiffDetail.tsx` — expand row to see changed attributes
- Export comparison to CSV/JSON/HTML

---

### 5.4 Field Usage Analytics ⏳
**Plan:**
- `src/ui/utils/fieldAnalytics.ts` — builds SOQL to measure population rates, uniqueness per field
- `src/ui/screens/FieldAnalyticsScreen.tsx` — run analysis, show progress, render results
- `src/ui/components/FieldAnalyticsChart.tsx` — horizontal bar chart (population %)
- `src/ui/components/FieldRecommendations.tsx` — actionable suggestions (make required, consider picklist, candidate for deletion)

---

## BATCH 6: Advanced Data Operations Part 1

### 6.1 Duplicate Detection & Merging ⏳
**Plan:**
- `src/ui/utils/duplicateDetection.ts` — configurable match rules; exact / Levenshtein / Soundex
- `src/ui/utils/fuzzyMatch.ts` — Levenshtein distance + Soundex implementations
- `src/ui/screens/DuplicateDetectionScreen.tsx` — configure match fields + weights, run scan, view groups
- `src/ui/components/MergeWizard.tsx` — 3-step: select master → field values → confirm
- `src/ui/components/DuplicateGroupView.tsx` — expandable group rows

---

### 6.2 Undo/Redo Operations ⏳
**Plan:**
- `src/ui/utils/undo.ts` — transaction service: capture rollback data, max 10 entries, 1-hour TTL
- `src/ui/components/UndoHistoryPanel.tsx` — floating panel listing reversible operations
- `storage.ts` — add `Transaction` interface (operation, objectName, rollbackData, timestamp)
- `background/index.ts` — capture rollback data (inserted IDs for insert, original values for update, deleted records for delete)
- Confirmation modal before undo executes

---

## BATCH 7: Advanced Data Operations Part 2

### 7.1 Data Transformation Pipelines ⏳
**Plan:**
- `src/ui/utils/pipelineExecutor.ts` — step-by-step execution engine; steps: filter, transform, lookup, aggregate, join
- `src/ui/screens/PipelineBuilderScreen.tsx` — drag-drop canvas for building pipelines
- `src/ui/components/pipeline/PipelineCanvas.tsx` — visual node graph
- `src/ui/components/pipeline/StepLibrary.tsx` — side panel of available step types
- `src/ui/components/pipeline/StepConfigPanel.tsx` — configure selected step
- Save/load pipelines, preview on sample data

---

### 7.2 Cross-Object Data Cloning ⏳
**Plan:**
- `src/ui/utils/crossObjectClone.ts` — dependency graph builder; topological sort for correct insert order; ID remapping for lookups
- `src/ui/screens/CloneWizardScreen.tsx` — 4-step wizard: source → relationships → field mapping → review
- `src/ui/components/RelationshipTree.tsx` — interactive hierarchy tree showing what will be cloned
- Handle circular references, required fields, same-org vs cross-org modes

---

## Files Changed So Far

### New Files Created
| File | Purpose |
|------|---------|
| `src/ui/utils/theme.ts` | Theme management |
| `src/ui/utils/export.ts` | Multi-format export service |
| `src/ui/utils/excel.ts` | Excel (SheetJS) export |
| `src/ui/utils/xml.ts` | XML export |
| `src/ui/utils/pushRetry.ts` | Retry dataset builder |
| `src/ui/components/ThemeToggle.tsx` | Theme toggle button |
| `src/ui/components/ExportModal.tsx` | Export config modal |
| `src/ui/components/DropZone.tsx` | Drag-drop file zone |
| `src/ui/components/RetryModal.tsx` | Retry confirmation modal |
| `src/ui/components/TypedConfirmModal.tsx` | Type-to-confirm modal |
| `src/ui/components/PushHistoryDetail.tsx` | Push detail + error groups modal |
| `src/ui/screens/PushHistoryScreen.tsx` | Push history table screen |

### Modified Files
| File | What Changed |
|------|-------------|
| `src/core/types/storage.ts` | Added `QueryFolder`; extended `SavedQuery` with folder/favorite/tags/execution fields; added `queryFolders` to schema |
| `src/core/types/messaging.ts` | Added `PUSH_HISTORY_GET` message type; `errors[]` in progress payload; `PushHistoryGetResponse` |
| `src/core/constants/index.ts` | Added `QUERY_FOLDERS` storage key |
| `src/services/storage/index.ts` | Updated `upsertSavedQuery`; added `incrementQueryExecution`, folder CRUD methods; imported `QueryFolder` |
| `src/ui/api/sf.ts` | Added `getPushHistory()`; imported `PushHistoryEntry`, `PushHistoryGetResponse` |
| `src/ui/app/AppRoot.tsx` | Added Push History nav item + route; imported `PushHistoryScreen` |
| `src/ui/components/AppShell.tsx` | Theme toggle integration |
| `src/ui/panel/PanelRoot.tsx` | Shadow root theme support |
| `src/ui/styles/uiCss.ts` | Dark theme vars; `--wl-success`, `--wl-danger-bg`, `--wl-accent-bg`, `--wl-success-bg`; `.wl-rowHighlight`; drag-drop styles |
| `src/ui/screens/DataPushScreen.tsx` | Retry modal, TypedConfirmModal for delete, push config capture |
| `src/ui/screens/SettingsScreen.tsx` | TypedConfirmModal for Clear Saved Queries |
| `src/ui/components/cleanser/DatasetHeader.tsx` | DropZone empty state |
| `src/background/index.ts` | `DATA_PUSH_COMPLETE` includes `errors[]`; `PUSH_HISTORY_GET` handler |
