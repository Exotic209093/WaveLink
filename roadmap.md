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
| 3.1 | Enhanced Query History with Folders | ✅ Complete |
| 3.2 | Cleanser Column Reordering | ✅ Complete |
| 3.3 | Bulk Field Updates | ✅ Complete |
| 4.1 | Advanced Keyboard Shortcuts | ✅ Complete |
| 5.1 | Test Data Generator | ✅ Complete |
| 5.2 | Data Templates Library | ✅ Complete |
| 5.3 | Schema Comparison | ✅ Complete |
| 5.4 | Field Usage Analytics | ✅ Complete |
| 6.1 | Duplicate Detection & Merging | ✅ Complete |
| 6.2 | Undo/Redo Operations | ✅ Complete |
| 7.1 | Data Transformation Pipelines | ✅ Complete |
| 7.2 | Cross-Object Data Cloning | ✅ Complete |

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

## BATCH 3: Power User Features Part 1 ✅

### 3.1 Enhanced Query History with Folders ✅
**What was built:**
- `src/core/types/storage.ts` — `SavedQuery` extended with `folderId`, `favorite`, `tags`, `executionCount`, `lastExecutedAt`; new `QueryFolder` interface
- `src/core/types/messaging.ts` — Added `QUERY_FOLDERS_GET`, `QUERY_FOLDERS_UPSERT`, `QUERY_FOLDERS_DELETE` message types
- `src/services/storage/index.ts` — Added folder CRUD, `incrementQueryExecution()`
- `src/background/index.ts` — Added 3 folder handlers
- `src/ui/api/sf.ts` — Added `listQueryFolders()`, `upsertQueryFolder()`, `deleteQueryFolder()`
- `src/ui/components/QueryFolderTree.tsx` — Recursive collapsible folder tree with expand/collapse, create, rename, delete
- `src/ui/components/QueryManager.tsx` — 2-column panel: folder tree left, query list right; favorites filter, fuzzy search, drag-to-folder, import/export JSON
- `src/ui/screens/QueryScreen.tsx` — Integrated QueryManager with "Manage" toggle

---

### 3.2 Cleanser Column Reordering ✅
**What was built:**
- `src/ui/utils/dragDrop.ts` — `reorderByDrag<T>()` pure function + `useDragList<T>()` Preact hook for HTML5 DnD state
- `src/ui/screens/DataCleanserScreen.tsx` — Drag handles on column rows, drop indicators, keyboard Alt+Up/Down reorder

---

### 3.3 Bulk Field Updates ✅
**What was built:**
- `src/ui/utils/formulas.ts` — `interpolate()`, `extractTokens()`, `evaluateCondition()`, `applyConditionalRule()`
- `src/ui/components/ConditionalBuilder.tsx` — IF/THEN/ELSE rule builder (field, operator, value → thenValue/elseValue)
- `src/ui/components/BulkUpdateModal.tsx` — Formula mode (`{Field}` interpolation) or Conditional mode; 5-row preview; Apply button
- `src/ui/screens/DataCleanserScreen.tsx` — Integrated BulkUpdateModal with state management

---

## BATCH 4: Power User Features Part 2 ✅

### 4.1 Advanced Keyboard Shortcuts ✅
**What was built:**
- `src/ui/utils/shortcuts.ts` — Singleton `shortcutRegistry` with `register()`, `setBinding()` with conflict detection, `handleKeydown()`, `normalizeKeys()`
- `src/ui/components/CommandPalette.tsx` — `Ctrl+K` overlay: search input, fuzzy-filtered command list, arrow-key navigation, Enter to execute
- `src/ui/components/ShortcutEditor.tsx` — Table of shortcuts with keypress capture rebinding, inline conflict warnings
- `src/ui/screens/SettingsScreen.tsx` — Integrated ShortcutEditor section
- `src/ui/app/AppRoot.tsx` — Global keydown listener, default shortcuts (Ctrl+K, Ctrl+Shift+Q, Ctrl+Shift+P, Ctrl+Z), CommandPalette state
- `src/core/types/storage.ts` — Added `shortcuts` to `UiSettings`

---

## BATCH 5: Developer Productivity ✅

### 5.1 Test Data Generator ✅
**What was built:**
- `src/ui/utils/testDataGenerator.ts` — `generateFieldValue()` maps SF field types to faker calls; `generateRecord()`, `generateDataset()`
- `src/ui/components/FieldGeneratorConfig.tsx` — Per-field config: Auto/Static/Formula/Faker mode, nullable + null rate
- `src/ui/components/RelationshipConfig.tsx` — Textarea for lookup IDs (round-robin assignment)
- `src/ui/screens/TestDataGeneratorScreen.tsx` — Object selector, count input, field configs, Generate Preview, Download CSV, Send to Push

**Dependencies added:** `@faker-js/faker`

---

### 5.2 Data Templates Library ✅
**What was built:**
- `src/core/types/storage.ts` — Extended `DataTemplate` with `category?`, `usageCount?`, `lastUsedAt?`
- `src/core/types/messaging.ts` — Added `TEMPLATES_LIST`, `TEMPLATES_UPSERT`, `TEMPLATES_DELETE`
- `src/services/storage/index.ts` — Added `upsertDataTemplate()`, `incrementTemplateUsage()`
- `src/ui/components/TemplateCard.tsx` — Card with name, object badge, category, usage count, actions
- `src/ui/components/TemplateEditor.tsx` — Form: name, description, objectName, category, fieldMappings JSON editor
- `src/ui/screens/TemplatesScreen.tsx` — Grid of TemplateCards, search, category filter, New/Edit/Delete
- `src/ui/screens/DataPushScreen.tsx` — Added "Load Template" / "Save as Template" buttons

---

### 5.3 Schema Comparison ✅
**What was built:**
- `src/ui/utils/schemaDiff.ts` — `diffSchemas()` → `SchemaDiff` (added/removed/changed/unchanged fields); `diffToCsv()`, `diffToHtml()`
- `src/ui/components/FieldDiffDetail.tsx` — Row showing field name, status badge, property deltas
- `src/ui/components/SchemaDiffView.tsx` — Filter toolbar + scrollable diff list
- `src/ui/screens/SchemaComparisonScreen.tsx` — Two object selectors, Compare button, SchemaDiffView, export CSV/JSON/HTML

---

### 5.4 Field Usage Analytics ✅
**What was built:**
- `src/ui/utils/fieldAnalytics.ts` — `buildAnalyticsQuery()`, `computeFieldMetrics()` → population/unique rates, `generateRecommendations()`
- `src/ui/components/FieldAnalyticsChart.tsx` — CSS bar chart: field name, population bar, unique rate bar
- `src/ui/components/FieldRecommendations.tsx` — Recommendation list for low-population/low-unique fields
- `src/ui/screens/FieldAnalyticsScreen.tsx` — Object selector, sample size, Analyze button, charts, recommendations, export

---

## BATCH 6: Advanced Data Operations Part 1 ✅

### 6.1 Duplicate Detection & Merging ✅
**What was built:**
- `src/ui/utils/duplicateDetection.ts` — `levenshteinDistance()`, `levenshteinSimilarity()`, `soundex()`, `detectDuplicates()` → `DuplicateGroup[]`, `mergeRecords()`
- `src/ui/components/DuplicateGroupView.tsx` — Table of group records with radio selectors per field for merge resolution
- `src/ui/components/MergeWizard.tsx` — 3-step wizard: overview → per-group resolution → confirm & apply
- `src/ui/screens/DuplicateDetectionScreen.tsx` — Object/fields selector, strategy (exact/levenshtein/soundex), threshold, Fetch + Detect, MergeWizard, Send to Push

---

### 6.2 Undo/Redo Operations ✅
**What was built:**
- `src/core/types/storage.ts` — Added `PushTransaction` interface with rollback data, TTL; `pushTransactions` in schema
- `src/core/constants/index.ts` — Added `MAX_UNDO_ENTRIES`, `UNDO_TTL_MS`, `PUSH_TRANSACTIONS` key
- `src/ui/utils/undo.ts` — `isTransactionExpired()`, `pruneTransactions()`
- `src/ui/components/UndoHistoryPanel.tsx` — Fixed bottom-right panel: transaction list with age, Undo button, expired entries greyed out
- `src/background/index.ts` — Auto-captures `PushTransaction` after insert operations

---

## BATCH 7: Advanced Data Operations Part 2 ✅

### 7.1 Data Transformation Pipelines ✅
**What was built:**
- `src/ui/utils/pipelineExecutor.ts` — Step types: filter, transform, lookup, aggregate, join. `executeStep()`, `executePipeline()` with intermediate outputs
- `src/ui/components/StepLibrary.tsx` — Vertical list of addable step types
- `src/ui/components/StepConfigPanel.tsx` — Config form per step type
- `src/ui/components/PipelineCanvas.tsx` — Vertical flow of steps, drag-to-reorder (reuses `useDragList`), connector lines, active selection
- `src/ui/screens/PipelineBuilderScreen.tsx` — 3-column layout: StepLibrary | Canvas | ConfigPanel; Run Preview, Save/Load, Send to Push

---

### 7.2 Cross-Object Data Cloning ✅
**What was built:**
- `src/ui/utils/crossObjectClone.ts` — `buildDependencyGraph()`, `topologicalSort()` (Kahn's algorithm), `detectCircularReferences()`, `remapIds()`
- `src/ui/components/RelationshipTree.tsx` — Tree of objects with checkboxes, edge labels, cycle warnings
- `src/ui/screens/CloneWizardScreen.tsx` — 5-step wizard: select root → configure filters → handle cycles → cross-org toggle → preview & execute

---

## Files Changed So Far

### New Files Created (Batches 1-2)
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

### New Files Created (Batches 3-7)
| File | Purpose |
|------|---------|
| `src/ui/utils/dragDrop.ts` | Reusable drag-and-drop utilities |
| `src/ui/utils/formulas.ts` | Template interpolation and conditional rules |
| `src/ui/utils/shortcuts.ts` | Keyboard shortcut registry with conflict detection |
| `src/ui/utils/testDataGenerator.ts` | Test data generation with faker.js |
| `src/ui/utils/schemaDiff.ts` | Schema comparison and diff engine |
| `src/ui/utils/fieldAnalytics.ts` | Field usage analytics computations |
| `src/ui/utils/duplicateDetection.ts` | Duplicate detection (Levenshtein, Soundex, exact) |
| `src/ui/utils/undo.ts` | Transaction expiry and pruning |
| `src/ui/utils/pipelineExecutor.ts` | Pipeline step execution engine |
| `src/ui/utils/crossObjectClone.ts` | Dependency graph, topological sort, ID remapping |
| `src/ui/components/QueryFolderTree.tsx` | Recursive collapsible folder tree |
| `src/ui/components/QueryManager.tsx` | 2-column query management panel |
| `src/ui/components/ConditionalBuilder.tsx` | IF/THEN/ELSE rule builder |
| `src/ui/components/BulkUpdateModal.tsx` | Bulk field update modal |
| `src/ui/components/CommandPalette.tsx` | Fuzzy-searchable command palette |
| `src/ui/components/ShortcutEditor.tsx` | Keyboard shortcut customizer |
| `src/ui/components/FieldGeneratorConfig.tsx` | Per-field test data config |
| `src/ui/components/RelationshipConfig.tsx` | Lookup ID injection config |
| `src/ui/components/TemplateCard.tsx` | Template display card |
| `src/ui/components/TemplateEditor.tsx` | Template edit form |
| `src/ui/components/FieldDiffDetail.tsx` | Schema diff detail row |
| `src/ui/components/SchemaDiffView.tsx` | Schema diff list view |
| `src/ui/components/FieldAnalyticsChart.tsx` | CSS bar chart for field metrics |
| `src/ui/components/FieldRecommendations.tsx` | Field optimization recommendations |
| `src/ui/components/DuplicateGroupView.tsx` | Duplicate group record table |
| `src/ui/components/MergeWizard.tsx` | 3-step merge wizard |
| `src/ui/components/UndoHistoryPanel.tsx` | Fixed undo history panel |
| `src/ui/components/StepLibrary.tsx` | Pipeline step type picker |
| `src/ui/components/StepConfigPanel.tsx` | Pipeline step configuration |
| `src/ui/components/PipelineCanvas.tsx` | Visual pipeline flow canvas |
| `src/ui/components/RelationshipTree.tsx` | Object relationship tree |
| `src/ui/screens/TestDataGeneratorScreen.tsx` | Test data generation screen |
| `src/ui/screens/TemplatesScreen.tsx` | Data templates library screen |
| `src/ui/screens/SchemaComparisonScreen.tsx` | Schema comparison screen |
| `src/ui/screens/FieldAnalyticsScreen.tsx` | Field usage analytics screen |
| `src/ui/screens/DuplicateDetectionScreen.tsx` | Duplicate detection & merging screen |
| `src/ui/screens/PipelineBuilderScreen.tsx` | Pipeline builder screen |
| `src/ui/screens/CloneWizardScreen.tsx` | Cross-object clone wizard screen |

### Modified Files (Batches 1-2)
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

### Modified Files (Batches 3-7)
| File | What Changed |
|------|-------------|
| `src/core/types/storage.ts` | Added `PushTransaction`, `Pipeline`, `DataTemplate` extensions, `UiSettings.shortcuts` |
| `src/core/types/messaging.ts` | Added folder, template, pipeline, transaction message types |
| `src/core/constants/index.ts` | Added `PIPELINES`, `PUSH_TRANSACTIONS`, `MAX_UNDO_ENTRIES`, `UNDO_TTL_MS` keys |
| `src/services/storage/index.ts` | Added pipeline, template, transaction CRUD methods |
| `src/background/index.ts` | Added ~12 new message handlers for folders, templates, pipelines, transactions |
| `src/ui/api/sf.ts` | Added methods for folders, templates, pipelines, transactions |
| `src/ui/app/AppRoot.tsx` | 13 nav items, CommandPalette, UndoHistoryPanel, global keyboard shortcuts |
| `src/ui/screens/QueryScreen.tsx` | Integrated QueryManager with "Manage" toggle |
| `src/ui/screens/DataCleanserScreen.tsx` | Drag-and-drop column reordering, BulkUpdateModal integration |
| `src/ui/screens/DataPushScreen.tsx` | "Load Template" / "Save as Template" buttons |
| `src/ui/screens/SettingsScreen.tsx` | ShortcutEditor section |
| `src/ui/styles/uiCss.ts` | Added all new component styles and dark theme overrides |

---

## Future Possibilities

> Features from the brainstorming backlog. Implemented features are marked with ✅.

---

### Implemented Future Possibilities ✅

#### Popup UI Modernisation ✅
**What was built:**
- Rewrote the popup from vanilla JS/DOM to Preact, using the same component system and design tokens as the full app
- `src/ui/popup/PopupRoot.tsx` — Preact popup root with auto-detection of active Salesforce tab
- `src/popup/index.tsx` — Mounts Preact PopupRoot (replaces old vanilla DOM entry)
- `src/popup/popup.html` — Simplified to minimal container (like app.html)
- `src/ui/components/AppShell.tsx` — Extended to support `mode: 'popup'` with compact nav
- Popup now has: Data Push, Templates, History, Settings + quick actions (Open Full App, Toggle Panel)

#### Data Quality Scorecards ✅
**What was built:**
- `src/ui/utils/dataQuality.ts` — Quality rule evaluation engine (`evaluateRule`, `scoreDataset`, `getDefaultRulesForField`); supports required/format/range/picklist/unique/custom rules
- `src/ui/components/QualityRuleEditor.tsx` — Interactive rule editor with field/type/severity/config inputs
- `src/ui/components/QualityScorecard.tsx` — Visual score display with grade circle, summary stats, field breakdown
- `src/ui/screens/DataQualityScorecardScreen.tsx` — Object selector, rule set management (save/load), auto-suggest rules, fetch & score, export
- Storage: `QualityRuleSet` type, CRUD methods in StorageService/background/SfApi

#### Query Performance Metrics ✅
**What was built:**
- `src/ui/utils/queryMetrics.ts` — `QueryMetricsStore` singleton tracking last 50 queries; `formatDuration`, `estimateApiCost`; average time, slowest queries, per-object filtering
- `src/ui/components/QueryMetricsPanel.tsx` — Inline panel showing execution times, record counts, averages

#### API Usage Dashboard ✅
**What was built:**
- `src/ui/screens/ApiUsageDashboardScreen.tsx` — Fetches Salesforce org limits via `SF_LIMITS_GET`; color-coded usage bars (green/yellow/red); search/filter, refresh

#### Bulk Object Operations ✅
**What was built:**
- `src/ui/screens/BulkObjectOpsScreen.tsx` — Object selector, count records, delete all records with TypedConfirmModal safety confirmation, production org warning

#### Visual Relationship Explorer ✅
**What was built:**
- `src/ui/utils/schemaGraph.ts` — `buildSchemaGraph`, `getRelatedObjects` (BFS), `getFieldRelationships`, `computeLayout` (hierarchical positioning)
- `src/ui/components/SchemaGraphView.tsx` — CSS + SVG node graph with positioned cards, edge lines, click selection
- `src/ui/screens/RelationshipExplorerScreen.tsx` — Object selector, depth control, explore button, split layout (graph | detail panel)

#### Onboarding & Help System ✅
**What was built:**
- `src/ui/utils/onboarding.ts` — `ONBOARDING_STEPS` array (~12 tutorial steps), progress helpers (`getNextStep`, `getCategoryProgress`, `isOnboardingComplete`)
- `src/ui/components/OnboardingWizard.tsx` — Step-by-step tutorial overlay with category tabs, progress bar, navigation, "Go to [feature]" buttons
- `src/ui/components/HelpTooltip.tsx` — Contextual "?" icon with hover tooltip
- `src/ui/screens/HelpScreen.tsx` — Help center with category cards, topic links, search, "Restart Tutorial" button
- Storage: `OnboardingProgress` type, get/set methods in StorageService/background/SfApi
- Auto-shows on first use; dismissible

---

### Remaining Future Possibilities (Not Yet Implemented)

#### Phase 4 (Deferred — needs more thought)

| Feature | Description |
|---------|-------------|
| **Multi-Org Workspace** | Switch between multiple Salesforce orgs without leaving the extension; side-by-side org comparison; org-specific settings and preferences |
| **Data Comparison Between Orgs** | Diff records between sandbox and production; highlight field-level differences; sync specific records from one org to another |
| **Team Sharing Features** | Export/import queries, datasets, and templates between team members; optional cloud sync; collaborative data review with comments and approvals |
| **Notification Integrations** | Slack/Teams notifications when a long-running push job completes; email notifications; webhook support for custom integrations |

#### Data Management & Operations

| Feature | Description |
|---------|-------------|
| **Scheduled / Recurring Data Imports** | Set up recurring imports on a schedule; auto-refresh from external CSV URLs or Google Sheets; background sync status notifications |
| **Relationship Visualisation & Bulk Relationship Updates** | Mass-update lookup/master-detail fields; reparent multiple records at once |
| **Backup & Restore** | One-click backup of a Salesforce object's data; scheduled backups with versioning; point-in-time restore for pre-deployment safety |

#### Developer Tools

| Feature | Description |
|---------|-------------|
| **Permission Set Viewer/Editor** | View and compare permission sets; clone or modify permissions; security audit helper |
| **Apex Log Viewer** | View debug logs in-extension; filter by type, user, and time; full-text search within logs; download logs |

#### Integration & Automation

| Feature | Description |
|---------|-------------|
| **External Data Source Integration** | Import from Google Sheets, Airtable, or Excel Online; live sync with OAuth; no CSV download required |
| **Git Integration for Data Versioning** | Version-control datasets; commit/diff data changes alongside code; branch-based data management for audit trails |
| **Custom Scripting Hooks** | JavaScript pre/post-push hooks; sandboxed execution environment; advanced transformation customisation |
| **CI/CD Pipeline Integration** | Headless CLI mode for Jenkins/GitHub Actions; automated data seeding in deployment pipelines |
