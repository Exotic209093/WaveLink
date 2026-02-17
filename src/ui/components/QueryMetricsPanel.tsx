/**
 * Inline panel showing query execution metrics.
 *
 * What this file does:
 * - Displays the last 5 queries by default with execution time, record count, and timestamp.
 * - Shows average execution time across all metrics.
 * - "View All" toggle expands to show full history.
 * - Clear button to reset metrics.
 *
 * Complexity: O(N) where N = metrics.length for rendering and average computation.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { QueryMetric } from '../utils/queryMetrics';
import { formatDuration } from '../utils/queryMetrics';

export interface QueryMetricsPanelProps {
  metrics: QueryMetric[];
  onClear: () => void;
}

export function QueryMetricsPanel(props: QueryMetricsPanelProps): VNode {
  const { metrics, onClear } = props;
  const [viewAll, setViewAll] = useState(false);

  const averageTime = useMemo(() => {
    if (metrics.length === 0) return 0;
    const total = metrics.reduce((sum, m) => sum + m.executionTimeMs, 0);
    return total / metrics.length;
  }, [metrics]);

  // Show most recent first
  const sorted = useMemo(() => [...metrics].reverse(), [metrics]);
  const displayed = viewAll ? sorted : sorted.slice(0, 5);

  return (
    <div class="wl-card" style="display:flex;flex-direction:column;gap:10px">
      <div class="wl-cardHeader">
        <h2>Query Metrics</h2>
        <div class="wl-actions">
          {metrics.length > 5 ? (
            <button class="wl-btn" onClick={() => setViewAll(!viewAll)}>
              {viewAll ? 'Show Recent' : `View All (${metrics.length})`}
            </button>
          ) : null}
          <button class="wl-btn" onClick={onClear} disabled={metrics.length === 0}>
            Clear
          </button>
        </div>
      </div>

      {/* Average time */}
      {metrics.length > 0 ? (
        <div class="wl-row">
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div>
              <span style="font-weight:900">Avg Time: </span>
              <span class="wl-mono">{formatDuration(averageTime)}</span>
            </div>
            <div>
              <span style="font-weight:900">Total Queries: </span>
              <span>{metrics.length}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Metrics list */}
      {displayed.length === 0 ? (
        <div class="wl-row">
          <div class="wl-muted">No query metrics recorded yet.</div>
        </div>
      ) : (
        <div style="display:flex;flex-direction:column;gap:6px">
          {displayed.map((m) => (
            <div
              key={m.id}
              style="display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:8px;border:1px solid var(--wl-line-2);font-size:13px"
            >
              <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title={m.soql}>
                <span class="wl-mono" style="font-size:12px">{m.soql}</span>
              </div>
              <div style="flex:0 0 auto;display:flex;gap:12px;align-items:center;white-space:nowrap">
                <span title="Execution time">
                  <span style="font-weight:700">{formatDuration(m.executionTimeMs)}</span>
                </span>
                <span title="Records returned" class="wl-muted">
                  {m.recordCount} row{m.recordCount !== 1 ? 's' : ''}
                </span>
                <span title="Timestamp" class="wl-muted" style="font-size:11px">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!viewAll && metrics.length > 5 ? (
        <div class="wl-muted" style="text-align:center;font-size:12px">
          Showing 5 of {metrics.length} queries
        </div>
      ) : null}
    </div>
  );
}
