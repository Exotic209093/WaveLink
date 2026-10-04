/**
 * Retry failed push operations by extracting failed records.
 *
 * Complexity: O(N) where N is the number of errors.
 */

export interface RetryDataset {
  records: Record<string, unknown>[];
  headers: string[];
  errorMap: Map<number, string>; // new index -> original error message
  originalIndices: number[]; // new index -> original index
}

export interface PushOutcomeDatasets {
  success: { records: Record<string, unknown>[]; headers: string[] };
  error: { records: Record<string, unknown>[]; headers: string[] };
}

/**
 * Translate a pushed-record index into a source-record index (#46).
 *
 * Push results are indexed by position in the pushed (mapped) array, which omits rows dropped at
 * mapping. `sourceIndexes` is DataMapper's mapped -> source map; omit it when rows were pushed 1:1.
 * Returns -1 for indices that do not identify a pushed row.
 */
export function toSourceRecordIndex(pushedIndex: number, sourceIndexes?: number[]): number {
  if (!sourceIndexes) return pushedIndex;
  return pushedIndex >= 0 && pushedIndex < sourceIndexes.length ? sourceIndexes[pushedIndex] : -1;
}

/**
 * Build complete success/error downloads while retaining every source column.
 *
 * `errors` and `rowIds.idRecordIndexes` are indexed by pushed position. IDs are attached only via
 * `idRecordIndexes`: results can arrive out of order and successes need not return an ID, so a
 * positional zip would label the wrong rows (#47). Rows dropped at mapping were never pushed and
 * appear in neither file.
 */
export function buildPushOutcomeDatasets(
  originalRecords: Record<string, unknown>[],
  errors: Array<{ recordIndex: number; message: string }>,
  rowIds: { ids: string[]; idRecordIndexes?: number[] } = { ids: [] },
  sourceIndexes?: number[],
): PushOutcomeDatasets {
  const inSource = (index: number): boolean => index >= 0 && index < originalRecords.length;
  const messages = new Map<number, string[]>();
  for (const error of errors) {
    const sourceIndex = toSourceRecordIndex(error.recordIndex, sourceIndexes);
    if (!inSource(sourceIndex)) continue;
    messages.set(sourceIndex, [...(messages.get(sourceIndex) ?? []), error.message]);
  }
  const idsBySource = new Map<number, string>();
  rowIds.idRecordIndexes?.forEach((pushedIndex, i) => {
    const sourceIndex = toSourceRecordIndex(pushedIndex, sourceIndexes);
    const id = rowIds.ids[i];
    if (id && inSource(sourceIndex)) idsBySource.set(sourceIndex, id);
  });
  const pushedSourceIndexes = sourceIndexes ?? originalRecords.map((_, i) => i);
  const successRecords: Record<string, unknown>[] = [];
  const errorRecords: Record<string, unknown>[] = [];
  for (const recordIndex of pushedSourceIndexes) {
    if (!inSource(recordIndex)) continue;
    const record = originalRecords[recordIndex];
    const rowErrors = messages.get(recordIndex);
    if (rowErrors) {
      errorRecords.push({ ...record, WaveLinkError: rowErrors.join('; '), WaveLinkSourceRow: recordIndex + 2 });
    } else {
      const id = idsBySource.get(recordIndex);
      successRecords.push(id ? { ...record, WaveLinkRecordId: id } : { ...record });
    }
  }
  const sourceHeaders = Array.from(new Set(originalRecords.flatMap(record => Object.keys(record))));
  return {
    success: {
      records: successRecords,
      headers: [...sourceHeaders, ...(idsBySource.size ? ['WaveLinkRecordId'] : [])],
    },
    error: {
      records: errorRecords,
      headers: [...sourceHeaders, 'WaveLinkError', 'WaveLinkSourceRow'],
    },
  };
}

/**
 * Builds a retry dataset containing only the records that failed in the original push.
 *
 * @param originalRecords - Original dataset records
 * @param errors - Array of errors with pushed-record indices and messages
 * @param sourceIndexes - DataMapper's mapped -> source index map (#46); omit when rows were pushed 1:1
 * @returns Retry dataset with failed records and error mapping
 */
export function buildRetryDataset(
  originalRecords: Record<string, unknown>[],
  errors: Array<{ recordIndex: number; message: string }>,
  sourceIndexes?: number[],
): RetryDataset {
  const sourceErrors = errors.map(e => ({ ...e, recordIndex: toSourceRecordIndex(e.recordIndex, sourceIndexes) }));

  // Get unique failed indices (in case there are duplicate error entries)
  const failedIndices = Array.from(
    new Set(sourceErrors.map(e => e.recordIndex).filter(idx => idx >= 0 && idx < originalRecords.length))
  ).sort((a, b) => a - b);

  // Extract failed records
  const records = failedIndices.map(idx => originalRecords[idx]);

  // Derive headers from first record (or use all keys from all records)
  const headers: string[] = records.length > 0
    ? Array.from(
        new Set(records.flatMap(r => Object.keys(r)))
      ).sort()
    : [];

  // Create error map: new index -> error message
  const errorMap = new Map<number, string>();
  sourceErrors.forEach(error => {
    const newIndex = failedIndices.indexOf(error.recordIndex);
    if (newIndex >= 0) {
      // If multiple errors for same record, concatenate them
      const existing = errorMap.get(newIndex);
      const message = existing ? `${existing}; ${error.message}` : error.message;
      errorMap.set(newIndex, message);
    }
  });

  return {
    records,
    headers,
    errorMap,
    originalIndices: failedIndices,
  };
}

/**
 * Groups errors by message to provide a summary.
 *
 * @param errors - Array of errors
 * @returns Map of error message to count
 */
export function groupErrorsByMessage(
  errors: Array<{ recordIndex: number; message: string }>
): Map<string, number> {
  const groups = new Map<string, number>();

  for (const error of errors) {
    const count = groups.get(error.message) || 0;
    groups.set(error.message, count + 1);
  }

  return groups;
}

/**
 * Gets the top N error messages by frequency.
 *
 * @param errors - Array of errors
 * @param topN - Number of top errors to return
 * @returns Array of [message, count] tuples, sorted by count descending
 */
export function getTopErrors(
  errors: Array<{ recordIndex: number; message: string }>,
  topN: number = 3
): Array<[string, number]> {
  const grouped = groupErrorsByMessage(errors);
  return Array.from(grouped.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
}
