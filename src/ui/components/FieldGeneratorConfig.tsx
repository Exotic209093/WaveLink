/**
 * Per-field configuration row for the test data generator.
 *
 * Renders a single field's generation settings: mode selector, nullable toggle,
 * null rate slider, and mode-specific inputs (static value or formula template).
 *
 * Complexity: O(P) where P is the number of picklist values for the field.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { GeneratorConfig } from '../utils/testDataGenerator';

export interface FieldGeneratorConfigProps {
  config: GeneratorConfig;
  onChange: (config: GeneratorConfig) => void;
}

/** Render a single field config row. O(P) for picklist display. */
export function FieldGeneratorConfig(props: FieldGeneratorConfigProps): VNode {
  const { config, onChange } = props;

  /** Update a single property on the config. O(1). */
  function patch(partial: Partial<GeneratorConfig>): void {
    onChange({ ...config, ...partial });
  }

  return (
    <div class="wl-fieldConfigRow">
      <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
        <span class="wl-mono" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title={config.fieldName}>
          {config.fieldName}
        </span>
        <span class="wl-badge" style="width:fit-content;font-size:10px">{config.fieldType}</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:4px">
        <select
          class="wl-select"
          style="font-size:12px;padding:6px 8px"
          value={config.override ?? 'auto'}
          onChange={(e) => patch({ override: (e.currentTarget as HTMLSelectElement).value as GeneratorConfig['override'] })}
        >
          <option value="auto">Auto</option>
          <option value="static">Static</option>
          <option value="formula">Formula</option>
        </select>

        {config.override === 'static' ? (
          <input
            class="wl-input"
            style="font-size:12px;padding:6px 8px"
            type="text"
            placeholder="Static value"
            value={config.staticValue ?? ''}
            onInput={(e) => patch({ staticValue: (e.currentTarget as HTMLInputElement).value })}
          />
        ) : null}

        {config.override === 'formula' ? (
          <div style="display:flex;flex-direction:column;gap:2px">
            <input
              class="wl-input"
              style="font-size:12px;padding:6px 8px"
              type="text"
              placeholder="e.g. ACC-{rowIndex}"
              value={config.formulaTemplate ?? ''}
              onInput={(e) => patch({ formulaTemplate: (e.currentTarget as HTMLInputElement).value })}
            />
            <span class="wl-muted" style="font-size:10px">
              Use &#123;rowIndex&#125; for row number interpolation
            </span>
          </div>
        ) : null}

        {config.picklistValues && config.picklistValues.length > 0 ? (
          <div class="wl-muted" style="font-size:10px">
            Picklist: {config.picklistValues.slice(0, 5).join(', ')}
            {config.picklistValues.length > 5 ? ` (+${config.picklistValues.length - 5} more)` : ''}
          </div>
        ) : null}
      </div>

      <div style="display:flex;flex-direction:column;gap:4px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px">
          <input
            type="checkbox"
            checked={config.nullable ?? false}
            onChange={(e) => patch({ nullable: (e.currentTarget as HTMLInputElement).checked })}
          />
          <span>Nullable</span>
        </label>

        {config.nullable ? (
          <div style="display:flex;align-items:center;gap:6px">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round((config.nullRate ?? 0) * 100)}
              onInput={(e) => patch({ nullRate: Number((e.currentTarget as HTMLInputElement).value) / 100 })}
              style="width:80px"
            />
            <span class="wl-muted" style="font-size:11px;white-space:nowrap">
              {Math.round((config.nullRate ?? 0) * 100)}%
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
