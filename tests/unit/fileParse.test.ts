/**
 * Tests for the file-parsing helpers behind the Import and Convert flows.
 *
 * Excel parsing is exercised only through detectFormat/dispatch (it needs a real
 * xlsx binary); CSV, JSON, and XML parsing are tested end to end via File.
 */

import {
  detectFormat,
  inferHeaders,
  parseJsonFile,
  parseCsvFile,
  parseXmlFile,
  parseAnyFile,
} from '../../src/ui/utils/fileParse';
import { recordsToXml } from '../../src/ui/utils/xml';

// jsdom's File/Blob in this jest version lacks .text()/.arrayBuffer(), and the
// parsers only touch name/text()/arrayBuffer() — so a minimal stub is enough.
function file(name: string, content: string): File {
  return {
    name,
    text: async () => content,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
  } as unknown as File;
}

describe('detectFormat', () => {
  it('maps known extensions (tsv counts as csv, case-insensitive)', () => {
    expect(detectFormat(file('a.csv', ''))).toBe('csv');
    expect(detectFormat(file('a.tsv', ''))).toBe('csv');
    expect(detectFormat(file('a.JSON', ''))).toBe('json');
    expect(detectFormat(file('a.xlsx', ''))).toBe('excel');
    expect(detectFormat(file('a.xls', ''))).toBe('excel');
    expect(detectFormat(file('a.xml', ''))).toBe('xml');
  });

  it('returns null for unknown or missing extensions', () => {
    expect(detectFormat(file('a.txt', ''))).toBeNull();
    expect(detectFormat(file('noext', ''))).toBeNull();
  });
});

describe('inferHeaders', () => {
  it('returns the union of keys, first record first, de-duplicated', () => {
    const records = [
      { Id: '1', Name: 'a' },
      { Id: '2', Name: 'b', Extra: 'x' },
    ];
    expect(inferHeaders(records)).toEqual(['Id', 'Name', 'Extra']);
  });

  it('returns an empty array for no records', () => {
    expect(inferHeaders([])).toEqual([]);
  });
});

describe('parseJsonFile', () => {
  it('parses an array of objects and infers headers', async () => {
    const { records, headers } = await parseJsonFile(file('a.json', JSON.stringify([{ Id: '1', Name: 'a' }])));
    expect(records).toEqual([{ Id: '1', Name: 'a' }]);
    expect(headers).toEqual(['Id', 'Name']);
  });

  it('wraps a single object into a one-element array and drops non-objects', async () => {
    const { records } = await parseJsonFile(file('a.json', JSON.stringify([{ Id: '1' }, 5, null, 'x'])));
    expect(records).toEqual([{ Id: '1' }]);
  });
});

describe('parseCsvFile', () => {
  it('parses a header row plus data rows', async () => {
    const { records, headers } = await parseCsvFile(file('a.csv', 'Id,Name\n1,Acme\n2,Globex'));
    expect(headers).toEqual(['Id', 'Name']);
    expect(records).toEqual([
      { Id: '1', Name: 'Acme' },
      { Id: '2', Name: 'Globex' },
    ]);
  });
});

describe('parseXmlFile', () => {
  it('parses <record><field name=..> structure', async () => {
    const xml =
      '<?xml version="1.0"?><records><record><field name="Id">1</field>' +
      '<field name="Name">Acme</field></record></records>';
    const { records, headers } = await parseXmlFile(file('a.xml', xml));
    expect(records).toEqual([{ Id: '1', Name: 'Acme' }]);
    expect(headers).toEqual(['Id', 'Name']);
  });

  it('round-trips records produced by recordsToXml', async () => {
    const original = [{ Id: '1', Name: 'A & B' }];
    const xml = recordsToXml(original, ['Id', 'Name']);
    const { records } = await parseXmlFile(file('rt.xml', xml));
    expect(records).toEqual([{ Id: '1', Name: 'A & B' }]); // entity round-trip preserved
  });
});

describe('parseAnyFile', () => {
  it('dispatches by extension and tags the result with its format', async () => {
    const csv = await parseAnyFile(file('a.csv', 'Id,Name\n1,Acme'));
    expect(csv.format).toBe('csv');
    expect(csv.records).toEqual([{ Id: '1', Name: 'Acme' }]);

    const json = await parseAnyFile(file('a.json', JSON.stringify([{ Id: '2' }])));
    expect(json.format).toBe('json');
  });

  it('throws on an unsupported file type', async () => {
    await expect(parseAnyFile(file('a.txt', 'nope'))).rejects.toThrow(/Unsupported file type/);
  });
});
