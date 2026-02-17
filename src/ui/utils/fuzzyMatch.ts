/**
 * Lightweight fuzzy / substring matching for autocomplete and search.
 *
 * Scoring priority: exact === 4, starts-with === 3, contains === 2, subsequence === 1, no-match === 0.
 */

export function fuzzyScore(candidate: string, query: string): number {
  if (!query) return 1; // empty query matches everything with minimum score
  const cl = candidate.toLowerCase();
  const ql = query.toLowerCase();

  if (cl === ql) return 4;
  if (cl.startsWith(ql)) return 3;
  if (cl.includes(ql)) return 2;

  // Subsequence check
  let qi = 0;
  for (let ci = 0; ci < cl.length && qi < ql.length; ci++) {
    if (cl[ci] === ql[qi]) qi++;
  }
  return qi === ql.length ? 1 : 0;
}

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  if (!query) return items;
  const scored = items
    .map(item => ({ item, score: fuzzyScore(getText(item), query) }))
    .filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.item);
}
