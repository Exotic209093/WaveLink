import type { VNode } from 'preact';
import { h } from 'preact';
import type { SObjectField } from '../../../core/types/salesforce';
import type { WhereCondition, SoqlOperator } from '../../utils/soqlBuilder';
import { getOperatorsForFieldType } from '../../utils/soqlBuilder';

export function WhereBuilder(props: {
  conditions: WhereCondition[];
  fields: SObjectField[];
  onChange: (conditions: WhereCondition[]) => void;
}): VNode {
  const { conditions, fields, onChange } = props;
  const fieldMap = new Map(fields.map(f => [f.name, f]));

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
      id: `w_${Date.now()}`,
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
  ): VNode {
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

    if (picklist && picklist.length > 0 && cond.operator !== 'LIKE') {
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

    if (ft === 'date') {
      return (
        <input
          type="date"
          class="wl-input wl-qb-condVal"
          value={cond.value}
          onInput={(e) => update(index, { value: (e.currentTarget as HTMLInputElement).value })}
        />
      );
    }

    if (ft === 'datetime') {
      return (
        <input
          type="datetime-local"
          class="wl-input wl-qb-condVal"
          value={cond.value}
          onInput={(e) => update(index, { value: (e.currentTarget as HTMLInputElement).value })}
        />
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
