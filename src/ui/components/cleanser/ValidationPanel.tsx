import type { VNode } from 'preact';
import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { downloadTextFile } from '../../utils/download';

export interface ValidationErrorRow {
  field: string;
  message: string;
  value?: unknown;
}

function toCsv(rows: ValidationErrorRow[]): string {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = ['field', 'message', 'value'].join(',');
  const lines = rows.map(r => [escape(r.field), escape(r.message), escape(r.value)].join(','));
  return [header, ...lines].join('\n');
}

export function ValidationPanel(props: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  objects: Array<{ name: string; label: string }>;
  objectName: string;
  onObjectName: (v: string) => void;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  onOperation: (v: 'insert' | 'update' | 'upsert' | 'delete') => void;
  errors: ValidationErrorRow[] | null;
  onRun: () => void;
  canRun: boolean;
  showOnlyErrorFields: boolean;
  onShowOnlyErrorFields: (v: boolean) => void;
}): VNode {
  const {
    enabled,
    onEnabledChange,
    objects,
    objectName,
    onObjectName,
    operation,
    onOperation,
    errors,
    onRun,
    canRun,
    showOnlyErrorFields,
    onShowOnlyErrorFields,
  } = props;

  const [open, setOpen] = useState(true);
  const [objectSearch, setObjectSearch] = useState('');

  const grouped = useMemo(() => {
    if (!errors) return null;
    const byField = new Map<string, ValidationErrorRow[]>();
    for (const e of errors) {
      const list = byField.get(e.field) ?? [];
      list.push(e);
      byField.set(e.field, list);
    }
    return Array.from(byField.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [errors]);

  const filteredObjects = useMemo(() => {
    const q = objectSearch.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter(o => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  }, [objects, objectSearch]);

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Validation</h2>
        <div class="wl-actions">
          <label class="wl-chip" style="cursor:pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange((e.currentTarget as HTMLInputElement).checked)} />
            <span>Enable</span>
          </label>
          <button class="wl-btn" onClick={() => setOpen(v => !v)}>{open ? 'Collapse' : 'Expand'}</button>
        </div>
      </div>

      {open ? (
        <div class="wl-row">
          {enabled ? (
            <>
              <div class="wl-row2">
                <div>
                  <div class="wl-muted" style="margin-bottom:6px">SObject</div>
                  <input class="wl-input" placeholder="Search objects..." value={objectSearch} onInput={(e) => setObjectSearch((e.currentTarget as HTMLInputElement).value)} />
                </div>
                <div>
                  <div class="wl-muted" style="margin-bottom:6px">Operation</div>
                  <select class="wl-select" value={operation} onChange={(e) => onOperation((e.currentTarget as HTMLSelectElement).value as never)}>
                    <option value="insert">insert</option>
                    <option value="update">update</option>
                    <option value="upsert">upsert</option>
                    <option value="delete">delete</option>
                  </select>
                </div>
              </div>

              <select class="wl-select" value={objectName} onChange={(e) => onObjectName((e.currentTarget as HTMLSelectElement).value)}>
                {filteredObjects.slice(0, 2000).map(o => (
                  <option key={o.name} value={o.name}>{o.label} ({o.name})</option>
                ))}
              </select>

              <div class="wl-actions" style="align-items:center">
                <button class="wl-btn wl-btnPrimary" onClick={onRun} disabled={!canRun}>Run Validation</button>
                <label class="wl-chip" style="cursor:pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyErrorFields}
                    onChange={(e) => onShowOnlyErrorFields((e.currentTarget as HTMLInputElement).checked)}
                    disabled={!errors || errors.length === 0}
                  />
                  <span>Show only error fields</span>
                </label>
                {errors && errors.length ? (
                  <>
                    <button
                      class="wl-btn"
                      onClick={() => downloadTextFile(`wavelink-validation-${Date.now()}.json`, JSON.stringify(errors, null, 2), 'application/json')}
                    >
                      Export JSON
                    </button>
                    <button
                      class="wl-btn"
                      onClick={() => downloadTextFile(`wavelink-validation-${Date.now()}.csv`, toCsv(errors), 'text/csv')}
                    >
                      Export CSV
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div class="wl-muted">Enable validation to check cleaned data against an SObject schema.</div>
          )}

          {enabled && grouped ? (
            <div class="wl-card" style="border-radius:12px">
              <div class="wl-cardHeader">
                <h2>Results</h2>
                <div class="wl-muted">{errors?.length ?? 0} errors</div>
              </div>
              {errors && errors.length > 0 ? (
                <div class="wl-tableWrap" style="max-height:320px">
                  <table class="wl-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Count</th>
                        <th>Example</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped.slice(0, 200).map(([field, rows]) => (
                        <tr key={field}>
                          <td class="wl-mono">{field}</td>
                          <td>{rows.length}</td>
                          <td title={rows[0]?.message ?? ''}>{rows[0]?.message ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div class="wl-row"><div class="wl-muted">No errors.</div></div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

