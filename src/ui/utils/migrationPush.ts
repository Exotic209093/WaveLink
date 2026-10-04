/**
 * Helpers for reading a completed data push back into a migration run.
 *
 * Kept out of the screen so they can be unit-tested without rendering the
 * Migration Workspace: `awaitPushResult` depends only on the injected API and
 * `buildIdMapEntries` is pure.
 */

import type { DataPushResultGetResponse } from '../../core/types/messaging';
import type { IdMapEntry } from '../../core/types/migration';

/** Minimal API surface needed to poll for a push result. */
export interface PushResultSource {
  getDataPushResult(pushId: string): Promise<DataPushResultGetResponse | null>;
}

/**
 * Poll until the background has stored the result for `pushId`.
 *
 * Push results are written only once the push reaches a terminal state, so the
 * first non-null response is final, including when `ids` is empty because
 * every record failed. Resolves with null on timeout.
 */
export async function awaitPushResult(
  sf: PushResultSource,
  pushId: string,
  timeoutMs = 5 * 60_000,
  intervalMs = 1_000,
): Promise<DataPushResultGetResponse | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await sf.getDataPushResult(pushId);
    if (res) return res;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * Pair each target ID with the source record that produced it.
 *
 * `idRecordIndexes[k]` is the index of the pushed record that produced
 * `ids[k]` (-1 when unknown). IDs can arrive out of input order, so they are
 * never zipped positionally; IDs without a known source row are skipped rather
 * than guessed, since a wrong pairing would link child records to the wrong
 * parents in the target org.
 */
export function buildIdMapEntries(
  sourceRecords: ReadonlyArray<Record<string, unknown>>,
  result: Pick<DataPushResultGetResponse, 'ids' | 'idRecordIndexes'>,
  objectName: string,
  now: number = Date.now(),
): IdMapEntry[] {
  const ids = Array.isArray(result.ids) ? result.ids : [];
  const entries: IdMapEntry[] = [];
  ids.forEach((targetId, k) => {
    const recordIndex = result.idRecordIndexes?.[k] ?? -1;
    const sourceId = recordIndex >= 0 ? sourceRecords[recordIndex]?.Id : undefined;
    if (typeof sourceId === 'string' && sourceId && targetId) {
      entries.push({ sourceId, targetId, objectName, createdAt: now });
    }
  });
  return entries;
}
