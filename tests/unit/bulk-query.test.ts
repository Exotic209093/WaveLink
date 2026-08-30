import { BulkApiService } from '../../src/services/salesforce/bulk-api';

function service(): BulkApiService {
  return new BulkApiService({
    instanceUrl: 'https://example.my.salesforce.com',
    accessToken: 'token',
    apiVersion: 'v65.0',
  });
}

function response(body: string, status: number = 200, headers: Record<string, string> = {}): Response {
  const normalized = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => normalized.get(name.toLowerCase()) ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

describe('BulkApiService query jobs', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('creates an asynchronous CSV query job with normalized SOQL', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(JSON.stringify({
      id: '750xx', operation: 'query', state: 'UploadComplete', numberRecordsProcessed: 0, createdDate: 'now',
    }), 200, { 'Content-Type': 'application/json' }));
    global.fetch = fetchMock;

    const job = await service().createQueryJob('SELECT Id,\n Name FROM Account');

    expect(job.id).toBe('750xx');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/data/v65.0/jobs/query',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(expect.objectContaining({
      operation: 'query',
      query: 'SELECT Id,  Name FROM Account',
      contentType: 'CSV',
    }));
  });

  it('parses a bounded result page and exposes the resume locator', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(
      'Id,Name,Notes\n001,"Acme, Ltd","line 1\nline 2"\n',
      200, { 'Sforce-Locator': 'next-page', 'Sforce-NumberOfRecords': '1' },
    ));

    const page = await service().getQueryResults('750xx', 'previous', 5000);

    expect(page).toEqual({
      records: [{ Id: '001', Name: 'Acme, Ltd', Notes: 'line 1\nline 2' }],
      locator: 'next-page',
      numberOfRecords: 1,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/jobs/query/750xx/results?maxRecords=5000&locator=previous'),
      expect.any(Object),
    );
  });

  it('treats a null locator as the final page and can abort the job', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response('Id\n001\n', 200, { 'Sforce-Locator': 'null' }))
      .mockResolvedValueOnce(response(JSON.stringify({
        id: '750xx', operation: 'query', state: 'Aborted', numberRecordsProcessed: 1, createdDate: 'now',
      }), 200, { 'Content-Type': 'application/json' }));
    global.fetch = fetchMock;

    expect((await service().getQueryResults('750xx')).locator).toBeNull();
    expect((await service().abortQueryJob('750xx')).state).toBe('Aborted');
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'PATCH' }));
  });
});
