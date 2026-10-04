/**
 * Bulk API 2.0 per-row results mapped back to input-record indices (#47).
 *
 * Why fingerprints instead of position or a row-number column:
 * - Bulk API 2.0 rejects CSV columns that are not fields, so a synthetic row key cannot be uploaded.
 * - Results are split into successfulResults / failedResults and Salesforce does not promise upload
 *   order within either file (internal batches run in parallel), so zipping them against the input
 *   attaches IDs and errors to the wrong rows.
 * - Each result row echoes the uploaded columns. Fingerprinting the cells exactly as `recordsToCsv`
 *   serialized them identifies the input row. Identical duplicate rows are claimed in input order,
 *   which is indistinguishable for them anyway. Rows that cannot be identified get index -1 rather
 *   than a guessed position.
 *
 * Fingerprints are hashed so the identity handed to the offscreen document stays small for large jobs.
 *
 * Complexity: O(N * K) to fingerprint N rows of K columns; matching is O(R) map lookups for R results.
 */

import { BULK_NULL_VALUE, bulkCsvCellValue, bulkCsvHeaders } from './bulk-api';
import type { BulkApiService, BulkJobResult } from './bulk-api';

/** Input-row identity for one ingest job: the uploaded header row plus one fingerprint per record. */
export interface BulkRowIdentity {
  headers: string[];
  /** `fingerprints[i]` identifies input record `i`. */
  fingerprints: string[];
}

export interface BulkRowResults {
  /** Every record ID from successfulResults (undo needs all of them, identified or not). */
  ids: string[];
  /** `idRecordIndexes[i]` is the input index that produced `ids[i]`; -1 when it could not be identified. */
  idRecordIndexes: number[];
  /** One entry per failed row; `recordIndex` is -1 when the row could not be identified. */
  errors: Array<{ recordIndex: number; message: string }>;
}

/** 53-bit string hash (cyrb53). Two seeds are combined so distinct rows effectively never collide. */
function cyrb53(str: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Normalize one cell so the uploaded value and Salesforce's echo compare equal even if the echo
 * trims whitespace, rewrites line endings, or blanks the `#N/A` null marker.
 */
function normalizeCell(value: string): string {
  const trimmed = value.replace(/\r\n?/g, '\n').trim();
  return trimmed === BULK_NULL_VALUE ? '' : trimmed;
}

function fingerprint(cells: string[]): string {
  const joined = cells.map(normalizeCell).join('\u001f');
  return `${cyrb53(joined, 1).toString(36)}.${cyrb53(joined, 2).toString(36)}`;
}

/** Fingerprint input records using the same header union and cell serialization as `recordsToCsv`. */
export function buildBulkRowIdentity(records: Record<string, unknown>[]): BulkRowIdentity {
  const headers = bulkCsvHeaders(records);
  return {
    headers,
    fingerprints: records.map(record => fingerprint(headers.map(h => bulkCsvCellValue(record, h)))),
  };
}

/** Map successfulResults / failedResults rows back to input indices. */
export function mapBulkResultsToInput(
  identity: BulkRowIdentity | undefined,
  successful: BulkJobResult[],
  failed: BulkJobResult[],
): BulkRowResults {
  // Fingerprint -> unclaimed input indices, in input order.
  const unclaimed = new Map<string, number[]>();
  identity?.fingerprints.forEach((fp, index) => {
    const queue = unclaimed.get(fp);
    if (queue) queue.push(index);
    else unclaimed.set(fp, [index]);
  });

  const claim = (rows: BulkJobResult[]): (row: BulkJobResult) => number => {
    if (!identity || rows.length === 0) return () => -1;
    // Tolerate header-case differences in the echoed columns.
    const echoed = new Map(Object.keys(rows[0]).map(key => [key.toLowerCase(), key]));
    const columns = identity.headers.map(h => (h in rows[0] ? h : echoed.get(h.toLowerCase())));
    return row => {
      const queue = unclaimed.get(fingerprint(columns.map(c => (c === undefined ? '' : row[c] ?? ''))));
      return queue && queue.length > 0 ? queue.shift()! : -1;
    };
  };

  const ids: string[] = [];
  const idRecordIndexes: number[] = [];
  const claimSuccess = claim(successful);
  for (const row of successful) {
    const recordIndex = claimSuccess(row);
    if (!row.sf__Id) continue;
    ids.push(row.sf__Id);
    idRecordIndexes.push(recordIndex);
  }

  const errors: Array<{ recordIndex: number; message: string }> = [];
  const claimFailure = claim(failed);
  for (const row of failed) {
    errors.push({ recordIndex: claimFailure(row), message: row.sf__Error || 'Bulk API reported a failure without a message.' });
  }

  return { ids, idRecordIndexes, errors };
}

/**
 * Fetch both Bulk result files for a completed job and map them to input indices.
 * A result file that cannot be read contributes nothing; the job summary stays authoritative.
 */
export async function fetchBulkRowResults(
  bulk: Pick<BulkApiService, 'getSuccessfulResults' | 'getFailedResults'>,
  jobId: string,
  identity: BulkRowIdentity | undefined,
): Promise<BulkRowResults> {
  const [successful, failed] = await Promise.all([
    bulk.getSuccessfulResults(jobId).catch(() => [] as BulkJobResult[]),
    bulk.getFailedResults(jobId).catch(() => [] as BulkJobResult[]),
  ]);
  return mapBulkResultsToInput(identity, successful, failed);
}
