import { buildSoql, formatSoqlValue, getOperatorsForFieldType, isDateLiteral, AGGREGATE_FUNCTIONS } from '../../src/ui/utils/soqlBuilder';
import type { QueryBuilderState, AggregateField } from '../../src/ui/utils/soqlBuilder';
import type { SalesforceFieldType } from '../../src/core/types/salesforce';

function baseState(overrides: Partial<QueryBuilderState> = {}): QueryBuilderState {
  return {
    objectName: 'Account',
    selectedFields: ['Id'],
    whereConditions: [],
    orderBy: null,
    limit: null,
    offset: null,
    ...overrides,
  };
}

describe('buildSoql', () => {
  it('returns empty string if no object', () => {
    expect(buildSoql(baseState({ objectName: '' }))).toBe('');
  });

  it('returns empty string if no fields and no aggregates', () => {
    expect(buildSoql(baseState({ selectedFields: [], aggregateFields: [] }))).toBe('');
  });

  it('builds basic SELECT FROM', () => {
    const state = baseState({ selectedFields: ['Id', 'Name'] });
    expect(buildSoql(state)).toBe('SELECT Id, Name\nFROM Account');
  });

  it('builds with WHERE clause', () => {
    const state = baseState({
      whereConditions: [
        { id: '1', field: 'Name', operator: '=', value: 'Acme', connector: 'AND' },
      ],
    });
    expect(buildSoql(state)).toBe("SELECT Id\nFROM Account\nWHERE Name = 'Acme'");
  });

  it('builds with multiple WHERE conditions and AND connector', () => {
    const ftMap = new Map<string, SalesforceFieldType>([
      ['Name', 'string'],
      ['Amount', 'currency'],
    ]);
    const state = baseState({
      objectName: 'Opportunity',
      selectedFields: ['Id', 'Name'],
      whereConditions: [
        { id: '1', field: 'Name', operator: 'LIKE', value: '%Acme%', connector: 'AND' },
        { id: '2', field: 'Amount', operator: '>', value: '100', connector: 'AND' },
      ],
    });
    const result = buildSoql(state, ftMap);
    expect(result).toContain("WHERE Name LIKE '%Acme%' AND Amount > 100");
  });

  it('builds with OR connector between conditions', () => {
    const state = baseState({
      whereConditions: [
        { id: '1', field: 'Name', operator: '=', value: 'Acme', connector: 'AND' },
        { id: '2', field: 'Name', operator: '=', value: 'Globex', connector: 'OR' },
      ],
    });
    const result = buildSoql(state);
    expect(result).toContain("WHERE Name = 'Acme' OR Name = 'Globex'");
  });

  it('builds with ORDER BY', () => {
    const state = baseState({
      selectedFields: ['Id', 'Name'],
      orderBy: { field: 'Name', direction: 'ASC' },
    });
    expect(buildSoql(state)).toContain('ORDER BY Name ASC');
  });

  it('builds with LIMIT', () => {
    const state = baseState({ limit: 50 });
    expect(buildSoql(state)).toContain('LIMIT 50');
  });

  it('builds with OFFSET', () => {
    const state = baseState({ limit: 50, offset: 100 });
    const result = buildSoql(state);
    expect(result).toContain('LIMIT 50');
    expect(result).toContain('OFFSET 100');
  });

  it('omits OFFSET when null or zero', () => {
    expect(buildSoql(baseState({ offset: null }))).not.toContain('OFFSET');
    expect(buildSoql(baseState({ offset: 0 }))).not.toContain('OFFSET');
  });

  it('builds full query with all clauses', () => {
    const state = baseState({
      objectName: 'Contact',
      selectedFields: ['Id', 'FirstName', 'LastName'],
      whereConditions: [
        { id: '1', field: 'LastName', operator: '!=', value: '', connector: 'AND' },
      ],
      orderBy: { field: 'LastName', direction: 'DESC' },
      limit: 200,
      offset: 50,
    });
    const result = buildSoql(state);
    expect(result).toContain('SELECT Id, FirstName, LastName');
    expect(result).toContain('FROM Contact');
    expect(result).toContain("WHERE LastName != ''");
    expect(result).toContain('ORDER BY LastName DESC');
    expect(result).toContain('LIMIT 200');
    expect(result).toContain('OFFSET 50');
  });

  it('builds IS NULL condition', () => {
    const state = baseState({
      whereConditions: [
        { id: '1', field: 'Email', operator: 'IS NULL', value: '', connector: 'AND' },
      ],
    });
    const result = buildSoql(state);
    expect(result).toContain('WHERE Email = NULL');
  });

  it('builds IS NOT NULL condition', () => {
    const state = baseState({
      whereConditions: [
        { id: '1', field: 'Email', operator: 'IS NOT NULL', value: '', connector: 'AND' },
      ],
    });
    const result = buildSoql(state);
    expect(result).toContain('WHERE Email != NULL');
  });

  it('skips conditions with empty field or operator', () => {
    const state = baseState({
      whereConditions: [
        { id: '1', field: '', operator: '=', value: 'x', connector: 'AND' },
        { id: '2', field: 'Name', operator: '' as any, value: 'x', connector: 'AND' },
      ],
    });
    const result = buildSoql(state);
    expect(result).not.toContain('WHERE');
  });

  // ── Aggregate Functions ──

  it('builds COUNT() aggregate', () => {
    const state = baseState({
      selectedFields: [],
      aggregateFields: [{ id: '1', fn: 'COUNT', field: '', alias: '' }],
    });
    const result = buildSoql(state);
    expect(result).toBe('SELECT COUNT()\nFROM Account');
  });

  it('builds SUM aggregate with alias', () => {
    const state = baseState({
      selectedFields: ['Name'],
      aggregateFields: [{ id: '1', fn: 'SUM', field: 'Amount', alias: 'total' }],
    });
    const result = buildSoql(state);
    expect(result).toContain('SELECT Name, SUM(Amount) total');
  });

  it('builds COUNT_DISTINCT aggregate', () => {
    const state = baseState({
      selectedFields: [],
      aggregateFields: [{ id: '1', fn: 'COUNT_DISTINCT', field: 'AccountId', alias: '' }],
    });
    const result = buildSoql(state);
    expect(result).toContain('COUNT_DISTINCT(AccountId)');
  });

  it('skips aggregate without required field', () => {
    const state = baseState({
      selectedFields: ['Id'],
      aggregateFields: [{ id: '1', fn: 'SUM', field: '', alias: '' }],
    });
    const result = buildSoql(state);
    expect(result).not.toContain('SUM');
  });

  it('builds multiple aggregates', () => {
    const state = baseState({
      selectedFields: ['StageName'],
      aggregateFields: [
        { id: '1', fn: 'COUNT', field: '', alias: 'cnt' },
        { id: '2', fn: 'AVG', field: 'Amount', alias: 'avgAmt' },
        { id: '3', fn: 'MAX', field: 'CloseDate', alias: '' },
      ],
      groupBy: ['StageName'],
    });
    const result = buildSoql(state);
    expect(result).toContain('COUNT() cnt');
    expect(result).toContain('AVG(Amount) avgAmt');
    expect(result).toContain('MAX(CloseDate)');
    expect(result).toContain('GROUP BY StageName');
  });

  // ── GROUP BY ──

  it('builds GROUP BY clause', () => {
    const state = baseState({
      selectedFields: ['StageName'],
      groupBy: ['StageName'],
    });
    const result = buildSoql(state);
    expect(result).toContain('GROUP BY StageName');
  });

  it('builds GROUP BY with multiple fields', () => {
    const state = baseState({
      selectedFields: ['StageName', 'Type'],
      groupBy: ['StageName', 'Type'],
    });
    const result = buildSoql(state);
    expect(result).toContain('GROUP BY StageName, Type');
  });

  it('omits GROUP BY when empty', () => {
    const state = baseState({ groupBy: [] });
    expect(buildSoql(state)).not.toContain('GROUP BY');
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

  it('returns 0 for non-numeric input on numeric type', () => {
    expect(formatSoqlValue('abc', 'int', '=')).toBe('0');
    expect(formatSoqlValue('', 'double', '=')).toBe('0');
  });

  it('returns boolean keywords', () => {
    expect(formatSoqlValue('true', 'boolean', '=')).toBe('true');
    expect(formatSoqlValue('false', 'boolean', '=')).toBe('false');
    expect(formatSoqlValue('invalid', 'boolean', '=')).toBe('false');
  });

  it('returns bare date for date types', () => {
    expect(formatSoqlValue('2025-01-15', 'date', '=')).toBe('2025-01-15');
  });

  it('returns NULL for empty date', () => {
    expect(formatSoqlValue('', 'date', '=')).toBe('NULL');
  });

  it('returns NULL for empty datetime', () => {
    expect(formatSoqlValue('', 'datetime', '=')).toBe('NULL');
  });

  it('normalizes datetime-local format (no seconds)', () => {
    expect(formatSoqlValue('2025-01-15T14:30', 'datetime', '=')).toBe('2025-01-15T14:30:00Z');
  });

  it('normalizes datetime without timezone (with seconds)', () => {
    expect(formatSoqlValue('2025-01-15T14:30:45', 'datetime', '=')).toBe('2025-01-15T14:30:45Z');
  });

  it('passes through already-valid datetime', () => {
    expect(formatSoqlValue('2025-01-15T14:30:00Z', 'datetime', '=')).toBe('2025-01-15T14:30:00Z');
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

  it('handles empty IN value gracefully', () => {
    expect(formatSoqlValue('', 'string', 'IN')).toBe('()');
  });

  // ── Date Literals ──

  it('passes through simple date literals for date type', () => {
    expect(formatSoqlValue('TODAY', 'date', '=')).toBe('TODAY');
    expect(formatSoqlValue('YESTERDAY', 'date', '<')).toBe('YESTERDAY');
    expect(formatSoqlValue('THIS_QUARTER', 'date', '>=')).toBe('THIS_QUARTER');
  });

  it('passes through parameterized date literals', () => {
    expect(formatSoqlValue('LAST_N_DAYS:30', 'date', '>=')).toBe('LAST_N_DAYS:30');
    expect(formatSoqlValue('NEXT_N_MONTHS:6', 'datetime', '<=')).toBe('NEXT_N_MONTHS:6');
  });

  it('passes through date literals for datetime type', () => {
    expect(formatSoqlValue('TODAY', 'datetime', '=')).toBe('TODAY');
    expect(formatSoqlValue('LAST_90_DAYS', 'datetime', '>=')).toBe('LAST_90_DAYS');
  });

  it('is case-insensitive for date literals', () => {
    expect(formatSoqlValue('today', 'date', '=')).toBe('TODAY');
    expect(formatSoqlValue('Last_N_Days:7', 'date', '>=')).toBe('LAST_N_DAYS:7');
  });
});

describe('isDateLiteral', () => {
  it('recognizes simple date literals', () => {
    expect(isDateLiteral('TODAY')).toBe(true);
    expect(isDateLiteral('YESTERDAY')).toBe(true);
    expect(isDateLiteral('THIS_QUARTER')).toBe(true);
    expect(isDateLiteral('LAST_YEAR')).toBe(true);
    expect(isDateLiteral('NEXT_90_DAYS')).toBe(true);
  });

  it('recognizes parameterized date literals', () => {
    expect(isDateLiteral('LAST_N_DAYS:30')).toBe(true);
    expect(isDateLiteral('NEXT_N_MONTHS:6')).toBe(true);
    expect(isDateLiteral('LAST_N_QUARTERS:4')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isDateLiteral('today')).toBe(true);
    expect(isDateLiteral('last_n_days:7')).toBe(true);
  });

  it('rejects non-literals', () => {
    expect(isDateLiteral('2025-01-15')).toBe(false);
    expect(isDateLiteral('RANDOM_THING')).toBe(false);
    expect(isDateLiteral('')).toBe(false);
    expect(isDateLiteral('Account')).toBe(false);
  });
});

describe('AGGREGATE_FUNCTIONS', () => {
  it('contains expected functions', () => {
    expect(AGGREGATE_FUNCTIONS).toContain('COUNT');
    expect(AGGREGATE_FUNCTIONS).toContain('COUNT_DISTINCT');
    expect(AGGREGATE_FUNCTIONS).toContain('SUM');
    expect(AGGREGATE_FUNCTIONS).toContain('AVG');
    expect(AGGREGATE_FUNCTIONS).toContain('MIN');
    expect(AGGREGATE_FUNCTIONS).toContain('MAX');
  });
});

describe('getOperatorsForFieldType', () => {
  it('boolean has =, !=, and NULL operators', () => {
    const ops = getOperatorsForFieldType('boolean');
    expect(ops).toContain('=');
    expect(ops).toContain('!=');
    expect(ops).toContain('IS NULL');
    expect(ops).toContain('IS NOT NULL');
    expect(ops).not.toContain('LIKE');
  });

  it('picklist does NOT include INCLUDES/EXCLUDES (only multipicklist does)', () => {
    const ops = getOperatorsForFieldType('picklist');
    expect(ops).not.toContain('INCLUDES');
    expect(ops).not.toContain('EXCLUDES');
    expect(ops).toContain('IN');
    expect(ops).toContain('NOT IN');
  });

  it('multipicklist includes INCLUDES/EXCLUDES', () => {
    const ops = getOperatorsForFieldType('multipicklist');
    expect(ops).toContain('INCLUDES');
    expect(ops).toContain('EXCLUDES');
  });

  it('numeric includes comparison operators and NULL', () => {
    const ops = getOperatorsForFieldType('int');
    expect(ops).toContain('<');
    expect(ops).toContain('>');
    expect(ops).toContain('<=');
    expect(ops).toContain('>=');
    expect(ops).toContain('IS NULL');
  });

  it('string includes LIKE and NULL operators', () => {
    const ops = getOperatorsForFieldType('string');
    expect(ops).toContain('LIKE');
    expect(ops).toContain('IS NULL');
    expect(ops).toContain('IS NOT NULL');
  });

  it('reference includes IN/NOT IN', () => {
    const ops = getOperatorsForFieldType('reference');
    expect(ops).toContain('IN');
    expect(ops).toContain('NOT IN');
  });

  it('encryptedstring only has =, !=, and NULL operators (no LIKE)', () => {
    const ops = getOperatorsForFieldType('encryptedstring');
    expect(ops).toContain('=');
    expect(ops).toContain('!=');
    expect(ops).toContain('IS NULL');
    expect(ops).not.toContain('LIKE');
    expect(ops).not.toContain('IN');
  });

  it('all field types include NULL operators', () => {
    const types: SalesforceFieldType[] = [
      'string', 'boolean', 'int', 'double', 'date', 'datetime',
      'id', 'reference', 'picklist', 'multipicklist', 'currency',
    ];
    for (const t of types) {
      const ops = getOperatorsForFieldType(t);
      expect(ops).toContain('IS NULL');
      expect(ops).toContain('IS NOT NULL');
    }
  });
});
