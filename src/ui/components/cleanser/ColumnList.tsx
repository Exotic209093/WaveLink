/**
 * Column list for the cleanser.
 *
 * What this file does:
 * - Renders each source column with its current op state (rename, drop, transform).
 * - Supports selection + drop toggles.
 *
 * Complexity: O(C) where C is `filteredSources.length`.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import type { ColumnOp } from '../../utils/cleanse';
import { TRANSFORM_OPTIONS } from '../../utils/transforms';

function badgeForTransform(transform: string): string {
  const found = TRANSFORM_OPTIONS.find(t => t.key === transform);
  return found?.badge ?? '';
}

export function ColumnList(props: {
  ops: ColumnOp[];
  filteredSources: string[];
  selected: Set<string>;
  errorFields?: Set<string>;
  onToggleSelected: (source: string, ev: MouseEvent) => void;
  onToggleDrop: (source: string) => void;
}): VNode {
  const { ops, filteredSources, selected, errorFields, onToggleSelected, onToggleDrop } = props;
  const opBySource = new Map(ops.map(o => [o.source, o]));

  return (
    <div class="wl-colList">
      {filteredSources.map(source => {
        const op = opBySource.get(source)!;
        const target = (op.renameTo || op.source).trim() || op.source;
        const isSelected = selected.has(source);
        const tfBadge = op.transform !== 'none' ? badgeForTransform(op.transform) : '';
        const hasErr = errorFields?.has(target) || errorFields?.has(source);

        return (
          <div
            key={source}
            class={`wl-colRow${isSelected ? ' wl-colRowSelected' : ''}`}
            role="button"
            tabIndex={0}
            onClick={(e) => onToggleSelected(source, e as unknown as MouseEvent)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleSelected(source, e as unknown as MouseEvent);
              }
            }}
            title={source}
          >
            <div class="wl-colRowLeft">
              <input
                type="checkbox"
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelected(source, e as unknown as MouseEvent);
                }}
              />
              <div class="wl-colNames">
                <div class="wl-mono">{source}</div>
                {target !== source ? <div class="wl-muted">-&gt; <span class="wl-mono">{target}</span></div> : null}
              </div>
            </div>

            <div class="wl-colBadges">
              {hasErr ? <span class="wl-badge wl-badgeErr">Err</span> : null}
              {op.drop ? <span class="wl-badge wl-badgeDrop">Dropped</span> : null}
              {tfBadge ? <span class="wl-badge">{tfBadge}</span> : null}
              <label class="wl-badge wl-badgeBtn">
                <input aria-label={`Drop ${source}`} type="checkbox" checked={op.drop} onClick={(e) => e.stopPropagation()} onChange={() => onToggleDrop(source)} />
                <span>Drop</span>
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
