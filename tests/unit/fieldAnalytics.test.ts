import {
  buildAnalyticsQuery,
  computeFieldMetrics,
  generateRecommendations,
} from '../../src/ui/utils/fieldAnalytics';
import type { FieldMetrics } from '../../src/ui/utils/fieldAnalytics';

describe('buildAnalyticsQuery', () => {
  it('returns valid SOQL with selected fields', () => {
    const fields = [
      { name: 'Name', type: 'string' },
      { name: 'Industry', type: 'picklist' },
    ];
    const query = buildAnalyticsQuery('Account', fields, 100);

    expect(query).toBe('SELECT Name, Industry FROM Account LIMIT 100');
  });

  it('skips system fields (Id, CreatedDate, LastModifiedDate, SystemModstamp, IsDeleted)', () => {
    const fields = [
      { name: 'Id', type: 'id' },
      { name: 'CreatedDate', type: 'datetime' },
      { name: 'LastModifiedDate', type: 'datetime' },
      { name: 'SystemModstamp', type: 'datetime' },
      { name: 'IsDeleted', type: 'boolean' },
      { name: 'Name', type: 'string' },
    ];
    const query = buildAnalyticsQuery('Account', fields, 50);

    expect(query).toBe('SELECT Name FROM Account LIMIT 50');
    expect(query).not.toContain('Id');
    expect(query).not.toContain('CreatedDate');
    expect(query).not.toContain('LastModifiedDate');
    expect(query).not.toContain('SystemModstamp');
    expect(query).not.toContain('IsDeleted');
  });

  it('returns empty string when all fields are system fields', () => {
    const fields = [
      { name: 'Id', type: 'id' },
      { name: 'CreatedDate', type: 'datetime' },
    ];
    const query = buildAnalyticsQuery('Account', fields, 100);
    expect(query).toBe('');
  });

  it('returns empty string for empty fields array', () => {
    const query = buildAnalyticsQuery('Account', [], 100);
    expect(query).toBe('');
  });
});

describe('computeFieldMetrics', () => {
  it('returns populationRate of 1 for a fully populated field', () => {
    const records = [
      { Name: 'Alice' },
      { Name: 'Bob' },
      { Name: 'Carol' },
    ];
    const metrics = computeFieldMetrics(records, { name: 'Name', type: 'string' });

    expect(metrics.populationRate).toBe(1);
    expect(metrics.fieldName).toBe('Name');
    expect(metrics.fieldType).toBe('string');
  });

  it('returns populationRate of 0 for a completely empty field', () => {
    const records = [
      { Name: null },
      { Name: undefined },
      { Name: '' },
    ];
    const metrics = computeFieldMetrics(records, { name: 'Name', type: 'string' });

    expect(metrics.populationRate).toBe(0);
  });

  it('returns correct populationRate for mixed population', () => {
    const records = [
      { Status: 'Active' },
      { Status: null },
      { Status: 'Inactive' },
      { Status: '' },
    ];
    const metrics = computeFieldMetrics(records, { name: 'Status', type: 'string' });

    expect(metrics.populationRate).toBe(0.5); // 2 out of 4
  });

  it('returns uniqueRate of 1 when all populated values are unique', () => {
    const records = [
      { Email: 'a@test.com' },
      { Email: 'b@test.com' },
      { Email: 'c@test.com' },
    ];
    const metrics = computeFieldMetrics(records, { name: 'Email', type: 'string' });

    expect(metrics.uniqueRate).toBe(1);
    expect(metrics.distinctCount).toBe(3);
  });

  it('returns uniqueRate less than 1 when there are duplicates', () => {
    const records = [
      { Status: 'Active' },
      { Status: 'Active' },
      { Status: 'Inactive' },
      { Status: 'Active' },
    ];
    const metrics = computeFieldMetrics(records, { name: 'Status', type: 'string' });

    expect(metrics.uniqueRate).toBe(0.5); // 2 distinct / 4 populated
    expect(metrics.distinctCount).toBe(2);
  });

  it('returns sampleValues with at most 5 items', () => {
    const records = Array.from({ length: 20 }, (_, i) => ({ Val: `value_${i}` }));
    const metrics = computeFieldMetrics(records, { name: 'Val', type: 'string' });

    expect(metrics.sampleValues.length).toBeLessThanOrEqual(5);
  });

  it('returns uniqueRate of 0 when field is completely empty', () => {
    const records = [{ Name: null }, { Name: null }];
    const metrics = computeFieldMetrics(records, { name: 'Name', type: 'string' });

    expect(metrics.uniqueRate).toBe(0);
  });
});

describe('generateRecommendations', () => {
  it('triggers recommendation for low population field (< 10%)', () => {
    const metrics: FieldMetrics[] = [
      {
        fieldName: 'Fax',
        fieldType: 'string',
        populationRate: 0.05,
        uniqueRate: 0.5,
        distinctCount: 3,
        sampleValues: ['123'],
      },
    ];
    const recs = generateRecommendations(metrics);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(r => r.includes('Fax') && r.includes('population'))).toBe(true);
  });

  it('triggers recommendation for completely empty field', () => {
    const metrics: FieldMetrics[] = [
      {
        fieldName: 'LegacyId',
        fieldType: 'string',
        populationRate: 0,
        uniqueRate: 0,
        distinctCount: 0,
        sampleValues: [],
      },
    ];
    const recs = generateRecommendations(metrics);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(r => r.includes('LegacyId') && r.includes('empty'))).toBe(true);
  });

  it('triggers external ID recommendation for all unique field with many values', () => {
    const metrics: FieldMetrics[] = [
      {
        fieldName: 'ExternalCode',
        fieldType: 'string',
        populationRate: 1,
        uniqueRate: 1,
        distinctCount: 50,
        sampleValues: ['A1', 'A2', 'A3'],
      },
    ];
    const recs = generateRecommendations(metrics);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(r => r.includes('ExternalCode') && r.includes('external ID'))).toBe(true);
  });

  it('triggers picklist recommendation for few distinct values', () => {
    const metrics: FieldMetrics[] = [
      {
        fieldName: 'Region',
        fieldType: 'string',
        populationRate: 1,
        uniqueRate: 0.03,
        distinctCount: 3,
        sampleValues: ['East', 'West', 'Central'],
      },
    ];
    const recs = generateRecommendations(metrics);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(r => r.includes('Region') && r.includes('picklist'))).toBe(true);
  });

  it('produces no recommendations for a normal, healthy field', () => {
    const metrics: FieldMetrics[] = [
      {
        fieldName: 'Name',
        fieldType: 'string',
        populationRate: 0.95,
        uniqueRate: 0.8,
        distinctCount: 80,
        sampleValues: ['Alice', 'Bob', 'Carol'],
      },
    ];
    const recs = generateRecommendations(metrics);

    expect(recs).toHaveLength(0);
  });
});
