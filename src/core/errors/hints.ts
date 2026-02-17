/**
 * Mapping of Salesforce error codes and common error patterns to user-friendly
 * troubleshooting hints.
 *
 * Used by the Toast component to display actionable suggestions alongside error messages.
 *
 * Complexity: O(1) lookup per error code.
 */

/** Salesforce error code → user-friendly hint */
const SF_ERROR_HINTS: Record<string, string> = {
  // Validation & field errors
  FIELD_CUSTOM_VALIDATION_EXCEPTION: 'Check the validation rules on this object in your org.',
  REQUIRED_FIELD_MISSING: 'One or more required fields are missing from your data.',
  INVALID_FIELD: 'A field name in your mapping does not exist on this object. Refresh the schema.',
  INVALID_TYPE: 'The object API name is incorrect or does not exist in this org.',
  INVALID_FIELD_FOR_INSERT_UPDATE: 'You are trying to write to a read-only or formula field.',
  FIELD_FILTER_VALIDATION_EXCEPTION: 'A lookup filter on the target field is rejecting this value.',
  STRING_TOO_LONG: 'A text value exceeds the maximum field length. Check your data.',
  NUMBER_OUTSIDE_VALID_RANGE: 'A number value is outside the allowed min/max range for the field.',
  INVALID_EMAIL_ADDRESS: 'One or more email fields contain an invalid email format.',
  INVALID_ID_FIELD: 'A Salesforce ID value is malformed. IDs must be 15 or 18 characters.',
  MALFORMED_ID: 'A Salesforce ID value is malformed. IDs must be 15 or 18 characters.',

  // DML & record errors
  DUPLICATE_VALUE: 'A record with this unique value already exists. Use upsert or fix duplicates.',
  ENTITY_IS_DELETED: 'The target record has been deleted. It may be in the Recycle Bin.',
  ENTITY_IS_LOCKED: 'The record is locked by an approval process or another user.',
  UNABLE_TO_LOCK_ROW: 'Row lock contention — another process is modifying these records. Retry shortly.',
  DELETE_FAILED: 'This record cannot be deleted due to dependencies or insufficient permissions.',

  // Auth & permissions
  INSUFFICIENT_ACCESS_OR_READONLY: 'You lack permissions to perform this operation. Check your profile/permission set.',
  INVALID_SESSION_ID: 'Your session has expired. Reconnect to your Salesforce org.',
  REQUEST_LIMIT_EXCEEDED: 'API rate limit exceeded. Wait a moment before retrying.',

  // Bulk & limits
  EXCEEDED_MAX_SIZE_REQUEST: 'The request payload is too large. Reduce batch size in Settings.',
  TOO_MANY_APEX_REQUESTS: 'Apex governor limit hit. Try smaller batch sizes or retry later.',
  LIMIT_EXCEEDED: 'A Salesforce governor limit was exceeded. Try reducing batch size.',

  // Lookup & relationship
  INVALID_CROSS_REFERENCE_KEY: 'A lookup or master-detail relationship ID is invalid or inaccessible.',
  CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY: 'A trigger or process builder on this object threw an error. Check Apex logs.',

  // Generic
  UNKNOWN_EXCEPTION: 'An unexpected Salesforce error occurred. Check the Apex debug logs for details.',
  SERVER_UNAVAILABLE: 'Salesforce servers are temporarily unavailable. Retry in a few minutes.',
};

/** HTTP status code → user-friendly hint */
const HTTP_STATUS_HINTS: Record<number, string> = {
  400: 'The request was malformed. Check your field mappings and data format.',
  401: 'Authentication failed. Your session may have expired — try reconnecting.',
  403: 'Access denied. Your user profile may lack the required permissions.',
  404: 'The requested resource was not found. The object or record may have been deleted.',
  429: 'API rate limit hit. WaveLink will retry automatically — or wait a moment.',
  500: 'Salesforce internal error. This is usually temporary — retry in a few seconds.',
  502: 'Bad gateway. Salesforce may be under maintenance.',
  503: 'Salesforce is temporarily unavailable. Retry in a few minutes.',
};

/** WaveLink error code → user-friendly hint */
const WAVELINK_ERROR_HINTS: Record<string, string> = {
  AUTH_ERROR: 'Try disconnecting and reconnecting to your Salesforce org.',
  NETWORK_ERROR: 'Check your internet connection and ensure Salesforce is reachable.',
  STORAGE_ERROR: 'Extension storage may be full. Try purging old push history in Settings.',
  VALIDATION_ERROR: 'Review the field validation errors and correct your data before retrying.',
  DATA_PUSH_ERROR: 'Some records failed. Check the error details and retry failed records.',
};

/**
 * Look up a troubleshooting hint for a given error.
 * Tries Salesforce error code first, then HTTP status, then WaveLink error code.
 */
export function getErrorHint(options: {
  sfErrorCode?: string;
  httpStatus?: number;
  waveLinkCode?: string;
}): string | undefined {
  const { sfErrorCode, httpStatus, waveLinkCode } = options;
  if (sfErrorCode && SF_ERROR_HINTS[sfErrorCode]) return SF_ERROR_HINTS[sfErrorCode];
  if (httpStatus && HTTP_STATUS_HINTS[httpStatus]) return HTTP_STATUS_HINTS[httpStatus];
  if (waveLinkCode && WAVELINK_ERROR_HINTS[waveLinkCode]) return WAVELINK_ERROR_HINTS[waveLinkCode];
  return undefined;
}
