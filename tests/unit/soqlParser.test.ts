import { parseSoqlContext, extractFromObject } from '../../src/ui/utils/soqlParser';

describe('extractFromObject', () => {
  it('extracts object from simple query', () => {
    expect(extractFromObject('SELECT Id FROM Account')).toBe('Account');
  });

  it('extracts object case-insensitively', () => {
    expect(extractFromObject('select Id from Contact where Name = \'x\'')).toBe('Contact');
  });

  it('returns null when no FROM clause', () => {
    expect(extractFromObject('SELECT Id')).toBeNull();
  });

  it('extracts custom object', () => {
    expect(extractFromObject('SELECT Id FROM My_Custom__c')).toBe('My_Custom__c');
  });
});

describe('parseSoqlContext', () => {
  it('detects SELECT clause with partial token', () => {
    const soql = 'SELECT Id, Na';
    const ctx = parseSoqlContext(soql, soql.length);
    expect(ctx.clause).toBe('SELECT');
    expect(ctx.partialToken).toBe('Na');
  });

  it('detects FROM clause with partial token', () => {
    const soql = 'SELECT Id, Name FROM Acc';
    const ctx = parseSoqlContext(soql, soql.length);
    expect(ctx.clause).toBe('FROM');
    expect(ctx.partialToken).toBe('Acc');
  });

  it('detects WHERE clause — field position', () => {
    const soql = 'SELECT Id FROM Account WHERE Na';
    const ctx = parseSoqlContext(soql, soql.length);
    expect(ctx.clause).toBe('WHERE');
    expect(ctx.partialToken).toBe('Na');
    expect(ctx.fromObject).toBe('Account');
    expect(ctx.whereField).toBeNull();
  });

  it('detects WHERE clause — value position after =', () => {
    const soql = 'SELECT Id FROM Account WHERE Name = ';
    const ctx = parseSoqlContext(soql, soql.length);
    expect(ctx.clause).toBe('WHERE');
    expect(ctx.precedingToken).toBe('=');
    expect(ctx.whereField).toBe('Name');
    expect(ctx.partialToken).toBe('');
  });

  it('detects WHERE clause — value position after LIKE', () => {
    const soql = 'SELECT Id FROM Account WHERE Name LIKE te';
    const ctx = parseSoqlContext(soql, soql.length);
    expect(ctx.clause).toBe('WHERE');
    expect(ctx.partialToken).toBe('te');
    expect(ctx.precedingToken).toBe('LIKE');
    expect(ctx.whereField).toBe('Name');
  });

  it('detects WHERE after AND connector — field position', () => {
    const soql = "SELECT Id FROM Account WHERE Name = 'test' AND ";
    const ctx = parseSoqlContext(soql, soql.length);
    expect(ctx.clause).toBe('WHERE');
    expect(ctx.partialToken).toBe('');
    expect(ctx.precedingToken).toBe('AND');
    expect(ctx.whereField).toBeNull();
  });

  it('detects ORDER BY clause', () => {
    const soql = 'SELECT Id FROM Account ORDER BY Na';
    const ctx = parseSoqlContext(soql, soql.length);
    expect(ctx.clause).toBe('ORDER_BY');
    expect(ctx.partialToken).toBe('Na');
  });

  it('detects LIMIT clause', () => {
    const soql = 'SELECT Id FROM Account LIMIT ';
    const ctx = parseSoqlContext(soql, soql.length);
    expect(ctx.clause).toBe('LIMIT');
    expect(ctx.partialToken).toBe('');
  });

  it('handles empty string', () => {
    const ctx = parseSoqlContext('', 0);
    expect(ctx.clause).toBe('UNKNOWN');
    expect(ctx.partialToken).toBe('');
    expect(ctx.fromObject).toBeNull();
  });

  it('detects cursor mid-query', () => {
    const soql = 'SELECT Id, Name FROM Account WHERE Name = \'x\'';
    // Cursor at position after "SELECT Id, "
    const ctx = parseSoqlContext(soql, 11);
    expect(ctx.clause).toBe('SELECT');
  });

  it('extracts fromObject from full query even with cursor before FROM', () => {
    const soql = 'SELECT Na FROM Account';
    const ctx = parseSoqlContext(soql, 9); // cursor at "Na"
    expect(ctx.fromObject).toBe('Account');
    expect(ctx.partialToken).toBe('Na');
  });
});
