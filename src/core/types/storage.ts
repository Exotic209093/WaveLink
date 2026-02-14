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
}

/** Data stored in chrome.storage.session (ephemeral, cleared on browser close) */
export interface SessionStorageSchema {
  /** Active access tokens keyed by orgId */
  activeTokens: Record<string, string>;
  /** In-progress push operations */
  activePushes: Record<string, ActivePush>;
}

/** Cached schema metadata with TTL */
export interface CachedSchema {
  objectName: string;
  orgId: string;
  data: unknown;
  cachedAt: number;
  ttl: number;
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
  totalRecords: number;
  successCount: number;
  failureCount: number;
  startedAt: number;
  completedAt: number;
  errors?: Array<{ recordIndex: number; message: string }>;
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
