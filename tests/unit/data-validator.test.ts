import { DataValidator } from '../../src/data/validators';
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
