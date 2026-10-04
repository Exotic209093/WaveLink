import { StorageService } from '../../src/services/storage';
import { STORAGE_KEYS } from '../../src/core/constants';
import { buildPushOutcomeDatasets, buildRetryDataset } from '../../src/ui/utils/pushRetry';

describe('Push Results (Session)', () => {
  test('caps stored push results to 20 (keeps most recent by capturedAt)', async () => {
    const storage = new StorageService();
    await chrome.storage.session.clear();

    for (let i = 0; i < 25; i++) {
      await storage.setPushResult({
        pushId: `p${i}`,
        orgId: '00Dxx0000000001',
        objectName: 'Account',
        operation: 'insert',
        ids: [`001xx000000000${i}`],
        capturedAt: i,
      });
    }

    const raw = await chrome.storage.session.get(STORAGE_KEYS.PUSH_RESULTS);
    const all = (raw[STORAGE_KEYS.PUSH_RESULTS] ?? {}) as Record<string, unknown>;
    expect(Object.keys(all)).toHaveLength(20);

    // Oldest kept should be p5 ... p24 (20 entries).
    expect(all).not.toHaveProperty('p0');
    expect(all).not.toHaveProperty('p4');
    expect(all).toHaveProperty('p5');
    expect(all).toHaveProperty('p24');
  });
});

describe('push outcome downloads', () => {
  test('preserves source rows and adds IDs or grouped error details', () => {
    const result = buildPushOutcomeDatasets(
      [{ Name: 'Good' }, { Name: 'Bad' }, { Name: 'Also good' }],
      [{ recordIndex: 1, message: 'Missing field' }, { recordIndex: 1, message: 'Invalid value' }],
      { ids: ['001-good', '001-also'], idRecordIndexes: [0, 2] },
    );
    expect(result.success.records).toEqual([
      { Name: 'Good', WaveLinkRecordId: '001-good' },
      { Name: 'Also good', WaveLinkRecordId: '001-also' },
    ]);
    expect(result.error.records).toEqual([{
      Name: 'Bad', WaveLinkError: 'Missing field; Invalid value', WaveLinkSourceRow: 3,
    }]);
  });

  test('attaches IDs by record index, not position, when results arrive out of order (#47)', () => {
    // Bulk results / parallel REST batches: IDs come back in a different order than the input,
    // and an updating upsert (HTTP 204) returns no ID for row 1.
    const result = buildPushOutcomeDatasets(
      [{ Name: 'A' }, { Name: 'B' }, { Name: 'C' }, { Name: 'D' }],
      [{ recordIndex: 2, message: 'DUPLICATE_VALUE' }],
      { ids: ['001-D', '001-A'], idRecordIndexes: [3, 0] },
    );
    expect(result.success.records).toEqual([
      { Name: 'A', WaveLinkRecordId: '001-A' },
      { Name: 'B' },
      { Name: 'D', WaveLinkRecordId: '001-D' },
    ]);
    expect(result.error.records).toEqual([{ Name: 'C', WaveLinkError: 'DUPLICATE_VALUE', WaveLinkSourceRow: 4 }]);
  });

  test('never zips IDs positionally when no record indexes are available (#47)', () => {
    const result = buildPushOutcomeDatasets(
      [{ Name: 'A' }, { Name: 'B' }],
      [{ recordIndex: 0, message: 'Failed' }],
      { ids: ['001-unknown'] },
    );
    expect(result.success.records).toEqual([{ Name: 'B' }]);
    expect(result.success.headers).toEqual(['Name']);
  });
});

describe('source-row translation after mapping drops rows (#46)', () => {
  // Source row 1 failed mapping, so the pushed array is [row0, row2, row3, row4].
  const sourceRecords = [{ Name: 'R0' }, { Name: 'R1-unmapped' }, { Name: 'R2' }, { Name: 'R3' }, { Name: 'R4' }];
  const sourceIndexes = [0, 2, 3, 4];
  // Pushed positions 1 and 3 failed, i.e. source rows 2 and 4.
  const pushErrors = [{ recordIndex: 1, message: 'Bad R2' }, { recordIndex: 3, message: 'Bad R4' }];

  test('retry dataset targets the source rows that actually failed', () => {
    const retry = buildRetryDataset(sourceRecords, pushErrors, sourceIndexes);
    expect(retry.records).toEqual([{ Name: 'R2' }, { Name: 'R4' }]);
    expect(retry.originalIndices).toEqual([2, 4]);
    expect(retry.errorMap).toEqual(new Map([[0, 'Bad R2'], [1, 'Bad R4']]));
  });

  test('outcome files blame the right rows and attach IDs to the right rows', () => {
    const result = buildPushOutcomeDatasets(
      sourceRecords,
      pushErrors,
      { ids: ['001-R0', '001-R3'], idRecordIndexes: [0, 2] },
      sourceIndexes,
    );
    expect(result.error.records).toEqual([
      { Name: 'R2', WaveLinkError: 'Bad R2', WaveLinkSourceRow: 4 },
      { Name: 'R4', WaveLinkError: 'Bad R4', WaveLinkSourceRow: 6 },
    ]);
    // The row dropped at mapping was never pushed, so it is not reported as a success.
    expect(result.success.records).toEqual([
      { Name: 'R0', WaveLinkRecordId: '001-R0' },
      { Name: 'R3', WaveLinkRecordId: '001-R3' },
    ]);
  });
});

