/**
 * Live push/migration progress metrics.
 *
 * Pure helpers that turn the raw push counters (processed / failed / total)
 * plus timing into the derived numbers a progress dashboard needs:
 * percentage, success/remaining counts, elapsed time, throughput, and ETA.
 *
 * Kept free of Preact so it can be unit-tested directly.
 *
 * Complexity: O(1).
 */

export interface PushProgressInput {
  status: string;
  processed: number;
  failed: number;
  total: number;
  startedAt: number;
  completedAt?: number;
  /** Current wall-clock time (passed in so the result is deterministic/testable). */
  now: number;
}

export interface PushProgress {
  /** Whole-percent of records processed (0–100). */
  pct: number;
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  elapsedMs: number;
  /** Records processed per second over the run so far (0 until measurable). */
  throughput: number;
  /** Estimated time remaining in ms, or null when it can't be estimated / already done. */
  etaMs: number | null;
  done: boolean;
}

const clampNonNeg = (n: number): number => (n > 0 ? n : 0);

export function computePushProgress(input: PushProgressInput): PushProgress {
  const total = clampNonNeg(input.total);
  const processed = Math.min(clampNonNeg(input.processed), total || clampNonNeg(input.processed));
  const failed = Math.min(clampNonNeg(input.failed), processed);
  const succeeded = clampNonNeg(processed - failed);
  const remaining = clampNonNeg(total - processed);

  const done = input.status === 'complete' || input.status === 'error' || (total > 0 && remaining === 0);

  const end = input.completedAt ?? input.now;
  const elapsedMs = clampNonNeg(end - input.startedAt);

  const elapsedSec = elapsedMs / 1000;
  const throughput = elapsedSec > 0 ? processed / elapsedSec : 0;

  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : (done ? 100 : 0);

  const etaMs = !done && throughput > 0 && remaining > 0 ? (remaining / throughput) * 1000 : null;

  return { pct, processed, succeeded, failed, remaining, elapsedMs, throughput, etaMs, done };
}

/**
 * Format a duration in ms as a compact clock string: "0s", "45s", "2m 05s",
 * "1h 03m". Returns "—" for null/undefined.
 */
export function formatClock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Format a throughput (records/sec) for display, e.g. "12.4/s" or "—". */
export function formatThroughput(perSec: number): string {
  if (!isFinite(perSec) || perSec <= 0) return '—';
  return perSec >= 10 ? `${Math.round(perSec)}/s` : `${perSec.toFixed(1)}/s`;
}
