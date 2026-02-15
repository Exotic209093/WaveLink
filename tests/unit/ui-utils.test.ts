import { flattenRecord, deriveColumns } from '../../src/ui/utils/records';
import { recordsToCsv } from '../../src/ui/utils/csv';

describe('UI Utils', () => {
  it('flattenRecord should flatten nested objects and ignore attributes', () => {
    const flat = flattenRecord({
      Id: '001xx000003DGbYAAW',
      Name: 'Acme',
      attributes: { type: 'Account' },
      Owner: { Name: 'Jane', Email: 'jane@example.com' },
      Tags__c: ['a', 'b'],
      NullField: null,
    });

    expect(flat.Id).toBe('001xx000003DGbYAAW');
    expect(flat.Name).toBe('Acme');
    expect(flat['Owner.Name']).toBe('Jane');
    expect(flat['Owner.Email']).toBe('jane@example.com');
    expect(flat.Tags__c).toBe(JSON.stringify(['a', 'b']));
    expect(flat.NullField).toBeNull();
    expect((flat as Record<string, unknown>).attributes).toBeUndefined();
  });

  it('deriveColumns should union keys', () => {
    const cols = deriveColumns([{ A: 1, B: 2 }, { B: 3, C: 4 }]);
    expect(cols).toEqual(expect.arrayContaining(['A', 'B', 'C']));
  });

  it('recordsToCsv should escape commas and quotes', () => {
    const csv = recordsToCsv(
      [
        { Name: 'Acme, Inc', Note: 'He said "hi"' },
      ],
      ['Name', 'Note'],
    );
    expect(csv.split('\n')[0]).toBe('Name,Note');
    expect(csv.split('\n')[1]).toBe('"Acme, Inc","He said ""hi"""');
  });
});

