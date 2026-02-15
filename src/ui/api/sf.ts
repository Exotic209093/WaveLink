import { MessageBus } from '../../services/messaging';
import type { SObjectDescribe } from '../../core/types/salesforce';
import type { UiSettings, SavedQuery } from '../../core/types/storage';
import type { DescribeGlobalResult, QueryResult } from '../../services/salesforce/api-client';

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
    useBulkApi?: boolean;
  }): Promise<{ pushId: string; strategy: 'bulk' | 'rest' }> {
    const res = await this.bus.send<typeof payload, { pushId: string; strategy: 'bulk' | 'rest' }>('DATA_PUSH_START', payload);
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to start data push');
    return res.data;
  }
}
