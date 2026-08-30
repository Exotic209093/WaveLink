import { StorageService } from '../../src/services/storage';
import { STORAGE_KEYS } from '../../src/core/constants';
import { buildPushOutcomeDatasets } from '../../src/ui/utils/pushRetry';

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
      ['001-good', '001-also'],
    );
    expect(result.success.records).toEqual([
      { Name: 'Good', WaveLinkRecordId: '001-good' },
      { Name: 'Also good', WaveLinkRecordId: '001-also' },
    ]);
    expect(result.error.records).toEqual([{
      Name: 'Bad', WaveLinkError: 'Missing field; Invalid value', WaveLinkSourceRow: 3,
    }]);
  });
});

