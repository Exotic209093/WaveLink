import {
  WaveLinkError,
  AuthError,
  TokenExpiredError,
  SalesforceApiError,
  RateLimitError,
  ValidationError,
  DataPushError,
  isRetryableError,
  NetworkError,
} from '../../src/core/errors';

describe('Error Hierarchy', () => {
  it('WaveLinkError should serialize to JSON', () => {
    const error = new WaveLinkError('test error', 'TEST_CODE', { detail: 1 });
    const json = error.toJSON();

    expect(json.name).toBe('WaveLinkError');
    expect(json.code).toBe('TEST_CODE');
    expect(json.message).toBe('test error');
    expect(json.details).toEqual({ detail: 1 });
    expect(json.timestamp).toBeGreaterThan(0);
  });

  it('AuthError should extend WaveLinkError', () => {
    const error = new AuthError('auth failed');
    expect(error).toBeInstanceOf(WaveLinkError);
    expect(error.code).toBe('AUTH_ERROR');
  });

  it('TokenExpiredError should include orgId', () => {
    const error = new TokenExpiredError('00D123456789');
    expect(error).toBeInstanceOf(AuthError);
    expect(error.message).toContain('00D123456789');
  });

  it('SalesforceApiError should include statusCode', () => {
    const error = new SalesforceApiError('not found', 404, 'NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.sfErrorCode).toBe('NOT_FOUND');
  });

  it('RateLimitError should include retryAfter', () => {
    const error = new RateLimitError(30);
    expect(error.retryAfter).toBe(30);
    expect(error.statusCode).toBe(429);
  });

  it('ValidationError should include field errors', () => {
    const fieldErrors = [{ field: 'Name', message: 'Required' }];
    const error = new ValidationError('validation failed', fieldErrors);
    expect(error.fieldErrors).toEqual(fieldErrors);
  });

  it('DataPushError should include counts', () => {
    const error = new DataPushError('push-1', 5, 10);
    expect(error.pushId).toBe('push-1');
    expect(error.failedRecords).toBe(5);
    expect(error.totalRecords).toBe(10);
  });
});

describe('isRetryableError', () => {
  it('should return true for RateLimitError', () => {
    expect(isRetryableError(new RateLimitError())).toBe(true);
  });

  it('should return true for NetworkError', () => {
    expect(isRetryableError(new NetworkError('connection failed'))).toBe(true);
  });

  it('should return true for 500+ status codes', () => {
    expect(isRetryableError(new SalesforceApiError('server error', 500))).toBe(true);
    expect(isRetryableError(new SalesforceApiError('gateway error', 502))).toBe(true);
  });

  it('should return false for 400 errors', () => {
    expect(isRetryableError(new SalesforceApiError('bad request', 400))).toBe(false);
  });

  it('should return false for non-WaveLink errors', () => {
    expect(isRetryableError(new Error('generic'))).toBe(false);
  });
});
