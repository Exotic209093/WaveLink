/**
 * XML export utilities for WaveLink.
 *
 * Generates Salesforce-compatible XML structure.
 *
 * Complexity: O(N*C) where N is number of records and C is number of columns.
 */

/**
 * Escapes special XML characters.
 *
 * @param value - Value to escape
 * @returns Escaped string
 */
function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts records to Salesforce-compatible XML format.
 *
 * @param records - Records to convert
 * @param columns - Column names to include
 * @returns XML string
 */
export function recordsToXml(
  records: Record<string, unknown>[],
  columns: string[]
): string {
  const lines: string[] = [];

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<records>');

  // Generate record elements
  for (const record of records) {
    lines.push('  <record>');
    for (const col of columns) {
      const value = record[col];
      if (value !== null && value !== undefined) {
        lines.push(`    <field name="${escapeXml(col)}">${escapeXml(value)}</field>`);
      }
    }
    lines.push('  </record>');
  }

  lines.push('</records>');

  return lines.join('\n');
}

/**
 * Converts records to XML with custom root and record element names.
 *
 * @param records - Records to convert
 * @param columns - Column names to include
 * @param rootElementName - Name of the root element
 * @param recordElementName - Name of each record element
 * @returns XML string
 */
export function recordsToXmlCustom(
  records: Record<string, unknown>[],
  columns: string[],
  rootElementName: string = 'records',
  recordElementName: string = 'record'
): string {
  const lines: string[] = [];

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<${rootElementName}>`);

  // Generate record elements
  for (const record of records) {
    lines.push(`  <${recordElementName}>`);
    for (const col of columns) {
      const value = record[col];
      const safeColumnName = col.replace(/[^a-zA-Z0-9_]/g, '_'); // Make XML-safe
      if (value !== null && value !== undefined) {
        lines.push(`    <${safeColumnName}>${escapeXml(value)}</${safeColumnName}>`);
      }
    }
    lines.push(`  </${recordElementName}>`);
  }

  lines.push(`</${rootElementName}>`);

  return lines.join('\n');
}
