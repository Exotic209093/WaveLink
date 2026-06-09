/**
 * Tests for the streaming query helper that backs scheduled snapshots and
 * large exports (pagination + column derivation).
 */

import { queryAllRecords, deriveColumns, type QueryPage, type QueryPager } from '../../src/services/salesforce/queryAll';

/** Builds a pager that serves pre-canned pages and records the calls made. */
function pagerFrom(pages: QueryPage[]): QueryPager & { queryCalls: number; moreCalls: string[] } {
  let idx = 0;
  const state = {
    queryCalls: 0,
    moreCalls: [] as string[],
    async query(): Promise<QueryPage> {
      state.queryCalls++;
      return pages[idx++];
    },
    async queryMore(url: string): Promise<QueryPage> {
      state.moreCalls.push(url);
      return pages[idx++];
    },
  };
  return state;
}

describe('queryAllRecords', () => {
  it('returns the single page when the first response is done', async () => {
    const pager = pagerFrom([{ records: [{ Id: '1' }, { Id: '2' }], done: true }]);
    const out = await queryAllRecords(pager, 'SELECT Id FROM Account');
    expect(out).toEqual([{ Id: '1' }, { Id: '2' }]);
    expect(pager.queryCalls).toBe(1);
    expect(pager.moreCalls).toEqual([]);
  });

  it('follows nextRecordsUrl across pages until done', async () => {
    const pager = pagerFrom([
      { records: [{ Id: '1' }], done: false, nextRecordsUrl: '/q/2' },
      { records: [{ Id: '2' }], done: false, nextRecordsUrl: '/q/3' },
      { records: [{ Id: '3' }], done: true },
    ]);
    const out = await queryAllRecords(pager, 'SELECT Id FROM Account');
    expect(out.map(r => r.Id)).toEqual(['1', '2', '3']);
    expect(pager.moreCalls).toEqual(['/q/2', '/q/3']);
  });

  it('stops paging when done is false but no nextRecordsUrl is given', async () => {
    const pager = pagerFrom([{ records: [{ Id: '1' }], done: false }]);
    const out = await queryAllRecords(pager, 'SELECT Id FROM Account');
    expect(out).toEqual([{ Id: '1' }]);
    expect(pager.moreCalls).toEqual([]);
  });

  it('respects maxRecords and stops early (even mid-page)', async () => {
    const pager = pagerFrom([
      { records: [{ Id: '1' }, { Id: '2' }, { Id: '3' }], done: false, nextRecordsUrl: '/q/2' },
      { records: [{ Id: '4' }], done: true },
    ]);
    const out = await queryAllRecords(pager, 'SELECT Id FROM Account', { maxRecords: 2 });
    expect(out.map(r => r.Id)).toEqual(['1', '2']);
    expect(pager.moreCalls).toEqual([]); // never fetched page 2
  });

  it('tolerates a missing records array', async () => {
    const pager = pagerFrom([{ done: true }]);
    expect(await queryAllRecords(pager, 'SELECT Id FROM Account')).toEqual([]);
  });
});

describe('deriveColumns', () => {
  it('collects keys in first-seen order and excludes attributes', () => {
    const records = [
      { attributes: { type: 'Account' }, Id: '1', Name: 'Acme' },
      { Id: '2', Name: 'Globex', Industry: 'Energy' },
    ];
    expect(deriveColumns(records)).toEqual(['Id', 'Name', 'Industry']);
  });

  it('only samples up to sampleSize records', () => {
    const records = [
      { Id: '1' },
      { Id: '2', Late: 'x' }, // beyond sampleSize=1, so Late not picked up
    ];
    expect(deriveColumns(records, 1)).toEqual(['Id']);
  });
});
