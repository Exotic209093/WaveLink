/**
 * Tests for SalesforceApiClient.rawCall — the shared primitive behind the
 * REST/Tooling Explorer and Apex debug-log capture. Verifies URL resolution,
 * non-throwing status passthrough, and JSON vs. raw-text body parsing.
 */

import { SalesforceApiClient } from '../../src/services/salesforce/api-client';

interface FakeResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
}

function mockFetch(resp: FakeResponse): { calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(resp as unknown as Response);
  };
  return { calls };
}

function client(): SalesforceApiClient {
  return new SalesforceApiClient({
    instanceUrl: 'https://example.my.salesforce.com',
    accessToken: 'TOKEN',
    apiVersion: 'v60.0',
  });
}

const jsonResp = (status: number, ok: boolean, obj: unknown): FakeResponse => ({
  status, ok, text: () => Promise.resolve(JSON.stringify(obj)),
});

describe('SalesforceApiClient.rawCall', () => {
  it('resolves a relative path against the versioned data base', async () => {
    const { calls } = mockFetch(jsonResp(200, true, { records: [] }));
    await client().rawCall('GET', '/limits');
    expect(calls[0].url).toBe('https://example.my.salesforce.com/services/data/v60.0/limits');
  });

  it('adds a leading slash to a relative path without one', async () => {
    const { calls } = mockFetch(jsonResp(200, true, {}));
    await client().rawCall('GET', 'sobjects');
    expect(calls[0].url).toBe('https://example.my.salesforce.com/services/data/v60.0/sobjects');
  });

  it('treats a /services/ path as an absolute service path (no version inserted)', async () => {
    const { calls } = mockFetch(jsonResp(200, true, []));
    await client().rawCall('GET', '/services/data');
    expect(calls[0].url).toBe('https://example.my.salesforce.com/services/data');
  });

  it('uses an absolute http(s) URL verbatim', async () => {
    const { calls } = mockFetch(jsonResp(200, true, {}));
    await client().rawCall('GET', 'https://other.example.com/foo');
    expect(calls[0].url).toBe('https://other.example.com/foo');
  });

  it('returns status + ok + parsed JSON body without throwing on 4xx', async () => {
    mockFetch(jsonResp(404, false, [{ message: 'Not found' }]));
    const res = await client().rawCall('GET', '/sobjects/Nope');
    expect(res.status).toBe(404);
    expect(res.ok).toBe(false);
    expect(res.body).toEqual([{ message: 'Not found' }]);
  });

  it('returns the raw text body when rawText is set', async () => {
    mockFetch({ status: 200, ok: true, text: () => Promise.resolve('39.0 APEX_CODE,DEBUG') });
    const res = await client().rawCall('GET', '/tooling/sobjects/ApexLog/x/Body', undefined, { rawText: true });
    expect(res.body).toBe('39.0 APEX_CODE,DEBUG');
  });

  it('sends a JSON body with a Content-Type header for writes', async () => {
    const { calls } = mockFetch(jsonResp(201, true, { id: '001', success: true }));
    await client().rawCall('POST', '/sobjects/Account', { Name: 'Acme' });
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBe(JSON.stringify({ Name: 'Acme' }));
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('returns a null body for 204 No Content', async () => {
    mockFetch({ status: 204, ok: true, text: () => Promise.resolve('') });
    const res = await client().rawCall('DELETE', '/sobjects/Account/001');
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  it('falls back to text when a JSON response fails to parse', async () => {
    mockFetch({ status: 200, ok: true, text: () => Promise.resolve('not json') });
    const res = await client().rawCall('GET', '/weird');
    expect(res.body).toBe('not json');
  });

  it('adds the required sObject type metadata to collection updates', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [{ id: '001xx', success: true, errors: [] }],
    } as unknown as Response);
    global.fetch = fetchMock;

    await client().collectionUpdate('Account', [{ Id: '001xx', Name: 'Updated' }]);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.method).toBe('PATCH');
    expect(JSON.parse(String(request.body))).toEqual({
      allOrNone: false,
      records: [{ attributes: { type: 'Account' }, Id: '001xx', Name: 'Updated' }],
    });
  });
});
