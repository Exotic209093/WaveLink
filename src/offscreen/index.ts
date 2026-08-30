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
import { BulkApiService } from '../services/salesforce/bulk-api';
import { StorageService } from '../services/storage';
import { generateId } from '../core/utils';
import { UNDO_TTL_MS } from '../core/constants';

const storage = new StorageService();

function broadcast(type: 'DATA_PUSH_PROGRESS' | 'DATA_PUSH_COMPLETE' | 'DATA_PUSH_ERROR', payload: unknown): void {
  chrome.runtime.sendMessage({ type, payload, requestId: generateId(), timestamp: Date.now(), source: 'background' }).catch(() => undefined);
}

export async function runBulkPush(request: OffscreenBulkPushRequest): Promise<void> {
  const p = request.payload;
  const bulk = new BulkApiService({ instanceUrl: p.instanceUrl, accessToken: p.accessToken, apiVersion: p.apiVersion });
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk push failed';
    const cancelled = /Aborted|Cancelled/i.test(message);
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

  queryAllRecords(client, payload.soql, { maxRecords: payload.maxRecords })
    .then(records => sendResponse({ ok: true, records } satisfies OffscreenCaptureResponse))
    .catch(e => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) } satisfies OffscreenCaptureResponse));

  return true; // keep the message channel open for the async response
});
