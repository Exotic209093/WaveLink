/**
 * Virtualized results table for displaying query results / record lists.
 *
 * What this file does:
 * - Derives columns from provided rows.
 * - Renders a virtual-scrolling table for smooth 10,000+ row performance.
 * - Column sorting: click header to cycle asc/desc/none.
 * - Column filtering: small input below each header for as-you-type filtering.
 * - Frozen "Id" column (position: sticky) when present.
 *
 * Complexity:
 * - Sorting: O(R log R) on sort change.
 * - Filtering: O(R * C_filtered) on filter change.
 * - Rendering: O(visible) rows, constant regardless of total rows.
 */

import type { VNode } from 'preact';
import { h, Fragment } from 'preact';
import { Icon } from './Icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { FlatRecord } from '../utils/records';

const ROW_HEIGHT = 32;
const BUFFER_ROWS = 5;

function looksLikeSfId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9]{15,18}$/.test(value);
}

type SortDir = 'asc' | 'desc' | null;

export function ResultsGrid(props: {
  instanceUrl?: string;
  records: FlatRecord[];
  columns: string[];
  selectedColumns: string[];
  onSelectedColumnsChange: (cols: string[]) => void;
  sf?: { updateRecord: (objectName: string, recordId: string, data: Record<string, unknown>) => Promise<void> };
  objectName?: string;
  /** Open the Record Inspector for an ID-looking cell value. */
  onInspectId?: (id: string) => void;
}): VNode {
  const { instanceUrl, records, columns, selectedColumns, onSelectedColumnsChange, sf, objectName, onInspectId } = props;
  const [showCols, setShowCols] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Inline edit state
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  // Sort state
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Filter state
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  function showCopyFeedback(msg: string): void {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 1500);
  }

  async function copyCell(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      showCopyFeedback('Cell copied');
    } catch {
      showCopyFeedback('Copy failed — clipboard unavailable');
    }
  }

  async function copyRow(record: FlatRecord): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
      showCopyFeedback('Row copied as JSON');
    } catch {
      showCopyFeedback('Copy failed — clipboard unavailable');
    }
  }

  async function copyColumn(col: string): Promise<void> {
    const values = sortedRecords.map(r => String(r[col] ?? '')).join('\n');
    try {
      await navigator.clipboard.writeText(values);
      showCopyFeedback(`Column "${col}" copied (${sortedRecords.length} values)`);
    } catch {
      showCopyFeedback('Copy failed — clipboard unavailable');
    }
  }

  function startEdit(rowIdx: number, col: string, currentValue: string): void {
    if (!sf || !objectName) return;
    setEditingCell({ row: rowIdx, col });
    setEditValue(currentValue);
  }

  async function commitEdit(recordId: string): Promise<void> {
    if (!editingCell || !sf || !objectName) return;
    setEditBusy(true);
    try {
      await sf.updateRecord(objectName, recordId, { [editingCell.col]: editValue || null });
      // Update local record
      const rec = sortedRecords[editingCell.row];
      if (rec) (rec as Record<string, unknown>)[editingCell.col] = editValue || null;
    } catch {
      // silently fail — value stays in edit mode
    } finally {
      setEditBusy(false);
      setEditingCell(null);
    }
  }

  function cancelEdit(): void {
    setEditingCell(null);
    setEditValue('');
  }

  // Virtual scroll state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);

  const visibleCols = useMemo(() => {
    const set = new Set(selectedColumns);
    return columns.filter(c => set.has(c));
  }, [columns, selectedColumns]);

  // Apply filters
  const filteredRecords = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, v]) => v.trim() !== '');
    if (activeFilters.length === 0) return records;
    return records.filter(r =>
      activeFilters.every(([col, query]) => {
        const val = r[col];
        const str = val === null || val === undefined ? '' : String(val);
        return str.toLowerCase().includes(query.toLowerCase());
      }),
    );
  }, [records, filters]);

  // Apply sorting
  const sortedRecords = useMemo(() => {
    if (!sortCol || !sortDir) return filteredRecords;
    const sorted = [...filteredRecords];
    sorted.sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const sa = String(va);
      const sb = String(vb);
      // Try numeric comparison
      const na = Number(sa);
      const nb = Number(sb);
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === 'asc' ? na - nb : nb - na;
      }
      const cmp = sa.localeCompare(sb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRecords, sortCol, sortDir]);

  function toggleCol(col: string): void {
    const set = new Set(selectedColumns);
    if (set.has(col)) set.delete(col);
    else set.add(col);
    onSelectedColumnsChange(Array.from(set));
  }

  function handleSort(col: string): void {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortCol(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function handleFilterChange(col: string, value: string): void {
    setFilters(prev => ({ ...prev, [col]: value }));
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  // Virtual scroll calculations
  const totalRows = sortedRecords.length;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIdx = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_ROWS);
  const visibleRows = sortedRecords.slice(startIdx, endIdx);

  const handleScroll = useCallback((e: Event) => {
    const target = e.currentTarget as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Measure viewport on mount and resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = (): void => setViewportHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const idColIdx = visibleCols.indexOf('Id');

  return (
    <div class="wl-card" style="position:relative">
      <div class="wl-cardHeader">
        <h2>Results</h2>
        <div class="wl-actions">
          <button class="wl-btn" onClick={() => setShowFilters(v => !v)}>
            {showFilters ? 'Hide Filters' : 'Filters'}
          </button>
          <button class="wl-btn" onClick={() => setShowCols(v => !v)}>
            Columns ({selectedColumns.length}/{columns.length})
          </button>
          <span class="wl-muted" style="font-size:12px">
            {totalRows === records.length
              ? `${records.length} rows`
              : `${totalRows} / ${records.length} rows`}
          </span>
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

      <div
        ref={scrollRef}
        class="wl-tableWrap"
        style="max-height:480px;overflow:auto"
        onScroll={handleScroll}
      >
        <table class="wl-table" style="table-layout:fixed">
          <thead>
            <tr>
              {visibleCols.map((c, ci) => (
                <th
                  key={c}
                  style={`cursor:pointer;user-select:none;min-width:100px;max-width:240px${
                    ci === idColIdx ? ';position:sticky;left:0;z-index:2;background:inherit' : ''
                  }`}
                  onClick={() => handleSort(c)}
                >
                  <span>{c}</span>
                  {sortCol === c ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
                  <button
                    class="wl-btn wl-grid-copyCol"
                    style="padding:0 3px;font-size:9px;margin-left:4px;opacity:0;vertical-align:middle"
                    onClick={(e) => { e.stopPropagation(); copyColumn(c); }}
                    title={`Copy all "${c}" values`}
                    aria-label={`Copy all "${c}" values`}
                  >{'\u2398'}</button>
                </th>
              ))}
              <th style="width:28px;border:none" />
            </tr>
            {showFilters ? (
              <tr>
                {visibleCols.map((c, ci) => (
                  <th
                    key={`filter-${c}`}
                    style={`padding:2px 4px${
                      ci === idColIdx ? ';position:sticky;left:0;z-index:2;background:inherit' : ''
                    }`}
                  >
                    <input
                      class="wl-input"
                      type="text"
                      style="font-size:11px;padding:2px 6px;width:100%"
                      placeholder="Filter..."
                      value={filters[c] ?? ''}
                      onInput={(e) => handleFilterChange(c, (e.currentTarget as HTMLInputElement).value)}
                    />
                  </th>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {/* Spacer row for virtual scroll offset */}
            {startIdx > 0 ? (
              <tr style={`height:${startIdx * ROW_HEIGHT}px`}>
                <td colSpan={visibleCols.length} />
              </tr>
            ) : null}
            {visibleRows.map((r, vi) => {
              const absIdx = startIdx + vi;
              const recordId = typeof r['Id'] === 'string' ? r['Id'] : null;
              return (
                <tr key={absIdx} style={`height:${ROW_HEIGHT}px`}>
                  {visibleCols.map((c, ci) => {
                    const v = r[c];
                    const display = v === null ? '' : String(v ?? '');
                    const isId = c === 'Id' && looksLikeSfId(v) && instanceUrl;
                    const isEditing = editingCell?.row === absIdx && editingCell?.col === c;
                    const canEdit = sf && objectName && recordId && c !== 'Id';

                    return (
                      <td
                        key={c}
                        title={display}
                        class="wl-grid-cell"
                        style={`max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap${
                          ci === idColIdx ? ';position:sticky;left:0;z-index:1;background:inherit' : ''
                        }`}
                        onDblClick={() => {
                          if (canEdit) startEdit(absIdx, c, display);
                          else copyCell(display);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          copyCell(display);
                        }}
                      >
                        {isEditing ? (
                          <input
                            class="wl-input"
                            style="font-size:12px;padding:1px 4px;width:100%"
                            value={editValue}
                            disabled={editBusy}
                            autoFocus
                            onInput={(e) => setEditValue((e.currentTarget as HTMLInputElement).value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && recordId) commitEdit(recordId);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            onBlur={cancelEdit}
                          />
                        ) : (
                          <Fragment>
                            {isId ? (
                              <a class="wl-link" href={`${instanceUrl}/${v}`} target="_blank" rel="noreferrer">
                                {display}
                              </a>
                            ) : display}
                            {onInspectId && looksLikeSfId(v) ? (
                              <button
                                class="wl-btn"
                                style="margin-left:6px;padding:0 5px;font-size:10px"
                                title="Inspect this record"
                                onClick={() => onInspectId(String(v))}
                              ><Icon name="search" size={13} /></button>
                            ) : null}
                          </Fragment>
                        )}
                      </td>
                    );
                  })}
                  <td style="padding:0;width:28px;border:none">
                    <button
                      class="wl-btn wl-grid-copyRow"
                      style="padding:0 4px;font-size:10px;opacity:0"
                      onClick={() => copyRow(r)}
                      title="Copy row as JSON"
                      aria-label="Copy row as JSON"
                    >{'\u2398'}</button>
                  </td>
                </tr>
              );
            })}
            {/* Spacer row for remaining virtual scroll space */}
            {endIdx < totalRows ? (
              <tr style={`height:${(totalRows - endIdx) * ROW_HEIGHT}px`}>
                <td colSpan={visibleCols.length} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {copyToast && (
        <div style="position:absolute;bottom:8px;right:8px;background:var(--wl-accent);color:white;padding:4px 12px;border-radius:8px;font-size:11px;pointer-events:none;z-index:10">
          {copyToast}
        </div>
      )}
    </div>
  );
}
