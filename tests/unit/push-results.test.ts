import { StorageService } from '../../src/services/storage';
import { STORAGE_KEYS } from '../../src/core/constants';

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

