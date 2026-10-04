/**
 * StorageService quota guard (PR #114, issues #56/#63/#94/#99).
 *
 * The guard must never stop a legitimate write: eviction is best-effort, it
 * must not recurse back into the guarded write path, and an unavailable usage
 * API must not turn every write into a StorageError.
 */

import { storageMock } from '../mocks/chromeMock';
import { StorageService } from '../../src/services/storage';
import { STORAGE_KEYS } from '../../src/core/constants';
import type { ActivePush } from '../../src/core/types/storage';

const GB = 1024 * 1024 * 1024;
const getBytesInUse = chrome.storage.local.getBytesInUse as jest.Mock;

function oldTerminalPush(id: string): ActivePush {
  const longAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
  return {
    id,
    orgId: 'org',
    objectName: 'Account',
    operation: 'insert',
    status: 'complete',
    totalRecords: 1,
    processedRecords: 1,
    failedRecords: 0,
    startedAt: longAgo,
    updatedAt: longAgo,
  } as ActivePush;
}

beforeEach(() => {
  storageMock.local = {};
  storageMock.session = {};
  getBytesInUse.mockClear();
});

afterEach(() => {
  getBytesInUse.mockImplementation(() => Promise.resolve(JSON.stringify(storageMock.local).length));
});

describe('StorageService quota guard', () => {
  it('evicts old terminal pushes once and still writes when usage stays above the threshold', async () => {
    storageMock.local[STORAGE_KEYS.ACTIVE_PUSHES] = { old: oldTerminalPush('old') };
    // Usage never drops (e.g. other large keys), so eviction cannot reach its target.
    getBytesInUse.mockImplementation(() => Promise.resolve(0.95 * GB));

    const svc = new StorageService();
    await svc.setUiSettings({ theme: 'dark' });

    expect((storageMock.local[STORAGE_KEYS.UI_SETTINGS] as { theme: string }).theme).toBe('dark');
    expect(storageMock.local[STORAGE_KEYS.ACTIVE_PUSHES]).toEqual({});
    // Bounded work: one guard check plus a handful of eviction checks, no recursion.
    expect(getBytesInUse.mock.calls.length).toBeLessThan(10);
  });

  it('still writes when the usage API is unavailable', async () => {
    getBytesInUse.mockImplementation(() => Promise.reject(new Error('getBytesInUse is not supported')));

    const svc = new StorageService();
    await svc.setUiSettings({ theme: 'light' });

    expect((storageMock.local[STORAGE_KEYS.UI_SETTINGS] as { theme: string }).theme).toBe('light');
  });
});
