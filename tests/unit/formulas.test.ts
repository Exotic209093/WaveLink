import {
  interpolate,
  extractTokens,
  evaluateCondition,
  applyConditionalRule,
} from '../../src/ui/utils/formulas';

describe('interpolate', () => {
  it('should replace a simple token with the record value', () => {
    const result = interpolate('Hello {Name}', { Name: 'World' });
    expect(result).toBe('Hello World');
  });

  it('should replace multiple tokens', () => {
    const result = interpolate('{First} {Last}', { First: 'John', Last: 'Doe' });
    expect(result).toBe('John Doe');
  });

  it('should replace missing fields with empty string', () => {
    const result = interpolate('Hello {Name}', {});
    expect(result).toBe('Hello ');
  });

  it('should handle null values as empty string', () => {
    const result = interpolate('Value: {Field}', { Field: null });
    expect(result).toBe('Value: ');
  });

  it('should handle undefined values as empty string', () => {
    const result = interpolate('Value: {Field}', { Field: undefined });
    expect(result).toBe('Value: ');
  });

  it('should return template unchanged when no tokens present', () => {
    const result = interpolate('No tokens here', { Name: 'Test' });
    expect(result).toBe('No tokens here');
  });

  it('should convert numeric values to string', () => {
    const result = interpolate('Count: {Num}', { Num: 42 });
    expect(result).toBe('Count: 42');
  });

  it('should trim whitespace in token names', () => {
    const result = interpolate('{ Name }', { Name: 'Trimmed' });
    expect(result).toBe('Trimmed');
  });
});

describe('extractTokens', () => {
  it('should extract multiple tokens', () => {
    const tokens = extractTokens('{First} and {Last}');
    expect(tokens).toEqual(['First', 'Last']);
  });

  it('should return empty array for empty template', () => {
    const tokens = extractTokens('');
    expect(tokens).toEqual([]);
  });

  it('should return empty array when no tokens present', () => {
    const tokens = extractTokens('No tokens here');
    expect(tokens).toEqual([]);
  });

  it('should trim whitespace in token names', () => {
    const tokens = extractTokens('{ First } and { Last }');
    expect(tokens).toEqual(['First', 'Last']);
  });

  it('should extract a single token', () => {
    const tokens = extractTokens('Hello {Name}');
    expect(tokens).toEqual(['Name']);
  });

  it('should extract duplicate tokens', () => {
    const tokens = extractTokens('{Name} is {Name}');
    expect(tokens).toEqual(['Name', 'Name']);
  });
});

describe('evaluateCondition', () => {
  describe('eq operator', () => {
    it('should return true when values are equal', () => {
      const result = evaluateCondition(
        { Status: 'Active' },
        { field: 'Status', operator: 'eq', value: 'Active' },
      );
      expect(result).toBe(true);
    });

    it('should return false when values are not equal', () => {
      const result = evaluateCondition(
        { Status: 'Inactive' },
        { field: 'Status', operator: 'eq', value: 'Active' },
      );
      expect(result).toBe(false);
    });
  });

  describe('neq operator', () => {
    it('should return true when values are not equal', () => {
      const result = evaluateCondition(
        { Status: 'Inactive' },
        { field: 'Status', operator: 'neq', value: 'Active' },
      );
      expect(result).toBe(true);
    });

    it('should return false when values are equal', () => {
      const result = evaluateCondition(
        { Status: 'Active' },
        { field: 'Status', operator: 'neq', value: 'Active' },
      );
      expect(result).toBe(false);
    });
  });

  describe('contains operator', () => {
    it('should return true when field contains the value', () => {
      const result = evaluateCondition(
        { Description: 'This is important data' },
        { field: 'Description', operator: 'contains', value: 'important' },
      );
      expect(result).toBe(true);
    });

    it('should return false when field does not contain the value', () => {
      const result = evaluateCondition(
        { Description: 'This is trivial data' },
        { field: 'Description', operator: 'contains', value: 'important' },
      );
      expect(result).toBe(false);
    });
  });

  describe('startsWith operator', () => {
    it('should return true when field starts with the value', () => {
      const result = evaluateCondition(
        { Name: 'Acme Corp' },
        { field: 'Name', operator: 'startsWith', value: 'Acme' },
      );
      expect(result).toBe(true);
    });

    it('should return false when field does not start with the value', () => {
      const result = evaluateCondition(
        { Name: 'Globex Inc' },
        { field: 'Name', operator: 'startsWith', value: 'Acme' },
      );
      expect(result).toBe(false);
    });
  });

  describe('isEmpty operator', () => {
    it('should return true when field is empty string', () => {
      const result = evaluateCondition(
        { Notes: '' },
        { field: 'Notes', operator: 'isEmpty', value: '' },
      );
      expect(result).toBe(true);
    });

    it('should return true when field is whitespace only', () => {
      const result = evaluateCondition(
        { Notes: '   ' },
        { field: 'Notes', operator: 'isEmpty', value: '' },
      );
      expect(result).toBe(true);
    });

    it('should return false when field has content', () => {
      const result = evaluateCondition(
        { Notes: 'Some notes' },
        { field: 'Notes', operator: 'isEmpty', value: '' },
      );
      expect(result).toBe(false);
    });
  });

  describe('notEmpty operator', () => {
    it('should return true when field has content', () => {
      const result = evaluateCondition(
        { Notes: 'Has content' },
        { field: 'Notes', operator: 'notEmpty', value: '' },
      );
      expect(result).toBe(true);
    });

    it('should return false when field is empty', () => {
      const result = evaluateCondition(
        { Notes: '' },
        { field: 'Notes', operator: 'notEmpty', value: '' },
      );
      expect(result).toBe(false);
    });
  });

  describe('null and undefined handling', () => {
    it('should treat null field as empty string', () => {
      const result = evaluateCondition(
        { Notes: null },
        { field: 'Notes', operator: 'isEmpty', value: '' },
      );
      expect(result).toBe(true);
    });

    it('should treat undefined field as empty string', () => {
      const result = evaluateCondition(
        {},
        { field: 'Notes', operator: 'isEmpty', value: '' },
      );
      expect(result).toBe(true);
    });

    it('should treat null field as empty for eq comparison', () => {
      const result = evaluateCondition(
        { Status: null },
        { field: 'Status', operator: 'eq', value: '' },
      );
      expect(result).toBe(true);
    });
  });
});

describe('applyConditionalRule', () => {
  it('should use thenValue when condition matches', () => {
    const record = { Status: 'Active', Priority: 'Low' };
    const result = applyConditionalRule(record, 'Priority', {
      field: 'Status',
      operator: 'eq',
      value: 'Active',
      thenValue: 'High',
      elseValue: 'Low',
    });
    expect(result.Priority).toBe('High');
  });

  it('should use elseValue when condition does not match', () => {
    const record = { Status: 'Inactive', Priority: 'High' };
    const result = applyConditionalRule(record, 'Priority', {
      field: 'Status',
      operator: 'eq',
      value: 'Active',
      thenValue: 'High',
      elseValue: 'Low',
    });
    expect(result.Priority).toBe('Low');
  });

  it('should preserve original value when elseValue is missing and condition does not match', () => {
    const record = { Status: 'Inactive', Priority: 'Medium' };
    const result = applyConditionalRule(record, 'Priority', {
      field: 'Status',
      operator: 'eq',
      value: 'Active',
      thenValue: 'High',
    });
    expect(result.Priority).toBe('Medium');
  });

  it('should return a new record object (immutability)', () => {
    const record = { Status: 'Active', Priority: 'Low' };
    const result = applyConditionalRule(record, 'Priority', {
      field: 'Status',
      operator: 'eq',
      value: 'Active',
      thenValue: 'High',
    });
    expect(result).not.toBe(record);
    expect(record.Priority).toBe('Low');
  });

  it('should preserve all other fields in the record', () => {
    const record = { Status: 'Active', Priority: 'Low', Name: 'Test' };
    const result = applyConditionalRule(record, 'Priority', {
      field: 'Status',
      operator: 'eq',
      value: 'Active',
      thenValue: 'High',
    });
    expect(result.Name).toBe('Test');
    expect(result.Status).toBe('Active');
  });
});
