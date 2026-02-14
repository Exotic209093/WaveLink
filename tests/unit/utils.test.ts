import {
  generateId,
  generateRequestId,
  chunkArray,
  isSalesforceUrl,
  extractSalesforceInstance,
  safeJsonParse,
  retryWithBackoff,
} from '../../src/core/utils';

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should generate string IDs', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('generateRequestId', () => {
  it('should generate IDs with req_ prefix', () => {
    const id = generateRequestId();
    expect(id.startsWith('req_')).toBe(true);
  });
});

describe('chunkArray', () => {
  it('should chunk an array into batches', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    const chunks = chunkArray(arr, 3);
    expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it('should handle empty array', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it('should handle array smaller than chunk size', () => {
    expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
  });

  it('should handle chunk size of 1', () => {
    expect(chunkArray([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });
});

describe('isSalesforceUrl', () => {
  it('should return true for salesforce.com URLs', () => {
    expect(isSalesforceUrl('https://myorg.my.salesforce.com')).toBe(true);
    expect(isSalesforceUrl('https://login.salesforce.com')).toBe(true);
  });

  it('should return true for force.com URLs', () => {
    expect(isSalesforceUrl('https://myorg.lightning.force.com')).toBe(true);
  });

  it('should return false for non-Salesforce URLs', () => {
    expect(isSalesforceUrl('https://google.com')).toBe(false);
    expect(isSalesforceUrl('https://example.com')).toBe(false);
  });

  it('should return false for invalid URLs', () => {
    expect(isSalesforceUrl('not-a-url')).toBe(false);
    expect(isSalesforceUrl('')).toBe(false);
  });
});

describe('extractSalesforceInstance', () => {
  it('should extract from lightning.force.com URLs', () => {
    expect(extractSalesforceInstance('https://myorg.lightning.force.com/page')).toBe('myorg');
  });

  it('should extract from my.salesforce.com URLs', () => {
    expect(extractSalesforceInstance('https://myorg.my.salesforce.com/page')).toBe('myorg');
  });

  it('should return null for unrecognized patterns', () => {
    expect(extractSalesforceInstance('https://google.com')).toBeNull();
  });

  it('should return null for invalid URLs', () => {
    expect(extractSalesforceInstance('not-a-url')).toBeNull();
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"key": "value"}')).toEqual({ key: 'value' });
  });

  it('should return null for invalid JSON', () => {
    expect(safeJsonParse('not json')).toBeNull();
  });

  it('should parse arrays', () => {
    expect(safeJsonParse('[1, 2, 3]')).toEqual([1, 2, 3]);
  });
});

describe('retryWithBackoff', () => {
  it('should return result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn, 3, 10);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, 3, 10);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(retryWithBackoff(fn, 2, 10)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should respect shouldRetry predicate', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('non-retryable'));
    const shouldRetry = jest.fn().mockReturnValue(false);

    await expect(retryWithBackoff(fn, 3, 10, shouldRetry)).rejects.toThrow('non-retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
