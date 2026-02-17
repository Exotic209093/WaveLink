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
import { h } from 'preact';
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
}): VNode {
  const { instanceUrl, records, columns, selectedColumns, onSelectedColumnsChange } = props;
  const [showCols, setShowCols] = useState(false);

  // Sort state
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Filter state
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

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
  const totalHeight = totalRows * ROW_HEIGHT;
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
    <div class="wl-card">
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
                  {c}
                  {sortCol === c ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
                </th>
              ))}
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
            {visibleRows.map((r, vi) => (
              <tr key={startIdx + vi} style={`height:${ROW_HEIGHT}px`}>
                {visibleCols.map((c, ci) => {
                  const v = r[c];
                  const display = v === null ? '' : String(v ?? '');
                  const isId = c === 'Id' && looksLikeSfId(v) && instanceUrl;
                  return (
                    <td
                      key={c}
                      title={display}
                      style={`max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap${
                        ci === idColIdx ? ';position:sticky;left:0;z-index:1;background:inherit' : ''
                      }`}
                    >
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
            {/* Spacer row for remaining virtual scroll space */}
            {endIdx < totalRows ? (
              <tr style={`height:${(totalRows - endIdx) * ROW_HEIGHT}px`}>
                <td colSpan={visibleCols.length} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
