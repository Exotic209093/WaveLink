/**
 * Template interpolation and conditional rule engine for bulk field updates.
 * Complexity: O(T) per record where T is token count in the template.
 */

/** Interpolate {FieldName} tokens with record values. O(T). */
export function interpolate(template: string, record: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const val = record[key.trim()];
    return val === null || val === undefined ? '' : String(val);
  });
}

/** Extract all {FieldName} tokens from a template string. */
export function extractTokens(template: string): string[] {
  const tokens: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    tokens.push(m[1].trim());
  }
  return tokens;
}

export type ConditionOperator = 'eq' | 'neq' | 'contains' | 'startsWith' | 'isEmpty' | 'notEmpty';

export interface ConditionalRule {
  field: string;
  operator: ConditionOperator;
  value: string;
  thenValue: string;
  elseValue?: string;
}

/** Evaluate a single condition against a record. O(1). */
export function evaluateCondition(
  record: Record<string, unknown>,
  rule: Pick<ConditionalRule, 'field' | 'operator' | 'value'>,
): boolean {
  const raw = record[rule.field];
  const str = raw === null || raw === undefined ? '' : String(raw);

  switch (rule.operator) {
    case 'eq': return str === rule.value;
    case 'neq': return str !== rule.value;
    case 'contains': return str.includes(rule.value);
    case 'startsWith': return str.startsWith(rule.value);
    case 'isEmpty': return str.trim() === '';
    case 'notEmpty': return str.trim() !== '';
    default: return false;
  }
}

/** Apply a conditional rule to a record, returning a new record with the target field set. O(1). */
export function applyConditionalRule(
  record: Record<string, unknown>,
  targetField: string,
  rule: ConditionalRule,
): Record<string, unknown> {
  const matches = evaluateCondition(record, rule);
  const value = matches ? rule.thenValue : (rule.elseValue ?? record[targetField]);
  return { ...record, [targetField]: value };
}
