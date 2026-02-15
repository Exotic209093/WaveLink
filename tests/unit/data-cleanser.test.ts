import { cleanseRecords } from '../../src/ui/utils/cleanse';
import { DataMapper } from '../../src/data/mappers';
import { DataValidator } from '../../src/data/validators';
import type { SObjectField } from '../../src/core/types/salesforce';

function field(name: string, opts: Partial<SObjectField> = {}): SObjectField {
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
    ...opts,
  };
}

describe('Data Cleanser', () => {
  it('should rename, drop and transform columns', () => {
    const records = [
      { Name: '  acme  ', Active__c: 'yes', Amount__c: '12.5', Ignored__c: 'x' },
    ];

    const { cleanedRecords, cleanedHeaders } = cleanseRecords(records, [
      { source: 'Name', renameTo: 'Name', drop: false, transform: 'trim' },
      { source: 'Active__c', renameTo: 'IsActive__c', drop: false, transform: 'boolean_parse' },
      { source: 'Amount__c', renameTo: 'Amount__c', drop: false, transform: 'number_format' },
      { source: 'Ignored__c', renameTo: 'Ignored__c', drop: true, transform: 'none' },
    ]);

    expect(cleanedHeaders).toEqual(['Name', 'IsActive__c', 'Amount__c']);
    expect(cleanedRecords[0]).toEqual({ Name: 'acme', IsActive__c: true, Amount__c: 12.5 });
  });

  it('auto-map should match fields by name ignoring case/underscores', () => {
    const mapper = new DataMapper();
    const mappings = mapper.autoMapFields(
      ['first_name', 'LASTNAME', 'Email'],
      [
        field('FirstName', { required: false }),
        field('LastName', { required: true }),
        field('Email', { required: false, type: 'email' }),
      ],
    );

    const asMap = new Map(mappings.map(m => [m.sourceField, m.targetField]));
    expect(asMap.get('first_name')).toBe('FirstName');
    expect(asMap.get('LASTNAME')).toBe('LastName');
    expect(asMap.get('Email')).toBe('Email');
  });

  it('validator should flag unknown fields and missing required fields', () => {
    const validator = new DataValidator();
    const fields: SObjectField[] = [
      field('Name', { required: true, nillable: false }),
      field('Email', { type: 'email' }),
    ];

    const result = validator.validateRecords(
      [
        { Email: 'not-an-email', Unknown__c: 'x' },
      ],
      fields,
      'insert',
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'Unknown__c')).toBe(true);
    expect(result.errors.some(e => e.field === 'Name')).toBe(true);
    expect(result.errors.some(e => e.field === 'Email')).toBe(true);
  });
});

