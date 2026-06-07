/**
 * Push Dry Run — client-side simulation of an import before committing it.
 *
 * What this does:
 * - Runs each mapped record through the existing schema `DataValidator`
 *   (required fields, createable/updateable, types, length, picklists) and
 *   adds the structural checks the API would reject up-front: a valid Id for
 *   update/delete, and an external-Id value for upsert.
 * - Returns a per-row pass/fail report plus grouped failure reasons, so the
 *   user can preview "X of N rows would succeed" without spending an API call
 *   or writing anything to the org.
 *
 * What this deliberately does NOT do:
 * - It cannot run server-side validation rules, triggers, flows, duplicate
 *   rules, or sharing checks — those only exist in the org. Treat a clean dry
 *   run as "the data is shaped correctly", not "the push is guaranteed".
 *
 * Complexity: O(N*K) where N is records and K is fields per record.
 */

import type { SObjectField } from '../../core/types/salesforce';
import { DataValidator } from '../../data/validators';

export type PushOperation = 'insert' | 'update' | 'upsert' | 'delete';

export interface DryRunRow {
  index: number;
  status: 'ok' | 'error';
  /** Human-readable failure reasons, with the "Record N:" prefix stripped. */
  reasons: string[];
}

export interface DryRunReason {
  message: string;
  count: number;
}

export interface DryRunReport {
  total: number;
  ok: number;
  failed: number;
  rows: DryRunRow[];
  /** Failure reasons grouped and sorted by descending frequency. */
  reasons: DryRunReason[];
}

export interface DryRunOptions {
  /** External Id field selected for upsert (if any). */
  externalIdField?: string | null;
}

/** Salesforce record Ids are 15 (case-sensitive) or 18 (safe) alphanumeric chars. */
const SF_ID_RE = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

/** Strip the leading "Record 12: " index prefix the validator embeds in messages. */
function stripIndexPrefix(message: string): string {
  return message.replace(/^Record\s+\d+:\s*/, '');
}

function hasValue(v: unknown): boolean {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/**
 * Simulate a push and report which rows would succeed vs fail, without
 * contacting Salesforce.
 */
export function simulatePush(
  records: Record<string, unknown>[],
  fields: SObjectField[],
  operation: PushOperation,
  options: DryRunOptions = {},
): DryRunReport {
  const validator = new DataValidator();
  const rows: DryRunRow[] = [];
  const reasonCounts = new Map<string, number>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const reasons = new Set<string>();

    // 1. Schema validation via the shared, tested engine (run per-record).
    const res = validator.validateRecords([record], fields, operation);
    for (const e of res.errors) reasons.add(stripIndexPrefix(e.message));

    // 2. Structural checks the schema validator doesn't cover.
    const idVal = record.Id ?? record.id;

    if (operation === 'update' || operation === 'delete') {
      if (!hasValue(idVal)) {
        reasons.add(`Missing Id (required for ${operation})`);
      } else if (!SF_ID_RE.test(String(idVal).trim())) {
        reasons.add(`Malformed Salesforce Id "${String(idVal)}"`);
      }
    }

    if (operation === 'upsert') {
      const extField = options.externalIdField;
      if (extField) {
        if (!hasValue(record[extField])) {
          reasons.add(`Missing external Id "${extField}" (required for upsert)`);
        }
      } else if (!hasValue(idVal)) {
        reasons.add('Upsert requires an external Id field or an Id value');
      }
    }

    const reasonList = Array.from(reasons);
    rows.push({ index: i, status: reasonList.length === 0 ? 'ok' : 'error', reasons: reasonList });
    for (const r of reasonList) reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
  }

  const reasons: DryRunReason[] = Array.from(reasonCounts.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count);

  const failed = rows.reduce((n, r) => n + (r.status === 'error' ? 1 : 0), 0);
  return { total: records.length, ok: records.length - failed, failed, rows, reasons };
}

/** Build a CSV of the per-row dry-run outcome (index, status, reasons). */
export function dryRunRowsToCsv(report: DryRunReport): string {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['row', 'status', 'reasons'].join(',');
  const lines = report.rows.map(r =>
    [escape(r.index + 1), escape(r.status), escape(r.reasons.join('; '))].join(','),
  );
  return [header, ...lines].join('\n');
}
