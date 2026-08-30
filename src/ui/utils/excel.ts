/**
 * Excel (XLSX) export utilities using SheetJS.
 *
 * Complexity: O(N*C) where N is number of records and C is number of columns.
 */

// SheetJS is ~875 KiB. Load it on demand (dynamic import) so CSV/JSON/XML
// users never pay for it — webpack splits it into its own async chunk.
async function loadXLSX(): Promise<typeof import('xlsx')> {
  return import(/* webpackChunkName: "xlsx" */ 'xlsx/dist/xlsx.mini.min.js');
}

/**
 * Converts records to Excel file and triggers download.
 *
 * @param records - Records to export
 * @param columns - Column names to include
 * @param filename - Name of the file to download
 * @param sheetName - Name of the Excel sheet (default: "Sheet1")
 */
export async function recordsToExcel(
  records: Record<string, unknown>[],
  columns: string[],
  filename: string,
  sheetName: string = 'Sheet1'
): Promise<void> {
  const XLSX = await loadXLSX();
  // Filter records to only include specified columns
  const filtered = records.map(record => {
    const filtered: Record<string, unknown> = {};
    for (const col of columns) {
      filtered[col] = record[col];
    }
    return filtered;
  });

  // Create worksheet from records
  const worksheet = XLSX.utils.json_to_sheet(filtered, { header: columns });

  // Auto-size columns based on content
  const maxWidths: Record<string, number> = {};
  for (const col of columns) {
    maxWidths[col] = col.length; // Start with header length
  }

  for (const record of filtered) {
    for (const col of columns) {
      const value = record[col];
      const length = value !== null && value !== undefined ? String(value).length : 0;
      if (length > maxWidths[col]) {
        maxWidths[col] = length;
      }
    }
  }

  // Set column widths (max 50 characters)
  worksheet['!cols'] = columns.map(col => ({
    wch: Math.min(maxWidths[col] + 2, 50),
  }));

  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Trigger download
  XLSX.writeFile(workbook, filename);
}

/**
 * Converts records to Excel buffer (for programmatic use).
 *
 * @param records - Records to convert
 * @param columns - Column names to include
 * @param sheetName - Name of the Excel sheet
 * @returns ArrayBuffer containing the Excel file
 */
export async function recordsToExcelBuffer(
  records: Record<string, unknown>[],
  columns: string[],
  sheetName: string = 'Sheet1'
): Promise<ArrayBuffer> {
  const XLSX = await loadXLSX();
  const filtered = records.map(record => {
    const filtered: Record<string, unknown> = {};
    for (const col of columns) {
      filtered[col] = record[col];
    }
    return filtered;
  });

  const worksheet = XLSX.utils.json_to_sheet(filtered, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}
