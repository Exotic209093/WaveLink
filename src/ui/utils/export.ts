/**
 * Multi-format export utilities for WaveLink.
 *
 * Supports CSV, JSON, Excel (XLSX), and XML export formats.
 *
 * Complexity: O(N*C) where N is number of records and C is number of columns.
 */

import type { FlatRecord } from './records';
import { recordsToCsv } from './csv';
import { recordsToExcel } from './excel';
import { recordsToXml } from './xml';
import { downloadBlobParts, downloadTextFile } from './download';

export type ExportFormat = 'csv' | 'json' | 'excel' | 'xml';

export interface ExportOptions {
  format: ExportFormat;
  filename: string;
  sheetName?: string; // Excel only
  includeMetadata?: boolean; // JSON only - wrap in metadata object
}

/**
 * Exports records to the specified format and triggers a download.
 *
 * @param records - Array of records to export
 * @param columns - Column names to include in export
 * @param options - Export configuration
 */
export async function exportRecords(
  records: Record<string, unknown>[],
  columns: string[],
  options: ExportOptions
): Promise<void> {
  const { format, filename, sheetName, includeMetadata } = options;

  // Small exports stay simple. Large text exports are generated in bounded
  // pieces so no second full-size output string or filtered-record array exists.
  if (records.length > 5_000 && format !== 'excel') {
    downloadLargeTextExport(records, columns, { format, filename, includeMetadata });
    return;
  }

  switch (format) {
    case 'csv': {
      const csv = recordsToCsv(records as FlatRecord[], columns);
      downloadTextFile(filename, csv, 'text/csv');
      break;
    }

    case 'json': {
      const json = recordsToJson(records, columns, includeMetadata);
      downloadTextFile(filename, json, 'application/json');
      break;
    }

    case 'excel': {
      await recordsToExcel(records, columns, filename, sheetName);
      break;
    }

    case 'xml': {
      const xml = recordsToXml(records, columns);
      downloadTextFile(filename, xml, 'application/xml');
      break;
    }

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

function selectColumns(record: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const column of columns) filtered[column] = record[column];
  return filtered;
}

function downloadLargeTextExport(
  records: Record<string, unknown>[],
  columns: string[],
  options: Pick<ExportOptions, 'format' | 'filename' | 'includeMetadata'>,
): void {
  const parts: BlobPart[] = [];
  const chunkSize = 1_000;
  if (options.format === 'csv') {
    for (let start = 0; start < records.length; start += chunkSize) {
      const csv = recordsToCsv(records.slice(start, start + chunkSize) as FlatRecord[], columns);
      parts.push(start === 0 ? csv : `\n${csv.slice(csv.indexOf('\n') + 1)}`);
    }
    downloadBlobParts(options.filename, parts, 'text/csv');
    return;
  }
  if (options.format === 'json') {
    if (options.includeMetadata) {
      parts.push(`{"exportedAt":${JSON.stringify(new Date().toISOString())},"recordCount":${records.length},"columnCount":${columns.length},"columns":${JSON.stringify(columns)},"records":[`);
    } else {
      parts.push('[');
    }
    for (let start = 0; start < records.length; start += chunkSize) {
      const chunk = records.slice(start, start + chunkSize).map(record => selectColumns(record, columns));
      const body = JSON.stringify(chunk).slice(1, -1);
      if (body) parts.push(start === 0 ? body : `,${body}`);
    }
    parts.push(options.includeMetadata ? ']}' : ']');
    downloadBlobParts(options.filename, parts, 'application/json');
    return;
  }
  if (options.format === 'xml') {
    parts.push('<?xml version="1.0" encoding="UTF-8"?>\n<records>');
    for (let start = 0; start < records.length; start += chunkSize) {
      const xml = recordsToXml(records.slice(start, start + chunkSize), columns);
      const bodyStart = xml.indexOf('<records>') + '<records>'.length;
      const bodyEnd = xml.lastIndexOf('</records>');
      parts.push(xml.slice(bodyStart, bodyEnd));
    }
    parts.push('\n</records>');
    downloadBlobParts(options.filename, parts, 'application/xml');
    return;
  }
  throw new Error(`Unsupported export format: ${options.format}`);
}

/**
 * Converts records to JSON string with optional metadata wrapper.
 *
 * @param records - Records to convert
 * @param columns - Columns to include
 * @param includeMetadata - Whether to wrap in metadata object
 * @returns JSON string
 */
function recordsToJson(
  records: Record<string, unknown>[],
  columns: string[],
  includeMetadata?: boolean
): string {
  // Filter records to only include specified columns
  const filtered = records.map(record => {
    const filtered: Record<string, unknown> = {};
    for (const col of columns) {
      filtered[col] = record[col];
    }
    return filtered;
  });

  if (includeMetadata) {
    const wrapped = {
      exportedAt: new Date().toISOString(),
      recordCount: filtered.length,
      columnCount: columns.length,
      columns,
      records: filtered,
    };
    return JSON.stringify(wrapped, null, 2);
  }

  return JSON.stringify(filtered, null, 2);
}

/**
 * Gets the appropriate file extension for the export format.
 *
 * @param format - Export format
 * @returns File extension (without dot)
 */
export function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'csv';
    case 'json':
      return 'json';
    case 'excel':
      return 'xlsx';
    case 'xml':
      return 'xml';
    default:
      return 'txt';
  }
}

/**
 * Ensures filename has the correct extension for the format.
 *
 * @param filename - Original filename
 * @param format - Export format
 * @returns Filename with correct extension
 */
export function ensureCorrectExtension(filename: string, format: ExportFormat): string {
  const extension = getFileExtension(format);
  const hasExtension = filename.toLowerCase().endsWith(`.${extension}`);
  return hasExtension ? filename : `${filename}.${extension}`;
}
