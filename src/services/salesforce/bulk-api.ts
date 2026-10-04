/**
 * Salesforce Bulk API 2.0 service.
 * Handles high-volume data operations using the ingest API.
 *
 * Why a separate service:
 * - Bulk API is a different protocol (job lifecycle + CSV upload + polling) than standard REST CRUD.
 *
 * Data types:
 * - Upload format is CSV (`text/csv`); results are also returned as CSV and parsed into `BulkJobResult[]`.
 *
 * Complexity:
 * - Polling is O(A) attempts (bounded) with O(1) work per attempt plus network.
 * - CSV conversion/parsing is O(N * K) over records/fields.
 */

import { API_BASE_PATH } from '../../core/constants';
import { SalesforceApiError, NetworkError } from '../../core/errors';
import type { ApiVersion, BulkJob, BulkJobState } from '../../core/types/salesforce';
import type { BulkQueryJob } from '../../core/types/salesforce';
import { sleep } from '../../core/utils';
import Papa from 'papaparse';

export interface BulkApiConfig {
  instanceUrl: string;
  accessToken: string;
  apiVersion: ApiVersion;
}

export interface BulkJobCreateRequest {
  object: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  externalIdFieldName?: string;
  lineEnding?: 'LF' | 'CRLF';
  columnDelimiter?: 'COMMA' | 'TAB' | 'PIPE' | 'SEMICOLON' | 'BACKQUOTE' | 'CARET';
}

export interface BulkJobResult {
  sf__Id: string;
  sf__Created: string;
  sf__Error: string;
  [key: string]: string;
}

export interface BulkQueryResultPage {
  records: Array<Record<string, unknown>>;
  locator: string | null;
  numberOfRecords: number;
}

/** Bulk API 2.0 sets a field to null only for this literal; an empty cell leaves it unchanged. */
export const BULK_NULL_VALUE = '#N/A';

/**
 * Ingest CSV header row: the union of keys across all records, in first-seen order (#45).
 * The mapper omits blank-ignored keys per record, so row 0 alone can miss whole columns.
 */
export function bulkCsvHeaders(records: Record<string, unknown>[]): string[] {
  const headers = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) headers.add(key);
  }
  return Array.from(headers);
}

/**
 * Unquoted ingest CSV cell for one field. Missing keys stay blank (Salesforce leaves the field
 * untouched); an explicit `null` ("blank means clear") becomes `#N/A` so Bulk clears it like REST.
 */
export function bulkCsvCellValue(record: Record<string, unknown>, header: string): string {
  const val = record[header];
  if (val === undefined) return '';
  if (val === null) return BULK_NULL_VALUE;
  // Sent verbatim. Formula-injection neutralisation (#66) applies to files opened in a spreadsheet
  // (exports), not API payloads: a `'` prefix here would be stored in Salesforce or make values
  // such as -5, +44 20 7946 0000 or @handle invalid.
  return String(val);
}

/**
 * BulkApiService manages Bulk API 2.0 ingest jobs.
 */
export class BulkApiService {
  private config: BulkApiConfig;

  constructor(config: BulkApiConfig) {
    this.config = config;
  }

  /** Update access token after refresh */
  updateAccessToken(accessToken: string): void {
    this.config.accessToken = accessToken;
  }

  /**
   * Create a new ingest job.
   */
  async createJob(request: BulkJobCreateRequest): Promise<BulkJob> {
    const url = this.buildUrl('/jobs/ingest');

    const response = await this.fetch(url, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        ...request,
        contentType: 'CSV',
        lineEnding: request.lineEnding ?? 'LF',
      }),
    });

    return this.handleResponse<BulkJob>(response);
  }

  /**
   * Upload CSV data to an open job.
   */
  async uploadJobData(jobId: string, csvData: string): Promise<void> {
    const url = this.buildUrl(`/jobs/ingest/${jobId}/batches`);

    const response = await this.fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'text/csv',
      },
      body: csvData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new SalesforceApiError(
        `Failed to upload job data: ${body}`,
        response.status,
        undefined,
        { jobId },
      );
    }
  }

  /**
   * Close the job to signal that all data has been uploaded.
   */
  async closeJob(jobId: string): Promise<BulkJob> {
    return this.updateJobState(jobId, 'UploadComplete');
  }

  /**
   * Abort a job.
   */
  async abortJob(jobId: string): Promise<BulkJob> {
    return this.updateJobState(jobId, 'Aborted');
  }

  /**
   * Get the current status of a job.
   */
  async getJobStatus(jobId: string): Promise<BulkJob> {
    const url = this.buildUrl(`/jobs/ingest/${jobId}`);
    const response = await this.fetch(url, { headers: this.jsonHeaders() });
    return this.handleResponse<BulkJob>(response);
  }

  /**
   * Poll for job completion.
   * @param jobId - The job ID to poll
   * @param intervalMs - Poll interval in milliseconds (default 5s)
   * @param maxAttempts - Maximum poll attempts (default 120 = 10 minutes at 5s)
   * @param onProgress - Optional callback for progress updates
   */
  async pollJobCompletion(
    jobId: string,
    intervalMs: number = 5000,
    maxAttempts: number = 120,
    onProgress?: (job: BulkJob) => void,
    abortSignal?: AbortSignal,
  ): Promise<BulkJob> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (abortSignal?.aborted) {
        throw new Error('Cancelled');
      }
      const job = await this.getJobStatus(jobId);

      if (onProgress) {
        onProgress(job);
      }

      if (job.state === 'JobComplete' || job.state === 'Failed' || job.state === 'Aborted') {
        return job;
      }

      await sleep(intervalMs);
    }

    throw new SalesforceApiError(
      `Job ${jobId} did not complete within the timeout period`,
      408,
      'JOB_TIMEOUT',
      { jobId, maxAttempts, intervalMs },
    );
  }

  /**
   * Get successful results for a completed job.
   */
  async getSuccessfulResults(jobId: string): Promise<BulkJobResult[]> {
    const url = this.buildUrl(`/jobs/ingest/${jobId}/successfulResults`);
    const response = await this.fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Accept': 'text/csv',
      },
    });

    const csvText = await response.text();
    if (!response.ok) {
      throw new SalesforceApiError(`Failed to retrieve bulk job results: ${csvText}`, response.status, undefined, { jobId });
    }
    return this.parseCsv(csvText);
  }

  /**
   * Get failed results for a completed job.
   */
  async getFailedResults(jobId: string): Promise<BulkJobResult[]> {
    const url = this.buildUrl(`/jobs/ingest/${jobId}/failedResults`);
    const response = await this.fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Accept': 'text/csv',
      },
    });

    const csvText = await response.text();
    if (!response.ok) {
      throw new SalesforceApiError(`Failed to retrieve bulk job results: ${csvText}`, response.status, undefined, { jobId });
    }
    return this.parseCsv(csvText);
  }

  /** Create an asynchronous Bulk API 2.0 query job. */
  async createQueryJob(soql: string): Promise<BulkQueryJob> {
    const response = await this.fetch(this.buildUrl('/jobs/query'), {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        operation: 'query',
        query: soql.replace(/[\r\n]+/g, ' ').trim(),
        contentType: 'CSV',
        columnDelimiter: 'COMMA',
        lineEnding: 'LF',
      }),
    });
    return this.handleResponse<BulkQueryJob>(response);
  }

  /** Read the current state and processed-record count for a query job. */
  async getQueryJobStatus(jobId: string): Promise<BulkQueryJob> {
    const response = await this.fetch(this.buildUrl(`/jobs/query/${encodeURIComponent(jobId)}`), {
      headers: this.jsonHeaders(),
    });
    return this.handleResponse<BulkQueryJob>(response);
  }

  /** Retrieve one bounded CSV result page; the locator resumes the next page. */
  async getQueryResults(jobId: string, locator?: string, maxRecords: number = 10_000): Promise<BulkQueryResultPage> {
    const params = new URLSearchParams({ maxRecords: String(Math.max(1, Math.min(100_000, maxRecords))) });
    if (locator) params.set('locator', locator);
    const response = await this.fetch(`${this.buildUrl(`/jobs/query/${encodeURIComponent(jobId)}/results`)}?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Accept': 'text/csv',
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new SalesforceApiError(`Failed to retrieve bulk query results: ${body}`, response.status, undefined, { jobId });
    }
    const csvText = await response.text();
    const parsed = Papa.parse<Record<string, unknown>>(csvText, {
      header: true,
      delimiter: ',',
      skipEmptyLines: true,
      // No dynamicTyping: it coerces Text values ("00123" -> 123, long numbers lose precision,
      // "true" -> boolean). Correct typing needs field metadata, not CSV guessing.
      transformHeader: header => header.trim(),
    });
    if (parsed.errors.length > 0) {
      throw new SalesforceApiError(`Invalid CSV returned by Bulk API: ${parsed.errors[0].message}`, 502, 'INVALID_BULK_CSV', { jobId });
    }
    const locatorHeader = response.headers.get('Sforce-Locator');
    const locatorValue = locatorHeader && locatorHeader.toLowerCase() !== 'null' ? locatorHeader : null;
    return {
      records: parsed.data,
      locator: locatorValue,
      numberOfRecords: Number(response.headers.get('Sforce-NumberOfRecords') ?? parsed.data.length),
    };
  }

  /** Abort a query job that is no longer needed. */
  async abortQueryJob(jobId: string): Promise<BulkQueryJob> {
    const response = await this.fetch(this.buildUrl(`/jobs/query/${encodeURIComponent(jobId)}`), {
      method: 'PATCH',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ state: 'Aborted' }),
    });
    return this.handleResponse<BulkQueryJob>(response);
  }

  /**
   * Convert records to CSV format for upload.
   */
  recordsToCsv(records: Record<string, unknown>[]): string {
    if (records.length === 0) return '';

    const headers = bulkCsvHeaders(records);
    const lines = [headers.join(',')];

    for (const record of records) {
      const values = headers.map(h => {
        const str = bulkCsvCellValue(record, h);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  // ── Private Helpers ──────────────────────────────────────────────

  private async updateJobState(jobId: string, state: BulkJobState): Promise<BulkJob> {
    const url = this.buildUrl(`/jobs/ingest/${jobId}`);
    const response = await this.fetch(url, {
      method: 'PATCH',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ state }),
    });
    return this.handleResponse<BulkJob>(response);
  }

  private buildUrl(path: string): string {
    return `${this.config.instanceUrl}${API_BASE_PATH}/${this.config.apiVersion}${path}`;
  }

  private jsonHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  private async fetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      throw new NetworkError(
        `Bulk API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { url },
      );
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const body = await response.text();
      throw new SalesforceApiError(
        `Bulk API error: ${body}`,
        response.status,
      );
    }
    return response.json();
  }

  private parseCsv(csvText: string): BulkJobResult[] {
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    return parsed.data.map((row) => ({
      sf__Id: row['sf__Id'] ?? '',
      sf__Created: row['sf__Created'] ?? '',
      sf__Error: row['sf__Error'] ?? '',
      ...row,
    }));
  }
}
