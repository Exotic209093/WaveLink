/**
 * Visual builder for IF / THEN / ELSE conditional rules.
 *
 * What this file does:
 * - Renders three rows (IF condition, THEN value, ELSE value) for constructing a ConditionalRule.
 * - Emits onChange whenever any part of the rule changes.
 *
 * Complexity:
 * - O(F) per render where F is the number of available fields (for the select dropdown).
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import type { ConditionalRule, ConditionOperator } from '../utils/formulas';

export interface ConditionalBuilderProps {
  fields: string[];
  rule: ConditionalRule | null;
  onChange: (rule: ConditionalRule) => void;
}

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'notEmpty', label: 'is not empty' },
];

/** No-value operators where the comparison value input should be hidden. */
const NO_VALUE_OPS: Set<ConditionOperator> = new Set(['isEmpty', 'notEmpty']);

/**
 * Conditional rule builder component.
 * O(F) render where F is the number of fields.
 */
export function ConditionalBuilder(props: ConditionalBuilderProps): VNode {
  const { fields, rule, onChange } = props;

  const current: ConditionalRule = rule ?? {
    field: fields[0] ?? '',
    operator: 'eq',
    value: '',
    thenValue: '',
    elseValue: '',
  };

  /** Emit a partial update merged with the current rule. */
  const update = (patch: Partial<ConditionalRule>): void => {
    onChange({ ...current, ...patch });
  };

  return (
    <div>
      {/* IF row */}
      <div class="wl-conditionalRow" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-weight:700;font-size:12px;min-width:36px">IF</span>

        <select
          class="wl-select"
          value={current.field}
          onChange={(e) => update({ field: (e.currentTarget as HTMLSelectElement).value })}
        >
          {fields.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <select
          class="wl-select"
          value={current.operator}
          onChange={(e) => update({ operator: (e.currentTarget as HTMLSelectElement).value as ConditionOperator })}
        >
          {OPERATORS.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>

        {!NO_VALUE_OPS.has(current.operator) ? (
          <input
            class="wl-input"
            type="text"
            placeholder="value"
            value={current.value}
            onInput={(e) => update({ value: (e.currentTarget as HTMLInputElement).value })}
            style="flex:1"
          />
        ) : null}
      </div>

      {/* THEN row */}
      <div class="wl-conditionalRow" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-weight:700;font-size:12px;min-width:36px">THEN</span>
        <input
          class="wl-input"
          type="text"
          placeholder="value to set"
          value={current.thenValue}
          onInput={(e) => update({ thenValue: (e.currentTarget as HTMLInputElement).value })}
          style="flex:1"
        />
      </div>

      {/* ELSE row */}
      <div class="wl-conditionalRow" style="display:flex;align-items:center;gap:8px">
        <span style="font-weight:700;font-size:12px;min-width:36px">ELSE</span>
        <input
          class="wl-input"
          type="text"
          placeholder="(optional) value if condition is false"
          value={current.elseValue ?? ''}
          onInput={(e) => update({ elseValue: (e.currentTarget as HTMLInputElement).value || undefined })}
          style="flex:1"
        />
      </div>
    </div>
  );
}
