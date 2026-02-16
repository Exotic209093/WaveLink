/**
 * SOQL query screen.
 *
 * What this file does:
 * - Runs SOQL queries against the selected Salesforce tab/org.
 * - Supports pagination (queryMore), exporting results (CSV/JSON), and saved queries.
 *
 * Why:
 * - This is the fastest "Inspector-like" workflow for verifying data and troubleshooting pushes.
 *
 * Complexity:
 * - Export/rendering is O(R*C) where R is result rows and C is selected columns.
 * - Network/query time dominates for large result sets.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi, SfContext } from '../api/sf';
import { Toast } from '../components/Toast';
import { deriveColumns, flattenRecord } from '../utils/records';
import type { FlatRecord } from '../utils/records';
import { recordsToCsv } from '../utils/csv';
import { downloadTextFile } from '../utils/download';
import { ResultsGrid } from '../components/ResultsGrid';

export function QueryScreen(props: {
  sf: SfApi;
  tabId?: number;
  context?: SfContext;
  onSoqlChange?: (soql: string) => void;
  soql?: string;
}): VNode {
  const { sf, tabId, context } = props;
  const [soql, setSoql] = useState(props.soql ?? 'SELECT Id, Name FROM Account LIMIT 10');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  const [rawRecords, setRawRecords] = useState<Array<Record<string, unknown>>>([]);
  const [nextUrl, setNextUrl] = useState<string | undefined>(undefined);
  const [totalSize, setTotalSize] = useState<number | null>(null);

  const flatRecords = useMemo<FlatRecord[]>(() => rawRecords.map(r => flattenRecord(r)), [rawRecords]);
  const columns = useMemo(() => deriveColumns(rawRecords), [rawRecords]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const [savedQueries, setSavedQueries] = useState<Array<{ id: string; name: string; soql: string }>>([]);
  const [selectedSaved, setSelectedSaved] = useState<string>('');

  useEffect(() => {
    sf.listSavedQueries()
      .then(q => setSavedQueries(q))
      .catch(() => {
        // Ignore
      });
  }, [sf]);

  useEffect(() => {
    if (selectedColumns.length === 0 && columns.length > 0) {
      const defaults = ['Id', 'Name'].filter(c => columns.includes(c));
      const rest = columns.filter(c => !defaults.includes(c));
      setSelectedColumns([...defaults, ...rest].slice(0, 14));
    }
  }, [columns, selectedColumns.length]);

  async function runQuery(): Promise<void> {
    setBusy(true);
    try {
      const res = await sf.runQuery(soql, tabId);
      setRawRecords(res.records ?? []);
      setNextUrl(res.nextRecordsUrl);
      setTotalSize(res.totalSize ?? null);
      props.onSoqlChange?.(soql);
    } catch (e) {
      setToast({ title: 'Query Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  async function loadMore(): Promise<void> {
    if (!nextUrl) return;
    setBusy(true);
    try {
      const res = await sf.queryMore(nextUrl, tabId);
      setRawRecords(prev => [...prev, ...(res.records ?? [])]);
      setNextUrl(res.nextRecordsUrl);
      setTotalSize(res.totalSize ?? totalSize);
    } catch (e) {
      setToast({ title: 'Load More Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  function exportCsv(): void {
    const cols = selectedColumns.length ? selectedColumns : columns;
    const csv = recordsToCsv(flatRecords, cols);
    downloadTextFile(`wavelink-query-${Date.now()}.csv`, csv, 'text/csv');
  }

  function exportJson(): void {
    downloadTextFile(`wavelink-query-${Date.now()}.json`, JSON.stringify(rawRecords, null, 2), 'application/json');
  }

  async function saveQuery(): Promise<void> {
    const name = prompt('Saved query name?');
    if (!name) return;
    try {
      const saved = await sf.upsertSavedQuery({ id: `q_${Date.now()}`, name, soql });
      setSavedQueries(prev => [saved, ...prev]);
      setToast({ title: 'Saved', body: `Saved query "${saved.name}"` });
    } catch (e) {
      setToast({ title: 'Save Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  function loadSaved(id: string): void {
    const q = savedQueries.find(s => s.id === id);
    if (!q) return;
    setSoql(q.soql);
    props.onSoqlChange?.(q.soql);
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>SOQL</h2>
          <div class="wl-actions">
            <button class="wl-btn wl-btnPrimary" onClick={runQuery} disabled={busy || !context}>
              {busy ? 'Running...' : 'Run'}
            </button>
            <button class="wl-btn" onClick={loadMore} disabled={busy || !nextUrl}>Load More</button>
            <button class="wl-btn" onClick={saveQuery} disabled={!soql.trim()}>Save</button>
            <button class="wl-btn" onClick={exportCsv} disabled={flatRecords.length === 0}>CSV</button>
            <button class="wl-btn" onClick={exportJson} disabled={rawRecords.length === 0}>JSON</button>
          </div>
        </div>

        <div class="wl-row">
          <div class="wl-row2">
            <select
              class="wl-select"
              value={selectedSaved}
              onChange={(e) => {
                const id = (e.currentTarget as HTMLSelectElement).value;
                setSelectedSaved(id);
                if (id) loadSaved(id);
              }}
            >
              <option value="">Saved queries...</option>
              {savedQueries.map(q => <option value={q.id} key={q.id}>{q.name}</option>)}
            </select>
            <input
              class="wl-input"
              value={context ? `${context.orgId}` : 'Open a logged-in Salesforce tab'}
              disabled
            />
          </div>
          <textarea
            class="wl-textarea"
            value={soql}
            onInput={(e) => setSoql((e.currentTarget as HTMLTextAreaElement).value)}
            spellcheck={false}
          />
          <div class="wl-muted">
            {totalSize !== null ? `${rawRecords.length} loaded (totalSize: ${totalSize})` : `${rawRecords.length} loaded`}
            {nextUrl ? ' - more available' : ''}
          </div>
        </div>
      </div>

      {flatRecords.length > 0 ? (
        <ResultsGrid
          instanceUrl={context?.instanceUrl}
          records={flatRecords}
          columns={columns}
          selectedColumns={selectedColumns.length ? selectedColumns : columns}
          onSelectedColumnsChange={setSelectedColumns}
        />
      ) : (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-muted">
              Run a query to see results here.
            </div>
          </div>
        </div>
      )}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
