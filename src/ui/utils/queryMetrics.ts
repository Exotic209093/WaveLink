/**
 * Query performance tracking utilities.
 * Stores execution metrics for SOQL queries and provides analysis helpers.
 * Complexity: O(N) for most operations where N=stored metrics, O(N log N) for sorted retrieval.
 */

/** A single query execution metric. */
export interface QueryMetric {
  id: string;
  soql: string;
  executionTimeMs: number;
  recordCount: number;
  timestamp: number;
  hasMore: boolean;
  objectName?: string;
}

/** Maximum number of metrics retained in memory. */
const MAX_METRICS = 50;

/** Salesforce REST API batch size for cost estimation. */
const API_BATCH_SIZE = 2000;

/**
 * Singleton store for query execution metrics.
 * Retains the last 50 metrics in memory (FIFO eviction).
 * Complexity: O(1) for add, O(N) for retrieval/aggregation.
 */
export class QueryMetricsStore {
  private static instance: QueryMetricsStore | null = null;
  private metrics: QueryMetric[] = [];

  private constructor() {}

  /** Get the singleton instance. O(1). */
  static getInstance(): QueryMetricsStore {
    if (!QueryMetricsStore.instance) {
      QueryMetricsStore.instance = new QueryMetricsStore();
    }
    return QueryMetricsStore.instance;
  }

  /**
   * Add a metric to the store.
   * Evicts the oldest entry when the store exceeds MAX_METRICS. O(1) amortized.
   */
  add(metric: QueryMetric): void {
    this.metrics.push(metric);
    if (this.metrics.length > MAX_METRICS) {
      this.metrics.shift();
    }
  }

  /** Return all stored metrics in insertion order. O(N). */
  getAll(): QueryMetric[] {
    return [...this.metrics];
  }

  /**
   * Compute the average execution time across all stored metrics. O(N).
   * Returns 0 if no metrics are stored.
   */
  getAverageTime(): number {
    if (this.metrics.length === 0) return 0;
    const total = this.metrics.reduce((sum, m) => sum + m.executionTimeMs, 0);
    return total / this.metrics.length;
  }

  /**
   * Return the N slowest queries, sorted descending by execution time. O(N log N).
   * @param n - Number of slowest queries to return.
   */
  getSlowest(n: number): QueryMetric[] {
    const sorted = [...this.metrics].sort((a, b) => b.executionTimeMs - a.executionTimeMs);
    return sorted.slice(0, n);
  }

  /**
   * Filter metrics by Salesforce object name. O(N).
   * @param objName - The SObject API name to filter by.
   */
  getByObject(objName: string): QueryMetric[] {
    const lower = objName.toLowerCase();
    return this.metrics.filter(m => m.objectName?.toLowerCase() === lower);
  }

  /** Clear all stored metrics. O(1). */
  clear(): void {
    this.metrics = [];
  }
}

/**
 * Format a millisecond duration into a human-readable string. O(1).
 *
 * @param ms - Duration in milliseconds.
 * @returns A string like "1.2s" for values >= 1000ms, or "342ms" for smaller values.
 *
 * @example
 * formatDuration(1234)  // "1.2s"
 * formatDuration(342)   // "342ms"
 * formatDuration(0)     // "0ms"
 */
export function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Estimate the number of Salesforce API calls required to retrieve a given
 * number of records, based on the REST API batch size of 2000. O(1).
 *
 * @param recordCount - Total number of records to retrieve.
 * @returns Estimated number of API calls (minimum 1 for any positive count).
 */
export function estimateApiCost(recordCount: number): number {
  if (recordCount <= 0) return 0;
  return Math.ceil(recordCount / API_BATCH_SIZE);
}
