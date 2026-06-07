/**
 * Modal for bulk field updates using template interpolation or conditional rules.
 *
 * What this file does:
 * - Formula mode: uses {FieldName} template interpolation to compute new values.
 * - Conditional mode: uses IF/THEN/ELSE rules via ConditionalBuilder.
 * - Shows a preview table of the first 5 records before applying.
 *
 * Complexity:
 * - Preview computation is O(P*T) where P is preview size (capped at 5) and T is token count.
 * - Full apply is O(N*T) where N is total record count.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { interpolate, applyConditionalRule } from '../utils/formulas';
import type { ConditionalRule } from '../utils/formulas';
import { ConditionalBuilder } from './ConditionalBuilder';

export interface BulkUpdateModalProps {
  open: boolean;
  fields: string[];
  records: Record<string, unknown>[];
  onApply: (updated: Record<string, unknown>[]) => void;
  onClose: () => void;
}

type UpdateMode = 'formula' | 'conditional';

const PREVIEW_LIMIT = 5;

/**
 * Bulk update modal component.
 * O(N*T) apply where N is records and T is template token count.
 */
export function BulkUpdateModal(props: BulkUpdateModalProps): VNode | null {
  const { open, fields, records, onApply, onClose } = props;

  const [mode, setMode] = useState<UpdateMode>('formula');
  const [template, setTemplate] = useState('');
  const [targetField, setTargetField] = useState(fields[0] ?? '');
  const [rule, setRule] = useState<ConditionalRule | null>(null);

  if (!open) return null;

  /** Compute updated records based on current mode. O(N*T) for formula, O(N) for conditional. */
  const computeUpdated = (source: Record<string, unknown>[]): Record<string, unknown>[] => {
    if (mode === 'formula') {
      return source.map(rec => ({
        ...rec,
        [targetField]: interpolate(template, rec),
      }));
    }
    // conditional mode
    if (!rule) return source;
    return source.map(rec => applyConditionalRule(rec, targetField, rule));
  };

  /** Preview records (first 5). */
  const previewRecords = useMemo(
    () => computeUpdated(records.slice(0, PREVIEW_LIMIT)),
    [records, mode, template, targetField, rule],
  );

  const handleApply = (): void => {
    onApply(computeUpdated(records));
    onClose();
  };

  /** Columns to show in the preview table. */
  const previewColumns = useMemo(() => {
    const cols = new Set<string>();
    cols.add(targetField);
    // Include up to 3 additional fields for context
    for (const f of fields) {
      if (cols.size >= 4) break;
      cols.add(f);
    }
    return Array.from(cols);
  }, [fields, targetField]);

  return (
    <div class="wl-modalOverlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Bulk Update">
      <div class="wl-modal wl-card" onClick={(e) => e.stopPropagation()}>
        <div class="wl-cardHeader">
          <h2>Bulk Update</h2>
          <button class="wl-btn" onClick={onClose}>Close</button>
        </div>

        <div class="wl-row">
          {/* Target field selector */}
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">
              Target Field
            </label>
            <select
              class="wl-select"
              value={targetField}
              onChange={(e) => setTargetField((e.currentTarget as HTMLSelectElement).value)}
            >
              {fields.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Mode selector */}
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">
              Update Mode
            </label>
            <select
              class="wl-select"
              value={mode}
              onChange={(e) => setMode((e.currentTarget as HTMLSelectElement).value as UpdateMode)}
            >
              <option value="formula">Formula (template)</option>
              <option value="conditional">Conditional (IF/THEN/ELSE)</option>
            </select>
          </div>

          {/* Mode-specific controls */}
          {mode === 'formula' ? (
            <div>
              <label style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">
                Template
              </label>
              <input
                class="wl-input"
                type="text"
                placeholder="e.g. {FirstName} {LastName}"
                value={template}
                onInput={(e) => setTemplate((e.currentTarget as HTMLInputElement).value)}
                style="width:100%"
              />
              <div class="wl-muted" style="margin-top:4px;font-size:11px">
                Use &#123;FieldName&#125; to reference record values.
              </div>
            </div>
          ) : (
            <div>
              <label style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">
                Condition
              </label>
              <ConditionalBuilder
                fields={fields}
                rule={rule}
                onChange={setRule}
              />
            </div>
          )}

          {/* Preview table */}
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">
              Preview (first {Math.min(records.length, PREVIEW_LIMIT)} records)
            </label>
            <div class="wl-tableWrap" style="max-height:200px;overflow:auto">
              <table class="wl-table" style="font-size:11px">
                <thead>
                  <tr>
                    {previewColumns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRecords.map((rec, idx) => (
                    <tr key={idx}>
                      {previewColumns.map(col => (
                        <td key={col} title={String(rec[col] ?? '')}>
                          {rec[col] === null || rec[col] === undefined ? '' : String(rec[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--wl-line-2)">
            <button class="wl-btn" onClick={onClose}>Cancel</button>
            <button
              class="wl-buttonBrand"
              onClick={handleApply}
              disabled={mode === 'formula' && !template.trim()}
            >
              Apply to {records.length} records
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
