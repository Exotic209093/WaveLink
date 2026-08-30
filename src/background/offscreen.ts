/**
 * Service-worker-side helper for delegating long Salesforce export queries to
 * the offscreen document (see src/offscreen/index.ts).
 *
 * chrome.offscreen is not present in the installed @types/chrome, so this module
 * declares the minimal surface it uses rather than reaching for `any`.
 *
 * All entry points fail soft: callers are expected to fall back to running the
 * query directly in the service worker if the offscreen path is unavailable, so
 * a browser without offscreen support (or a transient error) never breaks the
 * underlying feature.
 */

import type { OffscreenBulkPushPayload, OffscreenBulkPushResponse, OffscreenCapturePayload, OffscreenCaptureResponse } from '../core/types/offscreen';

interface OffscreenApi {
  hasDocument?: () => Promise<boolean>;
  createDocument: (params: { url: string; reasons: string[]; justification: string }) => Promise<void>;
  closeDocument?: () => Promise<void>;
}

const OFFSCREEN_URL = 'offscreen/offscreen.html';

function getOffscreenApi(): OffscreenApi | undefined {
  return (chrome as unknown as { offscreen?: OffscreenApi }).offscreen;
}

/** Guards against two concurrent createDocument calls (which would throw). */
let creating: Promise<void> | null = null;

/**
 * Ensures the offscreen document exists. Returns false if the API is missing or
 * the document could not be created, so callers can fall back.
 */
export async function ensureOffscreenDocument(): Promise<boolean> {
  const api = getOffscreenApi();
  if (!api) return false;

  try {
    if (api.hasDocument && (await api.hasDocument())) return true;

    if (!creating) {
      creating = api
        .createDocument({
          url: OFFSCREEN_URL,
          reasons: ['WORKERS'],
          justification: 'Run long Salesforce export queries that may outlive the service worker.',
        })
        .finally(() => {
          creating = null;
        });
    }
    await creating;
    return true;
  } catch {
    // Most likely the document already exists (a concurrent create raced us).
    try {
      return api.hasDocument ? await api.hasDocument() : false;
    } catch {
      return false;
    }
  }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs a paginated capture in the offscreen document and returns all records.
 * Throws if the offscreen path is unavailable or the capture fails — the caller
 * must catch and fall back to a service-worker-side capture.
 */
export async function captureViaOffscreen(payload: OffscreenCapturePayload): Promise<Record<string, unknown>[]> {
  const ready = await ensureOffscreenDocument();
  if (!ready) throw new Error('offscreen document unavailable');

  // The document may not have registered its onMessage listener the instant
  // createDocument resolves; retry a few times on "no receiving end".
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'OFFSCREEN_CAPTURE', payload })) as
        | OffscreenCaptureResponse
        | undefined;
      if (!res) throw new Error('empty offscreen response');
      if (!res.ok) throw new Error(res.error ?? 'offscreen capture failed');
      return res.records ?? [];
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      // Only the connection race is worth retrying; real capture errors rethrow.
      if (!/receiving end does not exist|message port closed/i.test(msg)) throw e;
      await sleep(100 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('offscreen capture failed');
}

/** Delegate Bulk ingest polling/finalization to the persistent offscreen context. */
export async function runBulkPushViaOffscreen(payload: OffscreenBulkPushPayload): Promise<void> {
  const ready = await ensureOffscreenDocument();
  if (!ready) throw new Error('offscreen document unavailable');
  const res = (await chrome.runtime.sendMessage({ type: 'OFFSCREEN_BULK_PUSH', payload })) as OffscreenBulkPushResponse | undefined;
  if (!res?.ok) throw new Error(res?.error ?? 'offscreen bulk push failed');
}
