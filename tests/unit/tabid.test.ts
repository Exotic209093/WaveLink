import { extractTabIdFromUrl, parseTabIdFromSearch } from '../../src/core/utils';

describe('parseTabIdFromSearch', () => {
  it('should parse a valid tabId', () => {
    expect(parseTabIdFromSearch('?tabId=123')).toBe(123);
  });

  it('should return null for non-numeric tabId', () => {
    expect(parseTabIdFromSearch('?tabId=abc')).toBeNull();
  });

  it('should return null when tabId is missing', () => {
    expect(parseTabIdFromSearch('')).toBeNull();
    expect(parseTabIdFromSearch('?other=1')).toBeNull();
  });
});

describe('extractTabIdFromUrl', () => {
  it('should extract tabId from a full URL', () => {
    expect(extractTabIdFromUrl('https://example.com/app/app.html?tabId=99')).toBe(99);
  });

  it('should return null for invalid URLs or missing tabId', () => {
    expect(extractTabIdFromUrl('not-a-url')).toBeNull();
    expect(extractTabIdFromUrl('https://example.com/app/app.html')).toBeNull();
  });
});

