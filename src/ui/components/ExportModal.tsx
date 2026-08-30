/**
 * Export configuration modal for multi-format exports.
 *
 * Allows users to configure export format, filename, and format-specific options.
 *
 * Complexity: O(1) for rendering.
 */

import { h, VNode } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ExportFormat } from '../utils/export';
import { exportRecords, ensureCorrectExtension, getFileExtension } from '../utils/export';

export interface ExportModalProps {
  open: boolean;
  records: Record<string, unknown>[];
  columns: string[];
  defaultFilename?: string;
  preferences?: ExportPreferences;
  onPreferencesChange?: (preferences: ExportPreferences) => void;
  onClose: () => void;
}

export interface ExportPreferences {
  format: ExportFormat;
  sheetName: string;
  includeMetadata: boolean;
}

export function ExportModal(props: ExportModalProps): VNode | null {
  const { open, records, columns, defaultFilename = 'export', onClose } = props;

  const [format, setFormat] = useState<ExportFormat>(props.preferences?.format ?? 'csv');
  const [filename, setFilename] = useState<string>(defaultFilename);
  const [sheetName, setSheetName] = useState<string>(props.preferences?.sheetName ?? 'Sheet1');
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(props.preferences?.includeMetadata ?? false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(columns));
  const [showColumnPicker, setShowColumnPicker] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setSelectedColumns(new Set(columns));
    setFormat(props.preferences?.format ?? 'csv');
    setSheetName(props.preferences?.sheetName ?? 'Sheet1');
    setIncludeMetadata(props.preferences?.includeMetadata ?? false);
  }, [open, columns, props.preferences?.format, props.preferences?.sheetName, props.preferences?.includeMetadata]);

  function updatePreferences(next: Partial<ExportPreferences>): void {
    props.onPreferencesChange?.({ format, sheetName, includeMetadata, ...next });
  }

  if (!open) return null;

  const handleExport = async () => {
    const finalFilename = ensureCorrectExtension(filename, format);
    const columnsToExport = Array.from(selectedColumns);

    await exportRecords(records, columnsToExport, {
      format,
      filename: finalFilename,
      sheetName: format === 'excel' ? sheetName : undefined,
      includeMetadata: format === 'json' ? includeMetadata : undefined,
    });

    onClose();
  };

  const toggleColumn = (column: string) => {
    const next = new Set(selectedColumns);
    if (next.has(column)) {
      next.delete(column);
    } else {
      next.add(column);
    }
    setSelectedColumns(next);
  };

  const selectAllColumns = () => {
    setSelectedColumns(new Set(columns));
  };

  const deselectAllColumns = () => {
    setSelectedColumns(new Set());
  };

  return (
    <div class="wl-modalOverlay" role="dialog" aria-modal="true" aria-label="Export Data">
      <div class="wl-modal wl-card">
        <div class="wl-cardHeader">
          <h2>Export Data</h2>
          <button class="wl-btn" onClick={onClose}>Close</button>
        </div>

        <div class="wl-row">
          <div>
            <label htmlFor="export-format" style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">
              Export Format
            </label>
            <select
              id="export-format"
              class="wl-select"
              value={format}
              onChange={(e) => {
                const next = (e.currentTarget as HTMLSelectElement).value as ExportFormat;
                setFormat(next);
                updatePreferences({ format: next });
              }}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="excel">Excel (XLSX)</option>
              <option value="xml">XML</option>
            </select>
          </div>

          <div>
            <label htmlFor="export-filename" style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">
              Filename
            </label>
            <input
              id="export-filename"
              class="wl-input"
              type="text"
              value={filename}
              onChange={(e) => setFilename((e.currentTarget as HTMLInputElement).value)}
              placeholder={`export.${getFileExtension(format)}`}
            />
            <div class="wl-muted" style="margin-top:4px">
              Extension .{getFileExtension(format)} will be added automatically
            </div>
          </div>

          {format === 'excel' ? (
            <div>
              <label htmlFor="export-sheet-name" style="display:block;margin-bottom:6px;font-weight:900;font-size:12px">
                Sheet Name
              </label>
              <input
                id="export-sheet-name"
                class="wl-input"
                type="text"
                value={sheetName}
                onChange={(e) => {
                  const next = (e.currentTarget as HTMLInputElement).value;
                  setSheetName(next);
                  updatePreferences({ sheetName: next });
                }}
                placeholder="Sheet1"
              />
            </div>
          ) : null}

          {format === 'json' ? (
            <div>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => {
                    const next = (e.currentTarget as HTMLInputElement).checked;
                    setIncludeMetadata(next);
                    updatePreferences({ includeMetadata: next });
                  }}
                />
                <span style="font-weight:900;font-size:12px">Include Metadata</span>
              </label>
              <div class="wl-muted" style="margin-top:4px">
                Wraps records in metadata object (exportedAt, recordCount, etc.)
              </div>
            </div>
          ) : null}

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-weight:900;font-size:12px">
                Columns to Export
              </span>
              <button
                class="wl-btn"
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                style="font-size:11px;padding:4px 8px"
              >
                {showColumnPicker ? 'Hide' : 'Show'} ({selectedColumns.size}/{columns.length})
              </button>
            </div>

            {showColumnPicker ? (
              <div style="max-height:240px;overflow:auto;border:1px solid var(--wl-line-2);border-radius:12px;padding:8px;background:rgba(255,255,255,0.5)">
                <div style="display:flex;gap:8px;margin-bottom:8px">
                  <button class="wl-btn" onClick={selectAllColumns} style="font-size:11px;padding:4px 8px">
                    Select All
                  </button>
                  <button class="wl-btn" onClick={deselectAllColumns} style="font-size:11px;padding:4px 8px">
                    Deselect All
                  </button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px">
                  {columns.map(col => (
                    <label
                      key={col}
                      style="display:flex;align-items:center;gap:6px;padding:4px;cursor:pointer;font-size:12px"
                    >
                      <input
                        type="checkbox"
                        checked={selectedColumns.has(col)}
                        onChange={() => toggleColumn(col)}
                      />
                      <span>{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div class="wl-muted">
                {selectedColumns.size} of {columns.length} columns selected
              </div>
            )}
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--wl-line-2)">
            <button class="wl-btn" onClick={onClose}>Cancel</button>
            <button
              class="wl-buttonBrand"
              onClick={handleExport}
              disabled={selectedColumns.size === 0}
            >
              Export {records.length} records
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
