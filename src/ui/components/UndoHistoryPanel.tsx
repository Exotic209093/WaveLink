/**
 * Fixed bottom-right overlay panel for viewing and undoing push transactions.
 *
 * What this file does:
 * - Loads push transactions from SfApi.
 * - Prunes expired entries and displays a scrollable list.
 * - Each row shows object name, operation, record count, elapsed time, and an Undo button.
 * - Undo triggers a delete push for rollbackIds; Remove discards a transaction.
 *
 * Why:
 * - Quick undo access is essential for iterative data seeding workflows.
 *
 * Complexity:
 * - Loading/pruning is O(N) where N = number of transactions.
 * - Undo is O(1) JS + network (push operation).
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { PushTransaction } from '../../core/types/storage';
import { pruneTransactions, isTransactionExpired, formatElapsed } from '../utils/undo';

export interface UndoHistoryPanelProps {
  sf: SfApi;
  open: boolean;
  onClose: () => void;
}

/**
 * UndoHistoryPanel renders a fixed overlay with push transaction undo controls.
 * O(N) for loading and display where N = transaction count.
 */
export function UndoHistoryPanel(props: UndoHistoryPanelProps): VNode {
  const { sf, open, onClose } = props;

  const [transactions, setTransactions] = useState<PushTransaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  /** Load and prune transactions. O(N). */
  async function loadTransactions(): Promise<void> {
    try {
      const raw = await sf.getPushTransactions();
      setTransactions(pruneTransactions(raw));
    } catch {
      // Silently handle load failures
    }
  }

  // Load on mount and when panel opens. O(N).
  useEffect(() => {
    if (open) {
      loadTransactions();
    }
  }, [open]);

  /** Visible (non-stale) transactions list. O(N). */
  const displayTransactions = useMemo(() => transactions, [transactions]);

  /** Undo a transaction by pushing a delete for its rollbackIds. O(1) JS + network. */
  async function handleUndo(t: PushTransaction): Promise<void> {
    if (isTransactionExpired(t)) return;
    if (t.rollbackIds.length === 0) return;

    setBusy(t.id);
    try {
      await sf.startDataPush({
        objectName: t.objectName,
        operation: 'delete',
        records: t.rollbackIds.map((id) => ({ Id: id })),
      });
      // Remove the transaction after successful undo
      await sf.removePushTransaction(t.id);
      await loadTransactions();
    } catch {
      // Silently handle undo failures
    } finally {
      setBusy(null);
    }
  }

  /** Remove a transaction without undoing. O(1) JS + network. */
  async function handleRemove(t: PushTransaction): Promise<void> {
    setBusy(t.id);
    try {
      await sf.removePushTransaction(t.id);
      await loadTransactions();
    } catch {
      // Silently handle remove failures
    } finally {
      setBusy(null);
    }
  }

  if (!open) return h('div', null) as VNode;

  return (
    <div class="wl-undoPanel" style="position:fixed;bottom:16px;right:16px;width:380px;z-index:1000">
      <div class="wl-undoPanelHeader">
        <span>Undo History</span>
        <div class="wl-actions">
          <button class="wl-btn" onClick={loadTransactions} style="padding:4px 8px;font-size:11px">
            Refresh
          </button>
          <button class="wl-btn" onClick={onClose} style="padding:4px 8px;font-size:11px">
            Close
          </button>
        </div>
      </div>

      <div class="wl-undoPanelBody">
        {displayTransactions.length === 0 ? (
          <div style="padding:16px;text-align:center" class="wl-muted">
            No undo transactions available.
          </div>
        ) : (
          displayTransactions.map((t) => {
            const expired = isTransactionExpired(t);
            const isBusy = busy === t.id;

            return (
              <div
                key={t.id}
                class="wl-undoRow"
                data-expired={expired ? 'true' : undefined}
              >
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    {t.objectName}
                  </div>
                  <div class="wl-muted" style="font-size:11px">
                    {t.operation} | {t.rollbackIds.length} IDs | {formatElapsed(t.capturedAt)}
                  </div>
                </div>
                <div class="wl-actions" style="flex-shrink:0">
                  <button
                    class="wl-btn wl-btnPrimary"
                    style="padding:4px 8px;font-size:11px"
                    onClick={() => handleUndo(t)}
                    disabled={expired || isBusy}
                  >
                    {isBusy ? '...' : 'Undo'}
                  </button>
                  <button
                    class="wl-btn wl-btnDanger"
                    style="padding:4px 8px;font-size:11px"
                    onClick={() => handleRemove(t)}
                    disabled={isBusy}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
