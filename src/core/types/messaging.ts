/**
 * Chrome extension messaging types.
 * Defines the contract between background, popup, and content scripts.
 */

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
  // Data operation messages
  | 'DATA_PUSH_START'
  | 'DATA_PUSH_PROGRESS'
  | 'DATA_PUSH_COMPLETE'
  | 'DATA_PUSH_ERROR'
  | 'DATA_PUSH_CANCEL'
  | 'DATA_PUSH_RESULT_GET'
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
  | 'SF_TOOLING_QUERY_RUN'
  | 'SF_TOOLING_QUERY_MORE'
  | 'SF_DESCRIBE_GLOBAL'
  | 'SF_DESCRIBE_SOBJECT'
  | 'SF_LIMITS_GET'
  // UI control
  | 'PANEL_TOGGLE'
  | 'UI_SETTINGS_GET'
  | 'UI_SETTINGS_SET'
  | 'SAVED_QUERIES_LIST'
  | 'SAVED_QUERIES_UPSERT'
  | 'SAVED_QUERIES_DELETE';

/** Base message shape */
export interface ExtensionMessage<T extends MessageType = MessageType, P = unknown> {
  type: T;
  payload: P;
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
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  status: 'processing' | 'complete' | 'error' | 'cancelled';
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
}

/** Schema payloads */
export interface SchemaDescribePayload {
  orgId: string;
}

export interface SchemaDescribeSObjectPayload {
  orgId: string;
  objectName: string;
}

/** Message handler type */
export type MessageHandler<T extends MessageType = MessageType> = (
  message: ExtensionMessage<T>,
  sender: chrome.runtime.MessageSender,
) => Promise<MessageResponse>;
