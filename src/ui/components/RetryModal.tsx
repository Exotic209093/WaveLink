/**
 * Retry modal for failed push operations.
 *
 * Shows error summary and allows user to generate a retry dataset.
 *
 * Complexity: O(1) for rendering.
 */

import { h, VNode } from 'preact';
import { getTopErrors } from '../utils/pushRetry';

export interface RetryModalProps {
  open: boolean;
  totalFailed: number;
  errors: Array<{ recordIndex: number; message: string }>;
  onRetry: () => void;
  onClose: () => void;
}

export function RetryModal(props: RetryModalProps): VNode | null {
  const { open, totalFailed, errors, onRetry, onClose } = props;

  if (!open) return null;

  const topErrors = getTopErrors(errors, 3);

  return (
    <div class="wl-modalOverlay" role="dialog" aria-modal="true" aria-label="Retry Failed Records">
      <div class="wl-modal wl-card">
        <div class="wl-cardHeader">
          <h2>Retry Failed Records</h2>
          <button class="wl-btn" onClick={onClose}>Close</button>
        </div>

        <div class="wl-row">
          <div>
            <div style="font-weight:900;font-size:16px;margin-bottom:12px">
              {totalFailed} {totalFailed === 1 ? 'record' : 'records'} failed
            </div>
            <div class="wl-muted" style="margin-bottom:16px">
              Generate a new dataset with only the failed records and retry the push operation.
              Your original field mappings will be preserved.
            </div>
          </div>

          <div>
            <div style="font-weight:900;font-size:14px;margin-bottom:8px">
              Top Error Messages:
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              {topErrors.map(([message, count], idx) => (
                <div
                  key={idx}
                  style="padding:10px;border-radius:10px;border:1px solid var(--wl-line-2);background:rgba(255,59,92,0.05)"
                >
                  <div style="font-weight:900;font-size:12px;color:var(--wl-danger);margin-bottom:4px">
                    {count} {count === 1 ? 'record' : 'records'}
                  </div>
                  <div style="font-size:12px;font-family:var(--wl-font-mono);color:var(--wl-ink-dim)">
                    {message}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--wl-line-2)">
            <button class="wl-btn" onClick={onClose}>Cancel</button>
            <button class="wl-buttonBrand" onClick={onRetry}>
              Generate Retry Dataset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
