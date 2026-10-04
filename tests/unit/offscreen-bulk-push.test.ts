import { StorageService } from '../../src/services/storage';
import { BulkApiService } from '../../src/services/salesforce/bulk-api';
import { buildBulkRowIdentity } from '../../src/services/salesforce/bulk-results';
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

  it('broadcasts per-row errors and IDs mapped to input indices (#47)', async () => {
    const storage = new StorageService();
    const records = [{ Name: 'Acme' }, { Name: 'Globex' }, { Name: 'Initech' }];
    await storage.setActivePush({
      id: 'push-rows', orgId: '00D', objectName: 'Account', operation: 'insert',
      totalRecords: 3, processedRecords: 0, failedRecords: 0, startedAt: 1,
      status: 'processing', strategy: 'bulk', bulkJobId: '750yy', resumeSupported: true,
    });
    jest.spyOn(BulkApiService.prototype, 'pollJobCompletion').mockResolvedValue({
      id: '750yy', operation: 'insert', object: 'Account', state: 'JobComplete',
      numberRecordsProcessed: 3, numberRecordsFailed: 1, createdDate: 'now', jobType: 'V2Ingest',
    });
    // Result files echo the uploaded columns and are not in upload order.
    jest.spyOn(BulkApiService.prototype, 'getSuccessfulResults').mockResolvedValue([
      { sf__Id: '001C', sf__Created: 'true', sf__Error: '', Name: 'Initech' },
      { sf__Id: '001A', sf__Created: 'true', sf__Error: '', Name: 'Acme' },
    ]);
    jest.spyOn(BulkApiService.prototype, 'getFailedResults').mockResolvedValue([
      { sf__Id: '', sf__Created: '', sf__Error: 'DUPLICATE_VALUE:duplicate', Name: 'Globex' },
    ]);
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockClear();

    await runBulkPush({
      type: 'OFFSCREEN_BULK_PUSH',
      payload: {
        pushId: 'push-rows', jobId: '750yy', instanceUrl: 'https://example.my.salesforce.com',
        accessToken: 'session-only', apiVersion: 'v65.0', orgId: '00D', objectName: 'Account',
        operation: 'insert', totalRecords: 3, startedAt: 1, rowIdentity: buildBulkRowIdentity(records),
      },
    });

    const complete = sendMessage.mock.calls.map(call => call[0]).find(m => m.type === 'DATA_PUSH_COMPLETE');
    expect(complete.payload).toEqual(expect.objectContaining({
      status: 'complete',
      failedRecords: 1,
      errors: [{ recordIndex: 1, message: 'DUPLICATE_VALUE:duplicate' }],
      ids: ['001C', '001A'],
      idRecordIndexes: [2, 0],
    }));
    expect(await storage.getPushResult('push-rows')).toEqual(expect.objectContaining({
      ids: ['001C', '001A'], idRecordIndexes: [2, 0],
    }));
  });
});
