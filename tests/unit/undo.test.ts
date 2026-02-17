import { isTransactionExpired, pruneTransactions, formatElapsed } from '../../src/ui/utils/undo';
import type { PushTransaction } from '../../src/core/types/storage';

function makeTx(overrides: Partial<PushTransaction> = {}): PushTransaction {
  return {
    id: 'tx_1',
    pushId: 'push_1',
    orgId: '00D123',
    objectName: 'Account',
    operation: 'insert',
    capturedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    rollbackIds: ['001xx'],
    rollbackOperation: 'delete',
    ...overrides,
  };
}

describe('isTransactionExpired', () => {
  it('returns false when expiresAt is in the future', () => {
    const tx = makeTx({ expiresAt: Date.now() + 60000 });
    expect(isTransactionExpired(tx)).toBe(false);
  });

  it('returns true when expiresAt is in the past', () => {
    const tx = makeTx({ expiresAt: Date.now() - 1000 });
    expect(isTransactionExpired(tx)).toBe(true);
  });
});

describe('pruneTransactions', () => {
  it('removes expired transactions', () => {
    const now = Date.now();
    const transactions: PushTransaction[] = [
      makeTx({ id: 'tx_1', expiresAt: now + 60000 }),
      makeTx({ id: 'tx_2', expiresAt: now - 1000 }),
      makeTx({ id: 'tx_3', expiresAt: now + 120000 }),
    ];
    const pruned = pruneTransactions(transactions);

    expect(pruned).toHaveLength(2);
    expect(pruned.map(t => t.id)).toContain('tx_1');
    expect(pruned.map(t => t.id)).toContain('tx_3');
    expect(pruned.map(t => t.id)).not.toContain('tx_2');
  });

  it('caps results to MAX_UNDO_ENTRIES (10)', () => {
    const now = Date.now();
    const transactions: PushTransaction[] = Array.from({ length: 15 }, (_, i) =>
      makeTx({ id: `tx_${i}`, expiresAt: now + 60000 * (i + 1) }),
    );
    const pruned = pruneTransactions(transactions);

    expect(pruned).toHaveLength(10);
  });

  it('returns empty array when all transactions are expired', () => {
    const transactions: PushTransaction[] = [
      makeTx({ id: 'tx_1', expiresAt: Date.now() - 5000 }),
      makeTx({ id: 'tx_2', expiresAt: Date.now() - 10000 }),
    ];
    const pruned = pruneTransactions(transactions);

    expect(pruned).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const pruned = pruneTransactions([]);
    expect(pruned).toHaveLength(0);
  });
});

describe('formatElapsed', () => {
  it('formats recent timestamps as seconds ago', () => {
    const capturedAt = Date.now() - 30 * 1000; // 30 seconds ago
    const result = formatElapsed(capturedAt);

    expect(result).toMatch(/^\d+s ago$/);
  });

  it('formats a few minutes ago correctly', () => {
    const capturedAt = Date.now() - 5 * 60 * 1000; // 5 minutes ago
    const result = formatElapsed(capturedAt);

    expect(result).toMatch(/^\d+m ago$/);
    expect(result).toBe('5m ago');
  });

  it('formats hours ago correctly', () => {
    const capturedAt = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
    const result = formatElapsed(capturedAt);

    expect(result).toMatch(/^\d+h ago$/);
    expect(result).toBe('2h ago');
  });

  it('formats exactly 60 seconds as 1m ago', () => {
    const capturedAt = Date.now() - 60 * 1000;
    const result = formatElapsed(capturedAt);

    expect(result).toBe('1m ago');
  });

  it('formats exactly 60 minutes as 1h ago', () => {
    const capturedAt = Date.now() - 60 * 60 * 1000;
    const result = formatElapsed(capturedAt);

    expect(result).toBe('1h ago');
  });
});
