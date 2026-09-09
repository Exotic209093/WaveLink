/**
 * Test scaffolding for background storage, migration, and UI settings handlers.
 * Addresses Issue #105: no test files exist for background handler modules.
 * Addresses Issue #40: establishes coverage baseline for storage/migration boundary.
 *
 * These tests exercise handlers registered in src/background/index.ts
 * by importing the module and invoking handlers through the chrome.runtime.onMessage listener.
 */

import { StorageService } from '../../src/services/storage';
import type { ExtensionMessage, MessageResponse } from '../../src/core/types/messaging';
import type { MigrationProject } from '../../src/core/types/migration';

// Import background module to register handlers on the MessageBus.
import '../../src/background/index';

function makeMessage<T>(type: string, payload: T): ExtensionMessage {
  return {
    type: type as ExtensionMessage['type'],
    payload: payload as ExtensionMessage['payload'],
    requestId: `req-${Date.now()}`,
    timestamp: Date.now(),
    source: 'popup',
  };
}

function getRegisteredHandler(type: string) {
  const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
  const listener = listeners[listeners.length - 1]?.[0];
  if (!listener) throw new Error(`No listener registered for ${type}`);

  return async (message: ExtensionMessage): Promise<MessageResponse> => {
    return new Promise((resolve) => {
      const result = listener(message, {}, resolve);
      if (result === false || result === undefined) {
        resolve({ success: false, error: { code: 'NOT_HANDLED', message: 'No handler' }, requestId: message.requestId });
      }
    });
  };
}

describe('Background Storage & Migration Handlers', () => {
  let storage: StorageService;

  beforeEach(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    jest.restoreAllMocks();
    storage = new StorageService();
  });

  describe('UI_SETTINGS_GET / UI_SETTINGS_SET', () => {
    it('returns default settings when none stored', async () => {
      const handler = getRegisteredHandler('UI_SETTINGS_GET');
      const message = makeMessage('UI_SETTINGS_GET', {});
      const response = await handler(message);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('persists and retrieves UI settings', async () => {
      const setHandler = getRegisteredHandler('UI_SETTINGS_SET');
      const setMessage = makeMessage('UI_SETTINGS_SET', { theme: 'dark', defaultBatchSize: 200 });
      const setResponse = await setHandler(setMessage);
      expect(setResponse.success).toBe(true);

      const getHandler = getRegisteredHandler('UI_SETTINGS_GET');
      const getMessage = makeMessage('UI_SETTINGS_GET', {});
      const getResponse = await getHandler(getMessage);

      expect(getResponse.success).toBe(true);
      expect(getResponse.data).toEqual(expect.objectContaining({ theme: 'dark', defaultBatchSize: 200 }));
    });
  });

  describe('SAVED_QUERIES_LIST / SAVED_QUERIES_UPSERT / SAVED_QUERIES_DELETE', () => {
    it('returns empty list when no queries saved', async () => {
      const handler = getRegisteredHandler('SAVED_QUERIES_LIST');
      const message = makeMessage('SAVED_QUERIES_LIST', {});
      const response = await handler(message);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ queries: [] });
    });

    it('upserts and lists a saved query', async () => {
      const upsertHandler = getRegisteredHandler('SAVED_QUERIES_UPSERT');
      const upsertMessage = makeMessage('SAVED_QUERIES_UPSERT', {
        id: 'q1',
        name: 'Test Query',
        soql: 'SELECT Id FROM Account',
      });
      const upsertResponse = await upsertHandler(upsertMessage);
      expect(upsertResponse.success).toBe(true);

      const listHandler = getRegisteredHandler('SAVED_QUERIES_LIST');
      const listMessage = makeMessage('SAVED_QUERIES_LIST', {});
      const listResponse = await listHandler(listMessage);

      expect(listResponse.success).toBe(true);
      const listData = listResponse.data as { queries: Array<{ id: string; name: string }> };
      expect(listData.queries).toHaveLength(1);
      expect(listData.queries[0]).toEqual(expect.objectContaining({ id: 'q1', name: 'Test Query' }));
    });

    it('deletes a saved query', async () => {
      // First upsert
      const upsertHandler = getRegisteredHandler('SAVED_QUERIES_UPSERT');
      await upsertHandler(makeMessage('SAVED_QUERIES_UPSERT', { id: 'q1', name: 'Q', soql: 'SELECT Id FROM Account' }));

      // Then delete
      const deleteHandler = getRegisteredHandler('SAVED_QUERIES_DELETE');
      const deleteResponse = await deleteHandler(makeMessage('SAVED_QUERIES_DELETE', { id: 'q1' }));
      expect(deleteResponse.success).toBe(true);

      // Verify gone
      const listHandler = getRegisteredHandler('SAVED_QUERIES_LIST');
      const listResponse = await listHandler(makeMessage('SAVED_QUERIES_LIST', {}));
      const listDataAfterDelete = listResponse.data as { queries: Array<unknown> };
      expect(listDataAfterDelete.queries).toHaveLength(0);
    });
  });

  describe('MIGRATION_PROJECTS_LIST / GET / UPSERT / DELETE', () => {
    const sampleProject: Omit<MigrationProject, 'createdAt' | 'updatedAt'> = {
      id: 'mig-1',
      name: 'Test Migration',
      sourceOrgId: '00Dxx0000000001',
      targetOrgId: '00Dxx0000000002',
      status: 'draft',
      objects: [],
    };

    it('returns empty list when no projects exist', async () => {
      const handler = getRegisteredHandler('MIGRATION_PROJECTS_LIST');
      const response = await handler(makeMessage('MIGRATION_PROJECTS_LIST', {}));

      expect(response.success).toBe(true);
      const listData = response.data as { projects: Array<unknown> };
      expect(listData.projects).toEqual([]);
    });

    it('upserts and retrieves a migration project', async () => {
      const upsertHandler = getRegisteredHandler('MIGRATION_PROJECTS_UPSERT');
      const upsertResponse = await upsertHandler(makeMessage('MIGRATION_PROJECTS_UPSERT', sampleProject));
      expect(upsertResponse.success).toBe(true);

      const getHandler = getRegisteredHandler('MIGRATION_PROJECTS_GET');
      const getResponse = await getHandler(makeMessage('MIGRATION_PROJECTS_GET', { id: 'mig-1' }));

      expect(getResponse.success).toBe(true);
      const getData = getResponse.data as { project: Record<string, unknown> };
      expect(getData.project).toEqual(expect.objectContaining({ id: 'mig-1', name: 'Test Migration' }));
    });

    it('deletes a migration project', async () => {
      const upsertHandler = getRegisteredHandler('MIGRATION_PROJECTS_UPSERT');
      await upsertHandler(makeMessage('MIGRATION_PROJECTS_UPSERT', sampleProject));

      const deleteHandler = getRegisteredHandler('MIGRATION_PROJECTS_DELETE');
      const deleteResponse = await deleteHandler(makeMessage('MIGRATION_PROJECTS_DELETE', { id: 'mig-1' }));
      expect(deleteResponse.success).toBe(true);

      const listHandler = getRegisteredHandler('MIGRATION_PROJECTS_LIST');
      const listResponse = await listHandler(makeMessage('MIGRATION_PROJECTS_LIST', {}));
      const listDataAfterDelete = listResponse.data as { projects: Array<unknown> };
      expect(listDataAfterDelete.projects).toHaveLength(0);
    });
  });

  describe('ONBOARDING_GET / ONBOARDING_SET', () => {
    it('returns default onboarding state when none stored', async () => {
      const handler = getRegisteredHandler('ONBOARDING_GET');
      const response = await handler(makeMessage('ONBOARDING_GET', {}));

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('persists onboarding progress', async () => {
      const setHandler = getRegisteredHandler('ONBOARDING_SET');
      const setResponse = await setHandler(makeMessage('ONBOARDING_SET', {
        completedSteps: ['welcome', 'connect-org'],
        lastSeenVersion: '0.6.0',
      }));
      expect(setResponse.success).toBe(true);

      const getHandler = getRegisteredHandler('ONBOARDING_GET');
      const getResponse = await getHandler(makeMessage('ONBOARDING_GET', {}));

      expect(getResponse.success).toBe(true);
      expect(getResponse.data).toEqual(expect.objectContaining({
        completedSteps: ['welcome', 'connect-org'],
        lastSeenVersion: '0.6.0',
      }));
    });
  });

  describe('STORAGE_USAGE_GET', () => {
    it('returns storage usage data', async () => {
      const handler = getRegisteredHandler('STORAGE_USAGE_GET');
      const response = await handler(makeMessage('STORAGE_USAGE_GET', {}));

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });
  });

  describe('SCHEMA_CACHE_CLEAR', () => {
    it('clears schema cache without error', async () => {
      const handler = getRegisteredHandler('SCHEMA_CACHE_CLEAR');
      const response = await handler(makeMessage('SCHEMA_CACHE_CLEAR', {}));

      expect(response.success).toBe(true);
    });
  });
});