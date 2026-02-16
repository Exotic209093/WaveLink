/**
 * Core constants used across the extension.
 *
 * What this file does:
 * - Defines stable defaults (API version, batch sizes, cache TTLs).
 * - Centralizes storage keys used by `StorageService`.
 *
 * Why:
 * - Keeps configuration in one place and makes behavior changes auditable.
 *
 * Complexity: O(1).
 */

import type { ApiVersion } from '../types/salesforce';

/** Default Salesforce API version */
export const DEFAULT_API_VERSION: ApiVersion = 'v59.0';

/** Salesforce login URLs */
export const SALESFORCE_LOGIN_URLS = {
  production: 'https://login.salesforce.com',
  sandbox: 'https://test.salesforce.com',
} as const;

/** OAuth 2.0 endpoints (relative to login URL) */
export const OAUTH_ENDPOINTS = {
  authorize: '/services/oauth2/authorize',
  token: '/services/oauth2/token',
  revoke: '/services/oauth2/revoke',
  userinfo: '/services/oauth2/userinfo',
} as const;

/** Salesforce REST API path prefix */
export const API_BASE_PATH = '/services/data';

/** Bulk API 2.0 path */
export const BULK_API_PATH = '/services/data/{version}/jobs/ingest';

/** Schema cache TTL: 30 minutes */
export const SCHEMA_CACHE_TTL = 30 * 60 * 1000;

/** Max records per REST API batch (Composite API limit) */
export const MAX_COMPOSITE_BATCH_SIZE = 25;

/** Max records per Bulk API batch */
export const MAX_BULK_BATCH_SIZE = 10_000;

/** Default batch size for data pushes */
export const DEFAULT_BATCH_SIZE = 200;

/** Threshold to auto-switch to Bulk API */
export const BULK_API_THRESHOLD = 2_000;

/** Token refresh buffer - refresh 5 minutes before expiry */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Max retry attempts for transient API errors */
export const MAX_API_RETRIES = 3;

/** Base retry delay in ms */
export const RETRY_BASE_DELAY_MS = 1000;

/** Push history retention: keep last 100 entries */
export const MAX_PUSH_HISTORY = 100;

/** Salesforce domain patterns for org detection */
export const SALESFORCE_DOMAIN_PATTERNS = [
  /^https:\/\/([a-zA-Z0-9-]+)\.lightning\.force\.com/,
  /^https:\/\/([a-zA-Z0-9-]+)\.my\.salesforce\.com/,
  /^https:\/\/([a-zA-Z0-9-]+)\.salesforce\.com/,
] as const;

/** Extension storage keys */
export const STORAGE_KEYS = {
  ORGS: 'orgs',
  ACTIVE_ORG_ID: 'activeOrgId',
  SCHEMA_CACHE: 'schemaCache',
  DATA_TEMPLATES: 'dataTemplates',
  PUSH_HISTORY: 'pushHistory',
  PUSH_RESULTS: 'pushResults',
  ACTIVE_TOKENS: 'activeTokens',
  ACTIVE_PUSHES: 'activePushes',
  SAVED_QUERIES: 'savedQueries',
  UI_SETTINGS: 'uiSettings',
} as const;
