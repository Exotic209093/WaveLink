/**
 * Dry Run report panel.
 *
 * Renders the client-side push simulation: a would-succeed / would-fail
 * summary, grouped failure reasons, and a capped per-row failure list, with
 * CSV / JSON download of the full report.
 *
 * Complexity: O(R) in the number of failing rows rendered.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { downloadTextFile } from '../utils/download';
import { dryRunRowsToCsv } from '../utils/pushDryRun';
import type { DryRunReport } from '../utils/pushDryRun';

const ROW_RENDER_CAP = 500;

export function DryRunPanel(props: {
  report: DryRunReport;
  objectName: string;
  operation: string;
  onClose: () => void;
}): VNode {
  const { report, objectName, operation, onClose } = props;
  const allPass = report.failed === 0 && report.total > 0;
  const failingRows = report.rows.filter(r => r.status === 'error');

  function exportJson(): void {
    downloadTextFile(
      `wavelink-dryrun-${objectName}-${Date.now()}.json`,
      JSON.stringify({ objectName, operation, ...report }, null, 2),
      'application/json',
    );
  }

  function exportCsv(): void {
    downloadTextFile(`wavelink-dryrun-${objectName}-${Date.now()}.csv`, dryRunRowsToCsv(report), 'text/csv');
  }

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Dry Run {allPass ? '✓' : ''}</h2>
        <div class="wl-actions">
          <button class="wl-btn" onClick={exportCsv} disabled={report.total === 0}>Export CSV</button>
          <button class="wl-btn" onClick={exportJson} disabled={report.total === 0}>Export JSON</button>
          <button class="wl-btn" onClick={onClose}>Dismiss</button>
        </div>
      </div>

      <div class="wl-row">
        <div class="wl-chipRow">
          <span class="wl-pill wl-pill--brand">{report.total} rows</span>
          <span class="wl-pill wl-pill--success">{report.ok} would succeed</span>
          <span class={`wl-pill ${report.failed > 0 ? 'wl-pill--error' : ''}`}>{report.failed} would fail</span>
          <span class="wl-pill">{operation} → {objectName}</span>
        </div>

        <div class="wl-muted" style="font-size:11px">
          Client-side simulation against the object schema (required fields, types, lengths, picklists,
          Id / external-Id presence). It does <strong>not</strong> run server-side validation rules,
          triggers, flows, or duplicate rules — nothing is written to the org.
        </div>

        {report.total === 0 ? (
          <div class="wl-muted">No mapped records to simulate. Apply a mapping first.</div>
        ) : allPass ? (
          <div class="wl-muted">All {report.total} rows passed the schema checks and look ready to push.</div>
        ) : (
          <>
            {/* Grouped reasons */}
            <div style="font-weight:900;font-size:13px;margin-top:4px">
              Failure reasons ({report.reasons.length})
            </div>
            <div class="wl-tableWrap" style="max-height:240px">
              <table class="wl-table">
                <thead>
                  <tr>
                    <th>Reason</th>
                    <th style="width:80px">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {report.reasons.map((r, idx) => (
                    <tr key={idx}>
                      <td>{r.message}</td>
                      <td class="wl-mono">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Per-row failures */}
            <div style="font-weight:900;font-size:13px;margin-top:8px">
              Failing rows ({failingRows.length})
            </div>
            <div class="wl-tableWrap" style="max-height:280px">
              <table class="wl-table">
                <thead>
                  <tr>
                    <th style="width:70px">Row</th>
                    <th>Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {failingRows.slice(0, ROW_RENDER_CAP).map(r => (
                    <tr key={r.index}>
                      <td class="wl-mono">{r.index + 1}</td>
                      <td>{r.reasons.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {failingRows.length > ROW_RENDER_CAP ? (
              <div class="wl-muted">Showing first {ROW_RENDER_CAP} of {failingRows.length} failing rows. Export for the full list.</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
