/**
 * Salesforce REST API client.
 * Provides typed methods for CRUD, Composite, and metadata operations.
 */

import { API_BASE_PATH, MAX_API_RETRIES, RETRY_BASE_DELAY_MS } from '../../core/constants';
import {
  SalesforceApiError,
  RateLimitError,
  NetworkError,
  isRetryableError,
} from '../../core/errors';
import { retryWithBackoff } from '../../core/utils';
import type {
  ApiVersion,
  SObjectDescribe,
  SalesforceRecordResult,
  CompositeSubRequest,
  CompositeResponse,
} from '../../core/types/salesforce';

export interface ApiClientConfig {
  instanceUrl: string;
  accessToken: string;
  apiVersion: ApiVersion;
}

/**
 * SalesforceApiClient provides a typed, resilient interface to the Salesforce REST API.
 */
export class SalesforceApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  /** Update the access token (e.g., after refresh) */
  updateAccessToken(accessToken: string): void {
    this.config.accessToken = accessToken;
  }

  /** Update instance URL (e.g., after redirect) */
  updateInstanceUrl(instanceUrl: string): void {
    this.config.instanceUrl = instanceUrl;
  }

  // ── Query Operations ──────────────────────────────────────────────

  /** Execute a SOQL query */
  async query<T = Record<string, unknown>>(soql: string): Promise<QueryResult<T>> {
    const encodedQuery = encodeURIComponent(soql);
    return this.request<QueryResult<T>>(`/query?q=${encodedQuery}`);
  }

  /** Fetch next page of query results */
  async queryMore<T = Record<string, unknown>>(nextRecordsUrl: string): Promise<QueryResult<T>> {
    return this.request<QueryResult<T>>(nextRecordsUrl, { useFullPath: true });
  }

  // ── Record CRUD ───────────────────────────────────────────────────

  /** Create a single record */
  async createRecord(
    objectName: string,
    data: Record<string, unknown>,
  ): Promise<SalesforceRecordResult> {
    return this.request<SalesforceRecordResult>(`/sobjects/${objectName}`, {
      method: 'POST',
      body: data,
    });
  }

  /** Update a single record */
  async updateRecord(
    objectName: string,
    recordId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.request(`/sobjects/${objectName}/${recordId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  /** Upsert a record by external ID */
  async upsertRecord(
    objectName: string,
    externalIdField: string,
    externalIdValue: string,
    data: Record<string, unknown>,
  ): Promise<SalesforceRecordResult> {
    return this.request<SalesforceRecordResult>(
      `/sobjects/${objectName}/${externalIdField}/${externalIdValue}`,
      { method: 'PATCH', body: data },
    );
  }

  /** Delete a single record */
  async deleteRecord(objectName: string, recordId: string): Promise<void> {
    await this.request(`/sobjects/${objectName}/${recordId}`, { method: 'DELETE' });
  }

  // ── Composite API ────────────────────────────────────────────────

  /** Execute a Composite API request (up to 25 sub-requests) */
  async composite(
    subrequests: CompositeSubRequest[],
    allOrNone: boolean = false,
  ): Promise<CompositeResponse> {
    return this.request<CompositeResponse>('/composite', {
      method: 'POST',
      body: { allOrNone, compositeRequest: subrequests },
    });
  }

  /** Execute an SObject Collection create (up to 200 records) */
  async collectionCreate(
    objectName: string,
    records: Record<string, unknown>[],
    allOrNone: boolean = false,
  ): Promise<SalesforceRecordResult[]> {
    const body = records.map(r => ({
      attributes: { type: objectName },
      ...r,
    }));
    return this.request<SalesforceRecordResult[]>('/composite/sobjects', {
      method: 'POST',
      body: { allOrNone, records: body },
    });
  }

  /** Execute an SObject Collection update (up to 200 records) */
  async collectionUpdate(
    records: Array<{ Id: string; [key: string]: unknown }>,
    allOrNone: boolean = false,
  ): Promise<SalesforceRecordResult[]> {
    return this.request<SalesforceRecordResult[]>('/composite/sobjects', {
      method: 'PATCH',
      body: { allOrNone, records },
    });
  }

  /** Execute an SObject Collection delete (up to 200 IDs) */
  async collectionDelete(ids: string[], allOrNone: boolean = false): Promise<SalesforceRecordResult[]> {
    const idsParam = ids.join(',');
    return this.request<SalesforceRecordResult[]>(
      `/composite/sobjects?ids=${idsParam}&allOrNone=${allOrNone}`,
      { method: 'DELETE' },
    );
  }

  // ── Metadata / Describe ──────────────────────────────────────────

  /** List all available SObjects */
  async describeGlobal(): Promise<DescribeGlobalResult> {
    return this.request<DescribeGlobalResult>('/sobjects');
  }

  /** Describe a specific SObject */
  async describeSObject(objectName: string): Promise<SObjectDescribe> {
    return this.request<SObjectDescribe>(`/sobjects/${objectName}/describe`);
  }

  /** Get API limits */
  async getLimits(): Promise<Record<string, { Max: number; Remaining: number }>> {
    return this.request('/limits');
  }

  // ── Core Request Method ──────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { method = 'GET', body, useFullPath = false } = options;

    const url = useFullPath
      ? `${this.config.instanceUrl}${path}`
      : `${this.config.instanceUrl}${API_BASE_PATH}/${this.config.apiVersion}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Accept': 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    return retryWithBackoff(
      async () => {
        let response: Response;
        try {
          response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          });
        } catch (error) {
          throw new NetworkError(
            `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { url, method },
          );
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(retryAfter ? parseInt(retryAfter, 10) : undefined);
        }

        if (response.status === 204) {
          return undefined as T;
        }

        const responseBody = await response.json();

        if (!response.ok) {
          const sfErrors = Array.isArray(responseBody) ? responseBody : [responseBody];
          const errorMessage = sfErrors.map((e: { message?: string }) => e.message).join('; ');
          const errorCode = sfErrors[0]?.errorCode as string | undefined;
          throw new SalesforceApiError(
            errorMessage || `API request failed: ${response.status}`,
            response.status,
            errorCode,
            { url, method, errors: sfErrors },
          );
        }

        return responseBody as T;
      },
      MAX_API_RETRIES,
      RETRY_BASE_DELAY_MS,
      isRetryableError,
    );
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  useFullPath?: boolean;
}

export interface QueryResult<T> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface DescribeGlobalResult {
  encoding: string;
  maxBatchSize: number;
  sobjects: DescribeGlobalSObject[];
}

export interface DescribeGlobalSObject {
  name: string;
  label: string;
  labelPlural: string;
  keyPrefix: string | null;
  custom: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  queryable: boolean;
}
