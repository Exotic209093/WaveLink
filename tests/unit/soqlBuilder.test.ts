import { buildSoql, formatSoqlValue, getOperatorsForFieldType } from '../../src/ui/utils/soqlBuilder';
import type { QueryBuilderState } from '../../src/ui/utils/soqlBuilder';
import type { SalesforceFieldType } from '../../src/core/types/salesforce';

describe('buildSoql', () => {
  it('returns empty string if no object', () => {
    const state: QueryBuilderState = {
      objectName: '',
      selectedFields: ['Id'],
      whereConditions: [],
      orderBy: null,
      limit: null,
    };
    expect(buildSoql(state)).toBe('');
  });

  it('returns empty string if no fields', () => {
    const state: QueryBuilderState = {
      objectName: 'Account',
      selectedFields: [],
      whereConditions: [],
      orderBy: null,
      limit: null,
    };
    expect(buildSoql(state)).toBe('');
  });

  it('builds basic SELECT FROM', () => {
    const state: QueryBuilderState = {
      objectName: 'Account',
      selectedFields: ['Id', 'Name'],
      whereConditions: [],
      orderBy: null,
      limit: null,
    };
    expect(buildSoql(state)).toBe('SELECT Id, Name\nFROM Account');
  });

  it('builds with WHERE clause', () => {
    const state: QueryBuilderState = {
      objectName: 'Account',
      selectedFields: ['Id'],
      whereConditions: [
        { id: '1', field: 'Name', operator: '=', value: 'Acme', connector: 'AND' },
      ],
      orderBy: null,
      limit: null,
    };
    expect(buildSoql(state)).toBe("SELECT Id\nFROM Account\nWHERE Name = 'Acme'");
  });

  it('builds with multiple WHERE conditions', () => {
    const ftMap = new Map<string, SalesforceFieldType>([
      ['Name', 'string'],
      ['Amount', 'currency'],
    ]);
    const state: QueryBuilderState = {
      objectName: 'Opportunity',
      selectedFields: ['Id', 'Name'],
      whereConditions: [
        { id: '1', field: 'Name', operator: 'LIKE', value: '%Acme%', connector: 'AND' },
        { id: '2', field: 'Amount', operator: '>', value: '100', connector: 'AND' },
      ],
      orderBy: null,
      limit: null,
    };
    const result = buildSoql(state, ftMap);
    expect(result).toContain("WHERE Name LIKE '%Acme%' AND Amount > 100");
  });

  it('builds with ORDER BY', () => {
    const state: QueryBuilderState = {
      objectName: 'Account',
      selectedFields: ['Id', 'Name'],
      whereConditions: [],
      orderBy: { field: 'Name', direction: 'ASC' },
      limit: null,
    };
    expect(buildSoql(state)).toContain('ORDER BY Name ASC');
  });

  it('builds with LIMIT', () => {
    const state: QueryBuilderState = {
      objectName: 'Account',
      selectedFields: ['Id'],
      whereConditions: [],
      orderBy: null,
      limit: 50,
    };
    expect(buildSoql(state)).toContain('LIMIT 50');
  });

  it('builds full query with all clauses', () => {
    const state: QueryBuilderState = {
      objectName: 'Contact',
      selectedFields: ['Id', 'FirstName', 'LastName'],
      whereConditions: [
        { id: '1', field: 'LastName', operator: '!=', value: '', connector: 'AND' },
      ],
      orderBy: { field: 'LastName', direction: 'DESC' },
      limit: 200,
    };
    const result = buildSoql(state);
    expect(result).toContain('SELECT Id, FirstName, LastName');
    expect(result).toContain('FROM Contact');
    expect(result).toContain("WHERE LastName != ''");
    expect(result).toContain('ORDER BY LastName DESC');
    expect(result).toContain('LIMIT 200');
  });
});

describe('formatSoqlValue', () => {
  it('wraps string in quotes', () => {
    expect(formatSoqlValue('hello', 'string', '=')).toBe("'hello'");
  });

  it('escapes single quotes in string', () => {
    expect(formatSoqlValue("O'Brien", 'string', '=')).toBe("'O\\'Brien'");
  });

  it('returns bare number for numeric types', () => {
    expect(formatSoqlValue('42', 'int', '=')).toBe('42');
    expect(formatSoqlValue('3.14', 'double', '>')).toBe('3.14');
    expect(formatSoqlValue('100', 'currency', '<=')).toBe('100');
  });

  it('returns boolean keywords', () => {
    expect(formatSoqlValue('true', 'boolean', '=')).toBe('true');
    expect(formatSoqlValue('false', 'boolean', '=')).toBe('false');
  });

  it('returns bare date for date types', () => {
    expect(formatSoqlValue('2025-01-15', 'date', '=')).toBe('2025-01-15');
  });

  it('formats IN operator with quoted items', () => {
    expect(formatSoqlValue('a, b, c', 'string', 'IN')).toBe("('a', 'b', 'c')");
  });

  it('formats IN operator with bare numbers', () => {
    expect(formatSoqlValue('1, 2, 3', 'int', 'IN')).toBe('(1, 2, 3)');
  });

  it('formats INCLUDES with semicolons', () => {
    expect(formatSoqlValue('Red;Blue', 'multipicklist', 'INCLUDES')).toBe("('Red', 'Blue')");
  });
});

describe('getOperatorsForFieldType', () => {
  it('boolean only has = and !=', () => {
    const ops = getOperatorsForFieldType('boolean');
    expect(ops).toEqual(['=', '!=']);
  });

  it('picklist includes INCLUDES/EXCLUDES', () => {
    const ops = getOperatorsForFieldType('picklist');
    expect(ops).toContain('INCLUDES');
    expect(ops).toContain('EXCLUDES');
  });

  it('numeric includes comparison operators', () => {
    const ops = getOperatorsForFieldType('int');
    expect(ops).toContain('<');
    expect(ops).toContain('>');
    expect(ops).toContain('<=');
    expect(ops).toContain('>=');
  });

  it('string includes LIKE', () => {
    const ops = getOperatorsForFieldType('string');
    expect(ops).toContain('LIKE');
  });

  it('reference includes IN/NOT IN', () => {
    const ops = getOperatorsForFieldType('reference');
    expect(ops).toContain('IN');
    expect(ops).toContain('NOT IN');
  });
});
