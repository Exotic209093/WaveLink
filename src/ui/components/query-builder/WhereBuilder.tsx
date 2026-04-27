import type { VNode } from 'preact';
import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import type { SObjectField } from '../../../core/types/salesforce';
import type { WhereCondition, SoqlOperator } from '../../utils/soqlBuilder';
import { getOperatorsForFieldType, SOQL_DATE_LITERALS } from '../../utils/soqlBuilder';

/** Operators that take no value input. */
const NULL_OPERATORS = new Set<SoqlOperator>(['IS NULL', 'IS NOT NULL']);
/** Operators that need multi-value text input even for picklist fields. */
const MULTI_VALUE_OPERATORS = new Set<SoqlOperator>(['IN', 'NOT IN', 'INCLUDES', 'EXCLUDES']);

export function WhereBuilder(props: {
  conditions: WhereCondition[];
  fields: SObjectField[];
  onChange: (conditions: WhereCondition[]) => void;
}): VNode {
  const { conditions, fields, onChange } = props;
  const fieldMap = useMemo(() => new Map(fields.map(f => [f.name, f])), [fields]);

  function update(index: number, patch: Partial<WhereCondition>): void {
    const next = conditions.map((c, i) => i === index ? { ...c, ...patch } : c);
    if (patch.field && patch.field !== conditions[index].field) {
      const ft = fieldMap.get(patch.field)?.type ?? 'string';
      const ops = getOperatorsForFieldType(ft);
      next[index] = { ...next[index], operator: ops[0], value: '' };
    }
    onChange(next);
  }

  function add(): void {
    onChange([...conditions, {
      id: crypto.randomUUID(),
      field: '',
      operator: '=',
      value: '',
      connector: 'AND',
    }]);
  }

  function remove(index: number): void {
    onChange(conditions.filter((_, i) => i !== index));
  }

  return (
    <div class="wl-qb-section">
      <div class="wl-qb-sectionLabel">Where</div>
      <div class="wl-qb-condGroup">
        {conditions.map((cond, i) => {
          const field = fieldMap.get(cond.field);
          const ops = field ? getOperatorsForFieldType(field.type) : ['=', '!=', '<', '>', 'LIKE'] as SoqlOperator[];
          const picklist = field?.picklistValues?.filter(p => p.active);

          return (
            <div key={cond.id}>
              {i > 0 && (
                <div class="wl-qb-condConnectorRow">
                  <div class="wl-qb-condConnectorLine" />
                  <div class="wl-qb-segmented wl-qb-segSm">
                    <button
                      class={`wl-qb-segBtn${cond.connector === 'AND' ? ' wl-qb-segBtnActive' : ''}`}
                      onClick={() => update(i, { connector: 'AND' })}
                    >AND</button>
                    <button
                      class={`wl-qb-segBtn${cond.connector === 'OR' ? ' wl-qb-segBtnActive' : ''}`}
                      onClick={() => update(i, { connector: 'OR' })}
                    >OR</button>
                  </div>
                  <div class="wl-qb-condConnectorLine" />
                </div>
              )}

              <div class="wl-qb-condCard">
                <select
                  class="wl-select wl-qb-condField"
                  value={cond.field}
                  onChange={(e) => update(i, { field: (e.currentTarget as HTMLSelectElement).value })}
                >
                  <option value="">Field...</option>
                  {fields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>

                <select
                  class="wl-select wl-qb-condOp"
                  value={cond.operator}
                  onChange={(e) => update(i, { operator: (e.currentTarget as HTMLSelectElement).value as SoqlOperator })}
                >
                  {ops.map(op => <option key={op} value={op}>{op}</option>)}
                </select>

                {renderValueInput(cond, field, picklist, i)}

                <button
                  class="wl-qb-condRemove"
                  onClick={() => remove(i)}
                  title="Remove condition"
                >&times;</button>
              </div>
            </div>
          );
        })}
      </div>
      <button class="wl-qb-addBtn" onClick={add} disabled={fields.length === 0}>
        + Add Condition
      </button>
    </div>
  );

  function renderValueInput(
    cond: WhereCondition,
    field: SObjectField | undefined,
    picklist: Array<{ value: string; label: string }> | undefined,
    index: number,
  ): VNode | null {
    // NULL operators take no value
    if (NULL_OPERATORS.has(cond.operator)) return null;

    const ft = field?.type;

    if (ft === 'boolean') {
      return (
        <select
          class="wl-select wl-qb-condVal"
          value={cond.value}
          onChange={(e) => update(index, { value: (e.currentTarget as HTMLSelectElement).value })}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    // Show single-select dropdown for picklist fields only with simple equality operators
    if (picklist && picklist.length > 0 && !MULTI_VALUE_OPERATORS.has(cond.operator) && cond.operator !== 'LIKE') {
      return (
        <select
          class="wl-select wl-qb-condVal"
          value={cond.value}
          onChange={(e) => update(index, { value: (e.currentTarget as HTMLSelectElement).value })}
        >
          <option value="">Value...</option>
          {picklist.map(p => <option key={p.value} value={p.value}>{p.label || p.value}</option>)}
        </select>
      );
    }

    if (ft === 'date' || ft === 'datetime') {
      // Check if current value is a date literal
      const isLiteral = SOQL_DATE_LITERALS.some(l =>
        cond.value.toUpperCase().startsWith(l.replace(':n', '').toUpperCase()),
      );
      return (
        <div class="wl-qb-condVal" style="display:flex;gap:4px;flex:1;min-width:80px">
          <select
            class="wl-select"
            style="width:auto;min-width:70px"
            value={isLiteral ? 'literal' : 'value'}
            onChange={(e) => {
              const mode = (e.currentTarget as HTMLSelectElement).value;
              if (mode === 'value') update(index, { value: '' });
              else update(index, { value: 'TODAY' });
            }}
          >
            <option value="value">{ft === 'date' ? 'Date' : 'Datetime'}</option>
            <option value="literal">Literal</option>
          </select>
          {isLiteral ? (
            <div style="display:flex;gap:4px;flex:1">
              <select
                class="wl-select"
                style="flex:1"
                value={cond.value.toUpperCase().replace(/:\d+$/, ':n')}
                onChange={(e) => {
                  const val = (e.currentTarget as HTMLSelectElement).value;
                  update(index, { value: val.includes(':n') ? val.replace(':n', ':30') : val });
                }}
              >
                {SOQL_DATE_LITERALS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              {cond.value.includes(':') && (
                <input
                  class="wl-input"
                  type="number"
                  min="1"
                  style="width:60px;flex-shrink:0"
                  value={cond.value.split(':')[1] || '30'}
                  onInput={(e) => {
                    const n = (e.currentTarget as HTMLInputElement).value;
                    const base = cond.value.split(':')[0];
                    update(index, { value: `${base}:${n}` });
                  }}
                />
              )}
            </div>
          ) : ft === 'date' ? (
            <input
              type="date"
              class="wl-input"
              style="flex:1"
              value={cond.value}
              onInput={(e) => update(index, { value: (e.currentTarget as HTMLInputElement).value })}
            />
          ) : (
            <input
              type="datetime-local"
              class="wl-input"
              style="flex:1"
              value={cond.value}
              onInput={(e) => update(index, { value: (e.currentTarget as HTMLInputElement).value })}
            />
          )}
        </div>
      );
    }

    const placeholder = (cond.operator === 'IN' || cond.operator === 'NOT IN')
      ? 'val1, val2, ...'
      : (cond.operator === 'INCLUDES' || cond.operator === 'EXCLUDES')
        ? 'val1;val2;...'
        : 'Value...';

    return (
      <input
        class="wl-input wl-qb-condVal"
        placeholder={placeholder}
        value={cond.value}
        onInput={(e) => update(index, { value: (e.currentTarget as HTMLInputElement).value })}
      />
    );
  }
}
