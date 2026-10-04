/**
 * CSV export formula-injection guard (#66) applies to string cells only.
 *
 * The guard stringified every value first, so genuine negative numbers exported as the text '-5.
 * The Excel exporter already guards strings only; CSV now matches it.
 */

import { recordsToCsv } from '../../src/ui/utils/csv';

function row(value: string | number | boolean | null): string {
  return recordsToCsv([{ Value: value }], ['Value']).split('\n')[1];
}

describe('CSV formula-injection guard', () => {
  it.each([
    ['negative integer', -5, '-5'],
    ['negative decimal', -12.5, '-12.5'],
    ['positive number', 42, '42'],
    ['boolean', true, 'true'],
  ])('passes %s through unchanged', (_label, value, expected) => {
    expect(row(value)).toBe(expected);
  });

  it.each([
    ['equals', '=SUM(A1:A9)', "'=SUM(A1:A9)"],
    ['plus', '+44 20 7946 0000', "'+44 20 7946 0000"],
    ['minus text', '-5', "'-5"],
    ['at', '@cmd', "'@cmd"],
    ['tab', '\tx', "'\tx"],
    ['carriage return', '\rx', `"'\rx"`],
    ['formula with comma', '=HYPERLINK("http://evil","click")', `"'=HYPERLINK(""http://evil"",""click"")"`],
  ])('neutralises string cells starting with %s', (_label, value, expected) => {
    expect(row(value)).toBe(expected);
  });

  it('leaves ordinary strings and nulls alone', () => {
    expect(row('Acme')).toBe('Acme');
    expect(row(null)).toBe('');
  });
});
