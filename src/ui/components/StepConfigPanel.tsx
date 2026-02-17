/**
 * Configuration form panel for a single pipeline step.
 *
 * What this file does:
 * - Switches on step.type to render the appropriate configuration form.
 * - Supports filter, transform, lookup, aggregate, and join step types.
 * - Provides a Remove button to delete the step from the pipeline.
 *
 * Why:
 * - Each step type has unique configuration fields; this panel handles them all in one component.
 *
 * Complexity:
 * - Rendering is O(A) where A = number of aggregation rows (for aggregate type).
 * - All other types are O(1) rendering.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState } from 'preact/hooks';
import type { PipelineStep } from '../utils/pipelineExecutor';

export interface StepConfigPanelProps {
  step: PipelineStep;
  onChange: (step: PipelineStep) => void;
  onRemove: () => void;
}

/**
 * Update a config field on the step. O(1).
 */
function updateConfig(
  step: PipelineStep,
  key: string,
  value: unknown,
  onChange: (s: PipelineStep) => void,
): void {
  onChange({
    ...step,
    config: { ...step.config, [key]: value },
  });
}

/**
 * Render the filter step config form. O(1).
 */
function FilterConfig(props: { step: PipelineStep; onChange: (s: PipelineStep) => void }): VNode {
  const { step, onChange } = props;
  const field = (step.config.field as string) ?? '';
  const operator = (step.config.operator as string) ?? 'eq';
  const value = (step.config.value as string) ?? '';

  return (
    <div style="display:flex;flex-direction:column;gap:8px">
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Field</div>
        <input
          class="wl-input"
          value={field}
          placeholder="Field name"
          onInput={(e) => updateConfig(step, 'field', (e.currentTarget as HTMLInputElement).value, onChange)}
        />
      </div>
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Operator</div>
        <select
          class="wl-select"
          value={operator}
          onChange={(e) => updateConfig(step, 'operator', (e.currentTarget as HTMLSelectElement).value, onChange)}
        >
          <option value="eq">Equals (eq)</option>
          <option value="neq">Not Equals (neq)</option>
          <option value="contains">Contains</option>
          <option value="startsWith">Starts With</option>
          <option value="isEmpty">Is Empty</option>
          <option value="notEmpty">Not Empty</option>
        </select>
      </div>
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Value</div>
        <input
          class="wl-input"
          value={value}
          placeholder="Comparison value"
          onInput={(e) => updateConfig(step, 'value', (e.currentTarget as HTMLInputElement).value, onChange)}
        />
      </div>
    </div>
  );
}

/**
 * Render the transform step config form. O(1).
 */
function TransformConfig(props: { step: PipelineStep; onChange: (s: PipelineStep) => void }): VNode {
  const { step, onChange } = props;
  const field = (step.config.field as string) ?? '';
  const expression = (step.config.expression as string) ?? '';

  return (
    <div style="display:flex;flex-direction:column;gap:8px">
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Field</div>
        <input
          class="wl-input"
          value={field}
          placeholder="Target field name"
          onInput={(e) => updateConfig(step, 'field', (e.currentTarget as HTMLInputElement).value, onChange)}
        />
      </div>
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Expression</div>
        <input
          class="wl-input"
          value={expression}
          placeholder="e.g. {FirstName} {LastName}"
          onInput={(e) => updateConfig(step, 'expression', (e.currentTarget as HTMLInputElement).value, onChange)}
        />
        <div class="wl-muted" style="margin-top:4px;font-size:11px">
          Use &#123;fieldName&#125; tokens to reference record values.
        </div>
      </div>
    </div>
  );
}

/**
 * Render the lookup step config form. O(1).
 */
function LookupConfig(props: { step: PipelineStep; onChange: (s: PipelineStep) => void }): VNode {
  const { step, onChange } = props;
  const lookupField = (step.config.lookupField as string) ?? '';
  const lookupKey = (step.config.lookupKey as string) ?? '';
  const outputField = (step.config.outputField as string) ?? '';
  const lookupTableJson = (step.config._lookupTableJson as string) ?? '[]';

  return (
    <div style="display:flex;flex-direction:column;gap:8px">
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Lookup Field (record)</div>
        <input
          class="wl-input"
          value={lookupField}
          placeholder="Field in current records"
          onInput={(e) => updateConfig(step, 'lookupField', (e.currentTarget as HTMLInputElement).value, onChange)}
        />
      </div>
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Lookup Key (table)</div>
        <input
          class="wl-input"
          value={lookupKey}
          placeholder="Key field in lookup table"
          onInput={(e) => updateConfig(step, 'lookupKey', (e.currentTarget as HTMLInputElement).value, onChange)}
        />
      </div>
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Output Field</div>
        <input
          class="wl-input"
          value={outputField}
          placeholder="Field to write result to"
          onInput={(e) => updateConfig(step, 'outputField', (e.currentTarget as HTMLInputElement).value, onChange)}
        />
      </div>
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Lookup Table (JSON array)</div>
        <textarea
          class="wl-textarea"
          value={lookupTableJson}
          onInput={(e) => {
            const raw = (e.currentTarget as HTMLTextAreaElement).value;
            updateConfig(step, '_lookupTableJson', raw, onChange);
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                updateConfig(step, 'lookupTable', parsed, onChange);
              }
            } catch {
              // Keep raw text, don't update parsed table
            }
          }}
          style="min-height:80px"
        />
      </div>
    </div>
  );
}

/**
 * Render the aggregate step config form. O(A) where A = aggregation rows.
 */
function AggregateConfig(props: { step: PipelineStep; onChange: (s: PipelineStep) => void }): VNode {
  const { step, onChange } = props;
  const groupByRaw = (step.config.groupBy as string[]) ?? [];
  const [groupByInput, setGroupByInput] = useState(groupByRaw.join(', '));
  const aggregations = (step.config.aggregations as Array<{ field: string; fn: string; outputField: string }>) ?? [];

  /** Update groupBy from comma-separated input. O(G). */
  function handleGroupByChange(value: string): void {
    setGroupByInput(value);
    const fields = value.split(',').map((s) => s.trim()).filter(Boolean);
    updateConfig(step, 'groupBy', fields, onChange);
  }

  /** Update a single aggregation row. O(A). */
  function updateAgg(index: number, patch: Partial<{ field: string; fn: string; outputField: string }>): void {
    const next = aggregations.map((a, i) => (i === index ? { ...a, ...patch } : a));
    updateConfig(step, 'aggregations', next, onChange);
  }

  /** Add a new aggregation row. O(1). */
  function addAgg(): void {
    updateConfig(step, 'aggregations', [...aggregations, { field: '', fn: 'count', outputField: '' }], onChange);
  }

  /** Remove an aggregation row. O(A). */
  function removeAgg(index: number): void {
    updateConfig(step, 'aggregations', aggregations.filter((_, i) => i !== index), onChange);
  }

  return (
    <div style="display:flex;flex-direction:column;gap:8px">
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Group By (comma-separated)</div>
        <input
          class="wl-input"
          value={groupByInput}
          placeholder="e.g. Department, Region"
          onInput={(e) => handleGroupByChange((e.currentTarget as HTMLInputElement).value)}
        />
      </div>

      <div>
        <div class="wl-muted" style="margin-bottom:4px">Aggregations</div>
        {aggregations.map((agg, i) => (
          <div key={i} style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:6px;align-items:center;margin-bottom:6px">
            <input
              class="wl-input"
              value={agg.field}
              placeholder="Field"
              onInput={(e) => updateAgg(i, { field: (e.currentTarget as HTMLInputElement).value })}
            />
            <select
              class="wl-select"
              value={agg.fn}
              onChange={(e) => updateAgg(i, { fn: (e.currentTarget as HTMLSelectElement).value })}
              style="width:90px"
            >
              <option value="count">count</option>
              <option value="sum">sum</option>
              <option value="avg">avg</option>
              <option value="min">min</option>
              <option value="max">max</option>
            </select>
            <input
              class="wl-input"
              value={agg.outputField}
              placeholder="Output field"
              onInput={(e) => updateAgg(i, { outputField: (e.currentTarget as HTMLInputElement).value })}
            />
            <button class="wl-btn wl-btnDanger" style="padding:4px 8px" onClick={() => removeAgg(i)}>
              X
            </button>
          </div>
        ))}
        <button class="wl-btn" style="align-self:flex-start;font-size:11px" onClick={addAgg}>
          + Add Aggregation
        </button>
      </div>
    </div>
  );
}

/**
 * Render the join step config form. O(1).
 */
function JoinConfig(props: { step: PipelineStep; onChange: (s: PipelineStep) => void }): VNode {
  const { step, onChange } = props;
  const joinField = (step.config.joinField as string) ?? '';
  const rightJoinField = (step.config.rightJoinField as string) ?? '';
  const joinType = (step.config.joinType as string) ?? 'inner';
  const rightRecordsJson = (step.config._rightRecordsJson as string) ?? '[]';

  return (
    <div style="display:flex;flex-direction:column;gap:8px">
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Left Join Field</div>
        <input
          class="wl-input"
          value={joinField}
          placeholder="Field in current records"
          onInput={(e) => updateConfig(step, 'joinField', (e.currentTarget as HTMLInputElement).value, onChange)}
        />
      </div>
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Right Join Field</div>
        <input
          class="wl-input"
          value={rightJoinField}
          placeholder="Field in right records"
          onInput={(e) => updateConfig(step, 'rightJoinField', (e.currentTarget as HTMLInputElement).value, onChange)}
        />
      </div>
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Join Type</div>
        <select
          class="wl-select"
          value={joinType}
          onChange={(e) => updateConfig(step, 'joinType', (e.currentTarget as HTMLSelectElement).value, onChange)}
        >
          <option value="inner">Inner Join</option>
          <option value="left">Left Join</option>
        </select>
      </div>
      <div>
        <div class="wl-muted" style="margin-bottom:4px">Right Records (JSON array)</div>
        <textarea
          class="wl-textarea"
          value={rightRecordsJson}
          onInput={(e) => {
            const raw = (e.currentTarget as HTMLTextAreaElement).value;
            updateConfig(step, '_rightRecordsJson', raw, onChange);
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                updateConfig(step, 'rightRecords', parsed, onChange);
              }
            } catch {
              // Keep raw text, don't update parsed records
            }
          }}
          style="min-height:80px"
        />
      </div>
    </div>
  );
}

/**
 * StepConfigPanel renders the configuration form for a pipeline step based on its type.
 * O(1) for most types; O(A) for aggregate where A = aggregation row count.
 */
export function StepConfigPanel(props: StepConfigPanelProps): VNode {
  const { step, onChange, onRemove } = props;

  /** Update the step label. O(1). */
  function handleLabelChange(label: string): void {
    onChange({ ...step, label });
  }

  return (
    <div class="wl-configPanel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-weight:900;font-size:13px">
          Configure: {step.type}
        </div>
        <button class="wl-btn wl-btnDanger" style="font-size:11px" onClick={onRemove}>
          Remove Step
        </button>
      </div>

      <div style="margin-bottom:12px">
        <div class="wl-muted" style="margin-bottom:4px">Label</div>
        <input
          class="wl-input"
          value={step.label}
          placeholder="Step label"
          onInput={(e) => handleLabelChange((e.currentTarget as HTMLInputElement).value)}
        />
      </div>

      {step.type === 'filter' && <FilterConfig step={step} onChange={onChange} />}
      {step.type === 'transform' && <TransformConfig step={step} onChange={onChange} />}
      {step.type === 'lookup' && <LookupConfig step={step} onChange={onChange} />}
      {step.type === 'aggregate' && <AggregateConfig step={step} onChange={onChange} />}
      {step.type === 'join' && <JoinConfig step={step} onChange={onChange} />}
    </div>
  );
}
