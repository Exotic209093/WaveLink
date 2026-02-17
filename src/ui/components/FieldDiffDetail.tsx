/**
 * Single field diff row for schema comparison.
 *
 * Displays the field name, a colour-coded status badge, and a summary
 * of changed property deltas (with left/right values when available).
 *
 * Complexity: O(C) where C is the number of changed properties.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { FieldDiff } from '../utils/schemaDiff';

export interface FieldDiffDetailProps {
  diff: FieldDiff;
}

/** Render a single field diff row. O(C). */
export function FieldDiffDetail(props: FieldDiffDetailProps): VNode {
  const { diff } = props;

  return (
    <div class="wl-diffRow" data-status={diff.status}>
      <span class="wl-mono" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title={diff.name}>
        {diff.name}
      </span>

      <span class="wl-diffBadge" data-status={diff.status}>
        {diff.status}
      </span>

      <div style="display:flex;flex-wrap:wrap;gap:4px;min-width:0">
        {diff.status === 'added' && diff.rightField ? (
          <span class="wl-muted" style="font-size:11px">
            type: {diff.rightField.type}
            {diff.rightField.label ? `, label: ${diff.rightField.label}` : ''}
          </span>
        ) : null}

        {diff.status === 'removed' && diff.leftField ? (
          <span class="wl-muted" style="font-size:11px">
            type: {diff.leftField.type}
            {diff.leftField.label ? `, label: ${diff.leftField.label}` : ''}
          </span>
        ) : null}

        {diff.status === 'changed' && diff.changedProperties.length > 0 ? (
          diff.changedProperties.map((prop) => {
            const leftVal = diff.leftField ? String(diff.leftField[prop] ?? '') : '';
            const rightVal = diff.rightField ? String(diff.rightField[prop] ?? '') : '';
            return (
              <span key={prop} class="wl-badge" style="font-size:10px;gap:3px">
                <span style="font-weight:900">{prop}:</span>
                <span style="text-decoration:line-through;opacity:0.6">{leftVal}</span>
                <span>&rarr;</span>
                <span>{rightVal}</span>
              </span>
            );
          })
        ) : null}

        {diff.status === 'unchanged' ? (
          <span class="wl-muted" style="font-size:11px">No changes</span>
        ) : null}
      </div>
    </div>
  );
}
