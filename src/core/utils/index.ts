/**
 * Shared utility functions for WaveLink.
 */

/** Generate a unique ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/** Generate a unique request ID for messaging */
export function generateRequestId(): string {
  return `req_${generateId()}`;
}

/** Sleep for a given duration */
export function sleep(ms: number): Promise<void> {
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
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/** Deep clone an object (structured clone where available, JSON fallback) */
export function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

/** Check if a URL matches a Salesforce domain */
export function isSalesforceUrl(url: string): boolean {
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
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
