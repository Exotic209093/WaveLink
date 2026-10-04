/**
 * Bulk API CSV must round-trip field values exactly.
 *
 * - Upload (#66 regression): the spreadsheet formula-injection guard from PR #118
 *   was also applied to the Bulk ingest CSV, so values starting with - + = @ were
 *   uploaded with a leading apostrophe (stored in Salesforce, or rejected for
 *   number fields). The REST path never did this.
 * - Query (#80 regression): PR #119 enabled Papa `dynamicTyping`, which coerced
 *   Text values ("00123" -> 123, long numeric strings lost precision, "true" -> true).
 */

import { BulkApiService, bulkCsvCellValue } from '../../src/services/salesforce/bulk-api';

function service(): BulkApiService {
  return new BulkApiService({
    instanceUrl: 'https://example.my.salesforce.com',
    accessToken: 'token',
    apiVersion: 'v65.0',
  });
}

function csvResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => body,
  } as unknown as Response;
}

describe('Bulk ingest CSV sends values verbatim', () => {
  it.each([
    ['negative number', -5, '-5'],
    ['negative decimal string', '-12.50', '-12.50'],
    ['international phone', '+44 20 7946 0000', '+44 20 7946 0000'],
    ['handle', '@wavelink', '@wavelink'],
    ['leading equals', '=1+1', '=1+1'],
  ])('%s', (_label, value, expected) => {
    expect(bulkCsvCellValue({ Field__c: value }, 'Field__c')).toBe(expected);
  });

  it('does not prefix an apostrophe anywhere in the uploaded CSV', () => {
    const csv = service().recordsToCsv([{ Amount: -5, Phone: '+1 555 0100' }]);
    expect(csv).toBe('Amount,Phone\n-5,+1 555 0100');
  });
});

describe('Bulk query results keep CSV values as strings', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('preserves leading zeros, long numeric strings, and boolean-looking text', async () => {
    global.fetch = jest.fn().mockResolvedValue(csvResponse(
      'Id,PostalCode,External_Id__c,Flag_Text__c\n001xx0000000001AAA,02134,123456789012345678,true\n',
    ));

    const page = await service().getQueryResults('750xx');

    expect(page.records).toEqual([{
      Id: '001xx0000000001AAA',
      PostalCode: '02134',
      External_Id__c: '123456789012345678',
      Flag_Text__c: 'true',
    }]);
  });
});
