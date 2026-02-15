import Papa from 'papaparse';

export interface ParsedDataset {
  records: Record<string, unknown>[];
  headers: string[];
}

export function inferHeaders(records: Array<Record<string, unknown>>): string[] {
  const headers: string[] = [];
  const seen = new Set<string>();

  const add = (k: string): void => {
    if (seen.has(k)) return;
    seen.add(k);
    headers.push(k);
  };

  if (records[0]) {
    for (const k of Object.keys(records[0])) add(k);
  }

  for (const r of records) {
    for (const k of Object.keys(r)) add(k);
  }

  return headers;
}

export async function parseJsonFile(file: File): Promise<ParsedDataset> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  const records = Array.isArray(parsed) ? parsed : [parsed];
  const objects = records
    .filter(r => r && typeof r === 'object')
    .map(r => r as Record<string, unknown>);
  return { records: objects, headers: inferHeaders(objects) };
}

export async function parseCsvFile(file: File): Promise<ParsedDataset> {
  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  if (result.errors?.length) {
    const first = result.errors[0];
    throw new Error(`CSV parse error: ${first.message} (row ${first.row ?? '?'})`);
  }

  const records = (result.data ?? []).filter(Boolean) as Record<string, unknown>[];
  const headers = (result.meta.fields ?? []).filter(Boolean);
  return { records, headers: headers.length ? headers : inferHeaders(records) };
}

