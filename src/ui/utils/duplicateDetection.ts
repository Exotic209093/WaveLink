/**
 * Duplicate detection and merging utilities.
 * Supports exact match, Levenshtein distance, and Soundex matching.
 * Complexity: O(N^2 * F) worst case for detection where N=records, F=fields.
 */

export type MatchStrategy = 'exact' | 'levenshtein' | 'soundex';

export interface DuplicateGroup {
  masterIndex: number;
  duplicateIndexes: number[];
  score: number;
}

export interface DetectionConfig {
  fields: string[];
  strategy: MatchStrategy;
  threshold?: number; // similarity threshold for fuzzy (default 0.85)
  caseSensitive?: boolean;
}

/** Compute Levenshtein edit distance between two strings. O(A*B). */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Compute Levenshtein similarity as 1 - distance/maxLen. O(A*B). */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/** Standard 4-character Soundex encoding. O(N) on string length. */
export function soundex(s: string): string {
  if (!s) return '0000';
  const upper = s.toUpperCase().replace(/[^A-Z]/g, '');
  if (!upper) return '0000';
  const map: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };
  let result = upper[0];
  let prev = map[upper[0]] ?? '0';
  for (let i = 1; i < upper.length && result.length < 4; i++) {
    const code = map[upper[i]] ?? '0';
    if (code !== '0' && code !== prev) {
      result += code;
    }
    prev = code;
  }
  return (result + '0000').slice(0, 4);
}

function getFieldKey(record: Record<string, unknown>, fields: string[], caseSensitive: boolean): string {
  return fields.map(f => {
    const val = record[f];
    const s = val === null || val === undefined ? '' : String(val);
    return caseSensitive ? s : s.toLowerCase();
  }).join('|');
}

function matchScore(a: string, b: string, strategy: MatchStrategy, _threshold: number): number {
  switch (strategy) {
    case 'exact':
      return a === b ? 1 : 0;
    case 'levenshtein':
      return levenshteinSimilarity(a, b);
    case 'soundex': {
      const partsA = a.split('|');
      const partsB = b.split('|');
      let matches = 0;
      for (let i = 0; i < partsA.length; i++) {
        if (soundex(partsA[i]) === soundex(partsB[i])) matches++;
      }
      return matches / Math.max(partsA.length, 1);
    }
    default:
      return 0;
  }
}

/** Detect duplicate groups in records. O(N^2 * F). */
export function detectDuplicates(
  records: Record<string, unknown>[],
  config: DetectionConfig,
): DuplicateGroup[] {
  const threshold = config.threshold ?? 0.85;
  const caseSensitive = config.caseSensitive ?? false;
  const groups: DuplicateGroup[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < records.length; i++) {
    if (assigned.has(i)) continue;
    const keyI = getFieldKey(records[i], config.fields, caseSensitive);
    const dupes: number[] = [];
    let totalScore = 0;

    for (let j = i + 1; j < records.length; j++) {
      if (assigned.has(j)) continue;
      const keyJ = getFieldKey(records[j], config.fields, caseSensitive);
      const score = matchScore(keyI, keyJ, config.strategy, threshold);
      if (score >= threshold) {
        dupes.push(j);
        totalScore += score;
        assigned.add(j);
      }
    }

    if (dupes.length > 0) {
      assigned.add(i);
      groups.push({
        masterIndex: i,
        duplicateIndexes: dupes,
        score: totalScore / dupes.length,
      });
    }
  }

  return groups;
}

/** Merge records in a group based on field-level resolution. O(F). */
export function mergeRecords(
  records: Record<string, unknown>[],
  group: DuplicateGroup,
  fieldResolutions: Record<string, 'master' | number>,
): Record<string, unknown> {
  const master = records[group.masterIndex];
  const merged: Record<string, unknown> = { ...master };

  for (const [field, source] of Object.entries(fieldResolutions)) {
    if (source === 'master') {
      merged[field] = master[field];
    } else {
      const idx = source as number;
      merged[field] = records[idx]?.[field] ?? master[field];
    }
  }

  return merged;
}
