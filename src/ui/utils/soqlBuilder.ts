/**
 * SOQL generation from structured query builder state.
 *
 * Pure functions — no side effects, no DOM.
 */

import type { SalesforceFieldType } from '../../core/types/salesforce';

export type SoqlOperator =
  | '=' | '!=' | '<' | '>' | '<=' | '>='
  | 'LIKE' | 'IN' | 'NOT IN'
  | 'INCLUDES' | 'EXCLUDES';

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

export interface QueryBuilderState {
  objectName: string;
  selectedFields: string[];
  whereConditions: WhereCondition[];
  orderBy: OrderByClause | null;
  limit: number | null;
}

/** Build a SOQL string from structured builder state. */
export function buildSoql(
  state: QueryBuilderState,
  fieldTypeMap?: Map<string, SalesforceFieldType>,
): string {
  if (!state.objectName || state.selectedFields.length === 0) return '';

  const parts: string[] = [];
  parts.push(`SELECT ${state.selectedFields.join(', ')}`);
  parts.push(`FROM ${state.objectName}`);

  if (state.whereConditions.length > 0) {
    const clauses: string[] = [];
    for (let i = 0; i < state.whereConditions.length; i++) {
      const cond = state.whereConditions[i];
      if (!cond.field || !cond.operator) continue;
      const ft = fieldTypeMap?.get(cond.field) ?? 'string';
      const formatted = formatSoqlValue(cond.value, ft, cond.operator);
      const expr = `${cond.field} ${cond.operator} ${formatted}`;
      if (i === 0) {
        clauses.push(expr);
      } else {
        clauses.push(`${cond.connector} ${expr}`);
      }
    }
    if (clauses.length > 0) parts.push(`WHERE ${clauses.join(' ')}`);
  }

  if (state.orderBy) {
    parts.push(`ORDER BY ${state.orderBy.field} ${state.orderBy.direction}`);
  }

  if (state.limit !== null && state.limit > 0) {
    parts.push(`LIMIT ${state.limit}`);
  }

  return parts.join('\n');
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
  if (isNumericType(fieldType)) return value || '0';
  if (fieldType === 'date') return value; // YYYY-MM-DD, no quotes in SOQL
  if (fieldType === 'datetime') return value; // YYYY-MM-DDThh:mm:ssZ, no quotes
  return `'${escapeSoqlString(value)}'`;
}

/** Get valid SOQL operators for a Salesforce field type. */
export function getOperatorsForFieldType(fieldType: SalesforceFieldType): SoqlOperator[] {
  if (fieldType === 'boolean') return ['=', '!='];

  if (fieldType === 'multipicklist') return ['=', '!=', 'INCLUDES', 'EXCLUDES'];
  if (fieldType === 'picklist' || fieldType === 'combobox') return ['=', '!=', 'IN', 'NOT IN', 'INCLUDES', 'EXCLUDES'];

  if (isNumericType(fieldType)) return ['=', '!=', '<', '>', '<=', '>='];
  if (fieldType === 'date' || fieldType === 'datetime' || fieldType === 'time') return ['=', '!=', '<', '>', '<=', '>='];

  if (fieldType === 'id' || fieldType === 'reference') return ['=', '!=', 'IN', 'NOT IN'];

  // string, textarea, email, phone, url, etc.
  return ['=', '!=', 'LIKE', 'IN', 'NOT IN'];
}

function isNumericType(ft: SalesforceFieldType): boolean {
  return ft === 'int' || ft === 'double' || ft === 'currency' || ft === 'percent';
}

function escapeSoqlString(s: string): string {
  return s.replace(/'/g, "\\'");
}
