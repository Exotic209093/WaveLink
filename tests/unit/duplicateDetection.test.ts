import {
  levenshteinDistance,
  levenshteinSimilarity,
  soundex,
  detectDuplicates,
  mergeRecords,
} from '../../src/ui/utils/duplicateDetection';
import type { DuplicateGroup } from '../../src/ui/utils/duplicateDetection';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('kitten', 'kitten')).toBe(0);
  });

  it('returns 1 for a single character difference', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
  });

  it('returns max length for completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });

  it('returns 0 for two empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('returns the length of the other string when one is empty', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
  });

  it('handles multi-step edits correctly', () => {
    // kitten -> sitten (sub) -> sittin (sub) -> sitting (insert) = 3
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('levenshteinSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(levenshteinSimilarity('hello', 'hello')).toBe(1);
  });

  it('returns 0 for completely different single-char strings', () => {
    expect(levenshteinSimilarity('a', 'b')).toBe(0);
  });

  it('returns a value between 0 and 1 for similar strings', () => {
    const sim = levenshteinSimilarity('kitten', 'sitting');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('returns 1 for two empty strings', () => {
    expect(levenshteinSimilarity('', '')).toBe(1);
  });
});

describe('soundex', () => {
  it('encodes "Robert" as R163', () => {
    expect(soundex('Robert')).toBe('R163');
  });

  it('encodes "Smith" as S530', () => {
    expect(soundex('Smith')).toBe('S530');
  });

  it('returns 0000 for empty string', () => {
    expect(soundex('')).toBe('0000');
  });

  it('pads short results to 4 characters', () => {
    const result = soundex('A');
    expect(result).toHaveLength(4);
    expect(result).toBe('A000');
  });

  it('produces same code for similar-sounding names', () => {
    expect(soundex('Robert')).toBe(soundex('Rupert'));
  });
});

describe('detectDuplicates', () => {
  describe('exact matching', () => {
    it('groups two identical records', () => {
      const records = [
        { Name: 'Acme Corp', City: 'NYC' },
        { Name: 'Acme Corp', City: 'NYC' },
      ];
      const groups = detectDuplicates(records, {
        fields: ['Name'],
        strategy: 'exact',
      });

      expect(groups).toHaveLength(1);
      expect(groups[0].masterIndex).toBe(0);
      expect(groups[0].duplicateIndexes).toContain(1);
    });

    it('returns empty groups when no duplicates exist', () => {
      const records = [
        { Name: 'Acme Corp' },
        { Name: 'Globex Inc' },
        { Name: 'Initech LLC' },
      ];
      const groups = detectDuplicates(records, {
        fields: ['Name'],
        strategy: 'exact',
      });

      expect(groups).toHaveLength(0);
    });

    it('handles case insensitive matching by default', () => {
      const records = [
        { Name: 'Acme Corp' },
        { Name: 'acme corp' },
      ];
      const groups = detectDuplicates(records, {
        fields: ['Name'],
        strategy: 'exact',
        caseSensitive: false,
      });

      expect(groups).toHaveLength(1);
    });

    it('respects case sensitivity when enabled', () => {
      const records = [
        { Name: 'Acme Corp' },
        { Name: 'acme corp' },
      ];
      const groups = detectDuplicates(records, {
        fields: ['Name'],
        strategy: 'exact',
        caseSensitive: true,
      });

      expect(groups).toHaveLength(0);
    });

    it('groups three duplicate records into one group with two duplicateIndexes', () => {
      const records = [
        { Name: 'Acme' },
        { Name: 'Acme' },
        { Name: 'Acme' },
      ];
      const groups = detectDuplicates(records, {
        fields: ['Name'],
        strategy: 'exact',
      });

      expect(groups).toHaveLength(1);
      expect(groups[0].masterIndex).toBe(0);
      expect(groups[0].duplicateIndexes).toHaveLength(2);
      expect(groups[0].duplicateIndexes).toContain(1);
      expect(groups[0].duplicateIndexes).toContain(2);
    });
  });

  describe('levenshtein matching', () => {
    it('groups similar records above threshold', () => {
      const records = [
        { Name: 'Acme Corporation' },
        { Name: 'Acme Corpration' }, // minor typo
      ];
      const groups = detectDuplicates(records, {
        fields: ['Name'],
        strategy: 'levenshtein',
        threshold: 0.8,
      });

      expect(groups).toHaveLength(1);
    });

    it('does not group dissimilar records below threshold', () => {
      const records = [
        { Name: 'Acme Corporation' },
        { Name: 'Globex Industries' },
      ];
      const groups = detectDuplicates(records, {
        fields: ['Name'],
        strategy: 'levenshtein',
        threshold: 0.8,
      });

      expect(groups).toHaveLength(0);
    });
  });
});

describe('mergeRecords', () => {
  const records = [
    { Name: 'Acme Corp', City: 'NYC', Phone: '111' },
    { Name: 'Acme Corporation', City: 'New York', Phone: '222' },
    { Name: 'Acme Co', City: 'NY', Phone: '333' },
  ];
  const group: DuplicateGroup = {
    masterIndex: 0,
    duplicateIndexes: [1, 2],
    score: 0.9,
  };

  it('uses master value when resolution is "master"', () => {
    const merged = mergeRecords(records, group, {
      Name: 'master',
      City: 'master',
      Phone: 'master',
    });

    expect(merged.Name).toBe('Acme Corp');
    expect(merged.City).toBe('NYC');
    expect(merged.Phone).toBe('111');
  });

  it('uses a specific record value when resolution is a number', () => {
    const merged = mergeRecords(records, group, {
      Name: 'master',
      City: 1,
      Phone: 2,
    });

    expect(merged.Name).toBe('Acme Corp');
    expect(merged.City).toBe('New York');
    expect(merged.Phone).toBe('333');
  });

  it('handles mixed resolutions across fields', () => {
    const merged = mergeRecords(records, group, {
      Name: 1,
      City: 'master',
      Phone: 2,
    });

    expect(merged.Name).toBe('Acme Corporation');
    expect(merged.City).toBe('NYC');
    expect(merged.Phone).toBe('333');
  });
});
