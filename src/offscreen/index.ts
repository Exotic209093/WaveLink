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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || (message as { type?: unknown }).type !== 'OFFSCREEN_CAPTURE') {
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
