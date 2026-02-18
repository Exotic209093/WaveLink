/**
 * Background Service Worker - the heart of WaveLink.
 *
 * Runs as a Manifest V3 service worker. This is where all privileged extension work happens:
 * - Message routing between popup, content scripts, and services
 * - Salesforce authentication lifecycle
 * - Data push orchestration
 * - Schema caching
 *
 * Design notes:
 * - We support two modes of "context":
 *   1) Stored orgs (`orgId`) for legacy popup flows.
 *   2) Per-tab Inspector-style auth (`tabId`) which derives a session token from cookies at request time.
 * - Handlers are intentionally small and side-effect scoped; long-running pushes execute asynchronously and
 *   report progress via broadcast messages.
 *
 * Complexity:
 * - Most handlers are O(1) aside from operations that enumerate browser tabs (O(T)) or iterate record batches (O(N)).
 */

import { MessageBus } from '../services/messaging';
import { StorageService } from '../services/storage';
import { SalesforceAuth } from '../services/salesforce/auth';
import { SalesforceApiClient } from '../services/salesforce/api-client';
import { BulkApiService } from '../services/salesforce/bulk-api';
import { buildUpsertSubrequests, parseUpsertCompositeResponse } from '../services/salesforce/composite-upsert';
import { DataMapper } from '../data/mappers';
import { DataValidator } from '../data/validators';
import { API_BASE_PATH, DEFAULT_API_VERSION, DEFAULT_BATCH_SIZE, BULK_API_THRESHOLD, MAX_COMPOSITE_BATCH_SIZE, SCHEMA_CACHE_TTL, UNDO_TTL_MS } from '../core/constants';
import { generateId } from '../core/utils';
import { isSalesforceUrl } from '../core/utils';
import type { MessageResponse } from '../core/types/messaging';
import type { SalesforceOrg, SObjectDescribe } from '../core/types/salesforce';
import type { PushHistoryEntry, PushResult, PushTransaction } from '../core/types/storage';

// ── Service Instances ────────────────────────────────────────────────

const messageBus = new MessageBus('background');
const storage = new StorageService();
const dataMapper = new DataMapper();
const dataValidator = new DataValidator();

const auth = new SalesforceAuth();

// In-memory registry for cancellation; cleared when the MV3 service worker is restarted.
const activePushes = new Map<string, { abortController: AbortController }>();

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
  /**
   * Resolve the target Salesforce tab for Inspector-style operations.
   *
   * Why:
   * - The full-page app explicitly passes `tabId`.
   * - Content-script initiated requests can rely on `sender.tab`.
   *
   * Data types:
   * - `payload` is unknown at runtime; we treat it as `{ tabId?: number } | null` and validate.
   *
   * Complexity: O(1).
   */
  const maybePayload = payload as { tabId?: number } | null;
  const tabId = maybePayload?.tabId ?? sender.tab?.id;
  if (!tabId) {
    throw new Error('No target tabId provided.');
  }
  return tabId;
}

async function resolveSfOrg(payload: unknown, sender: chrome.runtime.MessageSender): Promise<SalesforceOrg> {
  /**
   * Derive a valid `SalesforceOrg` (instanceUrl + accessToken + identity) for a specific Salesforce tab.
   *
   * Why this approach:
   * - We avoid OAuth and instead reuse the existing Salesforce browser session (Inspector-style).
   * - Tokens can change; we "ensureValidToken" by re-reading cookies when needed.
   *
   * Complexity:
   * - Dominated by network validation calls performed inside auth, so "O(1)" in terms of JS data structures.
   */
  const tabId = getTargetTabId(payload, sender);
  const org = await auth.loginForTab(tabId);
  // Refresh from cookies if needed (also validates session).
  return auth.ensureValidToken(org);
}

messageBus.on('SF_TABS_LIST', async (message): Promise<MessageResponse> => {
  try {
    /**
     * List all open Salesforce tabs for the full-page app selector.
     *
     * Data types:
     * - Returns `{ tabs: Array<{ tabId: number; title?: string; url: string; hostname: string }> }`.
     *
     * Complexity: O(T) where T is the number of open tabs in the browser.
     */
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
    /**
     * Resolve org context for a given tab.
     *
     * Why:
     * - UI needs identity + instanceUrl to label the org and build API requests.
     * - We gate persistence of `lastTabId` to the full-page app so the popup doesn't fight per-tab selection.
     *
     * Complexity: O(1) in JS terms (auth may do network validation).
     */
    const org = await resolveSfOrg(message.payload, sender);
    const tabId = (message.payload as { tabId?: number } | null)?.tabId ?? sender.tab?.id;
    // Only persist the user's last selected tab from the full app.
    // The popup should not influence per-app-tab selection.
    if (tabId && message.source === 'app') {
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

messageBus.on('SF_TOOLING_QUERY_RUN', async (message, sender): Promise<MessageResponse> => {
  try {
    const { soql } = message.payload as { soql: string };
    const org = await resolveSfOrg(message.payload, sender);
    const client = new SalesforceApiClient({
      instanceUrl: org.instanceUrl,
      accessToken: org.accessToken,
      apiVersion: org.apiVersion ?? DEFAULT_API_VERSION,
    });
    const result = await client.toolingQuery(soql);
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SF_TOOLING_QUERY_ERROR', message: error instanceof Error ? error.message : 'Tooling query failed' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('SF_TOOLING_QUERY_MORE', async (message, sender): Promise<MessageResponse> => {
  try {
    const { nextRecordsUrl } = message.payload as { nextRecordsUrl: string };
    const org = await resolveSfOrg(message.payload, sender);
    const client = new SalesforceApiClient({
      instanceUrl: org.instanceUrl,
      accessToken: org.accessToken,
      apiVersion: org.apiVersion ?? DEFAULT_API_VERSION,
    });
    const result = await client.toolingQueryMore(nextRecordsUrl);
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SF_TOOLING_QUERY_MORE_ERROR', message: error instanceof Error ? error.message : 'Tooling queryMore failed' },
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
    const uiSettingsForTtl = await storage.getUiSettings();
    const ttl = uiSettingsForTtl.schemaCacheTtlMinutes ? uiSettingsForTtl.schemaCacheTtlMinutes * 60 * 1000 : SCHEMA_CACHE_TTL;
    await storage.setCachedSchema(org.orgId, objectName, result, ttl);
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

// ── Query Folders Handlers ──────────────────────────────────────────

messageBus.on('QUERY_FOLDERS_GET', async (message): Promise<MessageResponse> => {
  try {
    const folders = await storage.getQueryFolders();
    return { success: true, data: { folders }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'QUERY_FOLDERS_GET_ERROR', message: error instanceof Error ? error.message : 'Failed to list query folders' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('QUERY_FOLDERS_UPSERT', async (message): Promise<MessageResponse> => {
  try {
    const payload = message.payload as { id: string; name: string; parentId?: string };
    const folder = await storage.upsertQueryFolder(payload);
    return { success: true, data: folder, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'QUERY_FOLDERS_UPSERT_ERROR', message: error instanceof Error ? error.message : 'Failed to save query folder' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('QUERY_FOLDERS_DELETE', async (message): Promise<MessageResponse> => {
  try {
    const { id } = message.payload as { id: string };
    await storage.deleteQueryFolder(id);
    return { success: true, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'QUERY_FOLDERS_DELETE_ERROR', message: error instanceof Error ? error.message : 'Failed to delete query folder' },
      requestId: message.requestId,
    };
  }
});

// ── Templates Handlers ──────────────────────────────────────────────

messageBus.on('TEMPLATES_LIST', async (message): Promise<MessageResponse> => {
  try {
    const templates = await storage.getDataTemplates();
    return { success: true, data: { templates }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'TEMPLATES_LIST_ERROR', message: error instanceof Error ? error.message : 'Failed to list templates' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('TEMPLATES_UPSERT', async (message): Promise<MessageResponse> => {
  try {
    const payload = message.payload as Parameters<typeof storage.upsertDataTemplate>[0];
    const template = await storage.upsertDataTemplate(payload);
    return { success: true, data: template, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'TEMPLATES_UPSERT_ERROR', message: error instanceof Error ? error.message : 'Failed to save template' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('TEMPLATES_DELETE', async (message): Promise<MessageResponse> => {
  try {
    const { id } = message.payload as { id: string };
    await storage.deleteDataTemplate(id);
    return { success: true, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'TEMPLATES_DELETE_ERROR', message: error instanceof Error ? error.message : 'Failed to delete template' },
      requestId: message.requestId,
    };
  }
});

// ── Push Transactions (Undo) Handlers ───────────────────────────────

messageBus.on('TRANSACTIONS_GET', async (message): Promise<MessageResponse> => {
  try {
    const transactions = await storage.getPushTransactions();
    return { success: true, data: { transactions }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'TRANSACTIONS_GET_ERROR', message: error instanceof Error ? error.message : 'Failed to get transactions' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('TRANSACTIONS_CLEAR', async (message): Promise<MessageResponse> => {
  try {
    const { id } = message.payload as { id: string };
    await storage.removePushTransaction(id);
    return { success: true, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'TRANSACTIONS_CLEAR_ERROR', message: error instanceof Error ? error.message : 'Failed to remove transaction' },
      requestId: message.requestId,
    };
  }
});

// ── Pipeline Handlers ───────────────────────────────────────────────

messageBus.on('PIPELINES_LIST', async (message): Promise<MessageResponse> => {
  try {
    const pipelines = await storage.getPipelines();
    return { success: true, data: { pipelines }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'PIPELINES_LIST_ERROR', message: error instanceof Error ? error.message : 'Failed to list pipelines' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('PIPELINES_UPSERT', async (message): Promise<MessageResponse> => {
  try {
    const payload = message.payload as Parameters<typeof storage.upsertPipeline>[0];
    const pipeline = await storage.upsertPipeline(payload);
    return { success: true, data: pipeline, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'PIPELINES_UPSERT_ERROR', message: error instanceof Error ? error.message : 'Failed to save pipeline' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('PIPELINES_DELETE', async (message): Promise<MessageResponse> => {
  try {
    const { id } = message.payload as { id: string };
    await storage.deletePipeline(id);
    return { success: true, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'PIPELINES_DELETE_ERROR', message: error instanceof Error ? error.message : 'Failed to delete pipeline' },
      requestId: message.requestId,
    };
  }
});

// ── Quality Rule Sets ────────────────────────────────────────────

messageBus.on('QUALITY_RULES_LIST', async (message): Promise<MessageResponse> => {
  try {
    const ruleSets = await storage.getQualityRuleSets();
    return { success: true, data: { ruleSets }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'QUALITY_RULES_LIST_ERROR', message: error instanceof Error ? error.message : 'Failed to list rule sets' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('QUALITY_RULES_UPSERT', async (message): Promise<MessageResponse> => {
  try {
    const payload = message.payload as Parameters<typeof storage.upsertQualityRuleSet>[0];
    const ruleSet = await storage.upsertQualityRuleSet(payload);
    return { success: true, data: ruleSet, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'QUALITY_RULES_UPSERT_ERROR', message: error instanceof Error ? error.message : 'Failed to save rule set' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('QUALITY_RULES_DELETE', async (message): Promise<MessageResponse> => {
  try {
    const { id } = message.payload as { id: string };
    await storage.deleteQualityRuleSet(id);
    return { success: true, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'QUALITY_RULES_DELETE_ERROR', message: error instanceof Error ? error.message : 'Failed to delete rule set' },
      requestId: message.requestId,
    };
  }
});

// ── Onboarding ───────────────────────────────────────────────────

messageBus.on('ONBOARDING_GET', async (message): Promise<MessageResponse> => {
  try {
    const progress = await storage.getOnboarding();
    return { success: true, data: progress, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'ONBOARDING_GET_ERROR', message: error instanceof Error ? error.message : 'Failed to get onboarding' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('ONBOARDING_SET', async (message): Promise<MessageResponse> => {
  try {
    const payload = message.payload as { completedSteps?: string[]; dismissedAt?: number; lastSeenVersion?: string };
    const current = await storage.getOnboarding();
    await storage.setOnboarding({ ...current, ...payload });
    return { success: true, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'ONBOARDING_SET_ERROR', message: error instanceof Error ? error.message : 'Failed to save onboarding' },
      requestId: message.requestId,
    };
  }
});

// ── Schema Cache Management ──────────────────────────────────────────

messageBus.on('SCHEMA_CACHE_CLEAR', async (message): Promise<MessageResponse> => {
  try {
    const payload = message.payload as { orgId?: string };
    const cleared = await storage.clearSchemaCache(payload.orgId);
    return { success: true, data: { cleared }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'SCHEMA_CACHE_CLEAR_ERROR', message: error instanceof Error ? error.message : 'Failed to clear schema cache' },
      requestId: message.requestId,
    };
  }
});

// ── Storage Management ───────────────────────────────────────────────

messageBus.on('STORAGE_USAGE_GET', async (message): Promise<MessageResponse> => {
  try {
    const usage = await storage.getStorageUsage();
    return { success: true, data: usage, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'STORAGE_USAGE_ERROR', message: error instanceof Error ? error.message : 'Failed to get storage usage' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('STORAGE_PURGE_OLD', async (message): Promise<MessageResponse> => {
  try {
    const result = await storage.purgeOldData();
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'STORAGE_PURGE_ERROR', message: error instanceof Error ? error.message : 'Failed to purge old data' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('DATA_EXPORT', async (message): Promise<MessageResponse> => {
  try {
    const data = await storage.exportUserData();
    return { success: true, data, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'DATA_EXPORT_ERROR', message: error instanceof Error ? error.message : 'Failed to export data' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('DATA_IMPORT', async (message): Promise<MessageResponse> => {
  try {
    const payload = message.payload as Record<string, unknown>;
    const result = await storage.importUserData(payload);
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'DATA_IMPORT_ERROR', message: error instanceof Error ? error.message : 'Failed to import data' },
      requestId: message.requestId,
    };
  }
});

async function togglePanelOnActiveTab(): Promise<void> {
  /**
   * Ask the active Salesforce tab's content script to toggle the in-page panel.
   *
   * Why:
   * - The panel UI runs in the page context (content script + shadow DOM).
   * - Background is the coordinator that can find the active tab and relay commands.
   *
   * Complexity: O(1) in JS work (single tab lookup + message send).
   */
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

messageBus.on('ORG_CONNECT_TAB', async (message): Promise<MessageResponse> => {
  try {
    const { tabId } = message.payload as { tabId: number };
    const org = await auth.loginForTab(tabId);
    await storage.saveOrg(org);
    await storage.setSessionToken(org.orgId, org.accessToken);
    return {
      success: true,
      data: { orgId: org.orgId, username: org.username, instanceUrl: org.instanceUrl },
      requestId: message.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: { code: 'ORG_CONNECT_TAB_ERROR', message: error instanceof Error ? error.message : 'Failed to connect org from tab' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('ORG_REFRESH', async (message): Promise<MessageResponse> => {
  try {
    const { orgId } = message.payload as { orgId: string };
    const org = await storage.getOrg(orgId);
    if (!org) {
      return { success: false, error: { code: 'ORG_NOT_FOUND', message: 'Org not found' }, requestId: message.requestId };
    }
    const refreshed = await auth.ensureValidToken(org);
    if (refreshed !== org) await storage.saveOrg(refreshed);
    return { success: true, data: { valid: true, orgId }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'ORG_REFRESH_ERROR', message: error instanceof Error ? error.message : 'Failed to refresh org token' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('ORG_UPDATE', async (message): Promise<MessageResponse> => {
  try {
    const { orgId, nickname } = message.payload as { orgId: string; nickname?: string };
    const org = await storage.getOrg(orgId);
    if (!org) {
      return { success: false, error: { code: 'ORG_NOT_FOUND', message: 'Org not found' }, requestId: message.requestId };
    }
    if (nickname !== undefined) org.nickname = nickname;
    await storage.saveOrg(org);
    return { success: true, data: { orgId }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'ORG_UPDATE_ERROR', message: error instanceof Error ? error.message : 'Failed to update org' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('CROSS_ORG_QUERY', async (message): Promise<MessageResponse> => {
  try {
    const { orgId, soql } = message.payload as { orgId: string; soql: string };
    const org = await getValidOrg(orgId);
    const client = createApiClient(org);
    const result = await client.query(soql);
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'CROSS_ORG_QUERY_ERROR', message: error instanceof Error ? error.message : 'Cross-org query failed' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('CROSS_ORG_DESCRIBE', async (message): Promise<MessageResponse> => {
  try {
    const { orgId, objectName } = message.payload as { orgId: string; objectName?: string };
    const org = await getValidOrg(orgId);
    const client = createApiClient(org);
    if (objectName) {
      const cached = await storage.getCachedSchema(orgId, objectName);
      if (cached) return { success: true, data: cached, requestId: message.requestId };
      const result = await client.describeSObject(objectName);
      const uiSettingsForTtl = await storage.getUiSettings();
      const ttl = uiSettingsForTtl.schemaCacheTtlMinutes ? uiSettingsForTtl.schemaCacheTtlMinutes * 60 * 1000 : SCHEMA_CACHE_TTL;
      await storage.setCachedSchema(orgId, objectName, result, ttl);
      return { success: true, data: result, requestId: message.requestId };
    }
    const result = await client.describeGlobal();
    return { success: true, data: result, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: { code: 'CROSS_ORG_DESCRIBE_ERROR', message: error instanceof Error ? error.message : 'Cross-org describe failed' },
      requestId: message.requestId,
    };
  }
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

    // Cache the result with user-configured TTL
    const uiSettingsForTtl2 = await storage.getUiSettings();
    const ttl2 = uiSettingsForTtl2.schemaCacheTtlMinutes ? uiSettingsForTtl2.schemaCacheTtlMinutes * 60 * 1000 : SCHEMA_CACHE_TTL;
    await storage.setCachedSchema(orgId, objectName, result, ttl2);

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
    /**
     * Kick off a data push and return immediately with a `pushId`.
     *
     * Why this is "fire-and-forget":
     * - Chrome message channels have timeouts and the UI expects an immediate response.
     * - The real work happens asynchronously and reports progress via `DATA_PUSH_PROGRESS` broadcasts.
     *
     * Data types:
     * - `records` is `Record<string, unknown>[]` to support arbitrary CSV/JSON inputs.
     * - Target org can be resolved from `tabId` (preferred) or `orgId` (legacy).
     *
     * Complexity: O(1) here; the async job is O(N) over records.
     */
    const payload = message.payload as {
      orgId?: string;
      tabId?: number;
      objectName: string;
      records: Record<string, unknown>[];
      operation: 'insert' | 'update' | 'upsert' | 'delete';
      externalIdField?: string;
      batchSize?: number;
      threads?: number;
      useBulkApi?: boolean;
    };

    // Read user's advanced settings to apply defaults
    const uiSettings = await storage.getUiSettings();
    if (payload.batchSize === undefined && uiSettings.defaultBatchSize) {
      payload.batchSize = uiSettings.defaultBatchSize;
    }
    if (payload.threads === undefined && uiSettings.defaultThreads) {
      payload.threads = uiSettings.defaultThreads;
    }

    const pushId = generateId();
    const startedAt = Date.now();
    const abortController = new AbortController();
    activePushes.set(pushId, { abortController });

    // Persist push state to session storage for resilience across service worker restarts
    storage.setActivePush({
      id: pushId,
      orgId: payload.orgId ?? '',
      objectName: payload.objectName,
      operation: payload.operation,
      totalRecords: payload.records.length,
      processedRecords: 0,
      failedRecords: 0,
      startedAt,
      status: 'processing',
    }).catch(() => undefined);

    if (!payload.tabId && !payload.orgId) {
      throw new Error('DATA_PUSH_START requires either tabId (full app) or orgId (popup).');
    }
    const org = payload.tabId
      ? await auth.ensureValidToken(await auth.loginForTab(payload.tabId))
      : await getValidOrg(payload.orgId!);

    // Determine API strategy
    const useBulk = payload.useBulkApi ?? payload.records.length >= BULK_API_THRESHOLD;

    const strategy = useBulk ? 'bulk' : 'rest';

    if (useBulk) {
      // Bulk API 2.0 path
      executeBulkPush(pushId, org, payload, { startedAt, abortSignal: abortController.signal, strategy })
        .then(() => storage.updateActivePushStatus(pushId, 'complete').catch(() => undefined))
        .catch(() => storage.updateActivePushStatus(pushId, 'error').catch(() => undefined))
        .finally(() => activePushes.delete(pushId));
    } else {
      // REST API (SObject Collections + Composite) path
      executeRestPush(pushId, org, payload, { startedAt, abortSignal: abortController.signal, strategy })
        .then(() => storage.updateActivePushStatus(pushId, 'complete').catch(() => undefined))
        .catch(() => storage.updateActivePushStatus(pushId, 'error').catch(() => undefined))
        .finally(() => activePushes.delete(pushId));
    }

    return {
      success: true,
      data: { pushId, strategy },
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

function isAbortLikeError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError')
    || (error instanceof Error && error.message === 'Cancelled')
  );
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

async function executeRestPush(
  pushId: string,
  org: SalesforceOrg,
  payload: {
    objectName: string;
    records: Record<string, unknown>[];
    operation: 'insert' | 'update' | 'upsert' | 'delete';
    externalIdField?: string;
    batchSize?: number;
    threads?: number;
  },
  ctx: { startedAt: number; abortSignal: AbortSignal; strategy: 'rest' | 'bulk' },
): Promise<void> {
  /**
   * Execute a push using REST (SObject Collections / Composite-style endpoints).
   *
   * Why REST here:
   * - For smaller datasets REST is simpler and provides per-record errors inline.
   * - Bulk API becomes more efficient above a threshold and is handled elsewhere.
   *
   * Data types:
   * - `records` is an array of "untyped" objects (`Record<string, unknown>`). Mapping/validation happens
   *   in DataMapper/DataValidator before API submission.
   *
   * Complexity:
   * - O(N) records processed overall, with O(B) per batch where B is `batchSize`.
   * - Network calls: O(ceil(N / B)).
   */
  const client = createApiClient(org);

  const effectiveBatchSize =
    payload.operation === 'upsert'
      ? MAX_COMPOSITE_BATCH_SIZE
      : clampInt(payload.batchSize ?? DEFAULT_BATCH_SIZE, 1, DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const threads = clampInt(payload.threads ?? 1, 1, 4, 1);

  const batchDescs: Array<{ start: number; batch: Record<string, unknown>[] }> = [];
  for (let start = 0; start < payload.records.length; start += effectiveBatchSize) {
    batchDescs.push({ start, batch: payload.records.slice(start, start + effectiveBatchSize) });
  }

  let processedRecords = 0;
  let failedRecords = 0;
  const errors: Array<{ recordIndex: number; message: string }> = [];
  const successfulIds: string[] = [];
  let broadcastedError = false;
  let cancelled = false;

  const applyBatchResult = (res: {
    processed: number;
    failed: number;
    ids: string[];
    errors: Array<{ recordIndex: number; message: string }>;
    batchLevelError?: string;
  }): void => {
    processedRecords += res.processed;
    failedRecords += res.failed;
    if (res.ids.length) successfulIds.push(...res.ids);
    if (res.errors.length) errors.push(...res.errors);

    messageBus.broadcast('DATA_PUSH_PROGRESS', {
      pushId,
      totalRecords: payload.records.length,
      processedRecords,
      failedRecords,
      status: 'processing',
    });

    if (res.batchLevelError && !broadcastedError) {
      broadcastedError = true;
      messageBus.broadcast('DATA_PUSH_ERROR', { pushId, error: res.batchLevelError });
    }
  };

  async function runBatch(
    desc: { start: number; batch: Record<string, unknown>[] },
  ): Promise<{ aborted: true } | { aborted: false; result: Parameters<typeof applyBatchResult>[0] }> {
    if (ctx.abortSignal.aborted) return { aborted: true };
    try {
      const batch = desc.batch;
      const start = desc.start;

      if (payload.operation === 'upsert') {
        const externalIdField = payload.externalIdField;
        if (!externalIdField) {
          return {
            aborted: false,
            result: {
              processed: batch.length,
              failed: batch.length,
              ids: [],
              errors: batch.map((_, i) => ({ recordIndex: start + i, message: 'Upsert requires externalIdField.' })),
              batchLevelError: 'Upsert requires externalIdField.',
            },
          };
        }

        const built = buildUpsertSubrequests({
          apiVersion: org.apiVersion,
          objectName: payload.objectName,
          externalIdField,
          records: batch,
          recordIndexOffset: start,
        });

        const outErrors: Array<{ recordIndex: number; message: string }> = [];
        for (const s of built.skipped) outErrors.push({ recordIndex: s.recordIndex, message: s.message });

        if (built.subrequests.length === 0) {
          return {
            aborted: false,
            result: {
              processed: batch.length,
              failed: batch.length,
              ids: [],
              errors: outErrors,
            },
          };
        }

        const composite = await client.composite(built.subrequests, false, { signal: ctx.abortSignal });
        const parsed = parseUpsertCompositeResponse(composite, built.refToRecordIndex);

        const ids: string[] = [];
        for (const s of parsed.successes) {
          if (s.id) ids.push(s.id);
        }
        for (const f of parsed.failures) outErrors.push({ recordIndex: f.recordIndex, message: f.message });

        return {
          aborted: false,
          result: {
            processed: batch.length,
            failed: built.skipped.length + parsed.failures.length,
            ids,
            errors: outErrors,
          },
        };
      }

      let results: Array<{ id: string; success: boolean; errors: Array<{ message: string }> }> | null = null;
      switch (payload.operation) {
        case 'insert':
          results = await client.collectionCreate(payload.objectName, batch, false, { signal: ctx.abortSignal });
          break;
        case 'update':
          results = await client.collectionUpdate(batch as Array<{ Id: string }>, false, { signal: ctx.abortSignal });
          break;
        case 'delete':
          results = await client.collectionDelete(batch.map(r => r.Id as string), false, { signal: ctx.abortSignal });
          break;
        default:
          results = await client.collectionCreate(payload.objectName, batch, false, { signal: ctx.abortSignal });
      }

      const ids: string[] = [];
      const outErrors: Array<{ recordIndex: number; message: string }> = [];
      let failed = 0;

      // Defensive: if Salesforce returns fewer results than sent, mark remainder as failed.
      const expected = batch.length;
      const got = results?.length ?? 0;
      for (let i = 0; i < expected; i++) {
        const recordIndex = start + i;
        const result = results?.[i];
        if (!result) {
          failed++;
          outErrors.push({ recordIndex, message: 'No result returned for record.' });
          continue;
        }
        if (!result.success) {
          failed++;
          outErrors.push({ recordIndex, message: result.errors.map(e => e.message).join('; ') });
        } else if (typeof result.id === 'string' && result.id.length > 0) {
          ids.push(result.id);
        }
      }

      // If SF returns extra results (unexpected), ignore extras but still count as processed by input size.
      void got;

      return {
        aborted: false,
        result: {
          processed: expected,
          failed,
          ids,
          errors: outErrors,
        },
      };
    } catch (error) {
      if (ctx.abortSignal.aborted || isAbortLikeError(error)) {
        return { aborted: true };
      }
      const message = error instanceof Error ? error.message : 'Batch failed';
      return {
        aborted: false,
        result: {
          processed: desc.batch.length,
          failed: desc.batch.length,
          ids: [],
          errors: desc.batch.map((_, i) => ({ recordIndex: desc.start + i, message: `Batch failed: ${message}` })),
          batchLevelError: message,
        },
      };
    }
  }

  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      if (ctx.abortSignal.aborted) {
        cancelled = true;
        return;
      }
      const idx = next++;
      if (idx >= batchDescs.length) return;
      const out = await runBatch(batchDescs[idx]);
      if (out.aborted) {
        cancelled = true;
        return;
      }
      applyBatchResult(out.result);
    }
  }

  const poolSize = Math.min(threads, Math.max(1, batchDescs.length));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  const completedAt = Date.now();

  // Save to history
  const historyEntry: PushHistoryEntry = {
    id: pushId,
    orgId: org.orgId,
    objectName: payload.objectName,
    operation: payload.operation,
    strategy: ctx.strategy === 'bulk' ? 'bulk' : 'rest',
    externalIdField: payload.operation === 'upsert' ? payload.externalIdField : undefined,
    totalRecords: payload.records.length,
    successCount: processedRecords - failedRecords,
    failureCount: failedRecords,
    startedAt: ctx.startedAt,
    completedAt,
    errors: errors.length > 0 ? errors : undefined,
  };

  await storage.addPushHistory(historyEntry);

  // Store successful IDs and failed records (session scoped) for rollback/audit/retry.
  const failedRecordData: Array<{ index: number; record: Record<string, unknown>; error: string }> = [];
  for (const err of errors) {
    if (err.recordIndex >= 0 && err.recordIndex < payload.records.length) {
      failedRecordData.push({
        index: err.recordIndex,
        record: payload.records[err.recordIndex],
        error: err.message,
      });
    }
  }
  const pushResult: PushResult = {
    pushId,
    orgId: org.orgId,
    objectName: payload.objectName,
    operation: payload.operation,
    ids: successfulIds,
    capturedAt: completedAt,
    failedRecords: failedRecordData.length > 0 ? failedRecordData : undefined,
  };
  await storage.setPushResult(pushResult);

  // Capture undo transaction for insert operations
  if (payload.operation === 'insert' && successfulIds.length > 0 && !cancelled) {
    const tx: PushTransaction = {
      id: generateId(),
      pushId,
      orgId: org.orgId,
      objectName: payload.objectName,
      operation: payload.operation,
      capturedAt: completedAt,
      expiresAt: completedAt + UNDO_TTL_MS,
      rollbackIds: successfulIds,
      rollbackOperation: 'delete',
    };
    await storage.addPushTransaction(tx);
  }

  messageBus.broadcast('DATA_PUSH_COMPLETE', {
    pushId,
    totalRecords: payload.records.length,
    processedRecords,
    failedRecords,
    status: cancelled ? 'cancelled' : 'complete',
    errors: errors.length > 0 ? errors : undefined,
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
  ctx: { startedAt: number; abortSignal: AbortSignal; strategy: 'rest' | 'bulk' },
): Promise<void> {
  /**
   * Execute a push using Bulk API 2.0.
   *
   * Why Bulk here:
   * - Bulk API is generally better for large datasets and avoids per-request record limits.
   *
   * Complexity:
   * - CSV conversion is O(N * K) where K is number of fields serialized per record.
   * - Polling adds time but not additional data-structure complexity.
   */
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

    // Best-effort abort if cancelled after job creation.
    if (ctx.abortSignal.aborted) {
      try { await bulkApi.abortJob(job.id); } catch { /* ignore */ }
      throw new Error('Cancelled');
    }
    ctx.abortSignal.addEventListener('abort', () => {
      bulkApi.abortJob(job.id).catch(() => {
        // Ignore
      });
    }, { once: true });

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
    }, ctx.abortSignal);

    const completedAt = Date.now();
    const successfulIds: string[] = [];
    if (completedJob.state === 'JobComplete') {
      try {
        const successful = await bulkApi.getSuccessfulResults(job.id);
        for (const row of successful) {
          if (typeof row.sf__Id === 'string' && row.sf__Id.length > 0) successfulIds.push(row.sf__Id);
        }
      } catch {
        // Ignore: results endpoint may fail in some orgs/permissions; push itself can still be complete.
      }
    }

    const historyEntry: PushHistoryEntry = {
      id: pushId,
      orgId: org.orgId,
      objectName: payload.objectName,
      operation: payload.operation,
      strategy: 'bulk',
      externalIdField: payload.operation === 'upsert' ? payload.externalIdField : undefined,
      totalRecords: payload.records.length,
      successCount: completedJob.numberRecordsProcessed - completedJob.numberRecordsFailed,
      failureCount: completedJob.numberRecordsFailed,
      startedAt: ctx.startedAt,
      completedAt,
    };

    await storage.addPushHistory(historyEntry);

    const pushResult: PushResult = {
      pushId,
      orgId: org.orgId,
      objectName: payload.objectName,
      operation: payload.operation,
      ids: successfulIds,
      capturedAt: completedAt,
    };
    await storage.setPushResult(pushResult);

    messageBus.broadcast('DATA_PUSH_COMPLETE', {
      pushId,
      totalRecords: payload.records.length,
      processedRecords: completedJob.numberRecordsProcessed,
      failedRecords: completedJob.numberRecordsFailed,
      status: completedJob.state === 'JobComplete' ? 'complete' : 'error',
    });
  } catch (error) {
    const cancelled = ctx.abortSignal.aborted || isAbortLikeError(error);
    if (cancelled) {
      const completedAt = Date.now();
      const historyEntry: PushHistoryEntry = {
        id: pushId,
        orgId: org.orgId,
        objectName: payload.objectName,
        operation: payload.operation,
        strategy: 'bulk',
        externalIdField: payload.operation === 'upsert' ? payload.externalIdField : undefined,
        totalRecords: payload.records.length,
        successCount: 0,
        failureCount: 0,
        startedAt: ctx.startedAt,
        completedAt,
        errors: [{ recordIndex: -1, message: 'Cancelled' }],
      };
      await storage.addPushHistory(historyEntry);

      const pushResult: PushResult = {
        pushId,
        orgId: org.orgId,
        objectName: payload.objectName,
        operation: payload.operation,
        ids: [],
        capturedAt: completedAt,
      };
      await storage.setPushResult(pushResult);

      messageBus.broadcast('DATA_PUSH_COMPLETE', {
        pushId,
        totalRecords: payload.records.length,
        processedRecords: 0,
        failedRecords: 0,
        status: 'cancelled',
      });
      return;
    }
    const msg = error instanceof Error ? error.message : 'Bulk push failed';
    const completedAt = Date.now();

    messageBus.broadcast('DATA_PUSH_ERROR', { pushId, error: msg });

    const historyEntry: PushHistoryEntry = {
      id: pushId,
      orgId: org.orgId,
      objectName: payload.objectName,
      operation: payload.operation,
      strategy: 'bulk',
      externalIdField: payload.operation === 'upsert' ? payload.externalIdField : undefined,
      totalRecords: payload.records.length,
      successCount: 0,
      failureCount: payload.records.length,
      startedAt: ctx.startedAt,
      completedAt,
      errors: [{ recordIndex: -1, message: msg }],
    };
    await storage.addPushHistory(historyEntry);

    const pushResult: PushResult = {
      pushId,
      orgId: org.orgId,
      objectName: payload.objectName,
      operation: payload.operation,
      ids: [],
      capturedAt: completedAt,
    };
    await storage.setPushResult(pushResult);

    messageBus.broadcast('DATA_PUSH_COMPLETE', {
      pushId,
      totalRecords: payload.records.length,
      processedRecords: 0,
      failedRecords: payload.records.length,
      status: 'error',
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

// On service worker startup: mark any in-progress pushes as interrupted
storage.markInterruptedPushes().catch(() => undefined);

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-panel') {
    togglePanelOnActiveTab().catch(() => {
      // Ignore
    });
  }
});

messageBus.on('DATA_PUSH_CANCEL', async (message): Promise<MessageResponse> => {
  try {
    const { pushId } = message.payload as { pushId: string };
    const active = activePushes.get(pushId);
    if (!active) {
      return { success: true, data: { cancelled: false }, requestId: message.requestId };
    }
    active.abortController.abort();
    storage.updateActivePushStatus(pushId, 'cancelled').catch(() => undefined);
    return { success: true, data: { cancelled: true }, requestId: message.requestId };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DATA_PUSH_CANCEL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to cancel data push',
      },
      requestId: message.requestId,
    };
  }
});

messageBus.on('DATA_PUSH_RESULT_GET', async (message): Promise<MessageResponse> => {
  try {
    const { pushId } = message.payload as { pushId: string };
    const result = await storage.getPushResult(pushId);
    if (!result) {
      return { success: true, data: null, requestId: message.requestId };
    }
    return {
      success: true,
      data: {
        pushId: result.pushId,
        objectName: result.objectName,
        operation: result.operation,
        ids: result.ids,
        capturedAt: result.capturedAt,
        failedRecords: result.failedRecords,
      },
      requestId: message.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DATA_PUSH_RESULT_GET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch data push result',
      },
      requestId: message.requestId,
    };
  }
});

messageBus.on('DATA_PUSH_RETRY_FAILED', async (message): Promise<MessageResponse> => {
  try {
    const { pushId, tabId } = message.payload as { pushId: string; tabId?: number };
    const result = await storage.getPushResult(pushId);
    if (!result || !result.failedRecords || result.failedRecords.length === 0) {
      return {
        success: false,
        error: { code: 'NO_FAILED_RECORDS', message: 'No failed records found for this push.' },
        requestId: message.requestId,
      };
    }

    // Get the original history entry to look up the org
    const history = await storage.getPushHistory();
    const originalEntry = history.find(h => h.id === pushId);

    const records = result.failedRecords.map(fr => fr.record);
    // Re-dispatch as a new push with retryOfPushId tracking
    const retryPushId = generateId();
    const startedAt = Date.now();
    const abortController = new AbortController();
    activePushes.set(retryPushId, { abortController });

    storage.setActivePush({
      id: retryPushId,
      orgId: result.orgId,
      objectName: result.objectName,
      operation: result.operation,
      totalRecords: records.length,
      processedRecords: 0,
      failedRecords: 0,
      startedAt,
      status: 'processing',
    }).catch(() => undefined);

    let org: SalesforceOrg;
    if (tabId) {
      org = await auth.ensureValidToken(await auth.loginForTab(tabId));
    } else {
      org = await getValidOrg(result.orgId);
    }

    const useBulk = records.length >= BULK_API_THRESHOLD;

    if (useBulk) {
      executeBulkPush(retryPushId, org, { objectName: result.objectName, records, operation: result.operation }, { startedAt, abortSignal: abortController.signal, strategy: 'bulk' })
        .then(() => storage.updateActivePushStatus(retryPushId, 'complete').catch(() => undefined))
        .catch(() => storage.updateActivePushStatus(retryPushId, 'error').catch(() => undefined))
        .finally(() => activePushes.delete(retryPushId));
    } else {
      executeRestPush(retryPushId, org, {
        objectName: result.objectName,
        records,
        operation: result.operation,
        externalIdField: originalEntry?.externalIdField,
      }, { startedAt, abortSignal: abortController.signal, strategy: 'rest' })
        .then(() => storage.updateActivePushStatus(retryPushId, 'complete').catch(() => undefined))
        .catch(() => storage.updateActivePushStatus(retryPushId, 'error').catch(() => undefined))
        .finally(() => activePushes.delete(retryPushId));
    }

    return {
      success: true,
      data: { pushId: retryPushId, strategy: useBulk ? 'bulk' : 'rest', recordCount: records.length },
      requestId: message.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: { code: 'RETRY_FAILED', message: error instanceof Error ? error.message : 'Failed to retry' },
      requestId: message.requestId,
    };
  }
});

messageBus.on('PUSH_HISTORY_GET', async (message): Promise<MessageResponse> => {
  try {
    const history = await storage.getPushHistory();
    return {
      success: true,
      data: { history },
      requestId: message.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'PUSH_HISTORY_GET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get push history',
      },
      requestId: message.requestId,
    };
  }
});

console.log('WaveLink background service worker initialized');
