import { StorageService } from '../../src/services/storage';

describe('push checkpoints', () => {
  const storage = new StorageService();

  beforeEach(async () => {
    await chrome.storage.session.clear();
    await chrome.storage.local.clear();
  });

  it('retains checkpoint metadata when session storage is cleared', async () => {
    await storage.setActivePush({
      id: 'restart-safe', orgId: '00D', objectName: 'Account', operation: 'insert',
      totalRecords: 100, processedRecords: 25, failedRecords: 0,
      startedAt: 1, status: 'processing', strategy: 'bulk', bulkJobId: '750restart', resumeSupported: true,
    });
    await chrome.storage.session.clear();

    expect(await storage.getActivePush('restart-safe')).toEqual(expect.objectContaining({
      processedRecords: 25, bulkJobId: '750restart', resumeSupported: true,
    }));
  });

  it('persists monotonic batch progress independently of the worker', async () => {
    await storage.setActivePush({
      id: 'push-1', orgId: '00D', objectName: 'Account', operation: 'insert',
      totalRecords: 1000, processedRecords: 0, failedRecords: 0,
      startedAt: 1, status: 'processing', strategy: 'rest', resumeSupported: false,
    });
    await storage.updateActivePush('push-1', { processedRecords: 400, failedRecords: 2, checkpoint: 400 });

    expect(await storage.getActivePush('push-1')).toEqual(expect.objectContaining({
      processedRecords: 400,
      failedRecords: 2,
      checkpoint: 400,
      status: 'processing',
    }));
  });

  it('marks evicted jobs interrupted and distinguishes resumable Bulk work', async () => {
    await storage.setActivePush({
      id: 'bulk', orgId: '00D', objectName: 'Contact', operation: 'upsert',
      totalRecords: 5000, processedRecords: 2000, failedRecords: 3,
      startedAt: 1, status: 'processing', strategy: 'bulk', bulkJobId: '750xx', resumeSupported: true,
    });
    await storage.setActivePush({
      id: 'rest', orgId: '00D', objectName: 'Contact', operation: 'insert',
      totalRecords: 10, processedRecords: 5, failedRecords: 0,
      startedAt: 1, status: 'processing', strategy: 'rest', resumeSupported: false,
    });

    expect(await storage.markInterruptedPushes()).toBe(2);
    const pushes = await storage.getActivePushes();
    expect(pushes.find(push => push.id === 'bulk')).toEqual(expect.objectContaining({
      status: 'interrupted', resumeSupported: true, bulkJobId: '750xx',
    }));
    expect(pushes.find(push => push.id === 'rest')?.lastError).toMatch(/source file/i);
  });
});
