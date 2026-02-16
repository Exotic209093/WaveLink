/**
 * Small preview table for cleanser output.
 *
 * Complexity: O(R*C) where R is rendered rows (capped) and C is headers length (capped).
 */

import type { VNode } from 'preact';
import { h } from 'preact';

export function PreviewGrid(props: {
  headers: string[];
  rows: Array<Record<string, unknown>>;
  note?: string;
}): VNode {
  const { headers, rows, note } = props;

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Preview (first 100 rows)</h2>
        <div class="wl-muted">{note ?? 'Preview reflects staged changes; Apply computes full cleaned dataset.'}</div>
      </div>
      <div class="wl-tableWrap">
        <table class="wl-table">
          <thead>
            <tr>
              {headers.map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {headers.map(h => {
                  const v = r[h];
                  const s = v === null || v === undefined ? '' : String(v);
                  return <td key={h} title={s}>{s}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
