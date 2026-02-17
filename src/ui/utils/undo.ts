/**
 * Undo/rollback transaction utilities.
 * Complexity: O(N) for pruning transactions.
 */

import type { PushTransaction } from '../../core/types/storage';
import { MAX_UNDO_ENTRIES } from '../../core/constants';

/** Check if a transaction has expired. O(1). */
export function isTransactionExpired(t: PushTransaction): boolean {
  return Date.now() > t.expiresAt;
}

/** Remove expired transactions and cap to MAX_UNDO_ENTRIES. O(N). */
export function pruneTransactions(transactions: PushTransaction[]): PushTransaction[] {
  const now = Date.now();
  return transactions
    .filter(t => t.expiresAt > now)
    .slice(0, MAX_UNDO_ENTRIES);
}

/** Format elapsed time as human-readable string. O(1). */
export function formatElapsed(capturedAt: number): string {
  const elapsed = Date.now() - capturedAt;
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
