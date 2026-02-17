import type { DataTemplate, FieldMapping } from '../../src/core/types/storage';

describe('DataTemplate type', () => {
  describe('structure', () => {
    it('should create a valid DataTemplate object with required fields', () => {
      const template: DataTemplate = {
        id: 'tmpl-1',
        name: 'Contact Template',
        description: 'Standard contact data template',
        objectName: 'Contact',
        fieldMappings: [],
        sampleData: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(template.id).toBe('tmpl-1');
      expect(template.name).toBe('Contact Template');
      expect(template.description).toBe('Standard contact data template');
      expect(template.objectName).toBe('Contact');
      expect(Array.isArray(template.fieldMappings)).toBe(true);
      expect(Array.isArray(template.sampleData)).toBe(true);
      expect(typeof template.createdAt).toBe('number');
      expect(typeof template.updatedAt).toBe('number');
    });

    it('should allow optional fields to be undefined', () => {
      const template: DataTemplate = {
        id: 'tmpl-2',
        name: 'Minimal Template',
        description: '',
        objectName: 'Account',
        fieldMappings: [],
        sampleData: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(template.category).toBeUndefined();
      expect(template.usageCount).toBeUndefined();
      expect(template.lastUsedAt).toBeUndefined();
    });
  });

  describe('optional fields', () => {
    it('should support category field', () => {
      const template: DataTemplate = {
        id: 'tmpl-cat',
        name: 'Categorized Template',
        description: 'A template with a category',
        objectName: 'Lead',
        fieldMappings: [],
        sampleData: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'Sales',
      };

      expect(template.category).toBe('Sales');
    });

    it('should support usageCount field', () => {
      const template: DataTemplate = {
        id: 'tmpl-usage',
        name: 'Used Template',
        description: 'A frequently used template',
        objectName: 'Opportunity',
        fieldMappings: [],
        sampleData: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 42,
      };

      expect(template.usageCount).toBe(42);
    });

    it('should support lastUsedAt field', () => {
      const now = Date.now();
      const template: DataTemplate = {
        id: 'tmpl-last',
        name: 'Recently Used Template',
        description: 'A recently used template',
        objectName: 'Case',
        fieldMappings: [],
        sampleData: [],
        createdAt: now - 100000,
        updatedAt: now - 50000,
        lastUsedAt: now,
      };

      expect(template.lastUsedAt).toBe(now);
      expect(template.lastUsedAt).toBeGreaterThan(template.createdAt);
    });

    it('should support all optional fields together', () => {
      const template: DataTemplate = {
        id: 'tmpl-full',
        name: 'Full Template',
        description: 'A template with all optional fields',
        objectName: 'Account',
        fieldMappings: [],
        sampleData: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'Marketing',
        usageCount: 15,
        lastUsedAt: Date.now(),
      };

      expect(template.category).toBe('Marketing');
      expect(template.usageCount).toBe(15);
      expect(typeof template.lastUsedAt).toBe('number');
    });
  });

  describe('fieldMappings', () => {
    it('should support an array of FieldMapping objects', () => {
      const mappings: FieldMapping[] = [
        {
          sourceField: 'first_name',
          targetField: 'FirstName',
          transformation: 'trim',
          required: true,
        },
        {
          sourceField: 'email_address',
          targetField: 'Email',
          transformation: 'lowercase',
          required: true,
        },
        {
          sourceField: 'notes',
          targetField: 'Description',
          required: false,
          defaultValue: 'N/A',
        },
      ];

      const template: DataTemplate = {
        id: 'tmpl-mappings',
        name: 'Mapped Template',
        description: 'A template with field mappings',
        objectName: 'Contact',
        fieldMappings: mappings,
        sampleData: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(template.fieldMappings).toHaveLength(3);
      expect(template.fieldMappings[0].sourceField).toBe('first_name');
      expect(template.fieldMappings[0].targetField).toBe('FirstName');
      expect(template.fieldMappings[0].transformation).toBe('trim');
      expect(template.fieldMappings[0].required).toBe(true);
    });

    it('should support FieldMapping with defaultValue', () => {
      const mapping: FieldMapping = {
        sourceField: 'status',
        targetField: 'Status__c',
        required: false,
        defaultValue: 'New',
      };

      expect(mapping.defaultValue).toBe('New');
      expect(mapping.transformation).toBeUndefined();
    });

    it('should support all transformation types', () => {
      const transformations = [
        'none', 'uppercase', 'lowercase', 'trim',
        'date_format', 'number_format', 'boolean_parse',
        'lookup_resolve', 'custom',
      ] as const;

      const mappings: FieldMapping[] = transformations.map((t, i) => ({
        sourceField: `source_${i}`,
        targetField: `Target_${i}`,
        transformation: t,
        required: false,
      }));

      expect(mappings).toHaveLength(9);
      mappings.forEach((m, i) => {
        expect(m.transformation).toBe(transformations[i]);
      });
    });
  });

  describe('sampleData', () => {
    it('should support an array of record objects', () => {
      const template: DataTemplate = {
        id: 'tmpl-sample',
        name: 'Sample Data Template',
        description: 'A template with sample data',
        objectName: 'Contact',
        fieldMappings: [
          { sourceField: 'name', targetField: 'Name', required: true },
          { sourceField: 'email', targetField: 'Email', required: true },
        ],
        sampleData: [
          { Name: 'John Doe', Email: 'john@example.com' },
          { Name: 'Jane Smith', Email: 'jane@example.com' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(template.sampleData).toHaveLength(2);
      expect(template.sampleData[0]).toHaveProperty('Name', 'John Doe');
      expect(template.sampleData[1]).toHaveProperty('Email', 'jane@example.com');
    });
  });
});
