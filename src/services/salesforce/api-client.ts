/**
 * Salesforce REST API client.
 * Provides typed methods for CRUD, Composite, and metadata operations.
 *
 * Why a dedicated client:
 * - Centralizes URL construction, headers, and retry/backoff logic.
 * - Provides typed response shapes for common Salesforce endpoints.
 *
 * Data types:
 * - Most payloads are `Record<string, unknown>` to support arbitrary SObject field shapes.
 *
 * Complexity:
 * - Individual request methods are O(1) JS work; dominant costs are network + JSON parsing.
 * - Batch helpers (collectionCreate/update/delete) are O(N) in the batch size due to payload construction.
 */

import { API_BASE_PATH, MAX_API_RETRIES, RETRY_BASE_DELAY_MS, CIRCUIT_BREAKER_THRESHOLD, CIRCUIT_BREAKER_WINDOW_MS, CIRCUIT_BREAKER_RESET_MS } from '../../core/constants';
import {
  SalesforceApiError,
  RateLimitError,
  NetworkError,
  CircuitBreakerError,
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

/**
 * Simple circuit breaker state machine.
 * Tracks consecutive failures and blocks requests when the circuit is open.
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureTimestamps: number[] = [];
  private openedAt = 0;

  /** Check if a request should be allowed through. Throws if circuit is OPEN. */
  allowRequest(): void {
    if (this.state === 'CLOSED') return;
    if (this.state === 'HALF_OPEN') return; // allow one probe

    // OPEN: check if enough time has passed to transition to HALF_OPEN
    const elapsed = Date.now() - this.openedAt;
    if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
      this.state = 'HALF_OPEN';
      return;
    }
    throw new CircuitBreakerError(CIRCUIT_BREAKER_RESET_MS - elapsed);
  }

  /** Record a successful request. Resets the circuit to CLOSED. */
  recordSuccess(): void {
    this.state = 'CLOSED';
    this.failureTimestamps = [];
  }

  /** Record a failed request. May trip the circuit to OPEN. */
  recordFailure(): void {
    const now = Date.now();
    this.failureTimestamps.push(now);

    // Only count failures within the window
    const windowStart = now - CIRCUIT_BREAKER_WINDOW_MS;
    this.failureTimestamps = this.failureTimestamps.filter(t => t >= windowStart);

    if (this.state === 'HALF_OPEN') {
      // Probe failed — re-open
      this.state = 'OPEN';
      this.openedAt = now;
      return;
    }

    if (this.failureTimestamps.length >= CIRCUIT_BREAKER_THRESHOLD) {
      this.state = 'OPEN';
      this.openedAt = now;
    }
  }
}

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
  private circuitBreaker = new CircuitBreaker();

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

  /** Execute a SOQL query against the Tooling API */
  async toolingQuery<T = Record<string, unknown>>(soql: string): Promise<QueryResult<T>> {
    const encodedQuery = encodeURIComponent(soql);
    return this.request<QueryResult<T>>(`/tooling/query?q=${encodedQuery}`);
  }

  /** Execute anonymous Apex via the Tooling API. Returns compile/run status. */
  async executeAnonymous(apexBody: string): Promise<ExecuteAnonymousResult> {
    const encoded = encodeURIComponent(apexBody);
    return this.request<ExecuteAnonymousResult>(`/tooling/executeAnonymous/?anonymousBody=${encoded}`);
  }

  /** Fetch next page of query results */
  async queryMore<T = Record<string, unknown>>(nextRecordsUrl: string): Promise<QueryResult<T>> {
    return this.request<QueryResult<T>>(nextRecordsUrl, { useFullPath: true });
  }

  /** Fetch next page of Tooling API query results */
  async toolingQueryMore<T = Record<string, unknown>>(nextRecordsUrl: string): Promise<QueryResult<T>> {
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
    options: { signal?: AbortSignal } = {},
  ): Promise<CompositeResponse> {
    return this.request<CompositeResponse>('/composite', {
      method: 'POST',
      body: { allOrNone, compositeRequest: subrequests },
      signal: options.signal,
    });
  }

  /** Execute an SObject Collection create (up to 200 records) */
  async collectionCreate(
    objectName: string,
    records: Record<string, unknown>[],
    allOrNone: boolean = false,
    options: { signal?: AbortSignal } = {},
  ): Promise<SalesforceRecordResult[]> {
    const body = records.map(r => ({
      attributes: { type: objectName },
      ...r,
    }));
    return this.request<SalesforceRecordResult[]>('/composite/sobjects', {
      method: 'POST',
      body: { allOrNone, records: body },
      signal: options.signal,
    });
  }

  /** Execute an SObject Collection update (up to 200 records) */
  async collectionUpdate(
    records: Array<{ Id: string; [key: string]: unknown }>,
    allOrNone: boolean = false,
    options: { signal?: AbortSignal } = {},
  ): Promise<SalesforceRecordResult[]> {
    return this.request<SalesforceRecordResult[]>('/composite/sobjects', {
      method: 'PATCH',
      body: { allOrNone, records },
      signal: options.signal,
    });
  }

  /** Execute an SObject Collection delete (up to 200 IDs) */
  async collectionDelete(
    ids: string[],
    allOrNone: boolean = false,
    options: { signal?: AbortSignal } = {},
  ): Promise<SalesforceRecordResult[]> {
    const idsParam = ids.join(',');
    return this.request<SalesforceRecordResult[]>(
      `/composite/sobjects?ids=${idsParam}&allOrNone=${allOrNone}`,
      { method: 'DELETE', signal: options.signal },
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

  /**
   * Make a raw, un-retried API call and return the status + parsed body without
   * throwing on non-2xx — so callers (the REST explorer, debug-log fetch) can
   * inspect error responses and plain-text bodies directly.
   *
   * Path resolution:
   * - Absolute URL (`https://…`) → used as-is.
   * - Path starting with `/services/` → appended to the instance URL.
   * - Otherwise → treated as relative to `/services/data/vXX`.
   */
  async rawCall(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
    path: string,
    body?: unknown,
    opts: { rawText?: boolean } = {},
  ): Promise<RawCallResult> {
    const url = /^https?:\/\//.test(path)
      ? path
      : path.startsWith('/services/')
        ? `${this.config.instanceUrl}${path}`
        : `${this.config.instanceUrl}${API_BASE_PATH}/${this.config.apiVersion}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Accept': opts.rawText ? 'text/plain, application/json' : 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let parsed: unknown = null;
    if (response.status !== 204) {
      const text = await response.text();
      if (opts.rawText) {
        parsed = text;
      } else {
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
      }
    }
    return { status: response.status, ok: response.ok, body: parsed };
  }

  /** Get query explain plan for a SOQL query */
  async queryExplain(soql: string): Promise<QueryExplainResult> {
    const encodedQuery = encodeURIComponent(soql);
    return this.request<QueryExplainResult>(`/query?explain=${encodedQuery}`);
  }

  // ── Core Request Method ──────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    /**
     * Single place where we:
     * - Construct an absolute URL from `{instanceUrl, apiVersion}`.
     * - Attach `Authorization: Bearer <token>` and content headers.
     * - Apply retry with exponential backoff for retryable errors.
     *
     * Complexity:
     * - O(1) JS work per attempt; total attempts bounded by `MAX_API_RETRIES`.
     */
    const { method = 'GET', body, useFullPath = false, signal } = options;

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

    // Circuit breaker gate: block requests if the circuit is open
    this.circuitBreaker.allowRequest();

    return retryWithBackoff(
      async () => {
        // Re-check on each retry attempt (circuit may have opened during backoff)
        this.circuitBreaker.allowRequest();

        let response: Response;
        try {
          response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal,
          });
        } catch (error) {
          this.circuitBreaker.recordFailure();
          throw new NetworkError(
            `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { url, method },
          );
        }

        if (response.status === 429) {
          this.circuitBreaker.recordFailure();
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(retryAfter ? parseInt(retryAfter, 10) : undefined);
        }

        if (response.status === 204) {
          this.circuitBreaker.recordSuccess();
          return undefined as T;
        }

        const responseBody = await response.json();

        if (!response.ok) {
          const sfErrors = Array.isArray(responseBody) ? responseBody : [responseBody];
          const errorMessage = sfErrors.map((e: { message?: string }) => e.message).join('; ');
          const errorCode = sfErrors[0]?.errorCode as string | undefined;
          const apiError = new SalesforceApiError(
            errorMessage || `API request failed: ${response.status}`,
            response.status,
            errorCode,
            { url, method, errors: sfErrors },
          );
          // Record 5xx errors as circuit breaker failures
          if (response.status >= 500) {
            this.circuitBreaker.recordFailure();
          }
          throw apiError;
        }

        this.circuitBreaker.recordSuccess();
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
  signal?: AbortSignal;
}

export interface QueryResult<T> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface RawCallResult {
  status: number;
  ok: boolean;
  body: unknown;
}

export interface ExecuteAnonymousResult {
  compiled: boolean;
  compileProblem: string | null;
  success: boolean;
  line: number;
  column: number;
  exceptionMessage: string | null;
  exceptionStackTrace: string | null;
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

export interface QueryExplainPlan {
  cardinality: number;
  fields: string[];
  leadingOperationType: string;
  relativeCost: number;
  sobjectCardinality: number;
  sobjectType: string;
  notes?: Array<{ description: string; fields: string[]; tableEnumOrId: string }>;
}

export interface QueryExplainResult {
  plans: QueryExplainPlan[];
}
