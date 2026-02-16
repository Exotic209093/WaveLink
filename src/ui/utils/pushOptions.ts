function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function clampBatchSize(n: number): number {
  // REST collection endpoints max at 200 records per request.
  return clampInt(n, 1, 200);
}

export function clampThreads(n: number): number {
  // Keep concurrency limited to reduce risk of rate limits.
  return clampInt(n, 1, 4);
}

