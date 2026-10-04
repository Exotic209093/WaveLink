import Papa from 'papaparse';
import { BulkApiService } from '../../src/services/salesforce/bulk-api';
import type { BulkJobResult } from '../../src/services/salesforce/bulk-api';
import { buildBulkRowIdentity, fetchBulkRowResults, mapBulkResultsToInput } from '../../src/services/salesforce/bulk-results';

function service(): BulkApiService {
  return new BulkApiService({
    instanceUrl: 'https://example.my.salesforce.com',
    accessToken: 'test',
    apiVersion: 'v65.0',
  });
}

/** Simulate a Bulk result row: sf__ columns plus the uploaded columns echoed back as strings. */
function echo(csv: string, inputRow: number, extra: Record<string, string>): BulkJobResult {
  const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data;
  return { sf__Id: '', sf__Created: '', sf__Error: '', ...extra, ...rows[inputRow] };
}

describe('Bulk ingest CSV (#45)', () => {
  test('header row is the union of keys across all records', () => {
    // Blank-ignored cells are omitted by the mapper, so row 0 has no Phone key.
    const csv = service().recordsToCsv([
      { Name: 'Acme' },
      { Name: 'Globex', Phone: '555-0100' },
      { Name: 'Initech', Website: 'initech.test' },
    ]);
    expect(csv.split('\n')).toEqual([
      'Name,Phone,Website',
      'Acme,,',
      'Globex,555-0100,',
      'Initech,,initech.test',
    ]);
  });

  test('explicit null (blank means clear) is sent as #N/A; missing keys stay blank', () => {
    const csv = service().recordsToCsv([
      { Id: '001A', Phone: null, Website: 'keep.test' },
      { Id: '001B', Website: undefined },
    ]);
    expect(csv.split('\n')).toEqual([
      'Id,Phone,Website',
      '001A,#N/A,keep.test',
      '001B,,',
    ]);
  });

  test('quotes values containing a carriage return', () => {
    const csv = service().recordsToCsv([{ Name: 'Acme', Description: 'line one\rline two' }]);
    expect(csv).toBe('Name,Description\nAcme,"line one\rline two"');
    expect(Papa.parse(csv, { header: true }).data).toEqual([{ Name: 'Acme', Description: 'line one\rline two' }]);
  });
});

describe('Bulk per-row result mapping (#47)', () => {
  const records = [
    { Name: 'Acme', Phone: '1' },
    { Name: 'Globex', Phone: null },
    { Name: 'Initech' },
    { Name: 'Umbrella', Phone: '4' },
  ];
  const csv = service().recordsToCsv(records);

  test('maps out-of-order successful and failed rows back to input indices', () => {
    const identity = buildBulkRowIdentity(records);
    const successful = [
      echo(csv, 3, { sf__Id: '001U', sf__Created: 'true' }),
      echo(csv, 0, { sf__Id: '001A', sf__Created: 'true' }),
    ];
    const failed = [
      echo(csv, 2, { sf__Error: 'REQUIRED_FIELD_MISSING:Required fields are missing: [Industry]' }),
      echo(csv, 1, { sf__Error: 'INVALID_FIELD:Bad phone' }),
    ];

    expect(mapBulkResultsToInput(identity, successful, failed)).toEqual({
      ids: ['001U', '001A'],
      idRecordIndexes: [3, 0],
      errors: [
        { recordIndex: 2, message: 'REQUIRED_FIELD_MISSING:Required fields are missing: [Industry]' },
        { recordIndex: 1, message: 'INVALID_FIELD:Bad phone' },
      ],
    });
  });

  test('tolerates echoed whitespace, header case, and a blanked #N/A marker', () => {
    const identity = buildBulkRowIdentity(records);
    const failed: BulkJobResult[] = [{ sf__Id: '', sf__Created: '', sf__Error: 'Bad', NAME: ' Globex ', phone: '' }];
    expect(mapBulkResultsToInput(identity, [], failed).errors).toEqual([{ recordIndex: 1, message: 'Bad' }]);
  });

  test('claims identical duplicate rows once each, in input order', () => {
    const dupes = [{ Name: 'Same' }, { Name: 'Other' }, { Name: 'Same' }];
    const dupeCsv = service().recordsToCsv(dupes);
    const result = mapBulkResultsToInput(
      buildBulkRowIdentity(dupes),
      [echo(dupeCsv, 0, { sf__Id: '001X' }), echo(dupeCsv, 2, { sf__Id: '001Y' })],
      [echo(dupeCsv, 0, { sf__Error: 'Surplus echo' })],
    );
    expect(result.idRecordIndexes).toEqual([0, 2]);
    expect(result.errors).toEqual([{ recordIndex: -1, message: 'Surplus echo' }]);
  });

  test('reports unidentifiable rows as -1 instead of guessing a position', () => {
    const result = mapBulkResultsToInput(
      undefined,
      [echo(csv, 0, { sf__Id: '001A' })],
      [echo(csv, 1, { sf__Error: 'Bad' })],
    );
    expect(result).toEqual({ ids: ['001A'], idRecordIndexes: [-1], errors: [{ recordIndex: -1, message: 'Bad' }] });
  });

  test('fetches both result files and keeps going when one cannot be read', async () => {
    const identity = buildBulkRowIdentity(records);
    const result = await fetchBulkRowResults({
      getSuccessfulResults: jest.fn().mockRejectedValue(new Error('403')),
      getFailedResults: jest.fn().mockResolvedValue([echo(csv, 2, { sf__Error: 'Bad' })]),
    }, '750xx', identity);
    expect(result).toEqual({ ids: [], idRecordIndexes: [], errors: [{ recordIndex: 2, message: 'Bad' }] });
  });

  test('result getters reject non-OK responses instead of parsing an error body as rows', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '[{"errorCode":"INVALID_SESSION_ID"}]',
    } as unknown as Response);
    try {
      await expect(service().getFailedResults('750xx')).rejects.toThrow('Failed to retrieve bulk job results');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
