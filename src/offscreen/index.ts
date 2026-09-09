/**
 * WaveLink offscreen document script.
 *
 * Runs long-lived Salesforce export queries on behalf of the service worker.
 * The worker creates this document on demand (chrome.offscreen.createDocument),
 * sends an OFFSCREEN_CAPTURE message with the org credentials + SOQL, and this
 * script pages through the full result set and returns the records. Because the
 * offscreen document is a persistent DOM context, the query survives service
 * worker eviction.
 *
 * No UI: the document body is empty.
 */

import { SalesforceApiClient } from '../services/salesforce/api-client';
import { queryAllRecords } from '../services/salesforce/queryAll';
import type { OffscreenCaptureRequest, OffscreenCaptureResponse } from '../core/types/offscreen';
import type { OffscreenBulkPushRequest, OffscreenBulkPushResponse } from '../core/types/offscreen';
import type { OffscreenTokenRefreshResponse } from '../core/types/offscreen';
import { BulkApiService } from '../services/salesforce/bulk-api';
import { StorageService } from '../services/storage';
import { generateId } from '../core/utils';
import { UNDO_TTL_MS } from '../core/constants';
import { SalesforceApiError } from '../core/errors';

const storage = new StorageService();

function broadcast(type: 'DATA_PUSH_PROGRESS' | 'DATA_PUSH_COMPLETE' | 'DATA_PUSH_ERROR', payload: unknown): void {
  chrome.runtime.sendMessage({ type, payload, requestId: generateId(), timestamp: Date.now(), source: 'background' }).catch(() => undefined);
}

/**
 * Request a fresh access token from the service worker (Issue #61).
 * The offscreen document cannot read browser cookies directly; only the
 * service worker can re-derive the session token. Returns the new token
 * or null if refresh failed.
 */
async function requestTokenRefresh(orgId?: string, instanceUrl?: string): Promise<string | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_TOKEN_REFRESH',
      payload: { orgId, instanceUrl },
      requestId: generateId(),
      timestamp: Date.now(),
      source: 'background',
    }) as OffscreenTokenRefreshResponse | undefined;
    if (response?.success && response.data?.accessToken) {
      return response.data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

/** Check if an error is a 401 Unauthorized from the Salesforce API. */
function isAuthError(error: unknown): boolean {
  if (error instanceof SalesforceApiError && error.statusCode === 401) return true;
  if (error instanceof Error && /401|Unauthorized|INVALID_SESSION_ID/i.test(error.message)) return true;
  return false;
}

export async function runBulkPush(request: OffscreenBulkPushRequest): Promise<void> {
  const p = request.payload;
  const bulk = new BulkApiService({ instanceUrl: p.instanceUrl, accessToken: p.accessToken, apiVersion: p.apiVersion });

  /**
   * Core bulk-push finalization logic extracted so it can be retried once
   * after a mid-job token refresh (Issue #61).
   */
  async function executeBulkFinalization(): Promise<void> {
    const completed = await bulk.pollJobCompletion(p.jobId, 5000, 120, progress => {
      storage.updateActivePush(p.pushId, {
        processedRecords: progress.numberRecordsProcessed,
        failedRecords: progress.numberRecordsFailed,
        checkpoint: progress.numberRecordsProcessed,
        status: 'processing',
      }).catch(() => undefined);
      broadcast('DATA_PUSH_PROGRESS', {
        pushId: p.pushId, totalRecords: p.totalRecords,
        processedRecords: progress.numberRecordsProcessed,
        failedRecords: progress.numberRecordsFailed, status: 'processing',
      });
    });
    if (completed.state !== 'JobComplete') throw new Error(`Salesforce Bulk job ended in ${completed.state}.`);
    const ids: string[] = [];
    try {
      for (const row of await bulk.getSuccessfulResults(p.jobId)) if (row.sf__Id) ids.push(row.sf__Id);
    } catch {
      // Detailed results are optional; the summary remains recoverable.
    }
    const completedAt = Date.now();
    const history = await storage.getPushHistory();
    if (!history.some(entry => entry.id === p.pushId)) {
      await storage.addPushHistory({
        id: p.pushId, orgId: p.orgId, objectName: p.objectName, operation: p.operation,
        strategy: 'bulk', externalIdField: p.operation === 'upsert' ? p.externalIdField : undefined,
        totalRecords: p.totalRecords,
        successCount: completed.numberRecordsProcessed - completed.numberRecordsFailed,
        failureCount: completed.numberRecordsFailed, startedAt: p.startedAt, completedAt,
      });
    }
    await storage.setPushResult({
      pushId: p.pushId, orgId: p.orgId, objectName: p.objectName,
      operation: p.operation, ids, capturedAt: completedAt,
    });
    if (p.operation === 'insert' && ids.length > 0) {
      await storage.addPushTransaction({
        id: generateId(), pushId: p.pushId, orgId: p.orgId, objectName: p.objectName,
        operation: 'insert', capturedAt: completedAt, expiresAt: completedAt + UNDO_TTL_MS,
        rollbackIds: ids, rollbackOperation: 'delete',
      });
    }
    await storage.updateActivePush(p.pushId, {
      status: 'complete', processedRecords: completed.numberRecordsProcessed,
      failedRecords: completed.numberRecordsFailed, checkpoint: completed.numberRecordsProcessed,
      lastError: undefined,
    });
    broadcast('DATA_PUSH_COMPLETE', {
      pushId: p.pushId, totalRecords: p.totalRecords,
      processedRecords: completed.numberRecordsProcessed,
      failedRecords: completed.numberRecordsFailed, status: 'complete',
    });
  }

  try {
    await executeBulkFinalization();
  } catch (firstError) {
    // Issue #61: on 401 during polling/results, refresh the token and retry once.
    if (isAuthError(firstError)) {
      const freshToken = await requestTokenRefresh(p.orgId, p.instanceUrl);
      if (freshToken) {
        bulk.updateAccessToken(freshToken);
        try {
          await executeBulkFinalization();
          return;
        } catch {
          // Fall through to original error handling below.
        }
      }
    }
    const message = firstError instanceof Error ? firstError.message : 'Bulk push failed';
    const cancelled = /Aborted|Cancelled/i.test(message);
    // Issue #59: A poll timeout means the Salesforce job is still running server-side.
    // Leave the checkpoint in a resumable 'interrupted' state instead of recording
    // an all-failed error — the worker can resume polling via resumeBulkPush.
    const timedOut = /did not complete within the timeout period/i.test(message);
    if (timedOut && !cancelled) {
      await storage.updateActivePush(p.pushId, {
        status: 'interrupted',
        lastError: 'Polling timed out; the Salesforce job is still running and can be resumed.',
      });
      broadcast('DATA_PUSH_COMPLETE', {
        pushId: p.pushId, totalRecords: p.totalRecords, processedRecords: 0,
        failedRecords: 0, status: 'interrupted',
      });
      return;
    }
    await storage.updateActivePush(p.pushId, { status: cancelled ? 'cancelled' : 'error', lastError: message });
    const history = await storage.getPushHistory();
    if (!history.some(entry => entry.id === p.pushId)) {
      await storage.addPushHistory({
        id: p.pushId, orgId: p.orgId, objectName: p.objectName, operation: p.operation,
        strategy: 'bulk', totalRecords: p.totalRecords, successCount: 0,
        failureCount: cancelled ? 0 : p.totalRecords, startedAt: p.startedAt,
        completedAt: Date.now(), errors: [{ recordIndex: -1, message }],
      });
    }
    broadcast('DATA_PUSH_ERROR', { pushId: p.pushId, error: message });
    broadcast('DATA_PUSH_COMPLETE', {
      pushId: p.pushId, totalRecords: p.totalRecords, processedRecords: 0,
      failedRecords: cancelled ? 0 : p.totalRecords, status: cancelled ? 'cancelled' : 'error',
    });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;
  if ((message as { type?: unknown }).type === 'OFFSCREEN_BULK_PUSH') {
    runBulkPush(message as OffscreenBulkPushRequest)
      .then(() => sendResponse({ ok: true } satisfies OffscreenBulkPushResponse))
      .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) } satisfies OffscreenBulkPushResponse));
    return true;
  }
  if ((message as { type?: unknown }).type !== 'OFFSCREEN_CAPTURE') {
    return false; // not ours — let other listeners handle it
  }

  const { payload } = message as OffscreenCaptureRequest;
  const client = new SalesforceApiClient({
    instanceUrl: payload.instanceUrl,
    accessToken: payload.accessToken,
    apiVersion: payload.apiVersion,
  });

  (async () => {
    try {
      const records = await queryAllRecords(client, payload.soql, { maxRecords: payload.maxRecords });
      sendResponse({ ok: true, records } satisfies OffscreenCaptureResponse);
    } catch (firstError) {
      // Issue #61: on 401, request a fresh token from the worker and retry once.
      if (isAuthError(firstError)) {
        const freshToken = await requestTokenRefresh(undefined, payload.instanceUrl);
        if (freshToken) {
          client.updateAccessToken(freshToken);
          try {
            const records = await queryAllRecords(client, payload.soql, { maxRecords: payload.maxRecords });
            sendResponse({ ok: true, records } satisfies OffscreenCaptureResponse);
            return;
          } catch (retryError) {
            sendResponse({ ok: false, error: retryError instanceof Error ? retryError.message : String(retryError) } satisfies OffscreenCaptureResponse);
            return;
          }
        }
      }
      sendResponse({ ok: false, error: firstError instanceof Error ? firstError.message : String(firstError) } satisfies OffscreenCaptureResponse);
    }
  })();

  return true; // keep the message channel open for the async response
});
