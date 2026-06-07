/**
 * Data quality scoring engine.
 * Evaluates records against configurable quality rules and produces
 * a scorecard with per-field breakdowns.
 * Complexity: O(R*Q) where R=records, Q=rules for full dataset scoring.
 */

import type { QualityRule } from '../../core/types/storage';

/** Result of evaluating a single rule against a single record. */
export interface QualityResult {
  field: string;
  rule: QualityRule;
  passed: boolean;
  value: unknown;
  message?: string;
}

/** Aggregate scorecard for an entire dataset evaluation. */
export interface ScorecardResult {
  totalRecords: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  /** Overall quality score from 0 to 100. */
  score: number;
  results: QualityResult[];
  fieldBreakdown: Map<string, { passed: number; failed: number; warnings: number }>;
}

/**
 * Evaluate a single QualityRule against a record. O(1).
 *
 * Rule types:
 * - `required` — field is non-null and non-empty
 * - `format` — regex match against `config.pattern`
 * - `range` — numeric value between `config.min` and `config.max`
 * - `picklist` — value is in `config.values` array
 * - `unique` — checks non-empty for single record evaluation (batch uniqueness checked in `scoreDataset`)
 * - `custom` — evaluates `config.expression` template against the record
 */
export function evaluateRule(
  record: Record<string, unknown>,
  rule: QualityRule,
): QualityResult {
  const raw = record[rule.field];
  const str = raw === null || raw === undefined ? '' : String(raw).trim();

  const base: Omit<QualityResult, 'passed' | 'message'> = {
    field: rule.field,
    rule,
    value: raw,
  };

  switch (rule.type) {
    case 'required': {
      const passed = raw !== null && raw !== undefined && str !== '';
      return {
        ...base,
        passed,
        message: passed ? undefined : rule.message || `Field "${rule.field}" is required`,
      };
    }

    case 'format': {
      const pattern = rule.config.pattern as string | undefined;
      if (!pattern) {
        return { ...base, passed: true };
      }
      // Empty values pass format checks — use 'required' rule for emptiness
      if (str === '') {
        return { ...base, passed: true };
      }
      const regex = new RegExp(pattern);
      const passed = regex.test(str);
      return {
        ...base,
        passed,
        message: passed ? undefined : rule.message || `Field "${rule.field}" does not match pattern ${pattern}`,
      };
    }

    case 'range': {
      const min = rule.config.min as number | undefined;
      const max = rule.config.max as number | undefined;
      // Empty values pass range checks — use 'required' rule for emptiness
      if (str === '') {
        return { ...base, passed: true };
      }
      const num = Number(raw);
      if (isNaN(num)) {
        return {
          ...base,
          passed: false,
          message: rule.message || `Field "${rule.field}" is not a valid number`,
        };
      }
      const aboveMin = min === undefined || num >= min;
      const belowMax = max === undefined || num <= max;
      const passed = aboveMin && belowMax;
      return {
        ...base,
        passed,
        message: passed
          ? undefined
          : rule.message || `Field "${rule.field}" value ${num} is outside range [${min ?? '-Inf'}, ${max ?? 'Inf'}]`,
      };
    }

    case 'picklist': {
      const values = rule.config.values as string[] | undefined;
      if (!values || values.length === 0) {
        return { ...base, passed: true };
      }
      // Empty values pass picklist checks — use 'required' rule for emptiness
      if (str === '') {
        return { ...base, passed: true };
      }
      const passed = values.includes(str);
      return {
        ...base,
        passed,
        message: passed
          ? undefined
          : rule.message || `Field "${rule.field}" value "${str}" is not in allowed values`,
      };
    }

    case 'unique': {
      // Single-record evaluation only checks non-empty.
      // True uniqueness is validated in scoreDataset via batch analysis.
      const passed = raw !== null && raw !== undefined && str !== '';
      return {
        ...base,
        passed,
        message: passed ? undefined : rule.message || `Field "${rule.field}" must have a value for uniqueness check`,
      };
    }

    case 'custom': {
      const expression = rule.config.expression as string | undefined;
      if (!expression) {
        return { ...base, passed: true };
      }
      // Evaluate template expression: replace {FieldName} tokens and check truthiness
      const interpolated = expression.replace(/\{([^}]+)\}/g, (_, key) => {
        const val = record[key.trim()];
        return val === null || val === undefined ? '' : String(val);
      });
      // The expression result is truthy if the interpolated string is non-empty
      // and not the literal strings "false" or "0"
      const passed = interpolated !== '' && interpolated !== 'false' && interpolated !== '0';
      return {
        ...base,
        passed,
        message: passed ? undefined : rule.message || `Field "${rule.field}" failed custom validation`,
      };
    }

    default:
      return { ...base, passed: true };
  }
}

/**
 * Score an entire dataset against a set of quality rules. O(R*Q).
 *
 * Runs every rule against every record, computes an overall score (0-100),
 * and builds a per-field breakdown of passes, failures, and warnings.
 * For `unique` rules, additionally checks for duplicate values across records.
 */
export function scoreDataset(
  records: Record<string, unknown>[],
  rules: QualityRule[],
): ScorecardResult {
  const results: QualityResult[] = [];
  const fieldBreakdown = new Map<string, { passed: number; failed: number; warnings: number }>();

  // Initialize field breakdown buckets
  for (const rule of rules) {
    if (!fieldBreakdown.has(rule.field)) {
      fieldBreakdown.set(rule.field, { passed: 0, failed: 0, warnings: 0 });
    }
  }

  // Collect values for uniqueness checks
  const uniqueFields = new Map<string, Map<string, number[]>>();
  for (const rule of rules) {
    if (rule.type === 'unique') {
      uniqueFields.set(rule.field, new Map());
    }
  }

  // First pass: build uniqueness maps
  if (uniqueFields.size > 0) {
    for (let i = 0; i < records.length; i++) {
      for (const [field, valueMap] of Array.from(uniqueFields.entries())) {
        const raw = records[i][field];
        const str = raw === null || raw === undefined ? '' : String(raw).trim();
        if (str !== '') {
          if (!valueMap.has(str)) {
            valueMap.set(str, []);
          }
          valueMap.get(str)!.push(i);
        }
      }
    }
  }

  let passedChecks = 0;
  let failedChecks = 0;
  let warningChecks = 0;

  // Second pass: evaluate all rules against all records
  for (let i = 0; i < records.length; i++) {
    for (const rule of rules) {
      let result = evaluateRule(records[i], rule);

      // Override unique rule result with batch uniqueness check
      if (rule.type === 'unique' && result.passed) {
        const valueMap = uniqueFields.get(rule.field);
        const raw = records[i][rule.field];
        const str = raw === null || raw === undefined ? '' : String(raw).trim();
        if (str !== '' && valueMap) {
          const indices = valueMap.get(str);
          if (indices && indices.length > 1) {
            result = {
              ...result,
              passed: false,
              message: rule.message || `Field "${rule.field}" value "${str}" is not unique (${indices.length} occurrences)`,
            };
          }
        }
      }

      results.push(result);
      const breakdown = fieldBreakdown.get(rule.field)!;

      if (result.passed) {
        passedChecks++;
        breakdown.passed++;
      } else if (rule.severity === 'warning') {
        warningChecks++;
        breakdown.warnings++;
      } else {
        failedChecks++;
        breakdown.failed++;
      }
    }
  }

  const totalChecks = results.length;
  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

  return {
    totalRecords: records.length,
    totalChecks,
    passedChecks,
    failedChecks,
    warningChecks,
    score,
    results,
    fieldBreakdown,
  };
}

/**
 * Suggest default quality rules for a field based on its describe metadata. O(P)
 * where P is the number of picklist values.
 *
 * @param field - A field describe object with at minimum `name`, `type`, and `nillable`.
 * @returns An array of suggested QualityRule objects (without `id` — caller should assign).
 */
export function getDefaultRulesForField(
  field: { name: string; type: string; nillable: boolean; picklistValues?: Array<{ value: string; active: boolean }> },
): QualityRule[] {
  const rules: QualityRule[] = [];
  let ruleIndex = 0;

  const makeId = (): string => `default-${field.name}-${ruleIndex++}`;

  // Non-nillable fields get a required rule
  if (!field.nillable) {
    rules.push({
      id: makeId(),
      field: field.name,
      type: 'required',
      config: {},
      severity: 'error',
      message: `${field.name} is required`,
    });
  }

  const typeLower = field.type.toLowerCase();

  // Email fields get a format rule
  if (typeLower === 'email') {
    rules.push({
      id: makeId(),
      field: field.name,
      type: 'format',
      config: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
      severity: 'error',
      message: `${field.name} must be a valid email address`,
    });
  }

  // URL fields get a format rule
  if (typeLower === 'url') {
    rules.push({
      id: makeId(),
      field: field.name,
      type: 'format',
      config: { pattern: '^https?://' },
      severity: 'warning',
      message: `${field.name} should be a valid URL`,
    });
  }

  // Phone fields get a format rule
  if (typeLower === 'phone') {
    rules.push({
      id: makeId(),
      field: field.name,
      type: 'format',
      config: { pattern: '^[\\d\\s\\(\\)\\+\\-\\.]+$' },
      severity: 'warning',
      message: `${field.name} should contain only valid phone characters`,
    });
  }

  // Numeric types get a range rule (non-negative by default)
  if (['int', 'integer', 'double', 'currency', 'percent'].includes(typeLower)) {
    rules.push({
      id: makeId(),
      field: field.name,
      type: 'range',
      config: { min: 0 },
      severity: 'warning',
      message: `${field.name} should be a non-negative number`,
    });
  }

  // Percent fields get a 0-100 range rule
  if (typeLower === 'percent') {
    rules.push({
      id: makeId(),
      field: field.name,
      type: 'range',
      config: { min: 0, max: 100 },
      severity: 'warning',
      message: `${field.name} should be between 0 and 100`,
    });
  }

  // Picklist fields get a picklist rule with active values
  if ((typeLower === 'picklist' || typeLower === 'multipicklist') && field.picklistValues) {
    const activeValues = field.picklistValues
      .filter(pv => pv.active)
      .map(pv => pv.value);
    if (activeValues.length > 0) {
      rules.push({
        id: makeId(),
        field: field.name,
        type: 'picklist',
        config: { values: activeValues },
        severity: 'error',
        message: `${field.name} must be one of the allowed picklist values`,
      });
    }
  }

  // ID / externalId fields get a unique rule
  if (typeLower === 'id' || field.name.toLowerCase().includes('externalid')) {
    rules.push({
      id: makeId(),
      field: field.name,
      type: 'unique',
      config: {},
      severity: 'error',
      message: `${field.name} must be unique`,
    });
  }

  return rules;
}

/**
 * Infer heuristic quality rules from column headers alone, for scoring an
 * in-memory dataset without describe metadata (e.g. inside the Cleanser).
 *
 * Every column gets a completeness (`required`, warning) rule, and columns
 * whose name hints at a known type (email / url / phone) also get a format
 * rule. The resulting score is dominated by completeness, which is the most
 * useful signal when shaping a raw file before a push.
 *
 * Complexity: O(H) in the number of headers.
 */
export function inferQualityRules(headers: string[]): QualityRule[] {
  const rules: QualityRule[] = [];

  for (const header of headers) {
    const name = header.trim();
    if (name === '') continue;
    const lower = name.toLowerCase();

    // Completeness — non-empty value expected for every column.
    rules.push({
      id: `infer-required-${name}`,
      field: name,
      type: 'required',
      config: {},
      severity: 'warning',
      message: `${name} is empty`,
    });

    if (lower.includes('email')) {
      rules.push({
        id: `infer-email-${name}`,
        field: name,
        type: 'format',
        config: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
        severity: 'error',
        message: `${name} must be a valid email address`,
      });
    } else if (lower.includes('website') || lower.includes('url')) {
      rules.push({
        id: `infer-url-${name}`,
        field: name,
        type: 'format',
        config: { pattern: '^https?://' },
        severity: 'warning',
        message: `${name} should be a valid URL`,
      });
    } else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('fax')) {
      rules.push({
        id: `infer-phone-${name}`,
        field: name,
        type: 'format',
        config: { pattern: '^[\\d\\s\\(\\)\\+\\-\\.]+$' },
        severity: 'warning',
        message: `${name} should contain only valid phone characters`,
      });
    }
  }

  return rules;
}
