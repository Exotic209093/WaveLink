/**
 * Background Service Worker - the heart of WaveLink.
 *
 * Runs as a Manifest V3 service worker. Handles:
 * - Message routing between popup, content scripts, and services
 * - Salesforce authentication lifecycle
 * - Data push orchestration
 * - Schema caching
 */

import { MessageBus } from '../services/messaging';
import { StorageService } from '../services/storage';
import { SalesforceAuth } from '../services/salesforce/auth';
import { SalesforceApiClient } from '../services/salesforce/api-client';
import { BulkApiService } from '../services/salesforce/bulk-api';
import { DataMapper } from '../data/mappers';
import { DataValidator } from '../data/validators';
import { DEFAULT_API_VERSION, DEFAULT_BATCH_SIZE, BULK_API_THRESHOLD, SCHEMA_CACHE_TTL } from '../core/constants';
import { generateId } from '../core/utils';
import { chunkArray } from '../core/utils';
import { isSalesforceUrl } from '../core/utils';
import type { MessageResponse } from '../core/types/messaging';
import type { SalesforceOrg, SObjectDescribe } from '../core/types/salesforce';
import type { PushHistoryEntry } from '../core/types/storage';

// ── Service Instances ────────────────────────────────────────────────

const messageBus = new MessageBus('background');
const storage = new StorageService();
const dataMapper = new DataMapper();
const dataValidator = new DataValidator();

const auth = new SalesforceAuth();

// ── Auth Handlers ────────────────────────────────────────────────────

messageBus.on('AUTH_INITIATE', async (message): Promise<MessageResponse> => {
  try {
    const org = await auth.login();

    await storage.saveOrg(org);
    await storage.setActiveOrgId(org.orgId);
    await storage.setSessionToken(org.orgId, org.accessToken);

    return {
      success: true,
      data: { orgId: org.orgId, username: org.username, instanceUrl: org.instanceUrl },
      requestId: message.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message: error instanceof Error ? error.message : 'Authentication failed',
      },
      requestId: message.requestId,
    };
  }
});

messageBus.on('AUTH_STATUS', async (message): Promise<MessageResponse> => {
  try {
    const activeOrg = await storage.getActiveOrg();
    if (!activeOrg) {
      return {
        success: true,
        data: { authenticated: false },
        requestId: message.requestId,
      };
    }

    const refreshedOrg = await auth.ensureValidToken(activeOrg);
    if (refreshedOrg !== activeOrg) {
      await storage.saveOrg(refreshedOrg);
    }

    return {
      success: true,
      data: {
        authenticated: true,
        org: {
          orgId: refreshedOrg.orgId,
          username: refreshedOrg.username,
          instanceUrl: refreshedOrg.instanceUrl,
        },
      },
      requestId: message.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AUTH_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to check auth status',
      },
      requestId: message.requestId,
    };
  }
});

messageBus.on('AUTH_LOGOUT', async (message): Promise<MessageResponse> => {
  try {
    const { orgId } = message.payload as { orgId?: string };
    const targetOrgId = orgId ?? (await storage.getActiveOrgId());

    if (targetOrgId) {
      const org = await storage.getOrg(targetOrgId);
      if (org) {
        await auth.logout(org);
        await storage.removeOrg(targetOrgId);
      }
    }

    return { success: true, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'LOGOUT_ERROR',
        message: error instanceof Error ? error.message : 'Logout failed',
      },
      requestId: message.requestId,
    };
  }
});

// ── Inspector-Style Salesforce Handlers ──────────────────────────────

function getTargetTabId(payload: unknown, sender: chrome.runtime.MessageSender): number {
  const maybePayload = payload as { tabId?: number } | null;
  const tabId = maybePayload?.tabId ?? sender.tab?.id;
  if (!tabId) {
    throw new Error('No target tabId provided.');
  }
  return tabId;
}

async function resolveSfOrg(payload: unknown, sender: chrome.runtime.MessageSender): Promise<SalesforceOrg> {
  const tabId = getTargetTabId(payload, sender);
  const org = await auth.loginForTab(tabId);
  // Refresh from cookies if needed (also validates session).
  return auth.ensureValidToken(org);
}

messageBus.on('SF_TABS_LIST', async (message): Promise<MessageResponse> => {
  try {
    const tabs = await chrome.tabs.query({});
    const sfTabs = tabs
      .filter(t => typeof t.url === 'string' && isSalesforceUrl(t.url))
      .map(t => {
        const url = new URL(t.url!);
        return {
          tabId: t.id!,
          title: t.title,
          url: t.url!,
          hostname: url.hostname,
        };
      });

    return { success: true, data: { tabs: sfTabs }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SF_TABS_LIST_ERROR', message: error instanceof Error ? error.message : 'Failed to list tabs' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SF_CONTEXT_GET', async (message, sender): Promise<MessageResponse> => {
  try {
    const org = await resolveSfOrg(message.payload, sender);
    const tabId = (message.payload as { tabId?: number } | null)?.tabId ?? sender.tab?.id;
    if (tabId) {
      await storage.setUiSettings({ lastTabId: tabId });
    }
    return {
      success: true,
      data: {
        orgId: org.orgId,
        username: org.username,
        instanceUrl: org.instanceUrl,
        apiVersion: org.apiVersion,
        environment: org.environment === 'sandbox' ? 'sandbox' : 'production',
      },
      requestId: message.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SF_CONTEXT_ERROR', message: error instanceof Error ? error.message : 'Failed to resolve org context' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SF_QUERY_RUN', async (message, sender): Promise<MessageResponse> => {
  try {
    const { soql } = message.payload as { soql: string };
    const org = await resolveSfOrg(message.payload, sender);
    const client = new SalesforceApiClient({
      instanceUrl: org.instanceUrl,
      accessToken: org.accessToken,
      apiVersion: org.apiVersion ?? DEFAULT_API_VERSION,
    });
    const result = await client.query(soql);
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SF_QUERY_ERROR', message: error instanceof Error ? error.message : 'Query failed' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SF_QUERY_MORE', async (message, sender): Promise<MessageResponse> => {
  try {
    const { nextRecordsUrl } = message.payload as { nextRecordsUrl: string };
    const org = await resolveSfOrg(message.payload, sender);
    const client = new SalesforceApiClient({
      instanceUrl: org.instanceUrl,
      accessToken: org.accessToken,
      apiVersion: org.apiVersion ?? DEFAULT_API_VERSION,
    });
    const result = await client.queryMore(nextRecordsUrl);
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SF_QUERY_MORE_ERROR', message: error instanceof Error ? error.message : 'QueryMore failed' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SF_DESCRIBE_GLOBAL', async (message, sender): Promise<MessageResponse> => {
  try {
    const org = await resolveSfOrg(message.payload, sender);
    const client = new SalesforceApiClient({
      instanceUrl: org.instanceUrl,
      accessToken: org.accessToken,
      apiVersion: org.apiVersion ?? DEFAULT_API_VERSION,
    });
    const result = await client.describeGlobal();
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SF_DESCRIBE_GLOBAL_ERROR', message: error instanceof Error ? error.message : 'Describe global failed' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SF_DESCRIBE_SOBJECT', async (message, sender): Promise<MessageResponse> => {
  try {
    const { objectName } = message.payload as { objectName: string };
    const org = await resolveSfOrg(message.payload, sender);

    const cached = await storage.getCachedSchema(org.orgId, objectName);
    if (cached) {
      return { success: true, data: cached, requestId: message.requestId };
    }

    const client = new SalesforceApiClient({
      instanceUrl: org.instanceUrl,
      accessToken: org.accessToken,
      apiVersion: org.apiVersion ?? DEFAULT_API_VERSION,
    });
    const result = await client.describeSObject(objectName);
    await storage.setCachedSchema(org.orgId, objectName, result, SCHEMA_CACHE_TTL);
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SF_DESCRIBE_SOBJECT_ERROR', message: error instanceof Error ? error.message : 'Describe SObject failed' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SF_LIMITS_GET', async (message, sender): Promise<MessageResponse> => {
  try {
    const org = await resolveSfOrg(message.payload, sender);
    const client = new SalesforceApiClient({
      instanceUrl: org.instanceUrl,
      accessToken: org.accessToken,
      apiVersion: org.apiVersion ?? DEFAULT_API_VERSION,
    });
    const result = await client.getLimits();
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SF_LIMITS_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch limits' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('UI_SETTINGS_GET', async (message): Promise<MessageResponse> => {
  try {
    const uiSettings = await storage.getUiSettings();
    return { success: true, data: uiSettings, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'UI_SETTINGS_GET_ERROR', message: error instanceof Error ? error.message : 'Failed to read UI settings' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('UI_SETTINGS_SET', async (message): Promise<MessageResponse> => {
  try {
    const patch = message.payload as Record<string, unknown>;
    const uiSettings = await storage.setUiSettings(patch as never);
    return { success: true, data: uiSettings, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'UI_SETTINGS_SET_ERROR', message: error instanceof Error ? error.message : 'Failed to write UI settings' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SAVED_QUERIES_LIST', async (message): Promise<MessageResponse> => {
  try {
    const queries = await storage.getSavedQueries();
    return { success: true, data: { queries }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SAVED_QUERIES_LIST_ERROR', message: error instanceof Error ? error.message : 'Failed to list saved queries' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SAVED_QUERIES_UPSERT', async (message): Promise<MessageResponse> => {
  try {
    const query = message.payload as { id: string; name: string; soql: string };
    const saved = await storage.upsertSavedQuery(query);
    return { success: true, data: saved, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SAVED_QUERIES_UPSERT_ERROR', message: error instanceof Error ? error.message : 'Failed to save query' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SAVED_QUERIES_DELETE', async (message): Promise<MessageResponse> => {
  try {
    const { id } = message.payload as { id: string };
    await storage.deleteSavedQuery(id);
    return { success: true, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SAVED_QUERIES_DELETE_ERROR', message: error instanceof Error ? error.message : 'Failed to delete query' },
      requestId: message.requestId,
    };
  }
});

async function togglePanelOnActiveTab(): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab?.id) return;
  if (!tab.url || !isSalesforceUrl(tab.url)) return;
  try {
    await messageBus.sendToTab(tab.id, 'PANEL_TOGGLE', {});
  } catch {
    // Ignore: content script may not be loaded yet.
  }
}

messageBus.on('PANEL_TOGGLE', async (message): Promise<MessageResponse> => {
  try {
    await togglePanelOnActiveTab();
    return { success: true, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'PANEL_TOGGLE_ERROR', message: error instanceof Error ? error.message : 'Failed to toggle panel' },
      requestId: message.requestId,
    };
  }
});

// ── Org Handlers ─────────────────────────────────────────────────────

messageBus.on('ORG_LIST', async (message): Promise<MessageResponse> => {
  const orgs = await storage.getOrgs();
  const activeOrgId = await storage.getActiveOrgId();
  return {
    success: true,
    data: { orgs: Object.values(orgs), activeOrgId },
    requestId: message.requestId,
  };
});

messageBus.on('ORG_SWITCH', async (message): Promise<MessageResponse> => {
  const { orgId } = message.payload as { orgId: string };
  const org = await storage.getOrg(orgId);
  if (!org) {
    return {
      success: false,
      error: { code: 'ORG_NOT_FOUND', message: `Org ${orgId} not found` },
      requestId: message.requestId,
    };
  }
  await storage.setActiveOrgId(orgId);
  return { success: true, data: { orgId }, requestId: message.requestId };
});

// ── Schema Handlers ──────────────────────────────────────────────────

messageBus.on('SCHEMA_DESCRIBE', async (message): Promise<MessageResponse> => {
  try {
    const { orgId } = message.payload as { orgId: string };
    const org = await getValidOrg(orgId);
    const client = createApiClient(org);
    const result = await client.describeGlobal();

    return {
      success: true,
      data: result.sobjects.filter(s => s.createable),
      requestId: message.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SCHEMA_ERROR',
        message: error instanceof Error ? error.message : 'Failed to describe schema',
      },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SCHEMA_DESCRIBE_SOBJECT', async (message): Promise<MessageResponse> => {
  try {
    const { orgId, objectName } = message.payload as { orgId: string; objectName: string };

    // Check cache first
    const cached = await storage.getCachedSchema(orgId, objectName);
    if (cached) {
      return { success: true, data: cached, requestId: message.requestId };
    }

    const org = await getValidOrg(orgId);
    const client = createApiClient(org);
    const result = await client.describeSObject(objectName);

    // Cache the result
    await storage.setCachedSchema(orgId, objectName, result, SCHEMA_CACHE_TTL);

    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SCHEMA_ERROR',
        message: error instanceof Error ? error.message : 'Failed to describe SObject',
      },
      requestId: message.requestId,
    };
  }
});

// ── Data Push Handlers ───────────────────────────────────────────────

messageBus.on('DATA_PUSH_START', async (message): Promise<MessageResponse> => {
  try {
    const payload = message.payload as {
      orgId?: string;
      tabId?: number;
      objectName: string;
      records: Record<string, unknown>[];
      operation: 'insert' | 'update' | 'upsert' | 'delete';
      externalIdField?: string;
      batchSize?: number;
      useBulkApi?: boolean;
    };

    const pushId = generateId();
    if (!payload.tabId && !payload.orgId) {
      throw new Error('DATA_PUSH_START requires either tabId (full app) or orgId (popup).');
    }
    const org = payload.tabId
      ? await auth.ensureValidToken(await auth.loginForTab(payload.tabId))
      : await getValidOrg(payload.orgId!);

    // Determine API strategy
    const useBulk = payload.useBulkApi ?? payload.records.length >= BULK_API_THRESHOLD;

    if (useBulk) {
      // Bulk API 2.0 path
      executeBulkPush(pushId, org, payload);
    } else {
      // REST API (SObject Collections) path
      executeRestPush(pushId, org, payload);
    }

    return {
      success: true,
      data: { pushId, strategy: useBulk ? 'bulk' : 'rest' },
      requestId: message.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DATA_PUSH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to start data push',
      },
      requestId: message.requestId,
    };
  }
});

// ── Push Execution (runs asynchronously) ─────────────────────────────

async function executeRestPush(
  pushId: string,
  org: SalesforceOrg,
  payload: {
    objectName: string;
    records: Record<string, unknown>[];
    operation: 'insert' | 'update' | 'upsert' | 'delete';
    batchSize?: number;
  },
): Promise<void> {
  const client = createApiClient(org);
  const batchSize = payload.batchSize ?? DEFAULT_BATCH_SIZE;
  const batches = chunkArray(payload.records, batchSize);

  let processedRecords = 0;
  let failedRecords = 0;
  const errors: Array<{ recordIndex: number; message: string }> = [];
  let broadcastedError = false;

  for (const batch of batches) {
    const batchStartIndex = processedRecords;
    try {
      let results;
      switch (payload.operation) {
        case 'insert':
          results = await client.collectionCreate(payload.objectName, batch);
          break;
        case 'update':
          results = await client.collectionUpdate(batch as Array<{ Id: string }>);
          break;
        case 'delete':
          results = await client.collectionDelete(batch.map(r => r.Id as string));
          break;
        default:
          results = await client.collectionCreate(payload.objectName, batch);
      }

      for (const result of results) {
        processedRecords++;
        if (!result.success) {
          failedRecords++;
          errors.push({
            recordIndex: processedRecords - 1,
            message: result.errors.map(e => e.message).join('; '),
          });
        }
      }

      // Broadcast progress
      messageBus.broadcast('DATA_PUSH_PROGRESS', {
        pushId,
        totalRecords: payload.records.length,
        processedRecords,
        failedRecords,
        status: 'processing',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch failed';
      for (let i = 0; i < batch.length; i++) {
        errors.push({ recordIndex: batchStartIndex + i, message: `Batch failed: ${message}` });
      }
      failedRecords += batch.length;
      processedRecords += batch.length;

      messageBus.broadcast('DATA_PUSH_PROGRESS', {
        pushId,
        totalRecords: payload.records.length,
        processedRecords,
        failedRecords,
        status: 'processing',
      });

      if (!broadcastedError) {
        broadcastedError = true;
        messageBus.broadcast('DATA_PUSH_ERROR', { pushId, error: message });
      }
    }
  }

  // Save to history
  const historyEntry: PushHistoryEntry = {
    id: pushId,
    orgId: org.orgId,
    objectName: payload.objectName,
    operation: payload.operation,
    totalRecords: payload.records.length,
    successCount: processedRecords - failedRecords,
    failureCount: failedRecords,
    startedAt: Date.now(),
    completedAt: Date.now(),
    errors: errors.length > 0 ? errors : undefined,
  };

  await storage.addPushHistory(historyEntry);

  messageBus.broadcast('DATA_PUSH_COMPLETE', {
    pushId,
    totalRecords: payload.records.length,
    processedRecords,
    failedRecords,
    status: 'complete',
  });
}

async function executeBulkPush(
  pushId: string,
  org: SalesforceOrg,
  payload: {
    objectName: string;
    records: Record<string, unknown>[];
    operation: 'insert' | 'update' | 'upsert' | 'delete';
    externalIdField?: string;
  },
): Promise<void> {
  const bulkApi = new BulkApiService({
    instanceUrl: org.instanceUrl,
    accessToken: org.accessToken,
    apiVersion: org.apiVersion,
  });

  try {
    const job = await bulkApi.createJob({
      object: payload.objectName,
      operation: payload.operation,
      externalIdFieldName: payload.externalIdField,
    });

    const csvData = bulkApi.recordsToCsv(payload.records);
    await bulkApi.uploadJobData(job.id, csvData);
    await bulkApi.closeJob(job.id);

    const completedJob = await bulkApi.pollJobCompletion(job.id, 5000, 120, (progressJob) => {
      messageBus.broadcast('DATA_PUSH_PROGRESS', {
        pushId,
        totalRecords: payload.records.length,
        processedRecords: progressJob.numberRecordsProcessed,
        failedRecords: progressJob.numberRecordsFailed,
        status: 'processing',
      });
    });

    const historyEntry: PushHistoryEntry = {
      id: pushId,
      orgId: org.orgId,
      objectName: payload.objectName,
      operation: payload.operation,
      totalRecords: payload.records.length,
      successCount: completedJob.numberRecordsProcessed - completedJob.numberRecordsFailed,
      failureCount: completedJob.numberRecordsFailed,
      startedAt: Date.now(),
      completedAt: Date.now(),
    };

    await storage.addPushHistory(historyEntry);

    messageBus.broadcast('DATA_PUSH_COMPLETE', {
      pushId,
      totalRecords: payload.records.length,
      processedRecords: completedJob.numberRecordsProcessed,
      failedRecords: completedJob.numberRecordsFailed,
      status: completedJob.state === 'JobComplete' ? 'complete' : 'error',
    });
  } catch (error) {
    messageBus.broadcast('DATA_PUSH_ERROR', {
      pushId,
      error: error instanceof Error ? error.message : 'Bulk push failed',
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

async function getValidOrg(orgId: string): Promise<SalesforceOrg> {
  const org = await storage.getOrg(orgId);
  if (!org) {
    throw new Error(`Org not found: ${orgId}`);
  }

  const refreshed = await auth.ensureValidToken(org);
  if (refreshed !== org) {
    await storage.saveOrg(refreshed);
  }

  return refreshed;
}

function createApiClient(org: SalesforceOrg): SalesforceApiClient {
  return new SalesforceApiClient({
    instanceUrl: org.instanceUrl,
    accessToken: org.accessToken,
    apiVersion: org.apiVersion ?? DEFAULT_API_VERSION,
  });
}

// ── Service Worker Lifecycle ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`WaveLink installed: ${details.reason}`);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-panel') {
    togglePanelOnActiveTab().catch(() => {
      // Ignore
    });
  }
});

console.log('WaveLink background service worker initialized');
