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
import { sleep } from '../../core/utils';

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
    return this.parseCsv(csvText);
  }

  /**
   * Convert records to CSV format for upload.
   */
  recordsToCsv(records: Record<string, unknown>[]): string {
    if (records.length === 0) return '';

    const headers = Object.keys(records[0]);
    const lines = [headers.join(',')];

    for (const record of records) {
      const values = headers.map(h => {
        const val = record[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
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
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0]);
    const results: BulkJobResult[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const record: BulkJobResult = { sf__Id: '', sf__Created: '', sf__Error: '' };
      headers.forEach((header, idx) => {
        record[header] = values[idx] ?? '';
      });
      results.push(record);
    }

    return results;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    values.push(current);
    return values;
  }
}
