/**
 * Table view for data comparison results with filter tabs, color-coded rows,
 * changed cell highlights, and checkbox selection for selective sync.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { DataDiffResult, RecordDiff, RecordDiffStatus } from '../utils/dataDiff';

type FilterTab = 'all' | 'added' | 'removed' | 'changed';

export function DataDiffView(props: {
  diff: DataDiffResult;
  selectedKeys: Set<string>;
  onToggleKey: (key: string) => void;
  onSelectAll: (keys: string[]) => void;
  onDeselectAll: () => void;
}): VNode {
  const { diff, selectedKeys, onToggleKey, onSelectAll, onDeselectAll } = props;
  const [filter, setFilter] = useState<FilterTab>('all');
  const [page, setPage] = useState(0);
  const pageSize = 100;

  function getFiltered(): RecordDiff[] {
    switch (filter) {
      case 'added': return diff.added;
      case 'removed': return diff.removed;
      case 'changed': return diff.changed;
      default: return [...diff.added, ...diff.removed, ...diff.changed, ...diff.unchanged];
    }
  }

  const filtered = getFiltered();
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const selectableKeys = [...diff.added, ...diff.changed].map(d => d.keyValue);

  const rowClass = (status: RecordDiffStatus): string => {
    switch (status) {
      case 'added': return 'wl-diffAdded';
      case 'removed': return 'wl-diffRemoved';
      case 'changed': return 'wl-diffChanged';
      default: return '';
    }
  };

  return (
    <div>
      <div class="wl-row" style="gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
        <div class="wl-chipRow">
          {(['all', 'added', 'removed', 'changed'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              class="wl-chip"
              data-active={filter === tab}
              onClick={() => { setFilter(tab); setPage(0); }}
              style={filter === tab ? 'background:var(--wl-accent);color:white' : ''}
            >
              {tab === 'all'
                ? `All (${diff.summary.total})`
                : tab === 'added'
                  ? `Added (${diff.summary.added})`
                  : tab === 'removed'
                    ? `Removed (${diff.summary.removed})`
                    : `Changed (${diff.summary.changed})`
              }
            </button>
          ))}
        </div>
        <div style="flex:1" />
        <span class="wl-muted" style="font-size:12px">{selectedKeys.size} selected</span>
        <button class="wl-btn" style="font-size:11px" onClick={() => onSelectAll(selectableKeys)}>Select All Syncable</button>
        <button class="wl-btn" style="font-size:11px" onClick={onDeselectAll}>Deselect All</button>
      </div>

      <div class="wl-tableWrap">
        <table class="wl-table">
          <thead>
            <tr>
              <th style="width:32px" />
              <th>Status</th>
              <th>{diff.matchField}</th>
              {diff.fields.map(f => (
                <th key={f}>{f}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(row => {
              const canSelect = row.status === 'added' || row.status === 'changed';
              return (
                <tr key={row.keyValue} class={rowClass(row.status)}>
                  <td>
                    {canSelect ? (
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(row.keyValue)}
                        onChange={() => onToggleKey(row.keyValue)}
                      />
                    ) : null}
                  </td>
                  <td>
                    <span class="wl-chip" style={`font-size:10px;${
                      row.status === 'added' ? 'background:var(--wl-success-bg);color:var(--wl-success)'
                        : row.status === 'removed' ? 'background:var(--wl-danger-bg);color:var(--wl-danger)'
                          : row.status === 'changed' ? 'background:var(--wl-accent-bg);color:var(--wl-accent)'
                            : ''
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td class="wl-mono" style="font-size:12px">{row.keyValue}</td>
                  {diff.fields.map(f => {
                    const isChanged = row.changedFields.includes(f);
                    const val = row.sourceRecord?.[f] ?? row.targetRecord?.[f] ?? '';
                    return (
                      <td key={f} class={isChanged ? 'wl-diffCellChanged' : ''} style="font-size:12px">
                        {isChanged && row.fieldDiffs[f] ? (
                          <span>
                            <span style="text-decoration:line-through;opacity:0.5">{String(row.fieldDiffs[f].target ?? '')}</span>
                            {' \u2192 '}
                            <span style="font-weight:600">{String(row.fieldDiffs[f].source ?? '')}</span>
                          </span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div class="wl-row" style="justify-content:center;gap:8px;margin-top:8px">
          <button class="wl-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span class="wl-muted" style="font-size:12px">Page {page + 1} of {totalPages}</span>
          <button class="wl-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}
