/**
 * Core Salesforce type definitions for WaveLink.
 * These types model the Salesforce REST API and org metadata.
 */

/** Salesforce org environment type */
export type SalesforceEnvironment = 'production' | 'sandbox' | 'scratch' | 'developer';

/** Salesforce API version string (e.g., "v59.0") */
export type ApiVersion = `v${number}.0`;

/** Represents a connected Salesforce org */
export interface SalesforceOrg {
  id: string;
  orgId: string;
  instanceUrl: string;
  environment: SalesforceEnvironment;
  username: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: number;
  apiVersion: ApiVersion;
  connectedAt: number;
  lastUsedAt: number;
  /** User-assigned nickname for this org */
  nickname?: string;
}

/** Salesforce SObject metadata */
export interface SObjectDescribe {
  name: string;
  label: string;
  labelPlural: string;
  keyPrefix: string | null;
  custom: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  fields: SObjectField[];
}

/** Salesforce field metadata */
export interface SObjectField {
  name: string;
  label: string;
  type: SalesforceFieldType;
  length: number;
  required: boolean;
  createable: boolean;
  updateable: boolean;
  nillable: boolean;
  defaultValue: unknown;
  picklistValues?: PicklistEntry[];
  referenceTo?: string[];
  relationshipName?: string | null;
  externalId: boolean;
  unique: boolean;
}

/** Salesforce field types */
export type SalesforceFieldType =
  | 'string'
  | 'boolean'
  | 'int'
  | 'double'
  | 'date'
  | 'datetime'
  | 'time'
  | 'base64'
  | 'id'
  | 'reference'
  | 'currency'
  | 'textarea'
  | 'percent'
  | 'phone'
  | 'url'
  | 'email'
  | 'combobox'
  | 'picklist'
  | 'multipicklist'
  | 'location'
  | 'address'
  | 'encryptedstring';

/** Picklist value entry */
export interface PicklistEntry {
  value: string;
  label: string;
  active: boolean;
  defaultValue: boolean;
}

/** Standard Salesforce API response for record operations */
export interface SalesforceRecordResult {
  id: string;
  success: boolean;
  errors: SalesforceError[];
}

/** Salesforce API error */
export interface SalesforceError {
  statusCode: string;
  message: string;
  fields: string[];
}

/** Composite API sub-request */
export interface CompositeSubRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  referenceId: string;
  body?: Record<string, unknown>;
}

/** Composite API response */
export interface CompositeResponse {
  compositeResponse: CompositeSubResult[];
}

export interface CompositeSubResult {
  body: unknown;
  httpHeaders: Record<string, string>;
  httpStatusCode: number;
  referenceId: string;
}

/** Bulk API 2.0 job */
export interface BulkJob {
  id: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  object: string;
  state: BulkJobState;
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
  createdDate: string;
  jobType: 'BigObjectIngest' | 'Classic' | 'V2Ingest';
}

export type BulkJobState =
  | 'Open'
  | 'UploadComplete'
  | 'InProgress'
  | 'Aborted'
  | 'JobComplete'
  | 'Failed';
