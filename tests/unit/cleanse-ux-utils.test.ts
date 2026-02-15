import { applyTransform, cleanseRecords, computeConflicts, computeSummary } from '../../src/ui/utils/cleanse';

describe('Cleanser UX Utils', () => {
  it('computeConflicts should detect duplicate rename targets (ignoring dropped)', () => {
    const res = computeConflicts([
      { source: 'A', renameTo: 'X', drop: false, transform: 'none' },
      { source: 'B', renameTo: 'X', drop: false, transform: 'none' },
      { source: 'C', renameTo: 'X', drop: true, transform: 'none' },
    ]);

    expect(res.hasBlocking).toBe(true);
    expect(res.conflicts).toEqual({ X: ['A', 'B'] });
  });

  it('computeSummary should count dropped/renamed/transformed', () => {
    const res = computeSummary([
      { source: 'A', renameTo: 'A', drop: false, transform: 'none' },
      { source: 'B', renameTo: 'B2', drop: false, transform: 'trim' },
      { source: 'C', renameTo: 'C', drop: true, transform: 'uppercase' },
      { source: 'D', renameTo: '   ', drop: false, transform: 'lowercase' },
    ]);

    expect(res.dropped).toBe(1);
    expect(res.renamed).toBe(1);
    expect(res.transformed).toBe(3);
  });

  it('applyTransform should match transform behaviors', () => {
    expect(applyTransform('  a  ', 'trim')).toBe('a');
    expect(applyTransform('ab', 'uppercase')).toBe('AB');
    expect(applyTransform('AB', 'lowercase')).toBe('ab');

    expect(applyTransform('yes', 'boolean_parse')).toBe(true);
    expect(applyTransform('Y', 'boolean_parse')).toBe(true);
    expect(applyTransform('no', 'boolean_parse')).toBe(false);

    expect(applyTransform('12.5', 'number_format')).toBe(12.5);
    expect(applyTransform('nope', 'number_format')).toBeNull();

    expect(applyTransform('2020-01-02', 'date_format')).toBe('2020-01-02');
    expect(applyTransform('not-a-date', 'date_format')).toBeNull();
  });

  it('preview cleanse on a subset should produce expected output', () => {
    const records = [
      { Name: '  acme  ', Active__c: 'yes' },
      { Name: '  beta  ', Active__c: 'no' },
    ];
    const ops = [
      { source: 'Name', renameTo: 'Name', drop: false, transform: 'trim' },
      { source: 'Active__c', renameTo: 'IsActive__c', drop: false, transform: 'boolean_parse' },
    ] as const;

    const subset = cleanseRecords(records.slice(0, 1), ops as any);
    expect(subset.cleanedHeaders).toEqual(['Name', 'IsActive__c']);
    expect(subset.cleanedRecords).toEqual([{ Name: 'acme', IsActive__c: true }]);
  });
});

