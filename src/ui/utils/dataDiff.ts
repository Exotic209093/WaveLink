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
  for (const rec of sourceRecords) {
    const key = String(rec[matchField] ?? '');
    if (key) sourceMap.set(key, rec);
  }

  const targetMap = new Map<string, Record<string, unknown>>();
  for (const rec of targetRecords) {
    const key = String(rec[matchField] ?? '');
    if (key) targetMap.set(key, rec);
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
        if (String(sv ?? '') !== String(tv ?? '')) {
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
  };
}

export function diffToCsv(diff: DataDiffResult): string {
  const rows: string[] = [`"${diff.matchField}","Status","Changed Fields",${diff.fields.map(f => `"Source:${f}","Target:${f}"`).join(',')}`];
  const all = [...diff.added, ...diff.removed, ...diff.changed];
  for (const d of all) {
    const fieldCols = diff.fields.map(f => {
      const sv = d.sourceRecord?.[f] ?? '';
      const tv = d.targetRecord?.[f] ?? '';
      return `"${String(sv).replace(/"/g, '""')}","${String(tv).replace(/"/g, '""')}"`;
    }).join(',');
    rows.push(`"${d.keyValue}","${d.status}","${d.changedFields.join('; ')}",${fieldCols}`);
  }
  return rows.join('\n');
}
