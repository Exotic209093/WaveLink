/**
 * Query execution history panel.
 *
 * Displays recent query executions from the QueryMetricsStore with timing,
 * record counts, and the ability to re-run a previous query.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { QueryMetricsStore, formatDuration } from '../utils/queryMetrics';
import type { QueryMetric } from '../utils/queryMetrics';

export function QueryHistory(props: {
  onLoadQuery: (soql: string) => void;
}): VNode {
  const { onLoadQuery } = props;
  const store = QueryMetricsStore.getInstance();
  const [sortBy, setSortBy] = useState<'recent' | 'slowest'>('recent');

  const metrics = useMemo(() => {
    if (sortBy === 'slowest') return store.getSlowest(50);
    return [...store.getAll()].reverse();
  }, [sortBy, store.getAll().length]);

  const avgTime = store.getAverageTime();

  function truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (metrics.length === 0) {
    return (
      <div class="wl-card">
        <div class="wl-row">
          <div class="wl-muted" style="text-align:center;padding:16px">
            No query history yet. Run a query to see it here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Query History</h2>
        <div class="wl-actions">
          <span class="wl-muted" style="font-size:11px">
            Avg: {formatDuration(avgTime)} | {metrics.length} queries
          </span>
          <button
            class="wl-btn"
            style={`font-size:11px;padding:4px 10px${sortBy === 'recent' ? ';background:var(--wl-glow)' : ''}`}
            onClick={() => setSortBy('recent')}
          >Recent</button>
          <button
            class="wl-btn"
            style={`font-size:11px;padding:4px 10px${sortBy === 'slowest' ? ';background:var(--wl-glow)' : ''}`}
            onClick={() => setSortBy('slowest')}
          >Slowest</button>
          <button
            class="wl-btn"
            style="font-size:11px;padding:4px 10px"
            onClick={() => { store.clear(); setSortBy('recent'); }}
          >Clear</button>
        </div>
      </div>
      <div style="max-height:320px;overflow:auto">
        {metrics.map((m: QueryMetric) => (
          <div
            key={m.id}
            class="wl-queryRow"
            style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--wl-line-2)"
            onClick={() => onLoadQuery(m.soql)}
          >
            <div style="flex:1;min-width:0;overflow:hidden">
              <div class="wl-mono" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {truncate(m.soql, 100)}
              </div>
            </div>
            <div style="display:flex;gap:12px;flex-shrink:0;align-items:center">
              {m.objectName && (
                <span class="wl-badge" style="font-size:10px;padding:1px 6px">{m.objectName}</span>
              )}
              <span style="font-size:11px;min-width:48px;text-align:right;font-weight:600">
                {formatDuration(m.executionTimeMs)}
              </span>
              <span class="wl-muted" style="font-size:10px;min-width:40px;text-align:right">
                {m.recordCount} rows
              </span>
              <span class="wl-muted" style="font-size:10px;min-width:56px;text-align:right">
                {formatTime(m.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
