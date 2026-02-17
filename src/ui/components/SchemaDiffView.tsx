/**
 * Scrollable list view of schema diffs with filter toolbar and summary stats.
 *
 * Renders a toolbar with all/added/removed/changed toggle buttons,
 * a summary row with counts, and a scrollable list of FieldDiffDetail items.
 *
 * Complexity: O(D) where D is the total number of field diffs.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { SchemaDiff, FieldDiffStatus } from '../utils/schemaDiff';
import { FieldDiffDetail } from './FieldDiffDetail';

export interface SchemaDiffViewProps {
  diff: SchemaDiff;
}

type FilterMode = 'all' | 'added' | 'removed' | 'changed';

/** Render the full diff view with filter toolbar. O(D). */
export function SchemaDiffView(props: SchemaDiffViewProps): VNode {
  const { diff } = props;
  const [filter, setFilter] = useState<FilterMode>('all');

  /** Combine and filter diffs based on current filter. O(D). */
  const visibleDiffs = useMemo(() => {
    switch (filter) {
      case 'added':
        return diff.added;
      case 'removed':
        return diff.removed;
      case 'changed':
        return diff.changed;
      case 'all':
      default:
        return [...diff.added, ...diff.removed, ...diff.changed, ...diff.unchanged];
    }
  }, [diff, filter]);

  /** Build filter buttons config. O(1). */
  const filters: Array<{ label: string; mode: FilterMode; count: number }> = [
    { label: 'All', mode: 'all', count: diff.summary.total },
    { label: 'Added', mode: 'added', count: diff.summary.added },
    { label: 'Removed', mode: 'removed', count: diff.summary.removed },
    { label: 'Changed', mode: 'changed', count: diff.summary.changed },
  ];

  return (
    <div class="wl-diffView">
      {/* Summary stats */}
      <div class="wl-chipRow" style="padding:8px 0">
        <span class="wl-chip">
          <span style="font-weight:900">{diff.leftLabel}</span> vs <span style="font-weight:900">{diff.rightLabel}</span>
        </span>
        <span class="wl-chip"><span style="font-weight:900">Total:</span> {diff.summary.total}</span>
        <span class="wl-chip" style="color:#4caf50"><span style="font-weight:900">Added:</span> {diff.summary.added}</span>
        <span class="wl-chip" style="color:var(--wl-danger)"><span style="font-weight:900">Removed:</span> {diff.summary.removed}</span>
        <span class="wl-chip" style="color:var(--wl-accent)"><span style="font-weight:900">Changed:</span> {diff.summary.changed}</span>
      </div>

      {/* Filter toolbar */}
      <div class="wl-actions" style="padding-bottom:8px">
        {filters.map((f) => (
          <button
            key={f.mode}
            class="wl-btn"
            data-active={filter === f.mode ? 'true' : 'false'}
            onClick={() => setFilter(f.mode)}
            style="font-size:11px;padding:5px 10px"
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Diff list */}
      <div style="max-height:520px;overflow-y:auto">
        {visibleDiffs.length > 0 ? (
          visibleDiffs.map((d) => (
            <FieldDiffDetail key={d.name} diff={d} />
          ))
        ) : (
          <div class="wl-muted" style="padding:12px 0">No fields match the selected filter.</div>
        )}
      </div>
    </div>
  );
}
