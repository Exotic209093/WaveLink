/**
 * Child relationship subquery builder.
 *
 * Allows adding subqueries like (SELECT Id, Name FROM Contacts) to the
 * field list of the parent query builder.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import type { ChildRelationship } from '../../../core/types/salesforce';

export interface SubqueryDef {
  id: string;
  relationshipName: string;
  fields: string;  // Comma-separated field list for simplicity
}

export function SubqueryBuilder(props: {
  subqueries: SubqueryDef[];
  childRelationships: ChildRelationship[];
  onChange: (subqueries: SubqueryDef[]) => void;
}): VNode {
  const { subqueries, childRelationships, onChange } = props;
  const [search, setSearch] = useState('');

  const availableRels = useMemo(
    () => childRelationships
      .filter(r => r.relationshipName && !r.deprecatedAndHidden)
      .filter(r => !search || r.relationshipName!.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 40),
    [childRelationships, search],
  );

  function add(relName: string): void {
    onChange([...subqueries, {
      id: crypto.randomUUID(),
      relationshipName: relName,
      fields: 'Id, Name',
    }]);
  }

  function update(index: number, patch: Partial<SubqueryDef>): void {
    onChange(subqueries.map((s, i) => i === index ? { ...s, ...patch } : s));
  }

  function remove(index: number): void {
    onChange(subqueries.filter((_, i) => i !== index));
  }

  return (
    <div class="wl-qb-section">
      <div class="wl-qb-sectionLabel">
        Subqueries (Child Relationships)
        {subqueries.length > 0 && (
          <span class="wl-badge" style="margin-left:8px;font-weight:700;padding:2px 8px">
            {subqueries.length}
          </span>
        )}
      </div>

      {subqueries.map((sq, i) => (
        <div key={sq.id} class="wl-qb-condCard" style="flex-direction:column;align-items:stretch;gap:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="wl-mono" style="font-size:12px;font-weight:600">{sq.relationshipName}</span>
            <button
              class="wl-qb-condRemove"
              onClick={() => remove(i)}
              title="Remove subquery"
            >&times;</button>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="wl-muted" style="font-size:11px;flex-shrink:0">SELECT</span>
            <input
              class="wl-input"
              style="flex:1;font-size:11px"
              placeholder="Id, Name, ..."
              value={sq.fields}
              onInput={(e) => update(i, { fields: (e.currentTarget as HTMLInputElement).value })}
            />
          </div>
          <div class="wl-muted" style="font-size:10px">
            Preview: (SELECT {sq.fields || '...'} FROM {sq.relationshipName})
          </div>
        </div>
      ))}

      {childRelationships.length > 0 && (
        <div style="margin-top:6px">
          <input
            class="wl-input"
            style="margin-bottom:6px"
            placeholder="Search child relationships..."
            value={search}
            onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
          />
          <div style="max-height:140px;overflow:auto;display:flex;flex-wrap:wrap;gap:4px">
            {availableRels.map(r => {
              const alreadyAdded = subqueries.some(s => s.relationshipName === r.relationshipName);
              return (
                <button
                  key={r.relationshipName}
                  class="wl-btn"
                  style={`font-size:11px;padding:3px 8px${alreadyAdded ? ';opacity:0.4' : ''}`}
                  disabled={alreadyAdded}
                  onClick={() => add(r.relationshipName!)}
                  title={`Child: ${r.childSObject} via ${r.field}`}
                >
                  {r.relationshipName}
                  <span class="wl-muted" style="margin-left:4px;font-size:10px">{r.childSObject}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {childRelationships.length === 0 && subqueries.length === 0 && (
        <div class="wl-muted" style="font-size:12px">
          Select an object to see available child relationships
        </div>
      )}
    </div>
  );
}

/** Build a subquery SELECT string from a SubqueryDef. */
export function buildSubqueryString(sq: SubqueryDef): string {
  const fields = sq.fields.trim() || 'Id';
  return `(SELECT ${fields} FROM ${sq.relationshipName})`;
}
