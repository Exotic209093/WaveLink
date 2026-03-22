/**
 * SOQL generation from structured query builder state.
 *
 * Pure functions — no side effects, no DOM.
 */

import type { SalesforceFieldType } from '../../core/types/salesforce';

export type SoqlOperator =
  | '=' | '!=' | '<' | '>' | '<=' | '>='
  | 'LIKE' | 'IN' | 'NOT IN'
  | 'INCLUDES' | 'EXCLUDES'
  | 'IS NULL' | 'IS NOT NULL';

export interface WhereCondition {
  id: string;
  field: string;
  operator: SoqlOperator;
  value: string;
  connector: 'AND' | 'OR';
}

export interface OrderByClause {
  field: string;
  direction: 'ASC' | 'DESC';
}

export type AggregateFunction = 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

export const AGGREGATE_FUNCTIONS: AggregateFunction[] = ['COUNT', 'COUNT_DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX'];

export interface AggregateField {
  id: string;
  fn: AggregateFunction;
  field: string;   // empty for bare COUNT()
  alias: string;   // optional alias
}

/** SOQL date literals supported by Salesforce. */
export const SOQL_DATE_LITERALS: string[] = [
  'TODAY', 'YESTERDAY', 'TOMORROW',
  'LAST_WEEK', 'THIS_WEEK', 'NEXT_WEEK',
  'LAST_MONTH', 'THIS_MONTH', 'NEXT_MONTH',
  'LAST_QUARTER', 'THIS_QUARTER', 'NEXT_QUARTER',
  'LAST_YEAR', 'THIS_YEAR', 'NEXT_YEAR',
  'LAST_90_DAYS', 'NEXT_90_DAYS',
  'LAST_N_DAYS:n', 'NEXT_N_DAYS:n',
  'LAST_N_WEEKS:n', 'NEXT_N_WEEKS:n',
  'LAST_N_MONTHS:n', 'NEXT_N_MONTHS:n',
  'LAST_N_QUARTERS:n', 'NEXT_N_QUARTERS:n',
  'LAST_N_YEARS:n', 'NEXT_N_YEARS:n',
];

/** Pattern matching a SOQL date literal (with or without :n parameter). */
const DATE_LITERAL_RE = /^(TODAY|YESTERDAY|TOMORROW|LAST_WEEK|THIS_WEEK|NEXT_WEEK|LAST_MONTH|THIS_MONTH|NEXT_MONTH|LAST_QUARTER|THIS_QUARTER|NEXT_QUARTER|LAST_YEAR|THIS_YEAR|NEXT_YEAR|LAST_90_DAYS|NEXT_90_DAYS|LAST_N_DAYS|NEXT_N_DAYS|LAST_N_WEEKS|NEXT_N_WEEKS|LAST_N_MONTHS|NEXT_N_MONTHS|LAST_N_QUARTERS|NEXT_N_QUARTERS|LAST_N_YEARS|NEXT_N_YEARS)(:\d+)?$/i;

export interface QueryBuilderState {
  objectName: string;
  selectedFields: string[];
  aggregateFields?: AggregateField[];
  whereConditions: WhereCondition[];
  orderBy: OrderByClause | null;
  groupBy?: string[];
  limit: number | null;
  offset: number | null;
}

/** Build a SOQL string from structured builder state. */
export function buildSoql(
  state: QueryBuilderState,
  fieldTypeMap?: Map<string, SalesforceFieldType>,
): string {
  if (!state.objectName) return '';

  const selectParts: string[] = [...state.selectedFields];

  // Append aggregate expressions
  if (state.aggregateFields) {
    for (const agg of state.aggregateFields) {
      let expr: string;
      if (agg.fn === 'COUNT' && !agg.field) {
        expr = 'COUNT()';
      } else if (agg.fn === 'COUNT_DISTINCT') {
        if (!agg.field) continue;
        expr = `COUNT_DISTINCT(${agg.field})`;
      } else {
        if (!agg.field) continue;
        expr = `${agg.fn}(${agg.field})`;
      }
      if (agg.alias) expr += ` ${agg.alias}`;
      selectParts.push(expr);
    }
  }

  if (selectParts.length === 0) return '';

  const parts: string[] = [];
  parts.push(`SELECT ${selectParts.join(', ')}`);
  parts.push(`FROM ${state.objectName}`);

  if (state.whereConditions.length > 0) {
    const clauses: string[] = [];
    for (let i = 0; i < state.whereConditions.length; i++) {
      const cond = state.whereConditions[i];
      if (!cond.field || !cond.operator) continue;

      let expr: string;
      if (cond.operator === 'IS NULL') {
        expr = `${cond.field} = NULL`;
      } else if (cond.operator === 'IS NOT NULL') {
        expr = `${cond.field} != NULL`;
      } else {
        const ft = fieldTypeMap?.get(cond.field) ?? 'string';
        const formatted = formatSoqlValue(cond.value, ft, cond.operator);
        expr = `${cond.field} ${cond.operator} ${formatted}`;
      }

      if (i === 0) {
        clauses.push(expr);
      } else {
        clauses.push(`${cond.connector} ${expr}`);
      }
    }
    if (clauses.length > 0) parts.push(`WHERE ${clauses.join(' ')}`);
  }

  if (state.groupBy && state.groupBy.length > 0) {
    parts.push(`GROUP BY ${state.groupBy.join(', ')}`);
  }

  if (state.orderBy) {
    parts.push(`ORDER BY ${state.orderBy.field} ${state.orderBy.direction}`);
  }

  if (state.limit !== null && state.limit > 0) {
    parts.push(`LIMIT ${state.limit}`);
  }

  if (state.offset !== null && state.offset > 0) {
    parts.push(`OFFSET ${state.offset}`);
  }

  return parts.join('\n');
}

/** Check if a string is a SOQL date literal (e.g. TODAY, LAST_N_DAYS:30). */
export function isDateLiteral(value: string): boolean {
  return DATE_LITERAL_RE.test(value.trim());
}

/** Format a value for embedding in a SOQL string. */
export function formatSoqlValue(
  value: string,
  fieldType: SalesforceFieldType,
  operator: SoqlOperator,
): string {
  if (operator === 'IN' || operator === 'NOT IN') {
    const items = value.split(',').map(v => v.trim()).filter(Boolean);
    const needsQuotes = !isNumericType(fieldType);
    const formatted = items.map(v => needsQuotes ? `'${escapeSoqlString(v)}'` : v);
    return `(${formatted.join(', ')})`;
  }

  if (operator === 'INCLUDES' || operator === 'EXCLUDES') {
    const items = value.split(';').map(v => v.trim()).filter(Boolean);
    const formatted = items.map(v => `'${escapeSoqlString(v)}'`);
    return `(${formatted.join(', ')})`;
  }

  if (fieldType === 'boolean') return value === 'true' ? 'true' : 'false';

  if (isNumericType(fieldType)) {
    const n = Number(value);
    return isNaN(n) ? '0' : String(n);
  }

  if (fieldType === 'date') {
    if (!value) return 'NULL';
    // Support date literals (TODAY, LAST_N_DAYS:30, etc.)
    if (isDateLiteral(value)) return value.trim().toUpperCase();
    return value; // YYYY-MM-DD, no quotes in SOQL
  }

  if (fieldType === 'datetime') {
    if (!value) return 'NULL';
    // Support date literals
    if (isDateLiteral(value)) return value.trim().toUpperCase();
    // Normalize browser datetime-local format (YYYY-MM-DDThh:mm) to SOQL (YYYY-MM-DDThh:mm:ssZ)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00Z`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return `${value}Z`;
    return value;
  }

  return `'${escapeSoqlString(value)}'`;
}

/** Get valid SOQL operators for a Salesforce field type. */
export function getOperatorsForFieldType(fieldType: SalesforceFieldType): SoqlOperator[] {
  const nullOps: SoqlOperator[] = ['IS NULL', 'IS NOT NULL'];

  if (fieldType === 'boolean') return ['=', '!=', ...nullOps];

  if (fieldType === 'multipicklist') return ['=', '!=', 'INCLUDES', 'EXCLUDES', ...nullOps];
  if (fieldType === 'picklist' || fieldType === 'combobox') return ['=', '!=', 'IN', 'NOT IN', ...nullOps];

  if (isNumericType(fieldType)) return ['=', '!=', '<', '>', '<=', '>=', ...nullOps];
  if (fieldType === 'date' || fieldType === 'datetime' || fieldType === 'time') return ['=', '!=', '<', '>', '<=', '>=', ...nullOps];

  if (fieldType === 'id' || fieldType === 'reference') return ['=', '!=', 'IN', 'NOT IN', ...nullOps];

  if (fieldType === 'encryptedstring') return ['=', '!=', ...nullOps];

  // string, textarea, email, phone, url, etc.
  return ['=', '!=', 'LIKE', 'IN', 'NOT IN', ...nullOps];
}

function isNumericType(ft: SalesforceFieldType): boolean {
  return ft === 'int' || ft === 'double' || ft === 'currency' || ft === 'percent';
}

function escapeSoqlString(s: string): string {
  return s.replace(/'/g, "\\'");
}
