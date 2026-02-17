/**
 * Quality rule editor component.
 *
 * What this file does:
 * - Renders a list of editable QualityRule items with field, type, severity, and config inputs.
 * - Supports adding new rules and deleting existing ones.
 * - Shows type-specific configuration inputs (pattern, min/max, picklist values, expression).
 *
 * Complexity: O(R * F) where R = rules.length, F = fields.length for dropdown rendering.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { QualityRule } from '../../core/types/storage';

export interface QualityRuleEditorProps {
  rules: QualityRule[];
  fields: string[];
  onChange: (rules: QualityRule[]) => void;
}

const RULE_TYPES: Array<{ value: QualityRule['type']; label: string }> = [
  { value: 'required', label: 'Required' },
  { value: 'format', label: 'Format (Regex)' },
  { value: 'range', label: 'Range (Min/Max)' },
  { value: 'picklist', label: 'Picklist' },
  { value: 'unique', label: 'Unique' },
  { value: 'custom', label: 'Custom Expression' },
];

const SEVERITIES: Array<{ value: QualityRule['severity']; label: string }> = [
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyRule(fields: string[]): QualityRule {
  return {
    id: generateRuleId(),
    field: fields[0] ?? '',
    type: 'required',
    config: {},
    severity: 'error',
    message: '',
  };
}

export function QualityRuleEditor(props: QualityRuleEditorProps): VNode {
  const { rules, fields, onChange } = props;

  function updateRule(index: number, patch: Partial<QualityRule>): void {
    const updated = rules.map((r, i) => {
      if (i !== index) return r;
      const next = { ...r, ...patch };
      // Reset config when type changes
      if (patch.type !== undefined && patch.type !== r.type) {
        next.config = {};
      }
      return next;
    });
    onChange(updated);
  }

  function deleteRule(index: number): void {
    onChange(rules.filter((_, i) => i !== index));
  }

  function addRule(): void {
    onChange([...rules, createEmptyRule(fields)]);
  }

  function updateConfig(index: number, key: string, value: unknown): void {
    const rule = rules[index];
    const nextConfig = { ...rule.config, [key]: value };
    updateRule(index, { config: nextConfig });
  }

  function renderTypeConfig(rule: QualityRule, index: number): VNode | null {
    switch (rule.type) {
      case 'format':
        return (
          <div style="display:flex;flex-direction:column;gap:6px">
            <label style="font-size:12px;font-weight:700">Regex Pattern</label>
            <input
              class="wl-input"
              type="text"
              value={(rule.config.pattern as string) ?? ''}
              onInput={(e) => updateConfig(index, 'pattern', (e.currentTarget as HTMLInputElement).value)}
              placeholder="e.g. ^[A-Z].*$"
              style="font-family:var(--wl-font-mono);font-size:12px"
            />
          </div>
        );

      case 'range':
        return (
          <div style="display:flex;gap:8px;align-items:flex-end">
            <div style="flex:1;display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;font-weight:700">Min</label>
              <input
                class="wl-input"
                type="number"
                value={(rule.config.min as number) ?? ''}
                onInput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value;
                  updateConfig(index, 'min', v === '' ? undefined : Number(v));
                }}
                placeholder="No min"
              />
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:4px">
              <label style="font-size:12px;font-weight:700">Max</label>
              <input
                class="wl-input"
                type="number"
                value={(rule.config.max as number) ?? ''}
                onInput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value;
                  updateConfig(index, 'max', v === '' ? undefined : Number(v));
                }}
                placeholder="No max"
              />
            </div>
          </div>
        );

      case 'picklist':
        return (
          <div style="display:flex;flex-direction:column;gap:6px">
            <label style="font-size:12px;font-weight:700">Allowed Values (comma-separated)</label>
            <input
              class="wl-input"
              type="text"
              value={((rule.config.values as string[]) ?? []).join(', ')}
              onInput={(e) => {
                const raw = (e.currentTarget as HTMLInputElement).value;
                const values = raw.split(',').map((v) => v.trim()).filter((v) => v !== '');
                updateConfig(index, 'values', values);
              }}
              placeholder="Value1, Value2, Value3"
            />
          </div>
        );

      case 'custom':
        return (
          <div style="display:flex;flex-direction:column;gap:6px">
            <label style="font-size:12px;font-weight:700">Expression</label>
            <input
              class="wl-input"
              type="text"
              value={(rule.config.expression as string) ?? ''}
              onInput={(e) => updateConfig(index, 'expression', (e.currentTarget as HTMLInputElement).value)}
              placeholder="e.g. {FieldName} !== '' || {OtherField} > 0"
              style="font-family:var(--wl-font-mono);font-size:12px"
            />
            <div class="wl-muted" style="font-size:11px">
              Use &#123;FieldName&#125; tokens to reference record fields.
            </div>
          </div>
        );

      case 'required':
      case 'unique':
      default:
        return null;
    }
  }

  return (
    <div class="wl-card" style="display:flex;flex-direction:column;gap:12px">
      <div class="wl-cardHeader">
        <h2>Quality Rules</h2>
        <span class="wl-muted">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
      </div>

      {rules.length === 0 ? (
        <div class="wl-row">
          <div class="wl-muted">No rules defined. Click "Add Rule" to get started.</div>
        </div>
      ) : null}

      {rules.map((rule, index) => (
        <div
          key={rule.id}
          class="wl-card"
          style="padding:12px;display:flex;flex-direction:column;gap:10px;border:1px solid var(--wl-line-2);border-radius:8px"
        >
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <div style="flex:1;min-width:140px;display:flex;flex-direction:column;gap:4px">
              <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">Field</label>
              <select
                class="wl-select"
                value={rule.field}
                onChange={(e) => updateRule(index, { field: (e.currentTarget as HTMLSelectElement).value })}
              >
                {rule.field && !fields.includes(rule.field) ? (
                  <option value={rule.field}>{rule.field}</option>
                ) : null}
                {fields.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div style="flex:1;min-width:120px;display:flex;flex-direction:column;gap:4px">
              <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">Type</label>
              <select
                class="wl-select"
                value={rule.type}
                onChange={(e) => updateRule(index, { type: (e.currentTarget as HTMLSelectElement).value as QualityRule['type'] })}
              >
                {RULE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div style="flex:0 0 100px;display:flex;flex-direction:column;gap:4px">
              <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">Severity</label>
              <select
                class="wl-select"
                value={rule.severity}
                onChange={(e) => updateRule(index, { severity: (e.currentTarget as HTMLSelectElement).value as QualityRule['severity'] })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <button
              class="wl-btn"
              onClick={() => deleteRule(index)}
              title="Delete rule"
              style="align-self:flex-end;color:var(--wl-danger)"
            >
              Delete
            </button>
          </div>

          <div style="display:flex;flex-direction:column;gap:4px">
            <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">Message</label>
            <input
              class="wl-input"
              type="text"
              value={rule.message}
              onInput={(e) => updateRule(index, { message: (e.currentTarget as HTMLInputElement).value })}
              placeholder="Validation message shown on failure"
            />
          </div>

          {renderTypeConfig(rule, index)}
        </div>
      ))}

      <div style="display:flex;justify-content:flex-start">
        <button class="wl-btn" onClick={addRule}>
          Add Rule
        </button>
      </div>
    </div>
  );
}
