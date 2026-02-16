/**
 * CSV export utilities for UI.
 *
 * Complexity: O(N*C) over records/columns.
 */

import type { FlatRecord } from './records';

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function recordsToCsv(records: FlatRecord[], columns: string[]): string {
  const header = columns.map(escapeCsvValue).join(',');
  const rows = records.map(r => columns.map(c => escapeCsvValue(r[c])).join(','));
  return [header, ...rows].join('\n');
}
