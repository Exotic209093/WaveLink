/**
 * Offline format converter (CSV ↔ JSON ↔ Excel ↔ XML).
 * Does not require a Salesforce connection.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState } from 'preact/hooks';
import { DropZone } from '../components/DropZone';
import { parseAnyFile } from '../utils/fileParse';
import type { SupportedInputFormat } from '../utils/fileParse';
import { exportRecords, ensureCorrectExtension } from '../utils/export';
import type { ExportFormat } from '../utils/export';
import { Icon } from '../components/Icon';

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
  excel: 'Excel (xlsx)',
  xml: 'XML',
};

const ACCEPT = ['.csv', '.tsv', '.json', '.xlsx', '.xml'];

function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

export function ConvertScreen(): VNode {
  const [records, setRecords] = useState<Record<string, unknown>[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState<string>('');
  const [sourceFormat, setSourceFormat] = useState<SupportedInputFormat | null>(null);
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('json');
  const [error, setError] = useState<string | null>(null);
  const [columnFilter, setColumnFilter] = useState<Set<string>>(new Set());

  async function handleFile(file: File): Promise<void> {
    setError(null);
    try {
      const parsed = await parseAnyFile(file);
      setRecords(parsed.records);
      setHeaders(parsed.headers);
      setSourceName(file.name);
      setSourceFormat(parsed.format);
      setColumnFilter(new Set(parsed.headers));
      // Default output to something different from source
      const defaultOut: ExportFormat = parsed.format === 'csv' ? 'json' : parsed.format === 'json' ? 'csv' : 'csv';
      setOutputFormat(defaultOut);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file');
      setRecords(null);
      setHeaders([]);
    }
  }

  async function handleDownload(): Promise<void> {
    if (!records) return;
    const cols = headers.filter(h => columnFilter.has(h));
    if (cols.length === 0) {
      setError('Select at least one column to include in the output.');
      return;
    }
    const filename = ensureCorrectExtension(baseName(sourceName) + '-converted', outputFormat);
    try {
      await exportRecords(records, cols, { format: outputFormat, filename });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export');
    }
  }

  function reset(): void {
    setRecords(null);
    setHeaders([]);
    setSourceName('');
    setSourceFormat(null);
    setError(null);
    setColumnFilter(new Set());
  }

  function toggleColumn(col: string): void {
    setColumnFilter(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  }

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Convert</span>
          <h1 class="wl-pageHeader__title">Format converter</h1>
          <p class="wl-pageHeader__sub">
            Drop a file in, pick an output format, get a download. Works fully offline — no Salesforce connection needed.
          </p>
        </div>
        <div class="wl-pageHeader__actions">
          {records ? (
            <button class="wl-buttonText" onClick={reset}>Start over</button>
          ) : null}
        </div>
      </div>

      {!records ? (
        <div class="wl-card">
          <div class="wl-cardSection">
            <DropZone accept={ACCEPT} onDrop={handleFile} className="wl-dropZone--lg">
              <div class="wl-dropZone__icon"><Icon name="folder" size={32} /></div>
              <p class="wl-dropZone__title">Drop a file to convert</p>
              <p class="wl-dropZone__hint">
                CSV · TSV · JSON · Excel (.xlsx) · XML — or click to browse
              </p>
            </DropZone>
            {error ? <div class="wl-bannerDanger" style="margin-top:12px">{error}</div> : null}
          </div>
        </div>
      ) : (
        <>
          <div class="wl-twoCol">
            <div class="wl-card">
              <div class="wl-cardHeader">
                <h2>Source</h2>
                <span class="wl-pill wl-pill--brand">{sourceFormat?.toUpperCase()}</span>
              </div>
              <div class="wl-cardSection">
                <div class="wl-formRow">
                  <div class="wl-formRow__label">File</div>
                  <div class="wl-mono" style="font-size:13px">{sourceName}</div>
                </div>
                <div class="wl-formRow">
                  <div class="wl-formRow__label">Records</div>
                  <div style="font-size:22px;font-weight:800;letter-spacing:-0.3px">{records.length.toLocaleString()}</div>
                </div>
                <div class="wl-formRow">
                  <div class="wl-formRow__label">Columns ({headers.length})</div>
                  <div style="display:flex;flex-wrap:wrap;gap:6px">
                    {headers.map(col => (
                      <label key={col} class={`wl-pill ${columnFilter.has(col) ? 'wl-pill--brand' : ''}`} style="cursor:pointer">
                        <input
                          type="checkbox"
                          checked={columnFilter.has(col)}
                          onChange={() => toggleColumn(col)}
                          style="margin:0;accent-color:var(--wl-brand)"
                        />
                        {col}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div class="wl-card">
              <div class="wl-cardHeader">
                <h2>Output</h2>
              </div>
              <div class="wl-cardSection">
                <div class="wl-formRow">
                  <span id="convert-format-label" class="wl-formRow__label wl-formRow__label--required">Format</span>
                  <div class="wl-flowTabs" role="group" aria-labelledby="convert-format-label" style="margin-bottom:0">
                    {(['csv', 'json', 'excel', 'xml'] as ExportFormat[]).map(fmt => (
                      <button
                        key={fmt}
                        class="wl-flowTab"
                        data-active={outputFormat === fmt}
                        onClick={() => setOutputFormat(fmt)}
                      >
                        {FORMAT_LABELS[fmt]}
                      </button>
                    ))}
                  </div>
                </div>
                <div class="wl-formRow">
                  <div class="wl-formRow__label">Filename preview</div>
                  <div class="wl-mono" style="font-size:13px">
                    {ensureCorrectExtension(baseName(sourceName) + '-converted', outputFormat)}
                  </div>
                </div>
                {error ? <div class="wl-bannerDanger">{error}</div> : null}
                <button
                  class="wl-buttonBrand"
                  onClick={handleDownload}
                  disabled={columnFilter.size === 0}
                  style="margin-top:8px"
                >
                  <Icon name="arrow-down" size={16} /> Download as {FORMAT_LABELS[outputFormat]}
                </button>
              </div>
            </div>
          </div>

          <div class="wl-card" style="margin-top:16px">
            <div class="wl-cardHeader">
              <h2>Preview (first 10 rows)</h2>
            </div>
            <div class="wl-tableWrap">
              <table class="wl-dataTable">
                <thead>
                  <tr>
                    {headers.filter(h => columnFilter.has(h)).map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      {headers.filter(h => columnFilter.has(h)).map(h => (
                        <td key={h}>{r[h] === null || r[h] === undefined ? '' : String(r[h])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
