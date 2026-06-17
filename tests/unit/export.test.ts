/**
 * Tests for the multi-format export utility (powers the Export and Convert flows).
 *
 * download.ts and excel.ts are mocked so the suite stays free of DOM download
 * side effects and the heavy xlsx dependency; csv.ts and xml.ts run for real so
 * the produced content is verified end to end.
 */

jest.mock('../../src/ui/utils/download');
jest.mock('../../src/ui/utils/excel');

import {
  exportRecords,
  getFileExtension,
  ensureCorrectExtension,
  type ExportFormat,
} from '../../src/ui/utils/export';
import { downloadTextFile } from '../../src/ui/utils/download';
import { recordsToExcel } from '../../src/ui/utils/excel';

const mockDownload = downloadTextFile as jest.Mock;
const mockExcel = recordsToExcel as jest.Mock;

const records = [
  { Id: '001', Name: 'Acme', Industry: 'Tech', Secret: 'hide-me' },
  { Id: '002', Name: 'Globex', Industry: 'Energy', Secret: 'hide-me' },
];
const columns = ['Id', 'Name', 'Industry'];

beforeEach(() => {
  mockDownload.mockClear();
  mockExcel.mockClear();
});

describe('getFileExtension', () => {
  it('maps each format to its extension', () => {
    expect(getFileExtension('csv')).toBe('csv');
    expect(getFileExtension('json')).toBe('json');
    expect(getFileExtension('excel')).toBe('xlsx');
    expect(getFileExtension('xml')).toBe('xml');
  });

  it('falls back to txt for an unknown format', () => {
    expect(getFileExtension('weird' as ExportFormat)).toBe('txt');
  });
});

describe('ensureCorrectExtension', () => {
  it('appends the extension when missing', () => {
    expect(ensureCorrectExtension('accounts', 'csv')).toBe('accounts.csv');
    expect(ensureCorrectExtension('accounts', 'excel')).toBe('accounts.xlsx');
  });

  it('keeps a filename that already has the right extension (case-insensitive)', () => {
    expect(ensureCorrectExtension('accounts.csv', 'csv')).toBe('accounts.csv');
    expect(ensureCorrectExtension('accounts.CSV', 'csv')).toBe('accounts.CSV');
  });

  it('appends when the existing extension does not match the format', () => {
    expect(ensureCorrectExtension('accounts.json', 'csv')).toBe('accounts.json.csv');
  });
});

describe('exportRecords', () => {
  it('writes CSV limited to the selected columns', () => {
    exportRecords(records, columns, { format: 'csv', filename: 'a.csv' });
    expect(mockDownload).toHaveBeenCalledTimes(1);
    const [filename, content, mime] = mockDownload.mock.calls[0];
    expect(filename).toBe('a.csv');
    expect(mime).toBe('text/csv');
    expect(content).toBe('Id,Name,Industry\n001,Acme,Tech\n002,Globex,Energy');
    expect(content).not.toContain('hide-me'); // unselected column excluded
  });

  it('writes a plain JSON array of only the selected columns', () => {
    exportRecords(records, columns, { format: 'json', filename: 'a.json' });
    const [, content, mime] = mockDownload.mock.calls[0];
    expect(mime).toBe('application/json');
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ Id: '001', Name: 'Acme', Industry: 'Tech' });
    expect(parsed[0]).not.toHaveProperty('Secret');
  });

  it('wraps JSON in a metadata envelope when requested', () => {
    exportRecords(records, columns, { format: 'json', filename: 'a.json', includeMetadata: true });
    const parsed = JSON.parse(mockDownload.mock.calls[0][1]);
    expect(parsed.recordCount).toBe(2);
    expect(parsed.columnCount).toBe(3);
    expect(parsed.columns).toEqual(columns);
    expect(parsed.records).toHaveLength(2);
    expect(typeof parsed.exportedAt).toBe('string');
  });

  it('writes XML with field elements for the selected columns', () => {
    exportRecords(records, columns, { format: 'xml', filename: 'a.xml' });
    const [, content, mime] = mockDownload.mock.calls[0];
    expect(mime).toBe('application/xml');
    expect(content).toContain('<records>');
    expect(content).toContain('<field name="Name">Acme</field>');
    expect(content).not.toContain('hide-me');
  });

  it('delegates Excel export to recordsToExcel without touching downloadTextFile', () => {
    exportRecords(records, columns, { format: 'excel', filename: 'a.xlsx', sheetName: 'Accts' });
    expect(mockExcel).toHaveBeenCalledWith(records, columns, 'a.xlsx', 'Accts');
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('throws on an unsupported format', async () => {
    await expect(
      exportRecords(records, columns, { format: 'pdf' as ExportFormat, filename: 'a.pdf' }),
    ).rejects.toThrow(/Unsupported export format/);
  });
});
