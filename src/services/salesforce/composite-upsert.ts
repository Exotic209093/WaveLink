import { API_BASE_PATH } from '../../core/constants';
import type { CompositeResponse, CompositeSubRequest } from '../../core/types/salesforce';

export function buildUpsertSubrequests(args: {
  apiVersion: string;
  objectName: string;
  externalIdField: string;
  records: Record<string, unknown>[];
  recordIndexOffset: number;
}): {
  subrequests: CompositeSubRequest[];
  refToRecordIndex: Map<string, number>;
  skipped: Array<{ recordIndex: number; message: string }>;
} {
  const { apiVersion, objectName, externalIdField, records, recordIndexOffset } = args;

  const subrequests: CompositeSubRequest[] = [];
  const refToRecordIndex = new Map<string, number>();
  const skipped: Array<{ recordIndex: number; message: string }> = [];

  for (let i = 0; i < records.length; i++) {
    const recordIndex = recordIndexOffset + i;
    const record = records[i];
    const externalIdValue = record[externalIdField];
    if (externalIdValue === undefined || externalIdValue === null || String(externalIdValue).trim() === '') {
      skipped.push({ recordIndex, message: `Missing external ID value for field "${externalIdField}"` });
      continue;
    }

    const referenceId = `r${recordIndex}`;
    refToRecordIndex.set(referenceId, recordIndex);

    const body: Record<string, unknown> = { ...record };
    delete body.Id;
    delete body.id;

    subrequests.push({
      method: 'PATCH',
      url: `${API_BASE_PATH}/${apiVersion}/sobjects/${objectName}/${externalIdField}/${encodeURIComponent(String(externalIdValue))}`,
      referenceId,
      body,
    });
  }

  return { subrequests, refToRecordIndex, skipped };
}

export function extractCompositeUpsertId(sub: CompositeResponse['compositeResponse'][number]): string | null {
  const body = sub.body as unknown;
  if (body && typeof body === 'object' && 'id' in body) {
    const id = (body as { id?: unknown }).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  const loc = sub.httpHeaders?.Location;
  if (typeof loc === 'string' && loc.length > 0) {
    const parts = loc.split('/');
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return null;
}

export function parseUpsertCompositeResponse(
  response: CompositeResponse,
  refToRecordIndex: Map<string, number>,
): {
  successes: Array<{ recordIndex: number; id?: string }>;
  failures: Array<{ recordIndex: number; message: string }>;
} {
  const successes: Array<{ recordIndex: number; id?: string }> = [];
  const failures: Array<{ recordIndex: number; message: string }> = [];

  for (const sub of response.compositeResponse) {
    const recordIndex = refToRecordIndex.get(sub.referenceId);
    if (recordIndex === undefined) continue;

    if (sub.httpStatusCode >= 200 && sub.httpStatusCode < 300) {
      const id = extractCompositeUpsertId(sub);
      successes.push(id ? { recordIndex, id } : { recordIndex });
      continue;
    }

    const body = sub.body as unknown;
    let msg = `Upsert failed (${sub.httpStatusCode})`;
    if (Array.isArray(body)) {
      msg = body.map((e: { message?: string }) => e.message).filter(Boolean).join('; ') || msg;
    } else if (body && typeof body === 'object' && 'message' in body) {
      const m = (body as { message?: unknown }).message;
      if (typeof m === 'string') msg = m;
    }
    failures.push({ recordIndex, message: msg });
  }

  return { successes, failures };
}

