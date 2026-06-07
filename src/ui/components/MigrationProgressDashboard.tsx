/**
 * Migration / push progress dashboard.
 *
 * Presentational: renders a live progress bar, status badge, the
 * processed / succeeded / failed / remaining tiles, and throughput · ETA ·
 * elapsed for an in-flight or finished push. Action buttons are passed in
 * by the parent via `actions` so this stays purely about display.
 *
 * Complexity: O(1).
 */

import type { ComponentChildren, VNode } from 'preact';
import { h } from 'preact';
import type { PushProgress } from '../utils/pushMetrics';
import { formatClock, formatThroughput } from '../utils/pushMetrics';

function statusStyle(status: string, done: boolean): { label: string; color: string } {
  if (status === 'error') return { label: 'Error', color: 'var(--wl-danger)' };
  if (status === 'complete' || done) return { label: 'Complete', color: 'var(--wl-success)' };
  if (status === 'processing') return { label: 'Processing', color: 'var(--wl-accent)' };
  return { label: status || 'Pending', color: 'var(--wl-ink-dim)' };
}

function Tile(props: { label: string; value: string; color?: string }): VNode {
  return (
    <div style="flex:1;min-width:92px;padding:10px 12px;border:1px solid var(--wl-line-2);border-radius:10px;text-align:center">
      <div style={`font-size:20px;font-weight:900;line-height:1${props.color ? `;color:${props.color}` : ''}`}>{props.value}</div>
      <div class="wl-muted" style="font-size:11px;margin-top:3px">{props.label}</div>
    </div>
  );
}

export function MigrationProgressDashboard(props: {
  progress: PushProgress;
  pushId: string;
  status: string;
  error?: string;
  actions?: ComponentChildren;
}): VNode {
  const { progress, pushId, status, error, actions } = props;
  const badge = statusStyle(status, progress.done);
  const barColor = status === 'error' ? 'var(--wl-danger)' : progress.done ? 'var(--wl-success)' : 'var(--wl-accent)';

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Migration Progress</h2>
        <div style="display:flex;align-items:center;gap:10px">
          <span
            class="wl-pill"
            style={`color:${badge.color};border-color:${badge.color}55`}
          >
            {badge.label}
          </span>
          <span class="wl-muted" style="font-size:11px;font-family:var(--wl-font-mono)">{pushId}</span>
        </div>
      </div>

      <div class="wl-row">
        {/* Progress bar */}
        <div style="display:flex;align-items:center;gap:10px">
          <div class="wl-meter" style="flex:1" title={`${progress.pct}% processed`}>
            <div class="wl-meterFill" style={`width:${progress.pct}%;background:${barColor}`} />
          </div>
          <span style="font-size:13px;font-weight:900;min-width:44px;text-align:right">{progress.pct}%</span>
        </div>

        {/* Stat tiles */}
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <Tile label="Processed" value={`${progress.processed.toLocaleString()} / ${(progress.processed + progress.remaining).toLocaleString()}`} />
          <Tile label="Succeeded" value={progress.succeeded.toLocaleString()} color="var(--wl-success)" />
          <Tile label="Failed" value={progress.failed.toLocaleString()} color={progress.failed > 0 ? 'var(--wl-danger)' : undefined} />
          <Tile label="Remaining" value={progress.remaining.toLocaleString()} />
        </div>

        {/* Throughput / ETA / elapsed */}
        <div class="wl-chipRow">
          <span class="wl-chip"><span>Throughput</span><strong>{formatThroughput(progress.throughput)}</strong></span>
          <span class="wl-chip"><span>{progress.done ? 'Took' : 'ETA'}</span><strong>{progress.done ? formatClock(progress.elapsedMs) : formatClock(progress.etaMs)}</strong></span>
          <span class="wl-chip"><span>Elapsed</span><strong>{formatClock(progress.elapsedMs)}</strong></span>
        </div>

        {error ? <div style="color:var(--wl-danger);font-weight:700;font-size:13px">{error}</div> : null}

        {actions ? <div class="wl-row" style="gap:10px;flex-wrap:wrap">{actions}</div> : null}
      </div>
    </div>
  );
}
