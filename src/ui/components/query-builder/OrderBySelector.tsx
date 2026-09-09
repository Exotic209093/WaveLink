import type { VNode } from 'preact';
import { h } from 'preact';
import type { SObjectField } from '../../../core/types/salesforce';
import type { OrderByClause } from '../../utils/soqlBuilder';
import { fieldDisplay } from '../../utils/fieldDisplay';

export function OrderBySelector(props: {
  fields: SObjectField[];
  orderBy: OrderByClause | null;
  onChange: (orderBy: OrderByClause | null) => void;
}): VNode {
  const { fields, orderBy, onChange } = props;

  return (
    <div class="wl-qb-section" role="group" aria-label="Order by configuration">
      <div class="wl-qb-sectionLabel" id="wl-qb-orderby-label">Order By</div>
      <div class="wl-qb-orderRow">
        <select
          class="wl-select"
          style="flex:1"
          aria-labelledby="wl-qb-orderby-label"
          value={orderBy?.field ?? ''}
          onChange={(e) => {
            const val = (e.currentTarget as HTMLSelectElement).value;
            if (!val) {
              onChange(null);
            } else {
              onChange({ field: val, direction: orderBy?.direction ?? 'ASC' });
            }
          }}
        >
          <option value="">None</option>
          {fields.map(f => <option key={f.name} value={f.name}>{fieldDisplay(f)}</option>)}
        </select>
        {orderBy && (
          <div class="wl-qb-segmented" role="radiogroup" aria-label="Sort direction">
            <button
              class={`wl-qb-segBtn${orderBy.direction === 'ASC' ? ' wl-qb-segBtnActive' : ''}`}
              role="radio"
              aria-checked={orderBy.direction === 'ASC'}
              onClick={() => onChange({ ...orderBy, direction: 'ASC' })}
            >ASC</button>
            <button
              class={`wl-qb-segBtn${orderBy.direction === 'DESC' ? ' wl-qb-segBtnActive' : ''}`}
              role="radio"
              aria-checked={orderBy.direction === 'DESC'}
              onClick={() => onChange({ ...orderBy, direction: 'DESC' })}
            >DESC</button>
          </div>
        )}
      </div>
    </div>
  );
}
