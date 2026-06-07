import { computePushProgress, formatClock, formatThroughput } from '../../src/ui/utils/pushMetrics';

describe('computePushProgress', () => {
  const base = { status: 'processing', total: 100, startedAt: 0 };

  it('computes percentage, succeeded, and remaining', () => {
    const p = computePushProgress({ ...base, processed: 40, failed: 5, now: 10_000 });
    expect(p.pct).toBe(40);
    expect(p.succeeded).toBe(35);
    expect(p.failed).toBe(5);
    expect(p.remaining).toBe(60);
    expect(p.done).toBe(false);
  });

  it('derives throughput and ETA from elapsed time', () => {
    // 50 processed in 10s -> 5/s; 50 remaining -> ~10s ETA
    const p = computePushProgress({ ...base, processed: 50, failed: 0, now: 10_000 });
    expect(p.throughput).toBeCloseTo(5, 5);
    expect(p.etaMs).toBeCloseTo(10_000, 5);
  });

  it('marks done and clears ETA when complete', () => {
    const p = computePushProgress({ ...base, status: 'complete', processed: 100, failed: 2, completedAt: 20_000, now: 99_000 });
    expect(p.done).toBe(true);
    expect(p.pct).toBe(100);
    expect(p.etaMs).toBeNull();
    // Elapsed uses completedAt, not the (later) now.
    expect(p.elapsedMs).toBe(20_000);
  });

  it('treats remaining === 0 as done even while status lags', () => {
    const p = computePushProgress({ ...base, processed: 100, failed: 0, now: 5_000 });
    expect(p.done).toBe(true);
    expect(p.etaMs).toBeNull();
  });

  it('handles a zero-total dataset without dividing by zero', () => {
    const p = computePushProgress({ status: 'processing', total: 0, processed: 0, failed: 0, startedAt: 0, now: 1_000 });
    expect(p.pct).toBe(0);
    expect(p.remaining).toBe(0);
    expect(p.etaMs).toBeNull();
  });

  it('clamps failed to processed and never goes negative', () => {
    const p = computePushProgress({ ...base, processed: 10, failed: 999, now: 1_000 });
    expect(p.failed).toBe(10);
    expect(p.succeeded).toBe(0);
  });
});

describe('formatClock', () => {
  it('formats seconds, minutes, and hours', () => {
    expect(formatClock(0)).toBe('0s');
    expect(formatClock(45_000)).toBe('45s');
    expect(formatClock(125_000)).toBe('2m 05s');
    expect(formatClock(3_780_000)).toBe('1h 03m');
  });
  it('returns a dash for null/invalid', () => {
    expect(formatClock(null)).toBe('—');
    expect(formatClock(-5)).toBe('—');
  });
});

describe('formatThroughput', () => {
  it('formats low and high rates', () => {
    expect(formatThroughput(4.25)).toBe('4.3/s');
    expect(formatThroughput(42)).toBe('42/s');
    expect(formatThroughput(0)).toBe('—');
  });
});
