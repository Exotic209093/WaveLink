/**
 * Visual SOQL query builder.
 *
 * Manages structured state (object, fields, WHERE, ORDER BY, LIMIT)
 * and generates a SOQL string in real-time via buildSoql().
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
import type { SalesforceFieldType } from '../../../core/types/salesforce';
import type { SchemaLoaderResult } from '../../hooks/useSchemaLoader';
import type { WhereCondition, OrderByClause } from '../../utils/soqlBuilder';
import { buildSoql } from '../../utils/soqlBuilder';
import { ObjectSelector } from './ObjectSelector';
import { FieldSelector } from './FieldSelector';
import { WhereBuilder } from './WhereBuilder';
import { OrderBySelector } from './OrderBySelector';
import { SoqlPreview } from './SoqlPreview';

export function QueryBuilder(props: {
  schema: SchemaLoaderResult;
  onApply: (soql: string) => void;
}): VNode {
  const { schema, onApply } = props;

  const [objectName, setObjectName] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [whereConditions, setWhereConditions] = useState<WhereCondition[]>([]);
  const [orderBy, setOrderBy] = useState<OrderByClause | null>(null);
  const [limit, setLimit] = useState<number | null>(null);

  // Load fields when object changes
  useEffect(() => {
    if (objectName) {
      schema.loadFields(objectName);
    }
    // Reset dependent state
    setSelectedFields([]);
    setWhereConditions([]);
    setOrderBy(null);
  }, [objectName]);

  const fieldTypeMap = useMemo(() => {
    const m = new Map<string, SalesforceFieldType>();
    for (const f of schema.fields) m.set(f.name, f.type);
    return m;
  }, [schema.fields]);

  const generatedSoql = useMemo(
    () => buildSoql({ objectName, selectedFields, whereConditions, orderBy, limit }, fieldTypeMap),
    [objectName, selectedFields, whereConditions, orderBy, limit, fieldTypeMap],
  );

  return (
    <div class="wl-qb-container">
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

      <WhereBuilder
        conditions={whereConditions}
        fields={schema.fields}
        onChange={setWhereConditions}
      />

      <OrderBySelector
        fields={schema.fields}
        orderBy={orderBy}
        onChange={setOrderBy}
      />

      <div class="wl-qb-section">
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

      <SoqlPreview soql={generatedSoql} onApply={() => onApply(generatedSoql)} />
    </div>
  );
}
