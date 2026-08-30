/**
 * Message contract between the service worker and the offscreen document.
 *
 * The offscreen document exists to run long-lived Salesforce export queries
 * that may outlive the MV3 service worker's ~5-minute lifetime.
 */

import type { ApiVersion } from './salesforce';

export interface OffscreenCapturePayload {
  instanceUrl: string;
  accessToken: string;
  apiVersion: ApiVersion;
  soql: string;
  maxRecords?: number;
}

export interface OffscreenCaptureRequest {
  type: 'OFFSCREEN_CAPTURE';
  payload: OffscreenCapturePayload;
}

export interface OffscreenCaptureResponse {
  ok: boolean;
  records?: Record<string, unknown>[];
  error?: string;
}

export interface OffscreenBulkPushPayload {
  pushId: string;
  jobId: string;
  instanceUrl: string;
  accessToken: string;
  apiVersion: ApiVersion;
  orgId: string;
  objectName: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  totalRecords: number;
  startedAt: number;
  externalIdField?: string;
}

export interface OffscreenBulkPushRequest {
  type: 'OFFSCREEN_BULK_PUSH';
  payload: OffscreenBulkPushPayload;
}

export interface OffscreenBulkPushResponse {
  ok: boolean;
  error?: string;
}
