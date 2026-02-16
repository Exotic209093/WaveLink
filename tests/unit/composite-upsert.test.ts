import { buildUpsertSubrequests, parseUpsertCompositeResponse } from '../../src/services/salesforce/composite-upsert';
import type { CompositeResponse } from '../../src/core/types/salesforce';

describe('Composite Upsert Helpers', () => {
  test('buildUpsertSubrequests skips missing external IDs and builds PATCH subrequests', () => {
    const { subrequests, skipped, refToRecordIndex } = buildUpsertSubrequests({
      apiVersion: 'v59.0',
      objectName: 'Account',
      externalIdField: 'External_Id__c',
      recordIndexOffset: 10,
      records: [
        { Name: 'A', External_Id__c: 'x1' },
        { Name: 'B' }, // missing external id
        { Name: 'C', External_Id__c: 'x3', Id: 'should_be_removed' },
      ],
    });

    expect(skipped).toEqual([{ recordIndex: 11, message: 'Missing external ID value for field "External_Id__c"' }]);
    expect(subrequests).toHaveLength(2);
    expect(refToRecordIndex.get('r10')).toBe(10);
    expect(refToRecordIndex.get('r12')).toBe(12);

    expect(subrequests[0].method).toBe('PATCH');
    expect(subrequests[0].url).toContain('/services/data/v59.0/sobjects/Account/External_Id__c/x1');
    expect(subrequests[0].referenceId).toBe('r10');
    expect((subrequests[1].body as Record<string, unknown>).Id).toBeUndefined();
  });

  test('parseUpsertCompositeResponse maps successes/failures and extracts IDs', () => {
    const refToRecordIndex = new Map<string, number>([
      ['r0', 0],
      ['r1', 1],
      ['r2', 2],
    ]);

    const response: CompositeResponse = {
      compositeResponse: [
        {
          referenceId: 'r0',
          httpStatusCode: 201,
          httpHeaders: {},
          body: { id: '001xx000003DGb1AAG' },
        },
        {
          referenceId: 'r1',
          httpStatusCode: 204,
          httpHeaders: { Location: '/services/data/v59.0/sobjects/Account/001xx000003DGb2AAG' },
          body: null,
        },
        {
          referenceId: 'r2',
          httpStatusCode: 400,
          httpHeaders: {},
          body: [{ message: 'Bad external id' }],
        },
      ],
    };

    const parsed = parseUpsertCompositeResponse(response, refToRecordIndex);
    expect(parsed.successes).toEqual([
      { recordIndex: 0, id: '001xx000003DGb1AAG' },
      { recordIndex: 1, id: '001xx000003DGb2AAG' },
    ]);
    expect(parsed.failures).toEqual([{ recordIndex: 2, message: 'Bad external id' }]);
  });
});

