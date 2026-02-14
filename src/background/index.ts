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
import type { MessageResponse } from '../core/types/messaging';
import type { SalesforceOrg, SObjectDescribe } from '../core/types/salesforce';
import type { PushHistoryEntry } from '../core/types/storage';

// ── Service Instances ────────────────────────────────────────────────

const messageBus = new MessageBus('background');
const storage = new StorageService();
const dataMapper = new DataMapper();
const dataValidator = new DataValidator();

// OAuth config - to be set via environment/config
const auth = new SalesforceAuth({
  clientId: '', // Set during extension configuration
  redirectUri: chrome.identity.getRedirectURL(),
  scopes: ['api', 'refresh_token', 'id'],
});

// ── Auth Handlers ────────────────────────────────────────────────────

messageBus.on('AUTH_INITIATE', async (message): Promise<MessageResponse> => {
  try {
    const { environment } = message.payload as { environment: 'production' | 'sandbox' };
    const org = await auth.login(environment);

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
      orgId: string;
      objectName: string;
      records: Record<string, unknown>[];
      operation: 'insert' | 'update' | 'upsert' | 'delete';
      externalIdField?: string;
      batchSize?: number;
      useBulkApi?: boolean;
    };

    const pushId = generateId();
    const org = await getValidOrg(payload.orgId);

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

  for (const batch of batches) {
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
      failedRecords += batch.length;
      processedRecords += batch.length;
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

console.log('WaveLink background service worker initialized');
