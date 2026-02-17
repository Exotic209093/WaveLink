/**
 * Reusable skeleton placeholder component for loading states.
 *
 * Replaces plain "Loading..." text with animated shimmer placeholders
 * that match the shape of the content being loaded.
 *
 * Complexity: O(1) per instance.
 */

import type { VNode } from 'preact';
import { h } from 'preact';

export type SkeletonVariant = 'text' | 'card' | 'table' | 'chip';

export interface SkeletonProps {
  /** Shape variant. Defaults to 'text'. */
  variant?: SkeletonVariant;
  /** Number of skeleton rows to render (for text/table). Defaults to 3. */
  rows?: number;
  /** Number of columns (for table variant). Defaults to 4. */
  columns?: number;
}

function SkeletonLine(props: { width?: string }): VNode {
  return <div class="wl-skeleton wl-skeleton--text" style={props.width ? { width: props.width } : undefined} />;
}

export function Skeleton(props: SkeletonProps): VNode {
  const { variant = 'text', rows = 3, columns = 4 } = props;

  if (variant === 'card') {
    return (
      <div class="wl-skeleton--card">
        <SkeletonLine width="60%" />
        <SkeletonLine width="100%" />
        <SkeletonLine width="80%" />
      </div>
    );
  }

  if (variant === 'chip') {
    return (
      <div class="wl-skeleton--chipRow">
        <div class="wl-skeleton wl-skeleton--chip" />
        <div class="wl-skeleton wl-skeleton--chip" />
        <div class="wl-skeleton wl-skeleton--chip" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div class="wl-skeleton--table">
        <div class="wl-skeleton--tableRow">
          {Array.from({ length: columns }, (_, i) => (
            <div key={i} class="wl-skeleton wl-skeleton--tableHead" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} class="wl-skeleton--tableRow">
            {Array.from({ length: columns }, (_, c) => (
              <div key={c} class="wl-skeleton wl-skeleton--tableCell" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Default: text lines with varying widths
  const widths = ['100%', '85%', '70%', '90%', '60%'];
  return (
    <div class="wl-skeleton--textGroup">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  );
}
