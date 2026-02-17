/**
 * CSS-based bar chart for field analytics metrics.
 *
 * Each row displays the field name, a population rate bar with percentage text,
 * and a unique rate bar. Bars are rendered as divs with proportional widths
 * and colour-coded fills.
 *
 * Complexity: O(M) where M is the number of field metrics.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { FieldMetrics } from '../utils/fieldAnalytics';

export interface FieldAnalyticsChartProps {
  metrics: FieldMetrics[];
}

/** Render the analytics chart. O(M). */
export function FieldAnalyticsChart(props: FieldAnalyticsChartProps): VNode {
  const { metrics } = props;

  if (metrics.length === 0) {
    return (
      <div class="wl-muted" style="padding:12px 0">No field metrics to display.</div>
    );
  }

  return (
    <div class="wl-analyticsChart">
      {/* Header row */}
      <div class="wl-analyticsRow" style="font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">
        <span>Field</span>
        <span>Population Rate</span>
        <span style="text-align:right">%</span>
      </div>

      {metrics.map((m) => {
        const popPct = Math.round(m.populationRate * 100);
        const uniqPct = Math.round(m.uniqueRate * 100);
        const isLow = popPct < 20;

        return (
          <div key={m.fieldName} class="wl-analyticsRow" title={`${m.fieldName}: ${popPct}% populated, ${uniqPct}% unique, ${m.distinctCount} distinct`}>
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
              <span class="wl-mono" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {m.fieldName}
              </span>
              <span class="wl-muted" style="font-size:10px">
                {m.fieldType} &middot; {m.distinctCount} distinct &middot; {uniqPct}% unique
              </span>
            </div>

            <div style="display:flex;flex-direction:column;gap:3px">
              {/* Population bar */}
              <div class="wl-analyticsBar">
                <div
                  class={isLow ? 'wl-analyticsBarFill wl-analyticsBarFillLow' : 'wl-analyticsBarFill'}
                  style={`width:${Math.max(0, Math.min(100, popPct))}%`}
                />
              </div>
              {/* Unique rate bar (smaller, secondary) */}
              <div class="wl-analyticsBar" style="height:5px;opacity:0.6">
                <div
                  class="wl-analyticsBarFill"
                  style={`width:${Math.max(0, Math.min(100, uniqPct))}%`}
                />
              </div>
            </div>

            <span style="text-align:right;font-weight:700;font-size:12px;white-space:nowrap">
              {popPct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
