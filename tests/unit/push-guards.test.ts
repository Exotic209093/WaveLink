import { pushConfirmationPhrase, requiresIdFirst, validateIdFirst } from '../../src/ui/utils/pushGuards';

describe('Push Guards', () => {
  test('requiresIdFirst only for update/delete', () => {
    expect(requiresIdFirst('insert')).toBe(false);
    expect(requiresIdFirst('upsert')).toBe(false);
    expect(requiresIdFirst('update')).toBe(true);
    expect(requiresIdFirst('delete')).toBe(true);
  });

  test('validateIdFirst blocks update/delete when first header is not Id', () => {
    expect(validateIdFirst(['Name', 'Id'], 'update')).toMatch(/first column header must be "Id"/);
    expect(validateIdFirst(['Name', 'Id'], 'delete')).toMatch(/first column header must be "Id"/);
  });

  test('validateIdFirst allows update/delete when first header is Id (case-insensitive)', () => {
    expect(validateIdFirst(['Id', 'Name'], 'update')).toBeNull();
    expect(validateIdFirst(['id', 'Name'], 'delete')).toBeNull();
  });

  test('validateIdFirst ignores insert/upsert', () => {
    expect(validateIdFirst(['Name'], 'insert')).toBeNull();
    expect(validateIdFirst(['External_Id__c'], 'upsert')).toBeNull();
  });

  test('requires typed confirmation for every production write and all deletes', () => {
    expect(pushConfirmationPhrase('insert', 3, 'Account', 'production')).toBe('INSERT 3 Account');
    expect(pushConfirmationPhrase('update', 2, 'Contact', 'production')).toBe('UPDATE 2 Contact');
    expect(pushConfirmationPhrase('upsert', 1, 'Lead', 'production')).toBe('UPSERT 1 Lead');
    expect(pushConfirmationPhrase('delete', 4, 'Account', 'sandbox')).toBe('DELETE 4 RECORDS');
    expect(pushConfirmationPhrase('insert', 3, 'Account', 'sandbox')).toBeNull();
  });
});

