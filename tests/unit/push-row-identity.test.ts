/**
 * REST push results carry per-row record indices for their IDs (#47).
 *
 * Exercises DATA_PUSH_START in src/background/index.ts through the chrome.runtime.onMessage
 * listener with the Salesforce client mocked at the prototype boundary.
 */

import { StorageService } from '../../src/services/storage';
import { SalesforceAuth } from '../../src/services/salesforce/auth';
import { SalesforceApiClient } from '../../src/services/salesforce/api-client';
import type { ExtensionMessage, MessageResponse } from '../../src/core/types/messaging';
import type { SalesforceOrg } from '../../src/core/types/salesforce';

// Import background module to register handlers on the MessageBus.
import '../../src/background/index';

/** Dispatch like Chrome does: offer the message to every registered listener until one claims it. */
function send(type: string, payload: unknown): Promise<MessageResponse> {
  const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls.map(call => call[0]);
  const message = { type, payload, requestId: `req-${Date.now()}`, timestamp: Date.now(), source: 'popup' } as ExtensionMessage;
  return new Promise((resolve, reject) => {
    if (!listeners.some(listener => listener(message, {}, resolve) === true)) reject(new Error(`No handler for ${type}`));
  });
}

async function waitFor<T>(read: () => Promise<T | null | undefined>): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const value = await read();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for push result');
}

const org: SalesforceOrg = {
  id: '00Dxx0000000001', orgId: '00Dxx0000000001', instanceUrl: 'https://example.my.salesforce.com',
  environment: 'sandbox', username: 'u@example.test', displayName: 'Test', accessToken: 'token',
  tokenExpiresAt: Date.now() + 3_600_000, apiVersion: 'v65.0', connectedAt: 1, lastUsedAt: 1,
};

describe('REST push row identity (#47)', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    jest.restoreAllMocks();
    await new StorageService().saveOrg(org);
    jest.spyOn(SalesforceAuth.prototype, 'ensureValidToken').mockImplementation(async o => o);
  });

  it('records the input index of each upsert ID, including updates that return no ID', async () => {
    jest.spyOn(SalesforceApiClient.prototype, 'composite').mockResolvedValue({
      compositeResponse: [
        { referenceId: 'r0', httpStatusCode: 201, httpHeaders: {}, body: { id: '001A', success: true, created: true } },
        // Upsert that matched an existing record: 204 No Content, no ID.
        { referenceId: 'r1', httpStatusCode: 204, httpHeaders: {}, body: null },
        { referenceId: 'r2', httpStatusCode: 400, httpHeaders: {}, body: [{ message: 'Bad value', errorCode: 'INVALID' }] },
        { referenceId: 'r3', httpStatusCode: 201, httpHeaders: {}, body: { id: '001D', success: true, created: true } },
      ],
    });
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockClear();

    const start = await send('DATA_PUSH_START', {
      orgId: org.orgId, objectName: 'Account', operation: 'upsert', externalIdField: 'Key__c', useBulkApi: false,
      records: [{ Key__c: 'A' }, { Key__c: 'B' }, { Key__c: 'C' }, { Key__c: 'D' }],
    });
    expect(start.success).toBe(true);
    const { pushId } = start.data as { pushId: string };

    const stored = await waitFor(() => new StorageService().getPushResult(pushId));
    expect(stored.ids).toEqual(['001A', '001D']);
    expect(stored.idRecordIndexes).toEqual([0, 3]);

    const complete = await waitFor(async () => sendMessage.mock.calls
      .map(call => call[0])
      .find(m => m?.type === 'DATA_PUSH_COMPLETE' && m.payload.pushId === pushId));
    expect(complete.payload).toEqual(expect.objectContaining({
      errors: [{ recordIndex: 2, message: 'Bad value' }],
      ids: ['001A', '001D'],
      idRecordIndexes: [0, 3],
    }));
  });
});
