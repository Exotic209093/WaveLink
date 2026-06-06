import { simulatePush, dryRunRowsToCsv } from '../../src/ui/utils/pushDryRun';
import type { SObjectField } from '../../src/core/types/salesforce';

function field(partial: Partial<SObjectField> & { name: string; type: SObjectField['type'] }): SObjectField {
  return {
    label: partial.name,
    length: 0,
    required: false,
    createable: true,
    updateable: true,
    nillable: true,
    defaultValue: null,
    externalId: false,
    relationshipName: null,
    ...partial,
  } as SObjectField;
}

const ACCOUNT_FIELDS: SObjectField[] = [
  field({ name: 'Id', type: 'id' }),
  field({ name: 'Name', type: 'string', length: 80, required: true, nillable: false }),
  field({ name: 'NumberOfEmployees', type: 'int' }),
  field({ name: 'Industry', type: 'picklist', picklistValues: [
    { value: 'Technology', label: 'Technology', active: true, defaultValue: false },
    { value: 'Finance', label: 'Finance', active: true, defaultValue: false },
  ] }),
];

describe('simulatePush', () => {
  it('reports all rows ok for a clean insert', () => {
    const records = [
      { Name: 'Acme', NumberOfEmployees: 10 },
      { Name: 'Globex', Industry: 'Technology' },
    ];
    const report = simulatePush(records, ACCOUNT_FIELDS, 'insert');
    expect(report.total).toBe(2);
    expect(report.ok).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.reasons).toHaveLength(0);
    expect(report.rows.every(r => r.status === 'ok')).toBe(true);
  });

  it('flags missing required fields on insert', () => {
    const records = [{ NumberOfEmployees: 5 }];
    const report = simulatePush(records, ACCOUNT_FIELDS, 'insert');
    expect(report.failed).toBe(1);
    expect(report.rows[0].status).toBe('error');
    expect(report.rows[0].reasons.join(' ')).toMatch(/Name/);
    // Reason messages must not leak the internal "Record N:" prefix.
    expect(report.rows[0].reasons.join(' ')).not.toMatch(/Record \d+:/);
  });

  it('flags invalid picklist and bad number values', () => {
    const records = [
      { Name: 'Acme', Industry: 'Aerospace' },
      { Name: 'Globex', NumberOfEmployees: 'lots' },
    ];
    const report = simulatePush(records, ACCOUNT_FIELDS, 'insert');
    expect(report.failed).toBe(2);
  });

  it('requires a well-formed Id for update', () => {
    const records = [
      { Id: '001000000000001AAA', Name: 'Acme' }, // valid 18-char
      { Id: 'not-an-id', Name: 'Globex' },         // malformed
      { Name: 'Initech' },                          // missing Id
    ];
    const report = simulatePush(records, ACCOUNT_FIELDS, 'update');
    expect(report.ok).toBe(1);
    expect(report.failed).toBe(2);
    expect(report.reasons.some(r => /Malformed Salesforce Id/.test(r.message))).toBe(true);
    expect(report.reasons.some(r => /Missing Id/.test(r.message))).toBe(true);
  });

  it('requires the chosen external Id value for upsert', () => {
    const fields = [...ACCOUNT_FIELDS, field({ name: 'ExtId__c', type: 'string', externalId: true, length: 40 })];
    const records = [
      { ExtId__c: 'A-1', Name: 'Acme' },
      { Name: 'Globex' }, // missing external id
    ];
    const report = simulatePush(records, fields, 'upsert', { externalIdField: 'ExtId__c' });
    expect(report.ok).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.reasons[0].message).toMatch(/external Id "ExtId__c"/);
  });

  it('groups identical reasons with counts sorted by frequency', () => {
    const records = [
      { NumberOfEmployees: 1 }, // missing Name
      { NumberOfEmployees: 2 }, // missing Name
      { Name: 'ok', Industry: 'Nope' }, // bad picklist
    ];
    const report = simulatePush(records, ACCOUNT_FIELDS, 'insert');
    expect(report.reasons[0].count).toBe(2); // missing-Name is most frequent
    expect(report.failed).toBe(3);
  });

  it('handles an empty dataset', () => {
    const report = simulatePush([], ACCOUNT_FIELDS, 'insert');
    expect(report).toEqual({ total: 0, ok: 0, failed: 0, rows: [], reasons: [] });
  });

  it('serializes per-row outcomes to CSV with 1-based row numbers', () => {
    const records = [{ Name: 'Acme' }, { NumberOfEmployees: 5 }];
    const report = simulatePush(records, ACCOUNT_FIELDS, 'insert');
    const csv = dryRunRowsToCsv(report);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('row,status,reasons');
    expect(lines[1]).toBe('1,ok,');
    expect(lines[2]).toMatch(/^2,error,/);
  });
});
