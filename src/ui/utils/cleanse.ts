/**
 * Cleanser data model and pure functions.
 *
 * What this file does:
 * - Represents column operations (`ColumnOp`) and applies them to records.
 * - Detects rename conflicts and provides summary stats for UI.
 *
 * Why pure functions:
 * - Easier to test and reuse across screens/components.
 *
 * Complexity:
 * - `cleanseRecords`: O(N*C) where N is records and C is ops/columns.
 * - `computeConflicts`/`computeSummary`: O(C).
 */

import type { TransformationType } from '../../core/types/storage';

export interface ColumnOp {
  source: string;
  renameTo: string;
  drop: boolean;
  transform: TransformationType;
}

export function applyTransform(value: unknown, transform: TransformationType): unknown {
  if (value === undefined || value === null) return value;
  if (!transform || transform === 'none') return value;

  const s = String(value);

  switch (transform) {
    case 'trim':
      return s.trim();
    case 'uppercase':
      return s.toUpperCase();
    case 'lowercase':
      return s.toLowerCase();
    case 'boolean_parse': {
      const str = s.toLowerCase().trim();
      return ['true', '1', 'yes', 'y'].includes(str);
    }
    case 'number_format': {
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case 'date_format': {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    }
    default:
      return value;
  }
}

export function buildOpsIndex(ops: ColumnOp[]): Map<string, ColumnOp> {
  return new Map(ops.map(o => [o.source, o]));
}

export function computeConflicts(ops: ColumnOp[]): { conflicts: Record<string, string[]>; hasBlocking: boolean } {
  const byTarget = new Map<string, string[]>();
  for (const op of ops) {
    if (op.drop) continue;
    const target = (op.renameTo || op.source).trim() || op.source;
    const list = byTarget.get(target) ?? [];
    list.push(op.source);
    byTarget.set(target, list);
  }

  const conflicts: Record<string, string[]> = {};
  for (const [target, sources] of byTarget) {
    if (sources.length > 1) conflicts[target] = sources;
  }

  return { conflicts, hasBlocking: Object.keys(conflicts).length > 0 };
}

export function computeSummary(ops: ColumnOp[]): { dropped: number; renamed: number; transformed: number } {
  let dropped = 0;
  let renamed = 0;
  let transformed = 0;

  for (const op of ops) {
    if (op.drop) dropped++;
    if ((op.renameTo || '').trim() && op.renameTo.trim() !== op.source) renamed++;
    if (op.transform && op.transform !== 'none') transformed++;
  }

  return { dropped, renamed, transformed };
}

export function cleanseRecords(
  records: Array<Record<string, unknown>>,
  ops: ColumnOp[],
): { cleanedRecords: Array<Record<string, unknown>>; cleanedHeaders: string[] } {
  const cleanedHeaders = ops
    .filter(o => !o.drop)
    .map(o => (o.renameTo || o.source).trim() || o.source);

  const cleanedRecords = records.map(r => {
    const out: Record<string, unknown> = {};
    for (const op of ops) {
      if (op.drop) continue;
      const key = (op.renameTo || op.source).trim() || op.source;
      out[key] = applyTransform(r[op.source], op.transform);
    }
    return out;
  });

  return { cleanedRecords, cleanedHeaders };
}
