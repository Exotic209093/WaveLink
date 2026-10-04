/**
 * Migration push read-back (issues #43 / #90 / #47).
 *
 * Regression for the PR #110 merge that made the migration poller return a bare
 * `string[]`, which the consumer then read as a push result (`result.ids`
 * undefined, so every migrated object failed and no ID map was written), and
 * for the poller ignoring results whose `ids` is empty (every record failed),
 * which stalled the run for the full timeout and then reported success.
 */

import { awaitPushResult, buildIdMapEntries } from '../../src/ui/utils/migrationPush';
import type { DataPushResultGetResponse } from '../../src/core/types/messaging';

function pushResult(overrides: Partial<DataPushResultGetResponse> = {}): DataPushResultGetResponse {
  return {
    pushId: 'push_1',
    objectName: 'Account',
    operation: 'insert',
    ids: [],
    capturedAt: 1,
    ...overrides,
  };
}

describe('awaitPushResult', () => {
  it('resolves with the full stored push result, not just the ID list', async () => {
    const stored = pushResult({
      ids: ['001T1', '001T3'],
      idRecordIndexes: [0, 2],
      failedRecords: [{ index: 1, record: {}, error: 'REQUIRED_FIELD_MISSING' }],
    });
    const sf = { getDataPushResult: jest.fn().mockResolvedValueOnce(null).mockResolvedValue(stored) };

    const result = await awaitPushResult(sf, 'push_1', 1_000, 0);

    expect(result).toEqual(stored);
    expect(sf.getDataPushResult).toHaveBeenCalledTimes(2);
  });

  it('returns a stored result with no IDs (every record failed) instead of polling until timeout', async () => {
    const stored = pushResult({
      ids: [],
      failedRecords: [{ index: 0, record: {}, error: 'DUPLICATE_VALUE' }],
    });
    const sf = { getDataPushResult: jest.fn().mockResolvedValue(stored) };

    await expect(awaitPushResult(sf, 'push_1', 1_000, 0)).resolves.toEqual(stored);
    expect(sf.getDataPushResult).toHaveBeenCalledTimes(1);
  });

  it('resolves null when no result is stored before the timeout', async () => {
    const sf = { getDataPushResult: jest.fn().mockResolvedValue(null) };
    await expect(awaitPushResult(sf, 'push_1', 5, 1)).resolves.toBeNull();
  });
});

describe('buildIdMapEntries', () => {
  const source = [
    { Id: '001S1', Name: 'A' },
    { Id: '001S2', Name: 'B' },
    { Id: '001S3', Name: 'C' },
  ];

  it('pairs IDs with their source rows via idRecordIndexes, even out of order', () => {
    const entries = buildIdMapEntries(
      source,
      { ids: ['001T3', '001T1', '001T2'], idRecordIndexes: [2, 0, 1] },
      'Account',
      42,
    );
    expect(entries).toEqual([
      { sourceId: '001S3', targetId: '001T3', objectName: 'Account', createdAt: 42 },
      { sourceId: '001S1', targetId: '001T1', objectName: 'Account', createdAt: 42 },
      { sourceId: '001S2', targetId: '001T2', objectName: 'Account', createdAt: 42 },
    ]);
  });

  it('skips failed rows so later records keep their own target IDs', () => {
    const entries = buildIdMapEntries(source, { ids: ['001T1', '001T3'], idRecordIndexes: [0, 2] }, 'Account');
    expect(entries.map(e => [e.sourceId, e.targetId])).toEqual([
      ['001S1', '001T1'],
      ['001S3', '001T3'],
    ]);
  });

  it('does not guess a source row for unidentified (-1) or unindexed IDs', () => {
    expect(buildIdMapEntries(source, { ids: ['001T1', '001T2'], idRecordIndexes: [-1, 1] }, 'Account')
      .map(e => [e.sourceId, e.targetId])).toEqual([['001S2', '001T2']]);
    expect(buildIdMapEntries(source, { ids: ['001T1', '001T2'] }, 'Account')).toEqual([]);
  });

  it('returns no entries when every record failed', () => {
    expect(buildIdMapEntries(source, { ids: [], idRecordIndexes: [] }, 'Account')).toEqual([]);
  });
});
