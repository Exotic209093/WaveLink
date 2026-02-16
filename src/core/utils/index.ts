/**
 * Shared utility functions for WaveLink.
 */

/** Generate a unique ID */
export function generateId(): string {
  // Time: O(1). Data: returns a string suitable for UI IDs (not cryptographically secure).
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/** Generate a unique request ID for messaging */
export function generateRequestId(): string {
  // Time: O(1). Data: string prefixed with `req_` for easy log correlation.
  return `req_${generateId()}`;
}

/** Sleep for a given duration */
export function sleep(ms: number): Promise<void> {
  // Time: O(1). Data: returns a Promise that resolves after `ms`.
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff.
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in ms (doubled each retry)
 * @param shouldRetry - Optional predicate to check if error is retryable
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
  shouldRetry?: (error: unknown) => boolean,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      if (shouldRetry && !shouldRetry(error)) break;
      await sleep(baseDelay * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

/** Chunk an array into batches of a given size */
export function chunkArray<T>(array: T[], size: number): T[][] {
  // Time: O(N) where N=array.length. Data: preserves order; last chunk may be smaller.
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/** Deep clone an object (structured clone where available, JSON fallback) */
export function deepClone<T>(obj: T): T {
  // Time: O(N) in object size. Data: uses structuredClone when available, otherwise JSON round-trip.
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

/** Check if a URL matches a Salesforce domain */
export function isSalesforceUrl(url: string): boolean {
  // Time: O(1). Data: conservative hostname-based allowlist.
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith('.salesforce.com') ||
      parsed.hostname.endsWith('.force.com')
    );
  } catch {
    return false;
  }
}

/** Extract the Salesforce instance identifier from a URL */
export function extractSalesforceInstance(url: string): string | null {
  // Time: O(1). Data: returns the subdomain instance name for known Salesforce host patterns.
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Pattern: myDomain.lightning.force.com
    const lightningMatch = hostname.match(/^([a-zA-Z0-9-]+)\.lightning\.force\.com$/);
    if (lightningMatch) return lightningMatch[1];

    // Pattern: myDomain.my.salesforce.com
    const myMatch = hostname.match(/^([a-zA-Z0-9-]+)\.my\.salesforce\.com$/);
    if (myMatch) return myMatch[1];

    return null;
  } catch {
    return null;
  }
}

/** Create an abort-capable timeout promise */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message?: string): Promise<T> {
  // Time: O(1). Data: wraps a Promise with a timer-based rejection.
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message ?? `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/** Safely parse JSON without throwing */
export function safeJsonParse<T>(json: string): T | null {
  // Time: O(N) in input length. Data: returns parsed value or null without throwing.
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** Parse a numeric `tabId` from a URL search string (e.g. `?tabId=123`). */
export function parseTabIdFromSearch(search: string): number | null {
  // Time: O(N) in query string length. Data: returns a positive integer tabId or null.
  try {
    const normalized = search.startsWith('?') ? search.slice(1) : search;
    if (!normalized) return null;
    const params = new URLSearchParams(normalized);
    const raw = params.get('tabId');
    if (!raw) return null;
    const tabId = Number.parseInt(raw, 10);
    if (!Number.isFinite(tabId) || tabId <= 0) return null;
    return tabId;
  } catch {
    return null;
  }
}

/** Extract a numeric `tabId` from a full URL string that may include `?tabId=...`. */
export function extractTabIdFromUrl(url: string): number | null {
  // Time: O(1). Data: safe wrapper that tolerates invalid URLs.
  try {
    const parsed = new URL(url);
    return parseTabIdFromSearch(parsed.search);
  } catch {
    return null;
  }
}
