/**
 * UI-facing Salesforce API wrapper.
 *
 * What this file does:
 * - Provides a small, typed client (`SfApi`) used by the app/panel to call background handlers.
 * - All privileged work (cookies, tabs, network) happens in the background service worker.
 *
 * Why:
 * - Keeps UI code free of `chrome.*` auth concerns and centralizes message contracts.
 *
 * Complexity:
 * - Each method is O(1) JS work and delegates to background (which may do O(T) tab scans or network calls).
 */

import { MessageBus } from '../../services/messaging';
import type { SObjectDescribe } from '../../core/types/salesforce';
import type { UiSettings, SavedQuery, PushHistoryEntry, QueryFolder, DataTemplate, PushTransaction, Pipeline, QualityRuleSet, OnboardingProgress } from '../../core/types/storage';
import type { DescribeGlobalResult, QueryResult } from '../../services/salesforce/api-client';
import type { DataPushCancelResponse, DataPushResultGetResponse, PushHistoryGetResponse } from '../../core/types/messaging';

export interface SfTabInfo {
  tabId: number;
  title?: string;
  url: string;
  hostname: string;
}

export interface SfContext {
  orgId: string;
  username: string;
  instanceUrl: string;
  apiVersion: string;
  environment: 'production' | 'sandbox';
}

export class SfApi {
  private bus: MessageBus;

  constructor(source: 'content' | 'popup' | 'app') {
    this.bus = new MessageBus(source);
  }

  async listTabs(): Promise<SfTabInfo[]> {
    const res = await this.bus.send<object, { tabs: SfTabInfo[] }>('SF_TABS_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list tabs');
    return res.data.tabs;
  }

  async getContext(tabId?: number): Promise<SfContext> {
    const res = await this.bus.send<{ tabId?: number }, SfContext>('SF_CONTEXT_GET', { tabId });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to resolve context');
    return res.data;
  }

  async runQuery(soql: string, tabId?: number): Promise<QueryResult<Record<string, unknown>>> {
    const res = await this.bus.send<{ tabId?: number; soql: string }, QueryResult<Record<string, unknown>>>(
      'SF_QUERY_RUN',
      { tabId, soql },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Query failed');
    return res.data;
  }

  async queryMore(nextRecordsUrl: string, tabId?: number): Promise<QueryResult<Record<string, unknown>>> {
    const res = await this.bus.send<{ tabId?: number; nextRecordsUrl: string }, QueryResult<Record<string, unknown>>>(
      'SF_QUERY_MORE',
      { tabId, nextRecordsUrl },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'QueryMore failed');
    return res.data;
  }

  async runToolingQuery(soql: string, tabId?: number): Promise<QueryResult<Record<string, unknown>>> {
    const res = await this.bus.send<{ tabId?: number; soql: string }, QueryResult<Record<string, unknown>>>(
      'SF_TOOLING_QUERY_RUN',
      { tabId, soql },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Tooling query failed');
    return res.data;
  }

  async toolingQueryMore(nextRecordsUrl: string, tabId?: number): Promise<QueryResult<Record<string, unknown>>> {
    const res = await this.bus.send<{ tabId?: number; nextRecordsUrl: string }, QueryResult<Record<string, unknown>>>(
      'SF_TOOLING_QUERY_MORE',
      { tabId, nextRecordsUrl },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Tooling queryMore failed');
    return res.data;
  }

  async describeGlobal(tabId?: number): Promise<DescribeGlobalResult> {
    const res = await this.bus.send<{ tabId?: number }, DescribeGlobalResult>('SF_DESCRIBE_GLOBAL', { tabId });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Describe global failed');
    return res.data;
  }

  async describeSObject(objectName: string, tabId?: number): Promise<SObjectDescribe> {
    const res = await this.bus.send<{ tabId?: number; objectName: string }, SObjectDescribe>(
      'SF_DESCRIBE_SOBJECT',
      { tabId, objectName },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Describe SObject failed');
    return res.data;
  }

  async getLimits(tabId?: number): Promise<Record<string, { Max: number; Remaining: number }>> {
    const res = await this.bus.send<{ tabId?: number }, Record<string, { Max: number; Remaining: number }>>(
      'SF_LIMITS_GET',
      { tabId },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to fetch limits');
    return res.data;
  }

  async getUiSettings(): Promise<UiSettings> {
    const res = await this.bus.send<object, UiSettings>('UI_SETTINGS_GET', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to read UI settings');
    return res.data;
  }

  async setUiSettings(patch: Partial<UiSettings>): Promise<UiSettings> {
    const res = await this.bus.send<Partial<UiSettings>, UiSettings>('UI_SETTINGS_SET', patch);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to write UI settings');
    return res.data;
  }

  async listSavedQueries(): Promise<SavedQuery[]> {
    const res = await this.bus.send<object, { queries: SavedQuery[] }>('SAVED_QUERIES_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list saved queries');
    return res.data.queries;
  }

  async upsertSavedQuery(query: { id: string; name: string; soql: string }): Promise<SavedQuery> {
    const res = await this.bus.send<typeof query, SavedQuery>('SAVED_QUERIES_UPSERT', query);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to save query');
    return res.data;
  }

  async deleteSavedQuery(id: string): Promise<void> {
    const res = await this.bus.send<{ id: string }, object>('SAVED_QUERIES_DELETE', { id });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete query');
  }

  async startDataPush(payload: {
    tabId?: number;
    orgId?: string;
    objectName: string;
    operation: 'insert' | 'update' | 'upsert' | 'delete';
    records: Record<string, unknown>[];
    externalIdField?: string;
    batchSize?: number;
    threads?: number;
    useBulkApi?: boolean;
  }): Promise<{ pushId: string; strategy: 'bulk' | 'rest' }> {
    const res = await this.bus.send<typeof payload, { pushId: string; strategy: 'bulk' | 'rest' }>('DATA_PUSH_START', payload);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to start data push');
    return res.data;
  }

  async cancelDataPush(pushId: string): Promise<DataPushCancelResponse> {
    const res = await this.bus.send<{ pushId: string }, DataPushCancelResponse>('DATA_PUSH_CANCEL', { pushId });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to cancel data push');
    return res.data;
  }

  async getDataPushResult(pushId: string): Promise<DataPushResultGetResponse | null> {
    const res = await this.bus.send<{ pushId: string }, DataPushResultGetResponse | null>('DATA_PUSH_RESULT_GET', { pushId });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to fetch data push result');
    return (res.data ?? null) as DataPushResultGetResponse | null;
  }

  async getPushHistory(): Promise<PushHistoryEntry[]> {
    const res = await this.bus.send<object, PushHistoryGetResponse>('PUSH_HISTORY_GET', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to fetch push history');
    return res.data.history;
  }

  // ── Query Folders ────────────────────────────────────────────────

  async listQueryFolders(): Promise<QueryFolder[]> {
    const res = await this.bus.send<object, { folders: QueryFolder[] }>('QUERY_FOLDERS_GET', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list query folders');
    return res.data.folders;
  }

  async upsertQueryFolder(folder: { id: string; name: string; parentId?: string }): Promise<QueryFolder> {
    const res = await this.bus.send<typeof folder, QueryFolder>('QUERY_FOLDERS_UPSERT', folder);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to save query folder');
    return res.data;
  }

  async deleteQueryFolder(id: string): Promise<void> {
    const res = await this.bus.send<{ id: string }, object>('QUERY_FOLDERS_DELETE', { id });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete query folder');
  }

  // ── Data Templates ───────────────────────────────────────────────

  async listTemplates(): Promise<DataTemplate[]> {
    const res = await this.bus.send<object, { templates: DataTemplate[] }>('TEMPLATES_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list templates');
    return res.data.templates;
  }

  async upsertTemplate(t: Partial<DataTemplate> & { id: string; name: string; objectName: string }): Promise<DataTemplate> {
    const res = await this.bus.send<typeof t, DataTemplate>('TEMPLATES_UPSERT', t);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to save template');
    return res.data;
  }

  async deleteTemplate(id: string): Promise<void> {
    const res = await this.bus.send<{ id: string }, object>('TEMPLATES_DELETE', { id });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete template');
  }

  // ── Push Transactions (Undo) ─────────────────────────────────────

  async getPushTransactions(): Promise<PushTransaction[]> {
    const res = await this.bus.send<object, { transactions: PushTransaction[] }>('TRANSACTIONS_GET', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to get transactions');
    return res.data.transactions;
  }

  async removePushTransaction(id: string): Promise<void> {
    const res = await this.bus.send<{ id: string }, object>('TRANSACTIONS_CLEAR', { id });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to remove transaction');
  }

  // ── Pipelines ────────────────────────────────────────────────────

  async listPipelines(): Promise<Pipeline[]> {
    const res = await this.bus.send<object, { pipelines: Pipeline[] }>('PIPELINES_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list pipelines');
    return res.data.pipelines;
  }

  async upsertPipeline(p: Partial<Pipeline> & { id: string; name: string; steps: Pipeline['steps'] }): Promise<Pipeline> {
    const res = await this.bus.send<typeof p, Pipeline>('PIPELINES_UPSERT', p);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to save pipeline');
    return res.data;
  }

  async deletePipeline(id: string): Promise<void> {
    const res = await this.bus.send<{ id: string }, object>('PIPELINES_DELETE', { id });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete pipeline');
  }

  // ── Quality Rule Sets ──────────────────────────────────────────

  async listQualityRuleSets(): Promise<QualityRuleSet[]> {
    const res = await this.bus.send<object, { ruleSets: QualityRuleSet[] }>('QUALITY_RULES_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list rule sets');
    return res.data.ruleSets;
  }

  async upsertQualityRuleSet(rs: Partial<QualityRuleSet> & { id: string; name: string; objectName: string; rules: QualityRuleSet['rules'] }): Promise<QualityRuleSet> {
    const res = await this.bus.send<typeof rs, QualityRuleSet>('QUALITY_RULES_UPSERT', rs);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to save rule set');
    return res.data;
  }

  async deleteQualityRuleSet(id: string): Promise<void> {
    const res = await this.bus.send<{ id: string }, object>('QUALITY_RULES_DELETE', { id });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete rule set');
  }

  // ── Onboarding ─────────────────────────────────────────────────

  async getOnboarding(): Promise<OnboardingProgress> {
    const res = await this.bus.send<object, OnboardingProgress>('ONBOARDING_GET', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to get onboarding');
    return res.data;
  }

  async setOnboarding(progress: Partial<OnboardingProgress>): Promise<void> {
    const res = await this.bus.send<Partial<OnboardingProgress>, object>('ONBOARDING_SET', progress);
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to save onboarding');
  }
}
