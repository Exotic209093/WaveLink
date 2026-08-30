import { diffRecords } from './dataDiff';
import type { DataDiffResult } from './dataDiff';

/**
 * Pick a stable, valid key whenever either comparison source changes.
 * Prefer Salesforce's canonical Id field, then a case-insensitive id, then the
 * first shared column. Preserve an explicit user choice while it remains valid.
 */
export function selectComparisonKey(commonHeaders: string[], currentKey: string): string {
  if (commonHeaders.length === 0) return '';
  if (commonHeaders.includes(currentKey)) return currentKey;
  return commonHeaders.find(header => header === 'Id')
    ?? commonHeaders.find(header => header.toLowerCase() === 'id')
    ?? commonHeaders[0];
}

/**
 * `diffRecords` uses source-to-target sync semantics, where source-only records
 * are "added" to the target. A local baseline comparison uses timeline
 * semantics instead: right-only records were added and left-only records were
 * removed. Keep left/right record values intact while translating the buckets.
 */
export function diffBaselineRecords(
  baselineRecords: Record<string, unknown>[],
  comparisonRecords: Record<string, unknown>[],
  matchField: string,
  compareFields: string[],
): DataDiffResult {
  const syncDiff = diffRecords(
    baselineRecords,
    comparisonRecords,
    matchField,
    compareFields,
    'baseline',
    'comparison',
    'records',
  );

  const added = syncDiff.removed.map(record => ({ ...record, status: 'added' as const }));
  const removed = syncDiff.added.map(record => ({ ...record, status: 'removed' as const }));

  return {
    ...syncDiff,
    added,
    removed,
    summary: {
      ...syncDiff.summary,
      added: added.length,
      removed: removed.length,
    },
  };
}
