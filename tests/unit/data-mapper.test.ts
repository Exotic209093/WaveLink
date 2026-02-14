import { DataMapper } from '../../src/data/mappers';
import type { FieldMapping } from '../../src/core/types/storage';
import type { SObjectField } from '../../src/core/types/salesforce';

describe('DataMapper', () => {
  let mapper: DataMapper;

  beforeEach(() => {
    mapper = new DataMapper();
  });

  describe('mapRecords', () => {
    it('should map source fields to target fields', () => {
      const mappings: FieldMapping[] = [
        { sourceField: 'first_name', targetField: 'FirstName', required: false },
        { sourceField: 'last_name', targetField: 'LastName', required: false },
        { sourceField: 'email_address', targetField: 'Email', required: false },
      ];

      const source = [
        { first_name: 'John', last_name: 'Doe', email_address: 'john@example.com' },
        { first_name: 'Jane', last_name: 'Smith', email_address: 'jane@example.com' },
      ];

      const result = mapper.mapRecords(source, mappings);

      expect(result.mappedRecords).toEqual([
        { FirstName: 'John', LastName: 'Doe', Email: 'john@example.com' },
        { FirstName: 'Jane', LastName: 'Smith', Email: 'jane@example.com' },
      ]);
      expect(result.errors).toHaveLength(0);
    });

    it('should apply transformations', () => {
      const mappings: FieldMapping[] = [
        { sourceField: 'name', targetField: 'Name', transformation: 'uppercase', required: false },
      ];

      const result = mapper.mapRecords([{ name: 'hello' }], mappings);
      expect(result.mappedRecords[0].Name).toBe('HELLO');
    });

    it('should use default values for missing fields', () => {
      const mappings: FieldMapping[] = [
        { sourceField: 'status', targetField: 'Status__c', defaultValue: 'Active', required: false },
      ];

      const result = mapper.mapRecords([{}], mappings);
      expect(result.mappedRecords[0].Status__c).toBe('Active');
    });

    it('should report errors for missing required fields', () => {
      const mappings: FieldMapping[] = [
        { sourceField: 'required_field', targetField: 'Required__c', required: true },
      ];

      const result = mapper.mapRecords([{}], mappings);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('required_field');
    });
  });

  describe('autoMapFields', () => {
    it('should auto-map matching field names (case-insensitive)', () => {
      const sourceFields = ['FirstName', 'lastname', 'Email'];
      const targetFields: SObjectField[] = [
        createMockField('FirstName'),
        createMockField('LastName'),
        createMockField('Email'),
      ];

      const mappings = mapper.autoMapFields(sourceFields, targetFields);

      expect(mappings).toHaveLength(3);
      expect(mappings.find(m => m.sourceField === 'FirstName')?.targetField).toBe('FirstName');
      expect(mappings.find(m => m.sourceField === 'lastname')?.targetField).toBe('LastName');
      expect(mappings.find(m => m.sourceField === 'Email')?.targetField).toBe('Email');
    });

    it('should skip non-createable fields', () => {
      const sourceFields = ['Id'];
      const targetFields: SObjectField[] = [
        { ...createMockField('Id'), createable: false },
      ];

      const mappings = mapper.autoMapFields(sourceFields, targetFields);
      expect(mappings).toHaveLength(0);
    });
  });
});

function createMockField(name: string): SObjectField {
  return {
    name,
    label: name,
    type: 'string',
    length: 255,
    required: false,
    createable: true,
    updateable: true,
    nillable: true,
    defaultValue: null,
    externalId: false,
    unique: false,
  };
}
