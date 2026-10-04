/**
 * Types Bulk API 2.0 query results from field describe metadata (#80).
 *
 * Why:
 * - Bulk query results arrive as CSV, so every value is a string, while the REST query API returns
 *   typed JSON. The same query must export the same JSON types in both modes.
 * - Guessing types from the CSV text corrupts data (Text "02134" -> 2134, 18-digit external IDs lose
 *   precision, Text "true" -> true), so only the queried object's describe decides the type.
 *
 * Rules (mirroring what REST returns):
 * - Empty cell -> `null` (Bulk CSV writes null as an empty cell; Salesforce never stores "" for a field).
 * - `boolean` -> true/false.
 * - `int`/`double`/`currency`/`percent` -> number, only when the decimal value is exactly representable
 *   as a JS number; otherwise the string is kept rather than silently losing precision.
 * - Everything else (Id, reference, text, picklist, date, datetime, time, ...) stays a string, as REST
 *   returns dates and datetimes as ISO strings.
 * - Relationship columns (`Account.Owner.Name`) are resolved through each lookup's `referenceTo`
 *   describe. Polymorphic lookups (several `referenceTo` targets, e.g. `What.Name`) and columns that
 *   cannot be resolved stay strings.
 *
 * Complexity: O(H * D) to resolve H headers through relationship depth D, then O(N * H) per page.
 */

import type { SObjectDescribe, SObjectField } from '../../core/types/salesforce';

export type DescribeLookup = (objectName: string) => Promise<SObjectDescribe | null>;

/** Describe field type per CSV header; `undefined` when the column could not be resolved. */
export type BulkFieldTypeMap = Record<string, string | undefined>;

const INTEGER_TYPES = new Set(['int', 'long']);
const DECIMAL_TYPES = new Set(['double', 'currency', 'percent']);

/** Doubles round-trip any decimal with at most 15 significant digits (DBL_DIG). */
const MAX_EXACT_SIGNIFICANT_DIGITS = 15;
const DECIMAL_PATTERN = /^[+-]?(\d*)(?:\.(\d*))?(?:[eE][+-]?\d+)?$/;

function toExactNumber(raw: string, integer: boolean): number | string {
  const text = raw.trim();
  if (integer) {
    if (!/^[+-]?\d+$/.test(text)) return raw;
    const value = Number(text);
    return Number.isSafeInteger(value) ? value : raw;
  }
  const match = DECIMAL_PATTERN.exec(text);
  if (!match || `${match[1]}${match[2] ?? ''}` === '') return raw;
  const digits = `${match[1]}${match[2] ?? ''}`.replace(/^0+/, '').replace(/0+$/, '');
  if (digits.length > MAX_EXACT_SIGNIFICANT_DIGITS) return raw;
  const value = Number(text);
  return Number.isFinite(value) ? value : raw;
}

/** Convert one Bulk CSV cell to the JSON type REST would return for a field of `fieldType`. */
export function typeBulkQueryValue(raw: unknown, fieldType: string | undefined): unknown {
  if (typeof raw !== 'string') return raw;
  if (raw === '') return null;
  if (!fieldType) return raw;
  if (fieldType === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
  }
  if (INTEGER_TYPES.has(fieldType)) return toExactNumber(raw, true);
  if (DECIMAL_TYPES.has(fieldType)) return toExactNumber(raw, false);
  return raw;
}

function findField(describe: SObjectDescribe, name: string): SObjectField | undefined {
  const lower = name.toLowerCase();
  return describe.fields.find(f => f.name.toLowerCase() === lower);
}

function findRelationship(describe: SObjectDescribe, relationshipName: string): SObjectField | undefined {
  const lower = relationshipName.toLowerCase();
  return describe.fields.find(f => f.relationshipName?.toLowerCase() === lower);
}

/**
 * Resolve the describe type of every CSV header, following relationship paths.
 * Describe failures leave the affected columns unresolved (strings) instead of failing the page.
 */
export async function resolveBulkFieldTypes(
  rootObject: string,
  headers: string[],
  describe: DescribeLookup,
): Promise<BulkFieldTypeMap> {
  const describes = new Map<string, Promise<SObjectDescribe | null>>();
  const load = (objectName: string): Promise<SObjectDescribe | null> => {
    const key = objectName.toLowerCase();
    let pending = describes.get(key);
    if (!pending) {
      pending = describe(objectName).catch(() => null);
      describes.set(key, pending);
    }
    return pending;
  };

  const types: BulkFieldTypeMap = {};
  for (const header of headers) {
    const path = header.split('.');
    let current = await load(rootObject);
    for (const relationship of path.slice(0, -1)) {
      if (!current) break;
      const lookup = findRelationship(current, relationship);
      const targets = lookup?.referenceTo ?? [];
      current = targets.length === 1 ? await load(targets[0]) : null;
    }
    types[header] = current ? findField(current, path[path.length - 1])?.type : undefined;
  }
  return types;
}

/** Apply `typeBulkQueryValue` to every cell of a parsed Bulk query page. */
export function typeBulkQueryRecords(
  records: Array<Record<string, unknown>>,
  types: BulkFieldTypeMap,
): Array<Record<string, unknown>> {
  return records.map(record => {
    const typed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      typed[key] = typeBulkQueryValue(value, types[key]);
    }
    return typed;
  });
}

/** Type one parsed page: resolve the page's headers against `rootObject`'s describe and convert values. */
export async function typeBulkQueryPage(
  records: Array<Record<string, unknown>>,
  rootObject: string | undefined,
  describe: DescribeLookup,
): Promise<Array<Record<string, unknown>>> {
  if (records.length === 0) return records;
  const headers = Object.keys(records[0]);
  const types = rootObject ? await resolveBulkFieldTypes(rootObject, headers, describe) : {};
  return typeBulkQueryRecords(records, types);
}
