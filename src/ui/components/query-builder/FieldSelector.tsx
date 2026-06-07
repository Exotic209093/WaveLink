import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import type { SObjectField } from '../../../core/types/salesforce';
import { fuzzyFilter } from '../../utils/fuzzyMatch';

export function FieldSelector(props: {
  fields: SObjectField[];
  loading: boolean;
  selectedFields: string[];
  onSelectedFieldsChange: (fields: string[]) => void;
}): VNode {
  const { fields, loading, selectedFields, onSelectedFieldsChange } = props;
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => fuzzyFilter(fields, search, f => f.name),
    [fields, search],
  );

  const selectedSet = useMemo(() => new Set(selectedFields), [selectedFields]);

  function toggle(name: string): void {
    const next = new Set(selectedSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onSelectedFieldsChange(Array.from(next));
  }

  function selectAll(): void {
    onSelectedFieldsChange(filtered.map(f => f.name));
  }

  function deselectAll(): void {
    onSelectedFieldsChange([]);
  }

  if (loading) {
    return (
      <div class="wl-qb-section">
        <div class="wl-qb-sectionLabel">Fields</div>
        <div class="wl-muted">Loading fields...</div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div class="wl-qb-section">
        <div class="wl-qb-sectionLabel">Fields</div>
        <div class="wl-muted">Select an object first</div>
      </div>
    );
  }

  const MAX_CHIPS = 14;

  return (
    <div class="wl-qb-section">
      <div class="wl-qb-sectionLabel">
        Fields
        <span class="wl-badge" style="margin-left:8px;font-weight:700;padding:2px 8px">
          {selectedFields.length} / {fields.length}
        </span>
      </div>

      {selectedFields.length > 0 && (
        <div class="wl-qb-fieldChips">
          {selectedFields.slice(0, MAX_CHIPS).map(name => (
            <span key={name} class="wl-qb-fieldChip">
              <span class="wl-mono">{name}</span>
              <button type="button" class="wl-qb-chipX" aria-label={`Remove field ${name}`} onClick={() => toggle(name)}>&times;</button>
            </span>
          ))}
          {selectedFields.length > MAX_CHIPS && (
            <span class="wl-muted" style="padding:2px 4px">+{selectedFields.length - MAX_CHIPS} more</span>
          )}
        </div>
      )}

      <div class="wl-qb-fieldControls">
        <input
          class="wl-input"
          style="flex:1"
          placeholder="Search fields..."
          value={search}
          onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
        />
        <button class="wl-btn" style="padding:6px 10px;font-size:11px" onClick={selectAll}>All</button>
        <button class="wl-btn" style="padding:6px 10px;font-size:11px" onClick={deselectAll}>None</button>
      </div>
      <div class="wl-qb-fieldList">
        {filtered.map(f => (
          <label key={f.name} class={`wl-qb-fieldItem${selectedSet.has(f.name) ? ' wl-qb-fieldItemSel' : ''}`}>
            <input
              type="checkbox"
              checked={selectedSet.has(f.name)}
              onChange={() => toggle(f.name)}
            />
            <span class="wl-mono" style="font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{f.name}</span>
            <span class="wl-qb-typeBadge">{f.type}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
