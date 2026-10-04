/**
 * Data comparison utilities for diffing records between two orgs.
 * Follows the same structural pattern as schemaDiff.ts.
 * Complexity: O((S + T) * F) where S/T are source/target record counts and F is compare fields.
 */

export type RecordDiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface RecordDiff {
  keyValue: string;
  status: RecordDiffStatus;
  sourceRecord?: Record<string, unknown>;
  targetRecord?: Record<string, unknown>;
  changedFields: string[];
  fieldDiffs: Record<string, { source: unknown; target: unknown }>;
}

export interface DataDiffResult {
  sourceOrgId: string;
  targetOrgId: string;
  objectName: string;
  matchField: string;
  fields: string[];
  added: RecordDiff[];
  removed: RecordDiff[];
  changed: RecordDiff[];
  unchanged: RecordDiff[];
  summary: { total: number; added: number; removed: number; changed: number };
  /** Number of duplicate match-key values silently collapsed during indexing. */
  duplicateKeyCount: number;
}

/**
 * Stringify a value for comparison. Objects and arrays are JSON-stringified
 * so that nested structures compare by content rather than as "[object Object]".
 */
function stringifyForCompare(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function diffRecords(
  sourceRecords: Record<string, unknown>[],
  targetRecords: Record<string, unknown>[],
  matchField: string,
  compareFields: string[],
  sourceOrgId: string,
  targetOrgId: string,
  objectName: string,
): DataDiffResult {
  const sourceMap = new Map<string, Record<string, unknown>>();
  let duplicateKeyCount = 0;
  for (const rec of sourceRecords) {
    const key = String(rec[matchField] ?? '');
    if (!key) continue;
    if (sourceMap.has(key)) duplicateKeyCount++;
    sourceMap.set(key, rec);
  }

  const targetMap = new Map<string, Record<string, unknown>>();
  for (const rec of targetRecords) {
    const key = String(rec[matchField] ?? '');
    if (!key) continue;
    if (targetMap.has(key)) duplicateKeyCount++;
    targetMap.set(key, rec);
  }

  const allKeys = new Set([...sourceMap.keys(), ...targetMap.keys()]);
  const added: RecordDiff[] = [];
  const removed: RecordDiff[] = [];
  const changed: RecordDiff[] = [];
  const unchanged: RecordDiff[] = [];

  for (const key of allKeys) {
    const source = sourceMap.get(key);
    const target = targetMap.get(key);

    if (source && !target) {
      added.push({ keyValue: key, status: 'added', sourceRecord: source, changedFields: [], fieldDiffs: {} });
    } else if (!source && target) {
      removed.push({ keyValue: key, status: 'removed', targetRecord: target, changedFields: [], fieldDiffs: {} });
    } else if (source && target) {
      const changedFields: string[] = [];
      const fieldDiffs: Record<string, { source: unknown; target: unknown }> = {};

      for (const field of compareFields) {
        const sv = source[field];
        const tv = target[field];
        const sStr = stringifyForCompare(sv);
        const tStr = stringifyForCompare(tv);
        if (sStr !== tStr) {
          changedFields.push(field);
          fieldDiffs[field] = { source: sv, target: tv };
        }
      }

      if (changedFields.length > 0) {
        changed.push({ keyValue: key, status: 'changed', sourceRecord: source, targetRecord: target, changedFields, fieldDiffs });
      } else {
        unchanged.push({ keyValue: key, status: 'unchanged', sourceRecord: source, targetRecord: target, changedFields: [], fieldDiffs: {} });
      }
    }
  }

  return {
    sourceOrgId,
    targetOrgId,
    objectName,
    matchField,
    fields: compareFields,
    added,
    removed,
    changed,
    unchanged,
    summary: { total: allKeys.size, added: added.length, removed: removed.length, changed: changed.length },
    duplicateKeyCount,
  };
}

export function diffToCsv(diff: DataDiffResult): string {
  const rows: string[] = [`"${diff.matchField}","Status","Changed Fields",${diff.fields.map(f => `"Source:${f}","Target:${f}"`).join(',')}`];
  const all = [...diff.added, ...diff.removed, ...diff.changed];
  for (const d of all) {
    const fieldCols = diff.fields.map(f => {
      const sv = stringifyForCompare(d.sourceRecord?.[f]);
      const tv = stringifyForCompare(d.targetRecord?.[f]);
      return `"${sv.replace(/"/g, '""')}","${tv.replace(/"/g, '""')}"`;
    }).join(',');
    rows.push(`"${d.keyValue}","${d.status}","${d.changedFields.join('; ')}",${fieldCols}`);
  }
  return rows.join('\n');
}

export interface CompareSyncJob {
  operation: 'insert' | 'update' | 'upsert';
  records: Record<string, unknown>[];
  externalIdField?: string;
}

export interface CompareSyncPlan {
  jobs: CompareSyncJob[];
  inserts: number;
  updates: number;
  upserts: number;
  /** Selected Changed keys whose target record has no Id, so cannot be updated. */
  skippedKeys: string[];
}

/**
 * Turn selected diff rows into push jobs for the target org.
 * - External ID match field: one upsert of Added + Changed records keyed on it.
 * - Otherwise: Added records are inserted, and Changed records are updated by
 *   the target record's Id with only the differing fields, so existing target
 *   rows are corrected rather than duplicated.
 */
export function buildCompareSyncPlan(
  diff: DataDiffResult,
  selectedKeys: Set<string>,
  options: { externalIdField?: string; omitFields?: Iterable<string> },
): CompareSyncPlan {
  const omit = new Set(options.omitFields ?? []);
  omit.add('Id');
  omit.add('attributes');
  const clean = (rec: Record<string, unknown>, only?: string[]): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const key of only ?? Object.keys(rec)) {
      if (!omit.has(key) && key in rec) out[key] = rec[key];
    }
    return out;
  };

  const added = diff.added.filter(d => selectedKeys.has(d.keyValue) && d.sourceRecord);
  const changed = diff.changed.filter(d => selectedKeys.has(d.keyValue) && d.sourceRecord);

  if (options.externalIdField) {
    const records = [...added, ...changed].map(d => clean(d.sourceRecord!));
    return {
      jobs: records.length ? [{ operation: 'upsert', records, externalIdField: options.externalIdField }] : [],
      inserts: 0,
      updates: 0,
      upserts: records.length,
      skippedKeys: [],
    };
  }

  const inserts = added.map(d => clean(d.sourceRecord!));
  const updates: Record<string, unknown>[] = [];
  const skippedKeys: string[] = [];
  for (const d of changed) {
    const targetId = d.targetRecord?.Id;
    if (typeof targetId !== 'string' || !targetId) {
      skippedKeys.push(d.keyValue);
      continue;
    }
    updates.push({ Id: targetId, ...clean(d.sourceRecord!, d.changedFields) });
  }

  const jobs: CompareSyncJob[] = [];
  if (inserts.length) jobs.push({ operation: 'insert', records: inserts });
  if (updates.length) jobs.push({ operation: 'update', records: updates });
  return { jobs, inserts: inserts.length, updates: updates.length, upserts: 0, skippedKeys };
}
