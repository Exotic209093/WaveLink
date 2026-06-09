/**
 * Streaming query helper: pages through a SOQL result set via queryMore until
 * the server reports `done`, accumulating all records.
 *
 * Why: scheduled snapshots and large exports previously kept only the first
 * page (~2000 records) that `query()` returns, silently truncating big objects.
 *
 * Operates on a minimal pager interface so it can be unit-tested without a real
 * Salesforce client and reused from both the service worker and the offscreen
 * document.
 *
 * Complexity: O(N) over records, one request per ~2000-record page.
 */

export interface QueryPage {
  records?: unknown[];
  done?: boolean;
  nextRecordsUrl?: string;
}

export interface QueryPager {
  query(soql: string): Promise<QueryPage>;
  queryMore(nextRecordsUrl: string): Promise<QueryPage>;
}

export interface QueryAllOptions {
  /** Hard cap to bound memory/time. Defaults to 100,000 records. */
  maxRecords?: number;
}

export async function queryAllRecords(
  pager: QueryPager,
  soql: string,
  options: QueryAllOptions = {},
): Promise<Record<string, unknown>[]> {
  const maxRecords = options.maxRecords ?? 100_000;
  const out: Record<string, unknown>[] = [];

  let page: QueryPage = await pager.query(soql);
  for (;;) {
    for (const record of (page.records ?? []) as Record<string, unknown>[]) {
      out.push(record);
      if (out.length >= maxRecords) return out;
    }
    if (page.done || !page.nextRecordsUrl) break;
    page = await pager.queryMore(page.nextRecordsUrl);
  }

  return out;
}

/**
 * Derives the set of column names present across the first `sampleSize` records,
 * excluding Salesforce's `attributes` envelope. Stable order of first appearance.
 */
export function deriveColumns(records: Record<string, unknown>[], sampleSize = 50): string[] {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const record of records.slice(0, sampleSize)) {
    for (const key of Object.keys(record)) {
      if (key === 'attributes' || seen.has(key)) continue;
      seen.add(key);
      cols.push(key);
    }
  }
  return cols;
}
