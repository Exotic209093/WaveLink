import {
  generateFieldValue,
  generateRecord,
  generateDataset,
} from '../../src/ui/utils/testDataGenerator';
import type { GeneratorConfig, RelationshipConfig } from '../../src/ui/utils/testDataGenerator';

/** Simple deterministic pseudo-random for tests. */
function deterministicRand(): () => number {
  let i = 0;
  return () => {
    i++;
    return ((i * 0.17) % 1 + 1) % 1; // always in [0, 1)
  };
}

describe('generateFieldValue', () => {
  describe('type-based generation', () => {
    it('should generate a string value for string field type', () => {
      const config: GeneratorConfig = { fieldName: 'Description', fieldType: 'string' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('string');
      expect((result as string).length).toBeGreaterThan(0);
    });

    it('should generate an email-like string for email field type', () => {
      const config: GeneratorConfig = { fieldName: 'Email', fieldType: 'email' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('string');
      expect(result as string).toContain('@');
    });

    it('should generate a boolean for boolean field type', () => {
      const config: GeneratorConfig = { fieldName: 'IsActive', fieldType: 'boolean' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('boolean');
    });

    it('should generate a string for phone field type', () => {
      const config: GeneratorConfig = { fieldName: 'Phone', fieldType: 'phone' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('string');
    });

    it('should generate a number for int field type', () => {
      const config: GeneratorConfig = { fieldName: 'Count', fieldType: 'int' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result)).toBe(true);
    });

    it('should generate a number for currency field type', () => {
      const config: GeneratorConfig = { fieldName: 'Amount', fieldType: 'currency' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('number');
    });

    it('should generate a date string for date field type', () => {
      const config: GeneratorConfig = { fieldName: 'StartDate', fieldType: 'date' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('string');
      // Date format: YYYY-MM-DD
      expect(result as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should generate an ISO datetime string for datetime field type', () => {
      const config: GeneratorConfig = { fieldName: 'CreatedDate', fieldType: 'datetime' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('string');
      expect(result as string).toContain('T');
    });

    it('should generate a URL string for url field type', () => {
      const config: GeneratorConfig = { fieldName: 'Website', fieldType: 'url' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('string');
      expect((result as string).startsWith('https://')).toBe(true);
    });
  });

  describe('override modes', () => {
    it('should return staticValue when override is static', () => {
      const config: GeneratorConfig = {
        fieldName: 'Status',
        fieldType: 'string',
        override: 'static',
        staticValue: 'Active',
      };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(result).toBe('Active');
    });

    it('should replace {rowIndex} in formula template', () => {
      const config: GeneratorConfig = {
        fieldName: 'Code',
        fieldType: 'string',
        override: 'formula',
        formulaTemplate: 'REC-{rowIndex}-X',
      };
      const result = generateFieldValue(config, 5, deterministicRand());
      expect(result).toBe('REC-5-X');
    });

    it('should replace multiple {rowIndex} occurrences in formula', () => {
      const config: GeneratorConfig = {
        fieldName: 'Code',
        fieldType: 'string',
        override: 'formula',
        formulaTemplate: '{rowIndex}-{rowIndex}',
      };
      const result = generateFieldValue(config, 3, deterministicRand());
      expect(result).toBe('3-3');
    });
  });

  describe('picklist', () => {
    it('should pick from picklistValues when field type is picklist', () => {
      const config: GeneratorConfig = {
        fieldName: 'Stage',
        fieldType: 'picklist',
        picklistValues: ['Open', 'Closed', 'Pending'],
      };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(['Open', 'Closed', 'Pending']).toContain(result);
    });

    it('should generate a fallback when picklistValues is empty', () => {
      const config: GeneratorConfig = {
        fieldName: 'Stage',
        fieldType: 'picklist',
        picklistValues: [],
      };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('string');
      expect((result as string).startsWith('Option')).toBe(true);
    });
  });

  describe('nullable fields', () => {
    it('should return null when nullable is true and rand is below nullRate', () => {
      // Create a rand that always returns a very low value to trigger null
      const alwaysLow = () => 0.01;
      const config: GeneratorConfig = {
        fieldName: 'Notes',
        fieldType: 'string',
        nullable: true,
        nullRate: 0.5,
      };
      const result = generateFieldValue(config, 0, alwaysLow);
      expect(result).toBeNull();
    });

    it('should not return null when rand is above nullRate', () => {
      // Create a rand that always returns a high value to skip null
      const alwaysHigh = () => 0.99;
      const config: GeneratorConfig = {
        fieldName: 'Notes',
        fieldType: 'string',
        nullable: true,
        nullRate: 0.5,
      };
      const result = generateFieldValue(config, 0, alwaysHigh);
      expect(result).not.toBeNull();
    });
  });

  describe('name-aware generation', () => {
    it('should generate a first name when fieldName is FirstName', () => {
      const config: GeneratorConfig = { fieldName: 'FirstName', fieldType: 'string' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('string');
      expect((result as string).length).toBeGreaterThan(0);
    });

    it('should generate a last name when fieldName is LastName', () => {
      const config: GeneratorConfig = { fieldName: 'LastName', fieldType: 'string' };
      const result = generateFieldValue(config, 0, deterministicRand());
      expect(typeof result).toBe('string');
      expect((result as string).length).toBeGreaterThan(0);
    });
  });
});

describe('generateRecord', () => {
  it('should return an object with all field names as keys', () => {
    const configs: GeneratorConfig[] = [
      { fieldName: 'Name', fieldType: 'string' },
      { fieldName: 'Email', fieldType: 'email' },
      { fieldName: 'IsActive', fieldType: 'boolean' },
    ];
    const record = generateRecord(configs, [], 0, deterministicRand());
    expect(record).toHaveProperty('Name');
    expect(record).toHaveProperty('Email');
    expect(record).toHaveProperty('IsActive');
  });

  it('should not include fields that return undefined (e.g., id type)', () => {
    const configs: GeneratorConfig[] = [
      { fieldName: 'Id', fieldType: 'id' },
      { fieldName: 'Name', fieldType: 'string' },
    ];
    const record = generateRecord(configs, [], 0, deterministicRand());
    expect(record).not.toHaveProperty('Id');
    expect(record).toHaveProperty('Name');
  });

  describe('relationships', () => {
    it('should assign lookupValues via round-robin', () => {
      const configs: GeneratorConfig[] = [
        { fieldName: 'Name', fieldType: 'string' },
      ];
      const relationships: RelationshipConfig[] = [
        { fieldName: 'AccountId', lookupValues: ['001A', '001B', '001C'] },
      ];

      const record0 = generateRecord(configs, relationships, 0, deterministicRand());
      const record1 = generateRecord(configs, relationships, 1, deterministicRand());
      const record2 = generateRecord(configs, relationships, 2, deterministicRand());
      const record3 = generateRecord(configs, relationships, 3, deterministicRand());

      expect(record0.AccountId).toBe('001A');
      expect(record1.AccountId).toBe('001B');
      expect(record2.AccountId).toBe('001C');
      expect(record3.AccountId).toBe('001A'); // wraps around
    });

    it('should not set relationship field when lookupValues is empty', () => {
      const configs: GeneratorConfig[] = [
        { fieldName: 'Name', fieldType: 'string' },
      ];
      const relationships: RelationshipConfig[] = [
        { fieldName: 'AccountId', lookupValues: [] },
      ];

      const record = generateRecord(configs, relationships, 0, deterministicRand());
      expect(record).not.toHaveProperty('AccountId');
    });
  });
});

describe('generateDataset', () => {
  const configs: GeneratorConfig[] = [
    { fieldName: 'Name', fieldType: 'string' },
    { fieldName: 'Email', fieldType: 'email' },
  ];

  it('should produce the correct number of records', () => {
    const dataset = generateDataset(configs, [], 10, 42);
    expect(dataset).toHaveLength(10);
  });

  it('should produce zero records when count is 0', () => {
    const dataset = generateDataset(configs, [], 0, 42);
    expect(dataset).toHaveLength(0);
  });

  it('should produce deterministic results with the same seed', () => {
    const dataset1 = generateDataset(configs, [], 5, 12345);
    const dataset2 = generateDataset(configs, [], 5, 12345);
    expect(dataset1).toEqual(dataset2);
  });

  it('should produce different results with different seeds', () => {
    const dataset1 = generateDataset(configs, [], 5, 111);
    const dataset2 = generateDataset(configs, [], 5, 222);
    // Very unlikely to be identical with different seeds
    const allSame = dataset1.every(
      (rec, i) => JSON.stringify(rec) === JSON.stringify(dataset2[i]),
    );
    expect(allSame).toBe(false);
  });

  it('should include relationship fields in generated records', () => {
    const relationships: RelationshipConfig[] = [
      { fieldName: 'OwnerId', lookupValues: ['005A', '005B'] },
    ];
    const dataset = generateDataset(configs, relationships, 4, 42);

    expect(dataset[0].OwnerId).toBe('005A');
    expect(dataset[1].OwnerId).toBe('005B');
    expect(dataset[2].OwnerId).toBe('005A');
    expect(dataset[3].OwnerId).toBe('005B');
  });

  it('should generate records with all configured fields', () => {
    const dataset = generateDataset(configs, [], 3, 42);
    for (const record of dataset) {
      expect(record).toHaveProperty('Name');
      expect(record).toHaveProperty('Email');
    }
  });
});
