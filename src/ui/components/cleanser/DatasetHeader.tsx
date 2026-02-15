import type { VNode } from 'preact';
import { h } from 'preact';

export function DatasetHeader(props: {
  title?: string;
  dataset: { filename: string; rows: number; columns: number; bytes?: number } | null;
  summary: { dropped: number; renamed: number; transformed: number };
  blockingMessage: string | null;
  canApply: boolean;
  hasSnapshot: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  onApply: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onGoToPush: () => void;
}): VNode {
  const {
    dataset,
    summary,
    blockingMessage,
    canApply,
    hasSnapshot,
    onUpload,
    onClear,
    onApply,
    onExportCsv,
    onExportJson,
    onGoToPush,
  } = props;

  const sizeText = dataset?.bytes ? `${Math.round(dataset.bytes / 1024)} KB` : '';

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Data Cleanser</h2>
        <div class="wl-actions">
          <label class="wl-btn">
            {dataset ? 'Replace File' : 'Upload CSV/JSON'}
            <input
              type="file"
              accept=".csv,.json"
              style="display:none"
              onChange={(e) => {
                const f = (e.currentTarget as HTMLInputElement).files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
          <button class="wl-btn wl-btnDanger" onClick={onClear} disabled={!dataset}>Clear</button>
          <button class="wl-btn wl-btnPrimary" onClick={onApply} disabled={!canApply}>Apply</button>
          <button class="wl-btn" onClick={onExportCsv} disabled={!hasSnapshot && !canApply}>Export CSV</button>
          <button class="wl-btn" onClick={onExportJson} disabled={!hasSnapshot && !canApply}>Export JSON</button>
          <button class="wl-btn wl-btnPrimary" onClick={onGoToPush} disabled={!hasSnapshot}>Send to Data Push</button>
        </div>
      </div>

      <div class="wl-row">
        {blockingMessage ? (
          <div class="wl-bannerDanger">{blockingMessage}</div>
        ) : null}

        <div class="wl-chipRow">
          <span class="wl-chip">
            <span>Rows</span>
            <strong>{dataset ? dataset.rows : '-'}</strong>
          </span>
          <span class="wl-chip">
            <span>Columns</span>
            <strong>{dataset ? dataset.columns : '-'}</strong>
          </span>
          <span class="wl-chip" title="Dropped columns">
            <span>Dropped</span>
            <strong>{dataset ? summary.dropped : '-'}</strong>
          </span>
          <span class="wl-chip" title="Renamed columns">
            <span>Renamed</span>
            <strong>{dataset ? summary.renamed : '-'}</strong>
          </span>
          <span class="wl-chip" title="Transformed columns">
            <span>Transformed</span>
            <strong>{dataset ? summary.transformed : '-'}</strong>
          </span>
          {dataset ? (
            <span class="wl-chip">
              <span>File</span>
              <strong title={dataset.filename}>{dataset.filename}</strong>
              {sizeText ? <span class="wl-muted">({sizeText})</span> : null}
            </span>
          ) : (
            <span class="wl-muted">Upload a file to start.</span>
          )}
        </div>
      </div>
    </div>
  );
}
