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

/** Build complete success/error downloads while retaining every source column. */
export function buildPushOutcomeDatasets(
  originalRecords: Record<string, unknown>[],
  errors: Array<{ recordIndex: number; message: string }>,
  successfulIds: string[] = [],
): PushOutcomeDatasets {
  const messages = new Map<number, string[]>();
  for (const error of errors) {
    if (error.recordIndex < 0 || error.recordIndex >= originalRecords.length) continue;
    messages.set(error.recordIndex, [...(messages.get(error.recordIndex) ?? []), error.message]);
  }
  let successIndex = 0;
  const successRecords: Record<string, unknown>[] = [];
  const errorRecords: Record<string, unknown>[] = [];
  originalRecords.forEach((record, recordIndex) => {
    const rowErrors = messages.get(recordIndex);
    if (rowErrors) {
      errorRecords.push({ ...record, WaveLinkError: rowErrors.join('; '), WaveLinkSourceRow: recordIndex + 2 });
    } else {
      const id = successfulIds[successIndex++];
      successRecords.push(id ? { ...record, WaveLinkRecordId: id } : { ...record });
    }
  });
  const sourceHeaders = Array.from(new Set(originalRecords.flatMap(record => Object.keys(record))));
  return {
    success: {
      records: successRecords,
      headers: [...sourceHeaders, ...(successfulIds.length ? ['WaveLinkRecordId'] : [])],
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
 * @param errors - Array of errors with record indices and messages
 * @returns Retry dataset with failed records and error mapping
 */
export function buildRetryDataset(
  originalRecords: Record<string, unknown>[],
  errors: Array<{ recordIndex: number; message: string }>
): RetryDataset {
  // Get unique failed indices (in case there are duplicate error entries)
  const failedIndices = Array.from(
    new Set(errors.map(e => e.recordIndex).filter(idx => idx >= 0 && idx < originalRecords.length))
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
  errors.forEach(error => {
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
