/**
 * Schema comparison utilities for diffing two SObject describes.
 * Complexity: O(F_left + F_right) where F is number of fields.
 */

export type FieldDiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface FieldDiff {
  name: string;
  status: FieldDiffStatus;
  leftField?: { name: string; type: string; length?: number; label?: string; [key: string]: unknown };
  rightField?: { name: string; type: string; length?: number; label?: string; [key: string]: unknown };
  changedProperties: string[];
}

export interface SchemaDiff {
  leftLabel: string;
  rightLabel: string;
  added: FieldDiff[];
  removed: FieldDiff[];
  changed: FieldDiff[];
  unchanged: FieldDiff[];
  summary: { total: number; added: number; removed: number; changed: number };
}

const COMPARE_PROPS = ['type', 'length', 'label', 'nillable', 'unique', 'externalId', 'defaultValue', 'precision', 'scale'] as const;

export function diffSchemas(
  leftFields: Array<{ name: string; [key: string]: unknown }>,
  rightFields: Array<{ name: string; [key: string]: unknown }>,
  leftLabel: string,
  rightLabel: string,
): SchemaDiff {
  const leftMap = new Map(leftFields.map(f => [f.name, f]));
  const rightMap = new Map(rightFields.map(f => [f.name, f]));
  const allNames = new Set([...leftMap.keys(), ...rightMap.keys()]);

  const added: FieldDiff[] = [];
  const removed: FieldDiff[] = [];
  const changed: FieldDiff[] = [];
  const unchanged: FieldDiff[] = [];

  for (const name of allNames) {
    const left = leftMap.get(name);
    const right = rightMap.get(name);

    if (!left && right) {
      added.push({ name, status: 'added', rightField: right as FieldDiff['rightField'], changedProperties: [] });
    } else if (left && !right) {
      removed.push({ name, status: 'removed', leftField: left as FieldDiff['leftField'], changedProperties: [] });
    } else if (left && right) {
      const changedProps: string[] = [];
      for (const prop of COMPARE_PROPS) {
        if (String(left[prop] ?? '') !== String(right[prop] ?? '')) {
          changedProps.push(prop);
        }
      }
      const diff: FieldDiff = {
        name,
        status: changedProps.length > 0 ? 'changed' : 'unchanged',
        leftField: left as FieldDiff['leftField'],
        rightField: right as FieldDiff['rightField'],
        changedProperties: changedProps,
      };
      if (changedProps.length > 0) changed.push(diff);
      else unchanged.push(diff);
    }
  }

  return {
    leftLabel,
    rightLabel,
    added,
    removed,
    changed,
    unchanged,
    summary: {
      total: allNames.size,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
    },
  };
}

export function diffToCsv(diff: SchemaDiff): string {
  const rows: string[] = ['Field,Status,Changed Properties,Left Type,Right Type'];
  const all = [...diff.added, ...diff.removed, ...diff.changed, ...diff.unchanged];
  for (const d of all) {
    const leftType = d.leftField?.type ?? '';
    const rightType = d.rightField?.type ?? '';
    rows.push(`"${d.name}","${d.status}","${d.changedProperties.join('; ')}","${leftType}","${rightType}"`);
  }
  return rows.join('\n');
}

export function diffToHtml(diff: SchemaDiff): string {
  const statusColor: Record<string, string> = { added: '#4caf50', removed: '#ff3b5c', changed: '#00a6c8', unchanged: '#999' };
  let html = `<html><body><h1>${diff.leftLabel} vs ${diff.rightLabel}</h1>`;
  html += `<p>Added: ${diff.summary.added}, Removed: ${diff.summary.removed}, Changed: ${diff.summary.changed}</p>`;
  html += '<table border="1" cellpadding="4" style="border-collapse:collapse;font-family:sans-serif;font-size:13px"><tr><th>Field</th><th>Status</th><th>Changes</th></tr>';
  const all = [...diff.added, ...diff.removed, ...diff.changed];
  for (const d of all) {
    html += `<tr><td>${d.name}</td><td style="color:${statusColor[d.status] ?? '#000'}">${d.status}</td><td>${d.changedProperties.join(', ')}</td></tr>`;
  }
  html += '</table></body></html>';
  return html;
}
