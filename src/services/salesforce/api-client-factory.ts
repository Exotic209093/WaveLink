/**
 * Salesforce API client factory with per-org caching.
 *
 * Why a factory:
 * - Avoids constructing a new SalesforceApiClient for every handler call.
 * - Centralizes configuration (API version, timeout, retry policy).
 * - Enables test-double injection via constructor override.
 *
 * Complexity: O(1) lookup/creation per orgId.
 */

import { SalesforceApiClient } from './api-client';
import { BulkApiService } from './bulk-api';
import { DEFAULT_API_VERSION } from '../../core/constants';
import type { SalesforceOrg } from '../../core/types/salesforce';

export interface ApiClientFactoryConfig {
  /** Override the default API version for all clients created by this factory. */
  apiVersion?: string;
}

export class ApiClientFactory {
  private readonly cache = new Map<string, SalesforceApiClient>();
  private readonly bulkCache = new Map<string, BulkApiService>();
  private readonly defaultApiVersion: string;

  constructor(config?: ApiClientFactoryConfig) {
    this.defaultApiVersion = config?.apiVersion ?? DEFAULT_API_VERSION;
  }

  /**
   * Get or create a cached SalesforceApiClient for the given org.
   * The client is keyed by orgId; if the org's token changes, call invalidate().
   */
  getClient(org: SalesforceOrg): SalesforceApiClient {
    const key = org.orgId;
    let client = this.cache.get(key);
    if (!client) {
      client = new SalesforceApiClient({
        instanceUrl: org.instanceUrl,
        accessToken: org.accessToken,
        apiVersion: org.apiVersion ?? this.defaultApiVersion,
      });
      this.cache.set(key, client);
    }
    return client;
  }

  /**
   * Get or create a cached BulkApiService for the given org.
   */
  getBulkService(org: SalesforceOrg): BulkApiService {
    const key = org.orgId;
    let service = this.bulkCache.get(key);
    if (!service) {
      service = new BulkApiService({
        instanceUrl: org.instanceUrl,
        accessToken: org.accessToken,
        apiVersion: org.apiVersion ?? this.defaultApiVersion,
      });
      this.bulkCache.set(key, service);
    }
    return service;
  }

  /**
   * Invalidate cached clients for a specific org (e.g., after token refresh).
   */
  invalidate(orgId: string): void {
    this.cache.delete(orgId);
    this.bulkCache.delete(orgId);
  }

  /**
   * Clear all cached clients.
   */
  clear(): void {
    this.cache.clear();
    this.bulkCache.clear();
  }
}