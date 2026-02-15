import type { VNode } from 'preact';
import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { FlatRecord } from '../utils/records';

function looksLikeSfId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9]{15,18}$/.test(value);
}

export function ResultsGrid(props: {
  instanceUrl?: string;
  records: FlatRecord[];
  columns: string[];
  selectedColumns: string[];
  onSelectedColumnsChange: (cols: string[]) => void;
}): VNode {
  const { instanceUrl, records, columns, selectedColumns, onSelectedColumnsChange } = props;
  const [showCols, setShowCols] = useState(false);

  const visibleCols = useMemo(() => {
    const set = new Set(selectedColumns);
    return columns.filter(c => set.has(c));
  }, [columns, selectedColumns]);

  function toggleCol(col: string): void {
    const set = new Set(selectedColumns);
    if (set.has(col)) set.delete(col);
    else set.add(col);
    onSelectedColumnsChange(Array.from(set));
  }

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Results</h2>
        <div class="wl-actions">
          <button class="wl-btn" onClick={() => setShowCols(v => !v)}>
            Columns ({selectedColumns.length}/{columns.length})
          </button>
        </div>
      </div>

      {showCols ? (
        <div class="wl-row" style="border-bottom:1px solid var(--wl-line-2)">
          <div class="wl-muted">Toggle visible columns:</div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:180px;overflow:auto">
            {columns.map(col => (
              <label class="wl-chip" style="cursor:pointer;justify-content:space-between" key={col}>
                <span class="wl-mono" style="font-size:11px">{col}</span>
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(col)}
                  onChange={() => toggleCol(col)}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div class="wl-tableWrap">
        <table class="wl-table">
          <thead>
            <tr>
              {visibleCols.map(c => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => (
              <tr key={idx}>
                {visibleCols.map(c => {
                  const v = r[c];
                  const display = v === null ? '' : String(v ?? '');
                  const isId = c === 'Id' && looksLikeSfId(v) && instanceUrl;
                  return (
                    <td key={c} title={display}>
                      {isId ? (
                        <a class="wl-link" href={`${instanceUrl}/${v}`} target="_blank" rel="noreferrer">
                          {display}
                        </a>
                      ) : display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

