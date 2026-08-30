import { StorageService } from '../../src/services/storage';
import { BulkApiService } from '../../src/services/salesforce/bulk-api';
import { runBulkPush } from '../../src/offscreen';

describe('offscreen Bulk push finalization', () => {
  beforeEach(async () => {
    await chrome.storage.session.clear();
    await chrome.storage.local.clear();
    jest.restoreAllMocks();
  });

  it('writes progress, result, history, and completion without a service worker owner', async () => {
    const storage = new StorageService();
    await storage.setActivePush({
      id: 'push-offscreen', orgId: '00D', objectName: 'Account', operation: 'insert',
      totalRecords: 2, processedRecords: 0, failedRecords: 0, startedAt: 1,
      status: 'processing', strategy: 'bulk', bulkJobId: '750xx', resumeSupported: true,
    });
    jest.spyOn(BulkApiService.prototype, 'pollJobCompletion').mockImplementation(async (_id, _interval, _attempts, progress) => {
      const job = {
        id: '750xx', operation: 'insert' as const, object: 'Account', state: 'JobComplete' as const,
        numberRecordsProcessed: 2, numberRecordsFailed: 0, createdDate: 'now', jobType: 'V2Ingest' as const,
      };
      progress?.(job);
      return job;
    });
    jest.spyOn(BulkApiService.prototype, 'getSuccessfulResults').mockResolvedValue([
      { sf__Id: '001A', sf__Created: 'true', sf__Error: '' },
      { sf__Id: '001B', sf__Created: 'true', sf__Error: '' },
    ]);

    await runBulkPush({
      type: 'OFFSCREEN_BULK_PUSH',
      payload: {
        pushId: 'push-offscreen', jobId: '750xx', instanceUrl: 'https://example.my.salesforce.com',
        accessToken: 'session-only', apiVersion: 'v65.0', orgId: '00D', objectName: 'Account',
        operation: 'insert', totalRecords: 2, startedAt: 1,
      },
    });

    expect(await storage.getActivePush('push-offscreen')).toEqual(expect.objectContaining({
      status: 'complete', processedRecords: 2, checkpoint: 2,
    }));
    expect(await storage.getPushResult('push-offscreen')).toEqual(expect.objectContaining({ ids: ['001A', '001B'] }));
    expect((await storage.getPushHistory()).find(entry => entry.id === 'push-offscreen')).toEqual(expect.objectContaining({ successCount: 2 }));
    expect((await storage.getPushTransactions()).find(tx => tx.pushId === 'push-offscreen')?.rollbackIds).toEqual(['001A', '001B']);
  });
});
