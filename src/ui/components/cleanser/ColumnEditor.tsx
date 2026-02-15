import type { VNode } from 'preact';
import { h } from 'preact';
import type { ColumnOp } from '../../utils/cleanse';
import { applyTransform } from '../../utils/cleanse';
import type { TransformationType } from '../../../core/types/storage';
import { TRANSFORM_OPTIONS } from '../../utils/transforms';

export function ColumnEditor(props: {
  op: ColumnOp;
  sampleValues: string[];
  onChange: (patch: Partial<ColumnOp>) => void;
  onReset: () => void;
}): VNode {
  const { op, sampleValues, onChange, onReset } = props;
  const target = (op.renameTo || op.source).trim() || op.source;

  const rows = sampleValues.slice(0, 10).map((v, idx) => {
    const after = applyTransform(v, op.transform);
    return (
      <tr key={idx}>
        <td class="wl-mono">{v}</td>
        <td class="wl-mono">{after === null || after === undefined ? '' : String(after)}</td>
      </tr>
    );
  });

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <div style="display:flex;align-items:baseline;gap:10px;min-width:0">
          <h2 style="margin:0">Column</h2>
          <span class="wl-muted" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            <span class="wl-mono">{op.source}</span>
          </span>
        </div>
        <div class="wl-actions">
          <button class="wl-btn wl-btnDanger" onClick={onReset}>Reset</button>
        </div>
      </div>

      <div class="wl-row">
        <div class="wl-row2">
          <label>
            <div class="wl-muted" style="margin-bottom:6px">Rename to</div>
            <input
              class="wl-input wl-mono"
              value={target}
              onInput={(e) => onChange({ renameTo: (e.currentTarget as HTMLInputElement).value })}
            />
          </label>
          <label>
            <div class="wl-muted" style="margin-bottom:6px">Transform</div>
            <select
              class="wl-select"
              value={op.transform}
              onChange={(e) => onChange({ transform: (e.currentTarget as HTMLSelectElement).value as TransformationType })}
            >
              {TRANSFORM_OPTIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
        </div>

        <label class="wl-chip" style="width:fit-content;cursor:pointer">
          <input type="checkbox" checked={op.drop} onChange={(e) => onChange({ drop: (e.currentTarget as HTMLInputElement).checked })} />
          <span>Drop column</span>
        </label>

        <div class="wl-card" style="border-radius:12px">
          <div class="wl-cardHeader">
            <h2>Sample Values (before / after)</h2>
          </div>
          <div class="wl-tableWrap" style="max-height:220px">
            <table class="wl-table wl-sampleTable">
              <thead>
                <tr>
                  <th>Original</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows : (
                  <tr><td colSpan={2} class="wl-muted">No sample values</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
