/**
 * Chrome extension messaging types.
 * Defines the contract between background, popup, and content scripts.
 */

import type { MigrationProject, IdMapEntry, MigrationSummaryReport } from './migration';

/** All message types in the extension */
export type MessageType =
  // Auth messages
  | 'AUTH_INITIATE'
  | 'AUTH_CALLBACK'
  | 'AUTH_REFRESH'
  | 'AUTH_LOGOUT'
  | 'AUTH_STATUS'
  // Org messages
  | 'ORG_DETECT'
  | 'ORG_INFO'
  | 'ORG_LIST'
  | 'ORG_SWITCH'
  | 'ORG_CONNECT_TAB'
  | 'ORG_REFRESH'
  | 'ORG_UPDATE'
  // Cross-org messages
  | 'CROSS_ORG_QUERY'
  | 'CROSS_ORG_DESCRIBE'
  // Data operation messages
  | 'DATA_PUSH_START'
  | 'DATA_PUSH_PROGRESS'
  | 'DATA_PUSH_COMPLETE'
  | 'DATA_PUSH_ERROR'
  | 'DATA_PUSH_CANCEL'
  | 'DATA_PUSH_RESULT_GET'
  | 'DATA_PUSH_RETRY_FAILED'
  | 'DATA_PUSH_ACTIVE_GET'
  | 'DATA_PUSH_RESUME'
  | 'PUSH_HISTORY_GET'
  // Schema messages
  | 'SCHEMA_DESCRIBE'
  | 'SCHEMA_DESCRIBE_SOBJECT'
  // Storage messages
  | 'STORAGE_GET'
  | 'STORAGE_SET'
  | 'STORAGE_REMOVE'
  // Salesforce Inspector-style messages
  | 'SF_TABS_LIST'
  | 'SF_CONTEXT_GET'
  | 'SF_QUERY_RUN'
  | 'SF_QUERY_MORE'
  | 'SF_BULK_QUERY_START'
  | 'SF_BULK_QUERY_STATUS'
  | 'SF_BULK_QUERY_RESULTS'
  | 'SF_BULK_QUERY_CANCEL'
  | 'SF_EXECUTE_ANONYMOUS'
  | 'SF_API_REQUEST'
  | 'SF_TOOLING_QUERY_RUN'
  | 'SF_TOOLING_QUERY_MORE'
  | 'SF_DESCRIBE_GLOBAL'
  | 'SF_DESCRIBE_SOBJECT'
  | 'SF_UPDATE_RECORD'
  | 'SF_CREATE_RECORD'
  | 'SF_DELETE_RECORD'
  | 'SF_LIMITS_GET'
  | 'SF_QUERY_EXPLAIN'
  // UI control
  | 'PANEL_TOGGLE'
  | 'OPEN_FULL_APP'
  | 'UI_SETTINGS_GET'
  | 'UI_SETTINGS_SET'
  | 'SAVED_QUERIES_LIST'
  | 'SAVED_QUERIES_UPSERT'
  | 'SAVED_QUERIES_DELETE'
  // Query folders
  | 'QUERY_FOLDERS_GET'
  | 'QUERY_FOLDERS_UPSERT'
  | 'QUERY_FOLDERS_DELETE'
  // Data templates
  | 'TEMPLATES_LIST'
  | 'TEMPLATES_UPSERT'
  | 'TEMPLATES_DELETE'
  // Push transactions (undo)
  | 'TRANSACTIONS_GET'
  | 'TRANSACTIONS_CLEAR'
  // Pipelines
  | 'PIPELINES_LIST'
  | 'PIPELINES_UPSERT'
  | 'PIPELINES_DELETE'
  // Quality rule sets
  | 'QUALITY_RULES_LIST'
  | 'QUALITY_RULES_UPSERT'
  | 'QUALITY_RULES_DELETE'
  // Schema cache management
  | 'SCHEMA_CACHE_CLEAR'
  // Storage management
  | 'STORAGE_USAGE_GET'
  | 'STORAGE_PURGE_OLD'
  // Data backup/restore
  | 'DATA_EXPORT'
  | 'DATA_IMPORT'
  // Onboarding
  | 'ONBOARDING_GET'
  | 'ONBOARDING_SET'
  // Migration projects
  | 'MIGRATION_PROJECTS_LIST'
  | 'MIGRATION_PROJECTS_GET'
  | 'MIGRATION_PROJECTS_UPSERT'
  | 'MIGRATION_PROJECTS_DELETE'
  // ID maps
  | 'ID_MAPS_LIST'
  | 'ID_MAPS_GET'
  | 'ID_MAPS_CREATE'
  | 'ID_MAPS_ADD_ENTRIES'
  | 'ID_MAPS_DELETE'
  | 'ID_MAPS_EXPORT'
  // Migration templates (Phase 3)
  | 'MIGRATION_TEMPLATES_LIST'
  | 'MIGRATION_TEMPLATES_UPSERT'
  | 'MIGRATION_TEMPLATES_DELETE'
  // Migration reports (Phase 2)
  | 'MIGRATION_REPORTS_LIST'
  | 'MIGRATION_REPORTS_GET'
  | 'MIGRATION_REPORTS_SAVE'
  | 'MIGRATION_REPORTS_DELETE'
  // Offscreen document token refresh (Issue #61)
  | 'OFFSCREEN_TOKEN_REFRESH';

// ── Payload Interfaces ────────────────────────────────────────────────

/** Auth message payloads */
export interface AuthInitiatePayload {
  environment?: 'production' | 'sandbox';
  loginUrl?: string;
}

export interface AuthStatusPayload {
  orgId?: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  org?: {
    orgId: string;
    username: string;
    instanceUrl: string;
  };
}

/** Org detection payload from content script */
export interface OrgDetectPayload {
  url: string;
  orgId?: string;
  instanceUrl?: string;
  username?: string;
}

/** Data push payloads */
export interface DataPushStartPayload {
  orgId?: string;
  tabId?: number;
  objectName: string;
  records: Record<string, unknown>[];
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  externalIdField?: string;
  batchSize?: number;
  /** REST only: max concurrent batch requests (1-4) */
  threads?: number;
  useBulkApi?: boolean;
}

export interface DataPushProgressPayload {
  pushId: string;
  totalRecords?: number;
  processedRecords?: number;
  failedRecords?: number;
  status?: 'processing' | 'complete' | 'error' | 'cancelled';
  errors?: Array<{ recordIndex: number; message: string }>;
  /** Single error message for DATA_PUSH_ERROR broadcasts. */
  error?: string;
}

export interface DataPushCancelPayload {
  pushId: string;
}

export interface DataPushCancelResponse {
  cancelled: boolean;
}

export interface DataPushResultGetPayload {
  pushId: string;
}

export interface DataPushResultGetResponse {
  pushId: string;
  objectName: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  ids: string[];
  capturedAt: number;
  /** Per-record failure metadata; indices correspond to input record positions. */
  failedRecords?: Array<{ index: number; record: Record<string, unknown>; error: string }>;
}

export interface PushHistoryGetResponse {
  history: Array<{
    id: string;
    orgId: string;
    objectName: string;
    operation: 'insert' | 'update' | 'upsert' | 'delete';
    strategy?: 'bulk' | 'rest';
    externalIdField?: string;
    totalRecords: number;
    successCount: number;
    failureCount: number;
    startedAt: number;
    completedAt: number;
    errors?: Array<{ recordIndex: number; message: string }>;
  }>;
}

/** Schema payloads */
export interface SchemaDescribePayload {
  orgId: string;
}

export interface SchemaDescribeSObjectPayload {
  orgId: string;
  objectName: string;
}

// ── Inline Payload Types (previously cast-only in handlers) ───────────

export interface SfQueryRunPayload {
  tabId?: number;
  soql: string;
}

export interface SfQueryMorePayload {
  tabId?: number;
  nextRecordsUrl: string;
}

export interface SfBulkQueryStartPayload {
  tabId?: number;
  soql: string;
}

export interface SfBulkQueryStatusPayload {
  tabId?: number;
  jobId: string;
}

export interface SfBulkQueryResultsPayload {
  tabId?: number;
  jobId: string;
  locator?: string;
  maxRecords?: number;
}

export interface SfBulkQueryCancelPayload {
  tabId?: number;
  jobId: string;
}

export interface SfToolingQueryRunPayload {
  tabId?: number;
  soql: string;
}

export interface SfToolingQueryMorePayload {
  tabId?: number;
  nextRecordsUrl: string;
}

export interface SfDescribeGlobalPayload {
  tabId?: number;
}

export interface SfDescribeSObjectPayload {
  tabId?: number;
  objectName: string;
}

export interface SfUpdateRecordPayload {
  tabId?: number;
  objectName: string;
  recordId: string;
  fields: Record<string, unknown>;
}

export interface SfCreateRecordPayload {
  tabId?: number;
  objectName: string;
  fields: Record<string, unknown>;
}

export interface SfDeleteRecordPayload {
  tabId?: number;
  objectName: string;
  recordId: string;
}

export interface SfLimitsGetPayload {
  tabId?: number;
}

export interface SfExecuteAnonymousPayload {
  tabId?: number;
  apexBody: string;
}

export interface SfApiRequestPayload {
  tabId?: number;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  path: string;
  body?: unknown;
  rawText?: boolean;
}

export interface SfQueryExplainPayload {
  tabId?: number;
  soql: string;
}

export interface SfContextGetPayload {
  tabId?: number;
}

export interface SfTabsListPayload {
  [key: string]: never;
}

export interface UiSettingsSetPayload {
  [key: string]: unknown;
}

export interface SavedQueryUpsertPayload {
  id: string;
  name: string;
  soql: string;
}

export interface IdOnlyPayload {
  id: string;
}

export interface QueryFolderUpsertPayload {
  id: string;
  name: string;
  parentId?: string;
}

export interface OnboardingSetPayload {
  completedSteps?: string[];
  dismissedAt?: number;
  lastSeenVersion?: string;
}

export interface OrgSwitchPayload {
  orgId: string;
}

export interface OrgConnectTabPayload {
  tabId: number;
}

export interface OrgRefreshPayload {
  orgId: string;
}

export interface OrgUpdatePayload {
  orgId: string;
  nickname?: string;
}

export interface CrossOrgQueryPayload {
  orgId: string;
  soql: string;
}

export interface CrossOrgDescribePayload {
  orgId: string;
  objectName?: string;
}

export interface DataPushResumePayload {
  pushId: string;
  tabId?: number;
}

export interface DataPushRetryFailedPayload {
  pushId: string;
  tabId?: number;
}

export interface OpenFullAppPayload {
  tabId?: number;
}

export interface PanelTogglePayload {
  [key: string]: never;
}

export interface SchemaCacheClearPayload {
  orgId?: string;
}

export type MigrationProjectUpsertPayload =
  & Pick<MigrationProject, 'id' | 'name' | 'sourceOrgId' | 'targetOrgId'>
  & Partial<Omit<MigrationProject, 'id' | 'name' | 'sourceOrgId' | 'targetOrgId' | 'createdAt' | 'updatedAt'>>;

export interface IdMapCreatePayload {
  id: string;
  name: string;
  sourceOrgId: string;
  targetOrgId: string;
}

export interface IdMapAddEntriesPayload {
  mapId: string;
  entries: IdMapEntry[];
}

export interface MigrationTemplateUpsertPayload {
  id: string;
  name: string;
  [key: string]: unknown;
}

export type MigrationReportSavePayload = MigrationSummaryReport;

export interface MigrationReportGetPayload {
  runId: string;
}

export interface MigrationReportDeletePayload {
  runId: string;
}

// ── Payload Map ───────────────────────────────────────────────────────

/** Maps each MessageType to its expected payload shape. */
export interface PayloadMap {
  AUTH_INITIATE: AuthInitiatePayload;
  AUTH_CALLBACK: unknown;
  AUTH_REFRESH: unknown;
  AUTH_LOGOUT: { orgId?: string };
  AUTH_STATUS: AuthStatusPayload;

  ORG_DETECT: OrgDetectPayload;
  ORG_INFO: Record<string, never>;
  ORG_LIST: Record<string, never>;
  ORG_SWITCH: OrgSwitchPayload;
  ORG_CONNECT_TAB: OrgConnectTabPayload;
  ORG_REFRESH: OrgRefreshPayload;
  ORG_UPDATE: OrgUpdatePayload;

  CROSS_ORG_QUERY: CrossOrgQueryPayload;
  CROSS_ORG_DESCRIBE: CrossOrgDescribePayload;

  DATA_PUSH_START: DataPushStartPayload;
  DATA_PUSH_PROGRESS: DataPushProgressPayload;
  DATA_PUSH_COMPLETE: DataPushProgressPayload;
  DATA_PUSH_ERROR: DataPushProgressPayload;
  DATA_PUSH_CANCEL: DataPushCancelPayload;
  DATA_PUSH_RESULT_GET: DataPushResultGetPayload;
  DATA_PUSH_RETRY_FAILED: DataPushRetryFailedPayload;
  DATA_PUSH_ACTIVE_GET: Record<string, never>;
  DATA_PUSH_RESUME: DataPushResumePayload;
  PUSH_HISTORY_GET: Record<string, never>;

  SCHEMA_DESCRIBE: SchemaDescribePayload;
  SCHEMA_DESCRIBE_SOBJECT: SchemaDescribeSObjectPayload;

  STORAGE_GET: { key: string };
  STORAGE_SET: { key: string; value: unknown };
  STORAGE_REMOVE: { key: string };

  SF_TABS_LIST: SfTabsListPayload;
  SF_CONTEXT_GET: SfContextGetPayload;
  SF_QUERY_RUN: SfQueryRunPayload;
  SF_QUERY_MORE: SfQueryMorePayload;
  SF_BULK_QUERY_START: SfBulkQueryStartPayload;
  SF_BULK_QUERY_STATUS: SfBulkQueryStatusPayload;
  SF_BULK_QUERY_RESULTS: SfBulkQueryResultsPayload;
  SF_BULK_QUERY_CANCEL: SfBulkQueryCancelPayload;
  SF_EXECUTE_ANONYMOUS: SfExecuteAnonymousPayload;
  SF_API_REQUEST: SfApiRequestPayload;
  SF_TOOLING_QUERY_RUN: SfToolingQueryRunPayload;
  SF_TOOLING_QUERY_MORE: SfToolingQueryMorePayload;
  SF_DESCRIBE_GLOBAL: SfDescribeGlobalPayload;
  SF_DESCRIBE_SOBJECT: SfDescribeSObjectPayload;
  SF_UPDATE_RECORD: SfUpdateRecordPayload;
  SF_CREATE_RECORD: SfCreateRecordPayload;
  SF_DELETE_RECORD: SfDeleteRecordPayload;
  SF_LIMITS_GET: SfLimitsGetPayload;
  SF_QUERY_EXPLAIN: SfQueryExplainPayload;

  PANEL_TOGGLE: PanelTogglePayload;
  OPEN_FULL_APP: OpenFullAppPayload;
  UI_SETTINGS_GET: Record<string, never>;
  UI_SETTINGS_SET: UiSettingsSetPayload;
  SAVED_QUERIES_LIST: Record<string, never>;
  SAVED_QUERIES_UPSERT: SavedQueryUpsertPayload;
  SAVED_QUERIES_DELETE: IdOnlyPayload;

  QUERY_FOLDERS_GET: Record<string, never>;
  QUERY_FOLDERS_UPSERT: QueryFolderUpsertPayload;
  QUERY_FOLDERS_DELETE: IdOnlyPayload;

  TEMPLATES_LIST: Record<string, never>;
  TEMPLATES_UPSERT: Record<string, unknown>;
  TEMPLATES_DELETE: IdOnlyPayload;

  TRANSACTIONS_GET: Record<string, never>;
  TRANSACTIONS_CLEAR: IdOnlyPayload;

  PIPELINES_LIST: Record<string, never>;
  PIPELINES_UPSERT: Record<string, unknown>;
  PIPELINES_DELETE: IdOnlyPayload;

  QUALITY_RULES_LIST: Record<string, never>;
  QUALITY_RULES_UPSERT: Record<string, unknown>;
  QUALITY_RULES_DELETE: IdOnlyPayload;

  SCHEMA_CACHE_CLEAR: SchemaCacheClearPayload;

  STORAGE_USAGE_GET: Record<string, never>;
  STORAGE_PURGE_OLD: Record<string, never>;

  DATA_EXPORT: Record<string, never>;
  DATA_IMPORT: Record<string, unknown>;

  ONBOARDING_GET: Record<string, never>;
  ONBOARDING_SET: OnboardingSetPayload;

  MIGRATION_PROJECTS_LIST: Record<string, never>;
  MIGRATION_PROJECTS_GET: IdOnlyPayload;
  MIGRATION_PROJECTS_UPSERT: MigrationProjectUpsertPayload;
  MIGRATION_PROJECTS_DELETE: IdOnlyPayload;

  ID_MAPS_LIST: Record<string, never>;
  ID_MAPS_GET: IdOnlyPayload;
  ID_MAPS_CREATE: IdMapCreatePayload;
  ID_MAPS_ADD_ENTRIES: IdMapAddEntriesPayload;
  ID_MAPS_DELETE: IdOnlyPayload;
  ID_MAPS_EXPORT: IdOnlyPayload;

  MIGRATION_TEMPLATES_LIST: Record<string, never>;
  MIGRATION_TEMPLATES_UPSERT: MigrationTemplateUpsertPayload;
  MIGRATION_TEMPLATES_DELETE: IdOnlyPayload;

  MIGRATION_REPORTS_LIST: Record<string, never>;
  MIGRATION_REPORTS_GET: MigrationReportGetPayload;
  MIGRATION_REPORTS_SAVE: MigrationReportSavePayload;
  MIGRATION_REPORTS_DELETE: MigrationReportDeletePayload;
}

/** Base message shape — payload type is derived from the message type via PayloadMap. */
export interface ExtensionMessage<T extends MessageType = MessageType> {
  type: T;
  payload: PayloadMap[T];
  requestId: string;
  timestamp: number;
  source: MessageSource;
}

/** Where a message originates from */
export type MessageSource = 'popup' | 'background' | 'content' | 'app';

/** Response wrapper */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: MessageError;
  requestId: string;
}

export interface MessageError {
  code: string;
  message: string;
  details?: unknown;
}

/** Message handler type — payload is inferred from T via PayloadMap. */
export type MessageHandler<T extends MessageType = MessageType> = (
  message: ExtensionMessage<T>,
  sender: chrome.runtime.MessageSender,
) => Promise<MessageResponse>;