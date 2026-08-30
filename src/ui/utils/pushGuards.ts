export type PushOperation = 'insert' | 'update' | 'upsert' | 'delete';

export function requiresIdFirst(operation: PushOperation): boolean {
  return operation === 'update' || operation === 'delete';
}

export function validateIdFirst(headers: string[], operation: PushOperation): string | null {
  if (!requiresIdFirst(operation)) return null;
  if (!headers.length) return 'Dataset has no headers. For update/delete, the first column header must be "Id".';
  const first = String(headers[0] ?? '').trim();
  if (first.toLowerCase() !== 'id') {
    return `For ${operation}, the first column header must be "Id" (current first column: "${first || '(empty)'}").`;
  }
  return null;
}

/** Require an exact typed phrase for every delete and every production write. */
export function pushConfirmationPhrase(
  operation: PushOperation,
  recordCount: number,
  objectName: string,
  environment?: 'production' | 'sandbox',
): string | null {
  if (operation === 'delete') return `DELETE ${recordCount} RECORDS`;
  if (environment === 'production') return `${operation.toUpperCase()} ${recordCount} ${objectName}`;
  return null;
}

