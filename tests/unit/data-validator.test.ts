import { DataValidator } from '../../src/data/validators';
import { DataMapper } from '../../src/data/mappers';
import { simulatePush } from '../../src/ui/utils/pushDryRun';
import type { SObjectField } from '../../src/core/types/salesforce';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('validateRecords', () => {
    it('should pass valid records', () => {
      const fields = [createField('Name', 'string', { createable: true })];
      const records = [{ Name: 'Test Record' }];

      const result = validator.validateRecords(records, fields, 'insert');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unknown fields', () => {
      const fields = [createField('Name', 'string', { createable: true })];
      const records = [{ Name: 'Test', UnknownField: 'value' }];

      const result = validator.validateRecords(records, fields, 'insert');
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('UnknownField');
    });

    it('should reject non-createable fields on insert', () => {
      const fields = [createField('Formula__c', 'string', { createable: false })];
      const records = [{ Formula__c: 'value' }];

      const result = validator.validateRecords(records, fields, 'insert');
      expect(result.valid).toBe(false);
    });

    it('should validate email format', () => {
      const fields = [createField('Email', 'email', { createable: true })];

      const validResult = validator.validateRecords([{ Email: 'test@example.com' }], fields, 'insert');
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateRecords([{ Email: 'not-an-email' }], fields, 'insert');
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate number fields', () => {
      const fields = [createField('Amount', 'double', { createable: true })];

      const validResult = validator.validateRecords([{ Amount: 42.5 }], fields, 'insert');
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateRecords([{ Amount: 'not-a-number' }], fields, 'insert');
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate string length', () => {
      const fields = [createField('ShortField', 'string', { createable: true, length: 5 })];

      const validResult = validator.validateRecords([{ ShortField: 'abc' }], fields, 'insert');
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateRecords([{ ShortField: 'too long value' }], fields, 'insert');
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate picklist values', () => {
      const fields = [createField('Status', 'picklist', {
        createable: true,
        picklistValues: [
          { value: 'Active', label: 'Active', active: true, defaultValue: false },
          { value: 'Inactive', label: 'Inactive', active: true, defaultValue: false },
        ],
      })];

      const validResult = validator.validateRecords([{ Status: 'Active' }], fields, 'insert');
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateRecords([{ Status: 'Invalid' }], fields, 'insert');
      expect(invalidResult.valid).toBe(false);
    });

    it('should reject null on non-nillable required fields', () => {
      const fields = [createField('Required', 'string', {
        createable: true,
        nillable: false,
        required: true,
      })];

      const result = validator.validateRecords([{ Required: null }], fields, 'insert');
      expect(result.valid).toBe(false);
    });
  });

  // Regression for #50: reference-lookup mappings produce relationship keys
  // (`Account: { External_Key__c: ... }`) that used to be reported as
  // `Unknown field "Account"`, deadlocking the guided import.
  describe('reference lookups (#50)', () => {
    const contactFields = (): SObjectField[] => [
      createField('LastName', 'string', { required: true, nillable: false }),
      createField('AccountId', 'reference', { relationshipName: 'Account', referenceTo: ['Account'] }),
      createField('Parent__c', 'reference', { relationshipName: 'Parent__r', referenceTo: ['Parent__c'], required: true, nillable: false }),
    ];

    it('accepts relationship keys produced by the mapper for externalId and relatedField lookups', () => {
      const mapped = new DataMapper().mapRecords([{ last: 'Doe', accountKey: 'ACME-1', parentName: 'Head Office' }], [
        { sourceField: 'last', targetField: 'LastName', required: true },
        { sourceField: 'accountKey', targetField: 'AccountId', required: false, lookup: { mode: 'externalId', relationshipName: 'Account', matchField: 'External_Key__c' } },
        { sourceField: 'parentName', targetField: 'Parent__c', required: false, lookup: { mode: 'relatedField', relationshipName: 'Parent__r', matchField: 'Name' } },
      ]).mappedRecords;
      expect(mapped[0]).toEqual({ LastName: 'Doe', Account: { External_Key__c: 'ACME-1' }, Parent__r: { Name: 'Head Office' } });

      for (const op of ['insert', 'update', 'upsert'] as const) {
        const result = validator.validateRecords(mapped, contactFields(), op);
        expect(result.errors).toEqual([]);
      }
    });

    it('lets the dry run pass lookup rows instead of flagging every row', () => {
      const report = simulatePush([{ LastName: 'Doe', Account: { External_Key__c: 'ACME-1' }, Parent__r: { Name: 'HQ' } }], contactFields(), 'insert');
      expect(report.rows[0]).toEqual(expect.objectContaining({ status: 'ok', reasons: [] }));
    });

    it('derives custom __r names when describe omits relationshipName', () => {
      const fields = [createField('Region__c', 'reference', { relationshipName: null, referenceTo: ['Region__c'] })];
      expect(validator.validateRecords([{ Region__r: { Code__c: 'EMEA' } }], fields, 'insert').errors).toEqual([]);
    });

    it('still rejects keys that are neither fields nor relationship names', () => {
      const result = validator.validateRecords([{ LastName: 'Doe', Parent__c: 'a01000000000001', Acount: { Key__c: 'x' } }], contactFields(), 'insert');
      expect(result.errors.map(e => e.message)).toEqual(['Record 0: Unknown field "Acount"']);
    });

    it('rejects malformed nested match values', () => {
      const base = { LastName: 'Doe', Parent__c: 'a01000000000001' };
      const bad = [
        { ...base, Account: 'ACME-1' },
        { ...base, Account: {} },
        { ...base, Account: { External_Key__c: 'A', Name: 'B' } },
        { ...base, Account: { External_Key__c: '   ' } },
        { ...base, Account: { External_Key__c: { nested: true } } },
      ];
      const result = validator.validateRecords(bad, contactFields(), 'insert');
      expect(result.errors.map(e => e.field)).toEqual(['Account', 'Account', 'Account', 'Account', 'Account']);
    });

    it('applies createable/updateable rules of the underlying reference field', () => {
      const fields = [createField('MasterId', 'reference', { relationshipName: 'Master', referenceTo: ['Account'], updateable: false })];
      expect(validator.validateRecords([{ Master: { Key__c: 'x' } }], fields, 'insert').valid).toBe(true);
      const result = validator.validateRecords([{ Master: { Key__c: 'x' } }], fields, 'update');
      expect(result.errors[0].message).toContain('"MasterId" (via "Master") is not updateable');
    });

    it('requires the match field to be an External ID or idLookup field when related metadata is supplied', () => {
      const relatedFields = {
        Account: [
          createField('External_Key__c', 'string', { externalId: true }),
          createField('Name', 'string', { idLookup: true }),
          createField('Description', 'textarea'),
        ],
      };
      const fields = [createField('AccountId', 'reference', { relationshipName: 'Account', referenceTo: ['Account'] })];
      const check = (matchField: string) =>
        validator.validateRecords([{ Account: { [matchField]: 'v' } }], fields, 'insert', { relatedFields }).errors.map(e => e.message);

      expect(check('External_Key__c')).toEqual([]);
      expect(check('Name')).toEqual([]);
      expect(check('Description')).toEqual(['Record 0: Field "Account.Description" is not an External ID or idLookup field and cannot be used to match "Account"']);
      expect(check('Missing__c')).toEqual(['Record 0: Unknown field "Missing__c" on Account (via "Account")']);
    });
  });
});

function createField(
  name: string,
  type: string,
  overrides: Partial<SObjectField> = {},
): SObjectField {
  return {
    name,
    label: name,
    type: type as SObjectField['type'],
    length: overrides.length ?? 255,
    required: overrides.required ?? false,
    createable: overrides.createable ?? true,
    updateable: overrides.updateable ?? true,
    nillable: overrides.nillable ?? true,
    defaultValue: null,
    externalId: false,
    unique: false,
    picklistValues: overrides.picklistValues,
    ...overrides,
  };
}
