/**
 * File parsing helpers for CSV/JSON uploads.
 *
 * Why:
 * - Keeps FileReader/parsing logic out of UI components.
 *
 * Complexity:
 * - CSV parsing is O(N) in file size; JSON parsing is O(N) in text length.
 */

import Papa from 'papaparse';

export interface ParsedDataset {
  records: Record<string, unknown>[];
  headers: string[];
}

export type SupportedInputFormat = 'csv' | 'json' | 'excel' | 'xml';

const FORMAT_BY_EXT: Record<string, SupportedInputFormat> = {
  '.csv': 'csv',
  '.tsv': 'csv',
  '.json': 'json',
  '.xlsx': 'excel',
  '.xls': 'excel',
  '.xml': 'xml',
};

export function detectFormat(file: File): SupportedInputFormat | null {
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext) return null;
  return FORMAT_BY_EXT[ext] ?? null;
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

export async function parseExcelFile(file: File): Promise<ParsedDataset> {
  // Load SheetJS (~875 KiB) only when an Excel file is actually parsed.
  const XLSX = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Excel file contains no sheets');
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false });
  return { records: rows, headers: inferHeaders(rows) };
}

export async function parseXmlFile(file: File): Promise<ParsedDataset> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`XML parse error: ${err.textContent ?? 'unknown'}`);

  // Find record-level elements: prefer <record>, else direct children of the root after declaration.
  let recordEls: Element[] = Array.from(doc.querySelectorAll('record'));
  if (recordEls.length === 0 && doc.documentElement) {
    recordEls = Array.from(doc.documentElement.children);
  }

  const records: Record<string, unknown>[] = recordEls.map(el => {
    const obj: Record<string, unknown> = {};
    // <field name="X">value</field> style first
    const fieldEls = el.querySelectorAll(':scope > field[name]');
    if (fieldEls.length > 0) {
      fieldEls.forEach(f => {
        const name = f.getAttribute('name');
        if (name) obj[name] = f.textContent ?? '';
      });
    } else {
      // Generic: child element name -> text content
      Array.from(el.children).forEach(child => {
        obj[child.tagName] = child.textContent ?? '';
      });
    }
    return obj;
  });

  return { records, headers: inferHeaders(records) };
}

export async function parseAnyFile(file: File): Promise<ParsedDataset & { format: SupportedInputFormat }> {
  const format = detectFormat(file);
  if (!format) throw new Error(`Unsupported file type: ${file.name}`);
  switch (format) {
    case 'csv': return { ...(await parseCsvFile(file)), format };
    case 'json': return { ...(await parseJsonFile(file)), format };
    case 'excel': return { ...(await parseExcelFile(file)), format };
    case 'xml': return { ...(await parseXmlFile(file)), format };
  }
}
