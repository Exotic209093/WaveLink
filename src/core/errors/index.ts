/**
 * Custom error hierarchy for WaveLink.
 * Provides structured error handling across the extension.
 *
 * Why:
 * - Chrome messaging and fetch errors otherwise lose context.
 * - We attach stable `code` values and `details` for UI-friendly reporting.
 *
 * Complexity: O(1).
 */

/** Base error class for all WaveLink errors */
export class WaveLinkError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly timestamp: number;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'WaveLinkError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/** Authentication/authorization errors */
export class AuthError extends WaveLinkError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthError';
  }
}

/** Token expired - needs refresh */
export class TokenExpiredError extends AuthError {
  constructor(orgId: string) {
    super(`Access token expired for org ${orgId}`, { orgId });
    this.name = 'TokenExpiredError';
  }
}

/** Salesforce API errors */
export class SalesforceApiError extends WaveLinkError {
  public readonly statusCode: number;
  public readonly sfErrorCode?: string;

  constructor(message: string, statusCode: number, sfErrorCode?: string, details?: unknown) {
    super(message, 'SALESFORCE_API_ERROR', details);
    this.name = 'SalesforceApiError';
    this.statusCode = statusCode;
    this.sfErrorCode = sfErrorCode;
  }
}

/** Rate limit exceeded */
export class RateLimitError extends SalesforceApiError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    super('Salesforce API rate limit exceeded', 429, 'REQUEST_LIMIT_EXCEEDED', { retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** Data validation errors */
export class ValidationError extends WaveLinkError {
  public readonly fieldErrors: FieldValidationError[];

  constructor(message: string, fieldErrors: FieldValidationError[]) {
    super(message, 'VALIDATION_ERROR', { fieldErrors });
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export interface FieldValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/** Data push operation errors */
export class DataPushError extends WaveLinkError {
  public readonly pushId: string;
  public readonly failedRecords: number;
  public readonly totalRecords: number;

  constructor(pushId: string, failedRecords: number, totalRecords: number, details?: unknown) {
    super(
      `Data push ${pushId} failed: ${failedRecords}/${totalRecords} records failed`,
      'DATA_PUSH_ERROR',
      details,
    );
    this.name = 'DataPushError';
    this.pushId = pushId;
    this.failedRecords = failedRecords;
    this.totalRecords = totalRecords;
  }
}

/** Storage errors */
export class StorageError extends WaveLinkError {
  constructor(message: string, details?: unknown) {
    super(message, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

/** Network/connectivity errors */
export class NetworkError extends WaveLinkError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

/** Circuit breaker is open - API calls temporarily blocked */
export class CircuitBreakerError extends WaveLinkError {
  public readonly resetMs: number;

  constructor(resetMs: number) {
    super(
      `API circuit breaker is open. Requests blocked for ${Math.ceil(resetMs / 1000)}s due to repeated failures.`,
      'CIRCUIT_BREAKER_OPEN',
      { resetMs },
    );
    this.name = 'CircuitBreakerError';
    this.resetMs = resetMs;
  }
}

/** Check if an error is retryable */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof NetworkError) return true;
  if (error instanceof SalesforceApiError) {
    return error.statusCode >= 500 || error.statusCode === 429;
  }
  return false;
}
