/**
 * CSV export utilities for UI.
 *
 * Complexity: O(N*C) over records/columns.
 */

import type { FlatRecord } from './records';

/** Neutralize formula-injection payloads (CSV injection / DDE). */
function neutralizeFormulaInjection(s: string): string {
  // Prefix with a single quote if the cell starts with a dangerous character.
  // Excel/Sheets treats leading = + - @ \t \r as formula/DDE triggers.
  if (/^[=+\-@\t\r]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = neutralizeFormulaInjection(String(value));
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
