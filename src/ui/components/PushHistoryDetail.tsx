/**
 * Push history detail panel with error grouping and export.
 *
 * What this file does:
 * - Displays push operation details
 * - Groups errors by message with counts
 * - Provides export functionality for errors
 *
 * Complexity: O(E) where E is number of errors for grouping.
 */

import { h, VNode } from 'preact';
import { useState } from 'preact/hooks';
import { exportRecords, ensureCorrectExtension } from '../utils/export';
import type { PushHistoryEntry } from '../../core/types/storage';

function groupErrors(errors: Array<{ recordIndex: number; message: string }>): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const err of errors) {
    const indices = groups.get(err.message) ?? [];
    indices.push(err.recordIndex);
    groups.set(err.message, indices);
  }
  return groups;
}

export interface PushHistoryDetailProps {
  entry: PushHistoryEntry;
  onClose: () => void;
  onRetryFailed?: (pushId: string) => Promise<void>;
}

export function PushHistoryDetail(props: PushHistoryDetailProps): VNode {
  const { entry, onClose, onRetryFailed } = props;
  const [busy, setBusy] = useState(false);

  const errorGroups = entry.errors ? groupErrors(entry.errors) : new Map();
  const sortedGroups = Array.from(errorGroups.entries()).sort((a, b) => b[1].length - a[1].length);

  const duration = entry.completedAt - entry.startedAt;
  const durationSec = (duration / 1000).toFixed(1);

  async function exportErrors(format: 'csv' | 'json'): Promise<void> {
    if (!entry.errors || entry.errors.length === 0) return;

    setBusy(true);
    try {
      const records = entry.errors.map(err => ({
        recordIndex: err.recordIndex,
        message: err.message,
      }));

      const filename = ensureCorrectExtension(`errors-${entry.id}`, format);

      await exportRecords(records, ['recordIndex', 'message'], {
        format,
        filename,
        includeMetadata: format === 'json',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="wl-modalOverlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Push Details">
      <div class="wl-modal wl-card" onClick={(e) => e.stopPropagation()} style="max-width:800px">
        <div class="wl-cardHeader">
          <h2>Push Details</h2>
          <button class="wl-btn" onClick={onClose}>Close</button>
        </div>

        <div class="wl-row">
          {/* Summary */}
          <div class="wl-chipRow">
            <span class="wl-chip">
              <span>Object</span>
              <strong>{entry.objectName}</strong>
            </span>
            <span class="wl-chip">
              <span>Operation</span>
              <strong>{entry.operation}</strong>
            </span>
            <span class="wl-chip">
              <span>Strategy</span>
              <strong>{entry.strategy?.toUpperCase() ?? 'AUTO'}</strong>
            </span>
            <span class="wl-chip">
              <span>Total</span>
              <strong>{entry.totalRecords}</strong>
            </span>
            <span class="wl-chip">
              <span>Success</span>
              <strong style="color:var(--wl-success)">{entry.successCount}</strong>
            </span>
            <span class="wl-chip">
              <span>Failed</span>
              <strong style="color:var(--wl-danger)">{entry.failureCount}</strong>
            </span>
            <span class="wl-chip">
              <span>Duration</span>
              <strong>{durationSec}s</strong>
            </span>
          </div>

          {entry.externalIdField ? (
            <div class="wl-muted">
              External ID Field: <strong>{entry.externalIdField}</strong>
            </div>
          ) : null}

          <div class="wl-muted">
            Started: {new Date(entry.startedAt).toLocaleString()}
          </div>

          {/* Error Groups */}
          {sortedGroups.length > 0 ? (
            <>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
                <h3 style="margin:0;font-size:16px;font-weight:900">
                  Error Summary ({entry.failureCount} failures, {sortedGroups.length} unique messages)
                </h3>
                <div style="display:flex;gap:8px">
                  {onRetryFailed && entry.failureCount > 0 ? (
                    <button
                      class="wl-buttonBrand"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onRetryFailed(entry.id);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Retry {entry.failureCount} Failed
                    </button>
                  ) : null}
                  <button class="wl-btn" onClick={() => exportErrors('csv')} disabled={busy}>
                    Export CSV
                  </button>
                  <button class="wl-btn" onClick={() => exportErrors('json')} disabled={busy}>
                    Export JSON
                  </button>
                </div>
              </div>

              <div style="max-height:400px;overflow-y:auto">
                {sortedGroups.map(([message, indices], idx) => (
                  <div
                    key={idx}
                    style="padding:12px;margin-bottom:8px;border-radius:10px;border:1px solid var(--wl-line-2);background:rgba(255,59,92,0.05)"
                  >
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                      <div style="font-weight:900;font-size:12px;color:var(--wl-danger)">
                        {indices.length} {indices.length === 1 ? 'record' : 'records'}
                      </div>
                      <div class="wl-muted" style="font-size:11px;font-family:var(--wl-font-mono)">
                        Indices: {indices.slice(0, 10).join(', ')}{indices.length > 10 ? ` +${indices.length - 10} more` : ''}
                      </div>
                    </div>
                    <div style="font-size:13px;font-family:var(--wl-font-mono);color:var(--wl-ink-dim)">
                      {message}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div class="wl-muted" style="margin-top:16px">
              No errors recorded for this push.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
