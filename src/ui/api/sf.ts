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
import type { SalesforceOrg, SObjectDescribe } from '../../core/types/salesforce';
import type { UiSettings, SavedQuery, PushHistoryEntry, QueryFolder, DataTemplate, PushTransaction, Pipeline, QualityRuleSet, OnboardingProgress } from '../../core/types/storage';
import type { MigrationProject, IdMap, IdMapEntry, MigrationTemplate, MigrationSummaryReport } from '../../core/types/migration';
import type { DescribeGlobalResult, QueryResult, QueryExplainResult, ExecuteAnonymousResult } from '../../services/salesforce/api-client';
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

  async queryExplain(soql: string, tabId?: number): Promise<QueryExplainResult> {
    const res = await this.bus.send<{ tabId?: number; soql: string }, QueryExplainResult>(
      'SF_QUERY_EXPLAIN',
      { tabId, soql },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Explain failed');
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

  async updateRecord(objectName: string, recordId: string, fields: Record<string, unknown>, tabId?: number): Promise<void> {
    const res = await this.bus.send<{ tabId?: number; objectName: string; recordId: string; fields: Record<string, unknown> }, { recordId: string }>(
      'SF_UPDATE_RECORD',
      { tabId, objectName, recordId, fields },
    );
    if (!res.success) throw new Error(res.error?.message ?? 'Update failed');
  }

  async executeAnonymous(apexBody: string, tabId?: number): Promise<ExecuteAnonymousResult> {
    const res = await this.bus.send<{ tabId?: number; apexBody: string }, ExecuteAnonymousResult>(
      'SF_EXECUTE_ANONYMOUS',
      { tabId, apexBody },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Execute anonymous failed');
    return res.data;
  }

  async createRecord(objectName: string, fields: Record<string, unknown>, tabId?: number): Promise<string> {
    const res = await this.bus.send<{ tabId?: number; objectName: string; fields: Record<string, unknown> }, { id: string }>(
      'SF_CREATE_RECORD',
      { tabId, objectName, fields },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Create failed');
    return res.data.id;
  }

  async deleteRecord(objectName: string, recordId: string, tabId?: number): Promise<void> {
    const res = await this.bus.send<{ tabId?: number; objectName: string; recordId: string }, { recordId: string }>(
      'SF_DELETE_RECORD',
      { tabId, objectName, recordId },
    );
    if (!res.success) throw new Error(res.error?.message ?? 'Delete failed');
  }

  async getLimits(tabId?: number): Promise<Record<string, { Max: number; Remaining: number }>> {
    const res = await this.bus.send<{ tabId?: number }, Record<string, { Max: number; Remaining: number }>>(
      'SF_LIMITS_GET',
      { tabId },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to fetch limits');
    return res.data;
  }

  async openFullApp(tabId?: number): Promise<void> {
    // Routed through the background worker (chrome.tabs.create) so the navigation
    // isn't intercepted by ad/content blockers (ERR_BLOCKED_BY_CLIENT) the way a
    // page-context window.open to a chrome-extension:// URL would be.
    const res = await this.bus.send<{ tabId?: number }, object>('OPEN_FULL_APP', { tabId });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to open full app');
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

  async retryFailedRecords(pushId: string, tabId?: number): Promise<{ pushId: string; strategy: string; recordCount: number }> {
    const res = await this.bus.send<{ pushId: string; tabId?: number }, { pushId: string; strategy: string; recordCount: number }>(
      'DATA_PUSH_RETRY_FAILED',
      { pushId, tabId },
    );
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to retry failed records');
    return res.data;
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

  // ── Org Management ──────────────────────────────────────────────

  async listOrgs(): Promise<{ orgs: SalesforceOrg[]; activeOrgId: string | null }> {
    const res = await this.bus.send<object, { orgs: SalesforceOrg[]; activeOrgId: string | null }>('ORG_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list orgs');
    return res.data;
  }

  async switchOrg(orgId: string): Promise<void> {
    const res = await this.bus.send<{ orgId: string }, { orgId: string }>('ORG_SWITCH', { orgId });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to switch org');
  }

  async connectOrgFromTab(tabId: number): Promise<{ orgId: string; username: string; instanceUrl: string }> {
    const res = await this.bus.send<{ tabId: number }, { orgId: string; username: string; instanceUrl: string }>('ORG_CONNECT_TAB', { tabId });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to connect org');
    return res.data;
  }

  async refreshOrg(orgId: string): Promise<void> {
    const res = await this.bus.send<{ orgId: string }, { valid: boolean; orgId: string }>('ORG_REFRESH', { orgId });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to refresh org');
  }

  async updateOrg(orgId: string, update: { nickname?: string }): Promise<void> {
    const res = await this.bus.send<{ orgId: string; nickname?: string }, { orgId: string }>('ORG_UPDATE', { orgId, ...update });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to update org');
  }

  async disconnectOrg(orgId: string): Promise<void> {
    const res = await this.bus.send<{ orgId?: string }, object>('AUTH_LOGOUT', { orgId });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to disconnect org');
  }

  // ── Cross-Org Operations ──────────────────────────────────────────

  async crossOrgQuery(orgId: string, soql: string): Promise<QueryResult<Record<string, unknown>>> {
    const res = await this.bus.send<{ orgId: string; soql: string }, QueryResult<Record<string, unknown>>>('CROSS_ORG_QUERY', { orgId, soql });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Cross-org query failed');
    return res.data;
  }

  async crossOrgDescribeGlobal(orgId: string): Promise<DescribeGlobalResult> {
    const res = await this.bus.send<{ orgId: string }, DescribeGlobalResult>('CROSS_ORG_DESCRIBE', { orgId });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Cross-org describe failed');
    return res.data;
  }

  async crossOrgDescribeSObject(orgId: string, objectName: string): Promise<SObjectDescribe> {
    const res = await this.bus.send<{ orgId: string; objectName: string }, SObjectDescribe>('CROSS_ORG_DESCRIBE', { orgId, objectName });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Cross-org describe SObject failed');
    return res.data;
  }

  // ── Schema Cache Management ──────────────────────────────────────

  async clearSchemaCache(orgId?: string): Promise<{ cleared: number }> {
    const res = await this.bus.send<{ orgId?: string }, { cleared: number }>('SCHEMA_CACHE_CLEAR', { orgId });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to clear schema cache');
    return res.data;
  }

  // ── Storage Management ─────────────────────────────────────────

  async getStorageUsage(): Promise<{ bytesInUse: number; quota: number }> {
    const res = await this.bus.send<object, { bytesInUse: number; quota: number }>('STORAGE_USAGE_GET', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to get storage usage');
    return res.data;
  }

  async purgeOldData(): Promise<{ historyPurged: number; transactionsPurged: number }> {
    const res = await this.bus.send<object, { historyPurged: number; transactionsPurged: number }>('STORAGE_PURGE_OLD', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to purge old data');
    return res.data;
  }

  // ── Data Backup/Restore ─────────────────────────────────────────

  async exportUserData(): Promise<Record<string, unknown>> {
    const res = await this.bus.send<object, Record<string, unknown>>('DATA_EXPORT', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to export data');
    return res.data;
  }

  async importUserData(data: Record<string, unknown>): Promise<{ imported: string[] }> {
    const res = await this.bus.send<Record<string, unknown>, { imported: string[] }>('DATA_IMPORT', data);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to import data');
    return res.data;
  }

  // ── Migration Projects ──────────────────────────────────────────

  async listMigrationProjects(): Promise<MigrationProject[]> {
    const res = await this.bus.send<object, { projects: MigrationProject[] }>('MIGRATION_PROJECTS_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list migration projects');
    return res.data.projects;
  }

  async getMigrationProject(id: string): Promise<MigrationProject | null> {
    const res = await this.bus.send<{ id: string }, { project: MigrationProject | null }>('MIGRATION_PROJECTS_GET', { id });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to get migration project');
    return res.data.project;
  }

  async upsertMigrationProject(project: Partial<MigrationProject> & { id: string; name: string; sourceOrgId: string; targetOrgId: string }): Promise<MigrationProject> {
    const res = await this.bus.send<typeof project, MigrationProject>('MIGRATION_PROJECTS_UPSERT', project);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to save migration project');
    return res.data;
  }

  async deleteMigrationProject(id: string): Promise<void> {
    const res = await this.bus.send<{ id: string }, object>('MIGRATION_PROJECTS_DELETE', { id });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete migration project');
  }

  // ── ID Maps ────────────────────────────────────────────────────

  async listIdMaps(): Promise<IdMap[]> {
    const res = await this.bus.send<object, { maps: IdMap[] }>('ID_MAPS_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list ID maps');
    return res.data.maps;
  }

  async getIdMap(id: string): Promise<IdMap | null> {
    const res = await this.bus.send<{ id: string }, { map: IdMap | null }>('ID_MAPS_GET', { id });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to get ID map');
    return res.data.map;
  }

  async createIdMap(map: { id: string; name: string; sourceOrgId: string; targetOrgId: string }): Promise<IdMap> {
    const res = await this.bus.send<typeof map, IdMap>('ID_MAPS_CREATE', map);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to create ID map');
    return res.data;
  }

  async addIdMapEntries(mapId: string, entries: IdMapEntry[]): Promise<IdMap> {
    const res = await this.bus.send<{ mapId: string; entries: IdMapEntry[] }, IdMap>('ID_MAPS_ADD_ENTRIES', { mapId, entries });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to add ID map entries');
    return res.data;
  }

  async deleteIdMap(id: string): Promise<void> {
    const res = await this.bus.send<{ id: string }, object>('ID_MAPS_DELETE', { id });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete ID map');
  }

  async exportIdMap(id: string): Promise<Record<string, IdMapEntry>> {
    const res = await this.bus.send<{ id: string }, { entries: Record<string, IdMapEntry> }>('ID_MAPS_EXPORT', { id });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to export ID map');
    return res.data.entries;
  }

  // ── Migration Templates (Phase 3) ───────────────────────────────

  async listMigrationTemplates(): Promise<MigrationTemplate[]> {
    const res = await this.bus.send<object, { templates: MigrationTemplate[] }>('MIGRATION_TEMPLATES_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list migration templates');
    return res.data.templates;
  }

  async upsertMigrationTemplate(template: Partial<MigrationTemplate> & { id: string; name: string }): Promise<MigrationTemplate> {
    const res = await this.bus.send<typeof template, MigrationTemplate>('MIGRATION_TEMPLATES_UPSERT', template);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to save migration template');
    return res.data;
  }

  async deleteMigrationTemplate(id: string): Promise<void> {
    const res = await this.bus.send<{ id: string }, object>('MIGRATION_TEMPLATES_DELETE', { id });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete migration template');
  }

  // ── Migration Reports (Phase 2) ───────────────────────────────

  async listMigrationReports(): Promise<MigrationSummaryReport[]> {
    const res = await this.bus.send<object, { reports: MigrationSummaryReport[] }>('MIGRATION_REPORTS_LIST', {});
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to list migration reports');
    return res.data.reports;
  }

  async getMigrationReport(runId: string): Promise<MigrationSummaryReport | null> {
    const res = await this.bus.send<{ runId: string }, { report: MigrationSummaryReport | null }>('MIGRATION_REPORTS_GET', { runId });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to get migration report');
    return res.data.report;
  }

  async saveMigrationReport(report: MigrationSummaryReport): Promise<void> {
    const res = await this.bus.send<MigrationSummaryReport, object>('MIGRATION_REPORTS_SAVE', report);
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to save migration report');
  }

  async deleteMigrationReport(runId: string): Promise<void> {
    const res = await this.bus.send<{ runId: string }, object>('MIGRATION_REPORTS_DELETE', { runId });
    if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete migration report');
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
