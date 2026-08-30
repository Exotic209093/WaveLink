/**
 * Storage types for Chrome extension storage API.
 * Separates concerns between local, sync, and session storage.
 */

import type { SalesforceOrg } from './salesforce';
import type { MigrationProject, IdMap, MigrationTemplate, MigrationSummaryReport } from './migration';

/** Data stored in chrome.storage.local (large, device-specific data) */
export interface LocalStorageSchema {
  /** Connected Salesforce orgs keyed by orgId */
  orgs: Record<string, SalesforceOrg>;
  /** Active org ID */
  activeOrgId: string | null;
  /** Cached SObject metadata keyed by orgId:objectName */
  schemaCache: Record<string, CachedSchema>;
  /** Saved data templates */
  dataTemplates: DataTemplate[];
  /** Push operation history */
  pushHistory: PushHistoryEntry[];
  /** Saved SOQL queries */
  savedQueries: SavedQuery[];
  /** Query folders for organization */
  queryFolders: QueryFolder[];
  /** UI settings for panel/app */
  uiSettings: UiSettings;
  /** Push transactions for undo/rollback */
  pushTransactions: PushTransaction[];
  /** Data transformation pipelines */
  pipelines: Pipeline[];
  /** Data quality rule sets */
  qualityRuleSets: QualityRuleSet[];
  /** User onboarding progress */
  onboarding: OnboardingProgress;
  /** Migration projects */
  migrationProjects: MigrationProject[];
  /** Persistent ID maps keyed by map ID */
  idMaps: Record<string, IdMap>;
  /** Migration templates (Phase 3) */
  migrationTemplates: MigrationTemplate[];
  /** Migration summary reports (Phase 2) */
  migrationReports: MigrationSummaryReport[];
  /** v0.2: saved export templates */
  exportTemplates: ExportTemplate[];
  /** v0.2: saved import templates */
  importTemplates: ImportTemplate[];
  /** v0.2: scheduled exports */
  scheduledExports: ScheduledExport[];
  /** v0.2: snapshots produced by scheduled exports (keyed by snapshot id) */
  exportSnapshots: Record<string, ExportSnapshot>;
  /** v0.5: unified, versioned repeatable workflow definitions */
  savedJobs: SavedJob[];
  /** v0.4: bounded schedule execution history */
  scheduleRunHistory: ScheduleRunHistoryEntry[];
  /** v0.4: non-sensitive job checkpoints retained across browser restarts */
  activePushes: Record<string, ActivePush>;
  /** v0.4: resumable Bulk Query 2.0 jobs keyed by org ID. */
  bulkQueryCheckpoints: Record<string, BulkQueryCheckpoint>;
}

/** Data stored in chrome.storage.session (ephemeral, cleared on browser close) */
export interface SessionStorageSchema {
  /** Active access tokens keyed by orgId */
  activeTokens: Record<string, string>;
  /** Completed push results retained for the current browser session */
  pushResults: Record<string, PushResult>;
}

/** Cached schema metadata with TTL */
export interface CachedSchema {
  objectName: string;
  orgId: string;
  data: unknown;
  cachedAt: number;
  ttl: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  soql: string;
  createdAt: number;
  updatedAt: number;
  folderId?: string;
  favorite?: boolean;
  tags?: string[];
  executionCount?: number;
  lastExecutedAt?: number;
}

export interface QueryFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: number;
}

export interface UiSettings {
  panelWidth: number;
  panelDock: 'right' | 'left';
  panelPinned: boolean;
  lastTabId?: number;
  theme?: 'light' | 'dark' | 'auto';
  shortcuts?: Record<string, string>;
  /** Default batch size for data pushes (1-200) */
  defaultBatchSize?: number;
  /** Default parallel threads for REST pushes (1-4) */
  defaultThreads?: number;
  /** API request timeout in milliseconds (5000-120000) */
  apiTimeoutMs?: number;
  /** Max retry attempts for transient errors (0-5) */
  maxRetries?: number;
  /** Max push history entries to retain (10-500) */
  pushHistoryLimit?: number;
  /** Schema cache TTL in minutes (5-120) */
  schemaCacheTtlMinutes?: number;
  /** Accent color hex string */
  accentColor?: string;
  /** User-assigned org colors for visual differentiation, keyed by orgId */
  orgColorMap?: Record<string, string>;
}

/** Saved data template for reusable data pushes */
export interface DataTemplate {
  id: string;
  name: string;
  description: string;
  objectName: string;
  fieldMappings: FieldMapping[];
  sampleData: Record<string, unknown>[];
  createdAt: number;
  updatedAt: number;
  category?: string;
  usageCount?: number;
  lastUsedAt?: number;
}

/** Maps source fields to Salesforce fields */
export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: TransformationType;
  defaultValue?: unknown;
  required: boolean;
  /** Explicit handling for empty CSV cells; defaults to ignore. */
  blankBehavior?: 'ignore' | 'clear';
  /** Resolve a Salesforce reference by ID or relationship field notation. */
  lookup?: {
    mode: 'id' | 'externalId' | 'relatedField';
    /** Relationship API name, for example Account or Parent__r. */
    relationshipName?: string;
    /** External ID or related-record field used inside the relationship object. */
    matchField?: string;
  };
}

export interface BulkQueryCheckpoint {
  jobId: string;
  orgId: string;
  soql: string;
  state: string;
  updatedAt: number;
}

export type TransformationType =
  | 'none'
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'date_format'
  | 'number_format'
  | 'boolean_parse'
  | 'lookup_resolve'
  | 'custom';

/** Push operation history entry */
export interface PushHistoryEntry {
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
  /** If this push was a retry of a previous push */
  retryOfPushId?: string;
}

/** Stored successful record IDs for a completed push (session scoped) */
export interface PushResult {
  pushId: string;
  orgId: string;
  objectName: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  ids: string[];
  capturedAt: number;
  /** Failed records stored for retry */
  failedRecords?: Array<{ index: number; record: Record<string, unknown>; error: string }>;
}

/** Captured push transaction for undo/rollback */
export interface PushTransaction {
  id: string;
  pushId: string;
  orgId: string;
  objectName: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  capturedAt: number;
  expiresAt: number;
  rollbackIds: string[];
  rollbackOperation: 'delete' | 'insert' | 'update';
}

/** Step types for transformation pipelines */
export type PipelineStepType = 'filter' | 'transform' | 'lookup' | 'aggregate' | 'join';

/** Single step in a transformation pipeline */
export interface PipelineStep {
  id: string;
  type: PipelineStepType;
  label: string;
  config: Record<string, unknown>;
}

/** Saved data transformation pipeline */
export interface Pipeline {
  id: string;
  name: string;
  steps: PipelineStep[];
  createdAt: number;
  updatedAt: number;
}

/** Data quality rule for validating records before push */
export interface QualityRule {
  id: string;
  field: string;
  type: 'required' | 'format' | 'range' | 'picklist' | 'unique' | 'custom';
  config: Record<string, unknown>;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/** Saved quality rule set for reuse */
export interface QualityRuleSet {
  id: string;
  name: string;
  objectName: string;
  rules: QualityRule[];
  createdAt: number;
  updatedAt: number;
}

/** Onboarding progress tracking */
export interface OnboardingProgress {
  completedSteps: string[];
  dismissedAt?: number;
  lastSeenVersion?: string;
}

/** In-progress push operation */
export interface ActivePush {
  id: string;
  orgId: string;
  objectName: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  startedAt: number;
  updatedAt?: number;
  status: 'queued' | 'processing' | 'interrupted' | 'complete' | 'error' | 'cancelled';
  strategy?: 'rest' | 'bulk';
  tabId?: number;
  bulkJobId?: string;
  checkpoint?: number;
  resumeSupported?: boolean;
  lastError?: string;
  abortController?: string;
}

/* ════════════════════════════════════════════════════════════════════
 * v0.2 — Export/Import pivot types
 * ════════════════════════════════════════════════════════════════════ */

/** Supported export formats (mirrors `ExportFormat` in src/ui/utils/export.ts) */
export type SavedExportFormat = 'csv' | 'json' | 'excel' | 'xml';

/** A reusable export config saved by the user. */
export interface ExportTemplate {
  id: string;
  kind: 'export';
  name: string;
  description?: string;
  soql: string;
  format: SavedExportFormat;
  /** Optional column subset to include in the export (in order) */
  columns?: string[];
  /** If set, default name for the downloaded file (no extension) */
  filenameBase?: string;
  /** Used to remember which org this was last run against */
  lastOrgId?: string;
  createdAt: number;
  updatedAt: number;
  usageCount?: number;
  lastUsedAt?: number;
}

/** A reusable import config saved by the user. */
export interface ImportTemplate {
  id: string;
  kind: 'import';
  name: string;
  description?: string;
  objectName: string;
  operation: 'insert' | 'update' | 'upsert';
  externalIdField?: string;
  fieldMappings: FieldMapping[];
  /** Whether to use Bulk API 2.0 vs REST */
  strategy?: 'bulk' | 'rest';
  createdAt: number;
  updatedAt: number;
  usageCount?: number;
  lastUsedAt?: number;
}

/** Recurrence interval for scheduled exports. Minutes — `chrome.alarms` minimum is 1 in dev / 30 in prod. */
export type ScheduleInterval =
  | { kind: 'minutes'; minutes: number }
  | { kind: 'hours'; hours: number }
  | { kind: 'days'; days: number };

/** A scheduled export job. */
export interface ScheduledExport {
  id: string;
  name: string;
  /** SOQL to run on each tick */
  soql: string;
  /** Target org for the query */
  orgId: string;
  /** Output format saved with each snapshot */
  format: SavedExportFormat;
  /** Recurrence cadence */
  interval: ScheduleInterval;
  /** Whether the schedule is currently active */
  enabled: boolean;
  /** Number of past snapshots to retain (older ones pruned) */
  retention: number;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastRunStatus?: 'success' | 'error';
  lastRunError?: string;
  nextRunAt?: number;
  /** IANA time zone used for previews and daily cadence interpretation. */
  timeZone?: string;
}

export interface ScheduleRunHistoryEntry {
  id: string;
  scheduleId: string;
  startedAt: number;
  completedAt: number;
  status: 'success' | 'error';
  recordCount: number;
  error?: string;
  nextRunAt: number;
}

export interface SavedJobDefinition {
  kind: 'export' | 'import';
  /** Runtime connection roles only. Saved jobs never persist an org ID or credential. */
  orgRoles?: {
    source?: 'active-org' | 'choose-at-run';
    target?: 'active-org' | 'choose-at-run';
  };
  objectName?: string;
  operation?: 'query' | 'insert' | 'update' | 'upsert' | 'delete';
  query?: string;
  inputSource?: 'local-file';
  columns?: string[];
  mappings?: FieldMapping[];
  externalIdField?: string;
  api: {
    strategy: 'auto' | 'rest' | 'bulk';
    batchSize?: number;
    concurrency?: number;
  };
  safety: {
    dryRun: boolean;
    requireProductionConfirmation: boolean;
  };
  output?: {
    format: SavedExportFormat;
    filenameBase?: string;
  };
  schedule?: {
    interval: ScheduleInterval;
    retention: number;
    timeZone: string;
  };
}

export interface SavedJobRevision {
  version: number;
  changedAt: number;
  definition: SavedJobDefinition;
  name: string;
  description?: string;
}

/** Portable, credential-free definition for a repeatable data workflow. */
export interface SavedJob {
  schemaVersion: 1;
  id: string;
  name: string;
  description?: string;
  favorite: boolean;
  definition: SavedJobDefinition;
  version: number;
  revisions: SavedJobRevision[];
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  lastUsedAt?: number;
}

/** A single snapshot produced by a scheduled-export run. */
export interface ExportSnapshot {
  id: string;
  scheduleId: string;
  capturedAt: number;
  recordCount: number;
  columns: string[];
  /** Inline records — kept reasonable by snapshot retention */
  records: Record<string, unknown>[];
  /** First error from this run, if any */
  error?: string;
  orgId?: string;
  objectName?: string;
  pinned?: boolean;
}
