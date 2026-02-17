/**
 * Storage types for Chrome extension storage API.
 * Separates concerns between local, sync, and session storage.
 */

import type { SalesforceOrg } from './salesforce';

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
}

/** Data stored in chrome.storage.session (ephemeral, cleared on browser close) */
export interface SessionStorageSchema {
  /** Active access tokens keyed by orgId */
  activeTokens: Record<string, string>;
  /** In-progress push operations */
  activePushes: Record<string, ActivePush>;
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
}

/** Maps source fields to Salesforce fields */
export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: TransformationType;
  defaultValue?: unknown;
  required: boolean;
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
}

/** Stored successful record IDs for a completed push (session scoped) */
export interface PushResult {
  pushId: string;
  orgId: string;
  objectName: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  ids: string[];
  capturedAt: number;
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
  status: 'queued' | 'processing' | 'complete' | 'error' | 'cancelled';
  abortController?: string;
}
