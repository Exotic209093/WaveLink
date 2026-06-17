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

    it('should match a source header against the field label (not just the API name)', () => {
      const sourceFields = ['Account Name'];
      const targetFields: SObjectField[] = [
        { ...createMockField('Name'), label: 'Account Name' },
      ];

      const mappings = mapper.autoMapFields(sourceFields, targetFields);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].targetField).toBe('Name');
    });

    it('should not include low-confidence fuzzy guesses', () => {
      const sourceFields = ['Emial']; // typo — fuzzy match only
      const targetFields: SObjectField[] = [createMockField('Email')];

      // autoMapFields is conservative (>= 0.9), so a fuzzy guess is excluded.
      expect(mapper.autoMapFields(sourceFields, targetFields)).toHaveLength(0);
    });
  });

  describe('suggestFieldMappings', () => {
    it('should rank an exact API-name match at full confidence', () => {
      const suggestions = mapper.suggestFieldMappings(['Email'], [createMockField('Email')]);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].confidence).toBe(1);
      expect(suggestions[0].matchedOn).toBe('name-exact');
    });

    it('should match normalized names (spaces/underscores/case)', () => {
      const suggestions = mapper.suggestFieldMappings(
        ['first_name'],
        [createMockField('FirstName')],
      );
      expect(suggestions[0].targetField).toBe('FirstName');
      expect(suggestions[0].matchedOn).toBe('name-normalized');
    });

    it('should suggest a fuzzy match for a near-miss typo', () => {
      const suggestions = mapper.suggestFieldMappings(['Departmnet'], [createMockField('Department')]);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].targetField).toBe('Department');
      expect(suggestions[0].matchedOn).toBe('fuzzy');
      expect(suggestions[0].confidence).toBeLessThan(0.95);
    });

    it('should drop weak matches below the confidence floor', () => {
      const suggestions = mapper.suggestFieldMappings(
        ['Phone'],
        [createMockField('AnnualRevenue')],
      );
      expect(suggestions).toHaveLength(0);
    });

    it('should not assign one target field to two source headers', () => {
      // Both headers are plausible matches for Name; only the best should win it.
      const suggestions = mapper.suggestFieldMappings(
        ['Name', 'Naem'],
        [createMockField('Name')],
      );
      const claimsOfName = suggestions.filter(s => s.targetField === 'Name');
      expect(claimsOfName).toHaveLength(1);
      expect(claimsOfName[0].sourceField).toBe('Name'); // exact beats fuzzy
    });

    it('should respect a custom minConfidence', () => {
      const conservative = mapper.suggestFieldMappings(
        ['Emial'],
        [createMockField('Email')],
        { minConfidence: 0.95 },
      );
      expect(conservative).toHaveLength(0);
    });
  });

  describe('findUnmappedRequiredFields', () => {
    const targetFields: SObjectField[] = [
      { ...createMockField('LastName'), required: true },
      { ...createMockField('Email'), required: false },
      { ...createMockField('Industry'), required: true },
    ];

    it('should report required createable fields with no mapping', () => {
      const mappings: FieldMapping[] = [
        { sourceField: 'email', targetField: 'Email', required: false },
      ];
      const unmapped = mapper.findUnmappedRequiredFields(targetFields, mappings);
      expect(unmapped.map(f => f.name).sort()).toEqual(['Industry', 'LastName']);
    });

    it('should ignore required fields that are mapped', () => {
      const mappings: FieldMapping[] = [
        { sourceField: 'ln', targetField: 'LastName', required: true },
        { sourceField: 'ind', targetField: 'Industry', required: true },
      ];
      expect(mapper.findUnmappedRequiredFields(targetFields, mappings)).toHaveLength(0);
    });

    it('should treat an empty target as unmapped', () => {
      const mappings: FieldMapping[] = [
        { sourceField: 'ln', targetField: '', required: true },
      ];
      const unmapped = mapper.findUnmappedRequiredFields(targetFields, mappings);
      expect(unmapped.map(f => f.name)).toContain('LastName');
    });

    it('should not report non-createable required fields', () => {
      const fields: SObjectField[] = [
        { ...createMockField('Id'), required: true, createable: false },
      ];
      expect(mapper.findUnmappedRequiredFields(fields, [])).toHaveLength(0);
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
