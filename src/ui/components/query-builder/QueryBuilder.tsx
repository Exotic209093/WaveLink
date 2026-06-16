/**
 * Visual SOQL query builder.
 *
 * Manages structured state (object, fields, WHERE, ORDER BY, GROUP BY, LIMIT, OFFSET)
 * and generates a SOQL string in real-time via buildSoql().
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import type { SalesforceFieldType } from '../../../core/types/salesforce';
import type { SchemaLoaderResult } from '../../hooks/useSchemaLoader';
import type { WhereCondition, OrderByClause, AggregateField } from '../../utils/soqlBuilder';
import { buildSoql, AGGREGATE_FUNCTIONS } from '../../utils/soqlBuilder';
import { fieldDisplay } from '../../utils/fieldDisplay';
import { ObjectSelector } from './ObjectSelector';
import { FieldSelector } from './FieldSelector';
import { WhereBuilder } from './WhereBuilder';
import { OrderBySelector } from './OrderBySelector';
import { SoqlPreview } from './SoqlPreview';
import { SubqueryBuilder, buildSubqueryString } from './SubqueryBuilder';
import type { SubqueryDef } from './SubqueryBuilder';

export function QueryBuilder(props: {
  schema: SchemaLoaderResult;
  onApply: (soql: string) => void;
}): VNode {
  const { schema, onApply } = props;

  const [objectName, setObjectName] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [aggregateFields, setAggregateFields] = useState<AggregateField[]>([]);
  const [whereConditions, setWhereConditions] = useState<WhereCondition[]>([]);
  const [orderBy, setOrderBy] = useState<OrderByClause | null>(null);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const [subqueries, setSubqueries] = useState<SubqueryDef[]>([]);

  // Load fields when object changes
  useEffect(() => {
    if (objectName) {
      schema.loadFields(objectName);
    } else {
      // Only reset dependent state when object is cleared
      setSelectedFields([]);
      setAggregateFields([]);
      setWhereConditions([]);
      setOrderBy(null);
      setGroupBy([]);
      setSubqueries([]);
    }
  }, [objectName, schema.loadFields]);

  // Reset dependent state when object changes (separate effect to avoid clearing on retry)
  const prevObjectRef = useRef(objectName);
  useEffect(() => {
    if (prevObjectRef.current !== objectName) {
      prevObjectRef.current = objectName;
      setSelectedFields([]);
      setAggregateFields([]);
      setWhereConditions([]);
      setOrderBy(null);
      setGroupBy([]);
      setSubqueries([]);
    }
  }, [objectName]);

  const fieldTypeMap = useMemo(() => {
    const m = new Map<string, SalesforceFieldType>();
    for (const f of schema.fields) m.set(f.name, f.type);
    return m;
  }, [schema.fields]);

  // Append subquery strings to selected fields for SOQL generation
  const fieldsWithSubqueries = useMemo(() => {
    const sqStrings = subqueries.map(sq => buildSubqueryString(sq));
    return [...selectedFields, ...sqStrings];
  }, [selectedFields, subqueries]);

  const generatedSoql = useMemo(
    () => buildSoql({ objectName, selectedFields: fieldsWithSubqueries, aggregateFields, whereConditions, orderBy, groupBy, limit, offset }, fieldTypeMap),
    [objectName, fieldsWithSubqueries, aggregateFields, whereConditions, orderBy, groupBy, limit, offset, fieldTypeMap],
  );

  function resetBuilder(): void {
    setObjectName('');
    setSelectedFields([]);
    setAggregateFields([]);
    setWhereConditions([]);
    setOrderBy(null);
    setGroupBy([]);
    setLimit(null);
    setOffset(null);
    setSubqueries([]);
  }

  function addAggregate(): void {
    setAggregateFields(prev => [...prev, { id: crypto.randomUUID(), fn: 'COUNT', field: '', alias: '' }]);
  }

  function updateAggregate(index: number, patch: Partial<AggregateField>): void {
    setAggregateFields(prev => prev.map((a, i) => i === index ? { ...a, ...patch } : a));
  }

  function removeAggregate(index: number): void {
    setAggregateFields(prev => prev.filter((_, i) => i !== index));
  }

  function toggleGroupBy(fieldName: string): void {
    setGroupBy(prev =>
      prev.includes(fieldName) ? prev.filter(f => f !== fieldName) : [...prev, fieldName],
    );
  }

  return (
    <div class="wl-qb-container">
      <div class="wl-qb-section" style="display:flex;justify-content:flex-end;border-bottom:none;padding-bottom:0">
        <button class="wl-btn" style="font-size:11px;padding:4px 12px" onClick={resetBuilder}>
          Reset
        </button>
      </div>

      <ObjectSelector
        objects={schema.objects}
        loading={schema.objectsLoading}
        value={objectName}
        onChange={setObjectName}
      />

      <FieldSelector
        fields={schema.fields}
        loading={schema.fieldsLoading}
        selectedFields={selectedFields}
        onSelectedFieldsChange={setSelectedFields}
      />

      {/* Subqueries (Child Relationships) */}
      <SubqueryBuilder
        subqueries={subqueries}
        childRelationships={schema.childRelationships}
        onChange={setSubqueries}
      />

      {/* Aggregate Functions */}
      <div class="wl-qb-section">
        <div class="wl-qb-sectionLabel">Aggregate Functions</div>
        <div class="wl-qb-condGroup">
          {aggregateFields.map((agg, i) => (
            <div key={agg.id} class="wl-qb-condCard">
              <select
                class="wl-select wl-qb-condOp"
                value={agg.fn}
                onChange={(e) => updateAggregate(i, { fn: (e.currentTarget as HTMLSelectElement).value as AggregateField['fn'] })}
              >
                {AGGREGATE_FUNCTIONS.map(fn => <option key={fn} value={fn}>{fn}</option>)}
              </select>
              {agg.fn === 'COUNT' ? (
                <span class="wl-muted" style="flex:1;padding:0 8px;font-size:12px">COUNT()</span>
              ) : (
                <select
                  class="wl-select wl-qb-condField"
                  value={agg.field}
                  onChange={(e) => updateAggregate(i, { field: (e.currentTarget as HTMLSelectElement).value })}
                >
                  <option value="">Field...</option>
                  {schema.fields.map(f => <option key={f.name} value={f.name}>{fieldDisplay(f)}</option>)}
                </select>
              )}
              <input
                class="wl-input"
                style="width:80px;flex-shrink:0"
                placeholder="Alias"
                value={agg.alias}
                onInput={(e) => updateAggregate(i, { alias: (e.currentTarget as HTMLInputElement).value })}
              />
              <button
                class="wl-qb-condRemove"
                onClick={() => removeAggregate(i)}
                title="Remove aggregate"
              >&times;</button>
            </div>
          ))}
        </div>
        <button class="wl-qb-addBtn" onClick={addAggregate} disabled={schema.fields.length === 0}>
          + Add Aggregate
        </button>
      </div>

      <WhereBuilder
        conditions={whereConditions}
        fields={schema.fields}
        onChange={setWhereConditions}
      />

      {/* GROUP BY */}
      {(aggregateFields.length > 0 || groupBy.length > 0) && schema.fields.length > 0 && (
        <div class="wl-qb-section">
          <div class="wl-qb-sectionLabel">
            Group By
            {groupBy.length > 0 && (
              <span class="wl-badge" style="margin-left:8px;font-weight:700;padding:2px 8px">
                {groupBy.length}
              </span>
            )}
          </div>
          {groupBy.length > 0 && (
            <div class="wl-qb-fieldChips">
              {groupBy.map(name => (
                <span key={name} class="wl-qb-fieldChip">
                  <span class="wl-mono">{name}</span>
                  <button type="button" class="wl-qb-chipX" aria-label={`Remove group by ${name}`} onClick={() => toggleGroupBy(name)}>&times;</button>
                </span>
              ))}
            </div>
          )}
          <div class="wl-qb-fieldList" style="max-height:140px">
            {schema.fields.map(f => (
              <label key={f.name} class={`wl-qb-fieldItem${groupBy.includes(f.name) ? ' wl-qb-fieldItemSel' : ''}`}>
                <input
                  type="checkbox"
                  checked={groupBy.includes(f.name)}
                  onChange={() => toggleGroupBy(f.name)}
                />
                <span class="wl-mono" style="font-size:12px;flex:1">{f.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <OrderBySelector
        fields={schema.fields}
        orderBy={orderBy}
        onChange={setOrderBy}
      />

      <div class="wl-qb-section" style="display:flex;gap:12px">
        <div style="flex:1">
          <div class="wl-qb-sectionLabel">Limit</div>
          <input
            class="wl-input"
            type="number"
            min="0"
            placeholder="No limit"
            value={limit ?? ''}
            onInput={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value;
              setLimit(v ? parseInt(v, 10) : null);
            }}
          />
        </div>
        <div style="flex:1">
          <div class="wl-qb-sectionLabel">Offset</div>
          <input
            class="wl-input"
            type="number"
            min="0"
            placeholder="No offset"
            value={offset ?? ''}
            onInput={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value;
              setOffset(v ? parseInt(v, 10) : null);
            }}
          />
        </div>
      </div>

      <SoqlPreview soql={generatedSoql} onApply={() => onApply(generatedSoql)} />
    </div>
  );
}
