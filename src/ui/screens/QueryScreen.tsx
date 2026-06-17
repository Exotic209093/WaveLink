/**
 * SOQL query screen.
 *
 * What this file does:
 * - Runs SOQL queries against the selected Salesforce tab/org.
 * - Supports pagination (queryMore), exporting results (CSV/JSON), and saved queries.
 * - Visual Query Builder for generating SOQL from structured inputs.
 * - Smart SOQL autocomplete with object/field/value suggestions.
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
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SfApi, SfContext } from '../api/sf';
import type { SavedQuery, QueryFolder } from '../../core/types/storage';
import { Toast } from '../components/Toast';
import { PromptModal } from '../components/PromptModal';
import { deriveColumns, flattenRecord } from '../utils/records';
import type { FlatRecord } from '../utils/records';
import { recordsToCsv } from '../utils/csv';
import { downloadTextFile } from '../utils/download';
import { ResultsGrid } from '../components/ResultsGrid';
import { QueryBuilder } from '../components/query-builder/QueryBuilder';
import { SoqlAutocomplete } from '../components/SoqlAutocomplete';
import type { Suggestion } from '../components/SoqlAutocomplete';
import { useSchemaLoader } from '../hooks/useSchemaLoader';
import { parseSoqlContext, isKeywordPrefix } from '../utils/soqlParser';
import { fuzzyFilter } from '../utils/fuzzyMatch';
import { QueryManager } from '../components/QueryManager';
import { QueryHistory } from '../components/QueryHistory';
import { SoqlHighlighter } from '../components/SoqlHighlighter';
import { QueryExplainPanel } from '../components/QueryExplainPanel';
import { QueryMetricsStore, formatDuration } from '../utils/queryMetrics';
import { extractFromObject } from '../utils/soqlParser';

export function QueryScreen(props: {
  sf: SfApi;
  tabId?: number;
  context?: SfContext;
  onSoqlChange?: (soql: string) => void;
  soql?: string;
  onInspectId?: (id: string) => void;
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

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<string>('');

  const [managerVisible, setManagerVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [explainVisible, setExplainVisible] = useState(false);
  const [saveQueryOpen, setSaveQueryOpen] = useState(false);
  const [queryFolders, setQueryFolders] = useState<QueryFolder[]>([]);
  const [lastExecMs, setLastExecMs] = useState<number | null>(null);

  // Builder & autocomplete state
  const [builderVisible, setBuilderVisible] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [acDismissed, setAcDismissed] = useState(false);
  const [acActiveIndex, setAcActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Shared schema loader
  const schema = useSchemaLoader(sf, tabId);

  // Autocomplete context & suggestions (single source of truth)
  const acCtx = useMemo(() => parseSoqlContext(soql, cursorPos), [soql, cursorPos]);
  const acSuggestions = useMemo((): Suggestion[] => {
    if (acCtx.clause === 'UNKNOWN') return [];

    // Suppress suggestions when the user is typing a SOQL keyword (e.g. "LIM" before LIMIT)
    if (acCtx.partialToken && isKeywordPrefix(acCtx.partialToken)) return [];

    // WHERE value position — suggest picklist values or booleans
    if (acCtx.clause === 'WHERE' && acCtx.whereField) {
      const field = schema.fields.find(f => f.name === acCtx.whereField);
      if (field?.type === 'boolean') {
        const vals: Suggestion[] = [
          { text: 'true', label: 'true', kind: 'value' },
          { text: 'false', label: 'false', kind: 'value' },
        ];
        return vals.filter(s => !acCtx.partialToken || s.text.startsWith(acCtx.partialToken));
      }
      if (field?.picklistValues && field.picklistValues.length > 0) {
        const active = field.picklistValues.filter(p => p.active);
        return fuzzyFilter(active, acCtx.partialToken, p => p.value)
          .slice(0, 40)
          .map(p => ({ text: p.value, label: p.value, detail: p.label !== p.value ? p.label : undefined, kind: 'value' }));
      }
      return [];
    }

    switch (acCtx.clause) {
      case 'FROM':
        return fuzzyFilter(schema.objects, acCtx.partialToken, o => o.name)
          .slice(0, 50)
          .map(o => ({ text: o.name, label: o.name, detail: o.label, kind: 'object' }));
      case 'SELECT':
      case 'WHERE':
      case 'ORDER_BY':
      case 'GROUP_BY':
      case 'HAVING': {
        if (!acCtx.fromObject) return [];

        // Build suggestions: direct fields + relationship traversal (e.g. Account.Name)
        const suggestions: Suggestion[] = [];

        // Check if the partial token includes a dot (relationship traversal)
        const dotIdx = acCtx.partialToken.lastIndexOf('.');
        if (dotIdx >= 0) {
          // User is typing e.g. "Account.Na" — suggest fields from the related object
          const relName = acCtx.partialToken.substring(0, dotIdx);
          const afterDot = acCtx.partialToken.substring(dotIdx + 1);
          // Find the reference field that matches this relationship name
          const refField = schema.fields.find(
            f => f.type === 'reference' && f.relationshipName === relName,
          );
          if (refField?.referenceTo?.length) {
            // We can't load the related object's fields inline without an async call,
            // so suggest common fields on any related object
            const commonRelFields = ['Id', 'Name', 'Email', 'Phone', 'Type', 'Status', 'OwnerId', 'CreatedDate', 'LastModifiedDate', 'RecordTypeId'];
            return commonRelFields
              .filter(f => f.toLowerCase().startsWith(afterDot.toLowerCase()))
              .map(f => ({
                text: `${relName}.${f}`,
                label: `${relName}.${f}`,
                detail: refField.referenceTo![0],
                kind: 'field' as const,
              }));
          }
          return [];
        }

        // Direct field suggestions
        const fieldSuggs = fuzzyFilter(schema.fields, acCtx.partialToken, f => f.name)
          .slice(0, 40)
          .map(f => ({ text: f.name, label: f.name, detail: f.type, kind: 'field' as const }));
        suggestions.push(...fieldSuggs);

        // Relationship name suggestions (for SELECT clause traversal)
        if (acCtx.clause === 'SELECT' || acCtx.clause === 'WHERE' || acCtx.clause === 'ORDER_BY') {
          const relSuggs = schema.fields
            .filter(f => f.type === 'reference' && f.relationshipName)
            .filter(f => !acCtx.partialToken || f.relationshipName!.toLowerCase().startsWith(acCtx.partialToken.toLowerCase()))
            .slice(0, 10)
            .map(f => ({
              text: f.relationshipName! + '.',
              label: f.relationshipName! + '.',
              detail: f.referenceTo?.[0] ?? 'reference',
              kind: 'field' as const,
            }));
          suggestions.push(...relSuggs);
        }

        return suggestions.slice(0, 50);
      }
      case 'LIMIT':
        return ['10', '50', '100', '200', '1000', '2000']
          .filter(v => v.startsWith(acCtx.partialToken))
          .map(v => ({ text: v, label: v, kind: 'value' }));
      default:
        return [];
    }
  }, [acCtx, schema.objects, schema.fields]);

  // Autocomplete is visible when we have suggestions and the user hasn't dismissed
  const acVisible = acSuggestions.length > 0 && !acDismissed;

  // Auto-load fields when FROM object is detected or after a failed load
  useEffect(() => {
    if (acCtx.fromObject && acCtx.fromObject !== schema.describedObject && !schema.fieldsLoading) {
      schema.loadFields(acCtx.fromObject);
    }
  }, [acCtx.fromObject, schema.describedObject, schema.fieldsLoading]);

  // Reset active index and un-dismiss when suggestions change
  useEffect(() => {
    setAcActiveIndex(0);
    setAcDismissed(false);
  }, [acSuggestions]);

  useEffect(() => {
    sf.listSavedQueries()
      .then(q => setSavedQueries(q))
      .catch(() => {
        // Ignore
      });
    sf.listQueryFolders()
      .then(f => setQueryFolders(f))
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
    setSelectedColumns([]); // Reset columns so new results get fresh defaults
    setLastExecMs(null);
    const t0 = performance.now();
    try {
      const res = await sf.runQuery(soql, tabId);
      const elapsed = Math.round(performance.now() - t0);
      setLastExecMs(elapsed);
      setRawRecords(res.records ?? []);
      setNextUrl(res.nextRecordsUrl);
      setTotalSize(res.totalSize ?? null);
      props.onSoqlChange?.(soql);

      // Track in metrics store
      QueryMetricsStore.getInstance().add({
        id: crypto.randomUUID(),
        soql,
        executionTimeMs: elapsed,
        recordCount: res.records?.length ?? 0,
        timestamp: Date.now(),
        hasMore: !!res.nextRecordsUrl,
        objectName: extractFromObject(soql) ?? undefined,
      });
    } catch (e) {
      setLastExecMs(Math.round(performance.now() - t0));
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

  function saveQuery(): void {
    setSaveQueryOpen(true);
  }

  async function confirmSaveQuery(name: string): Promise<void> {
    setSaveQueryOpen(false);
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
    setRawRecords([]);
    setNextUrl(undefined);
    setTotalSize(null);
    setSelectedColumns([]);
    props.onSoqlChange?.(q.soql);
  }

  function acceptSuggestion(index: number): void {
    const s = acSuggestions[index];
    if (!s) return;
    const before = soql.substring(0, acCtx.tokenStart);
    const after = soql.substring(cursorPos);
    const newSoql = before + s.text + after;
    const newCursor = acCtx.tokenStart + s.text.length;
    setSoql(newSoql);
    setCursorPos(newCursor);
    setAcDismissed(true);
    // Restore focus and cursor position
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(newCursor, newCursor);
      }
    });
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (acVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAcActiveIndex(i => Math.min(i + 1, acSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAcActiveIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        acceptSuggestion(acActiveIndex);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAcDismissed(true);
        return;
      }
    }

    // Ctrl+Enter to run query
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card wl-card--soql">
        <div class="wl-cardHeader">
          <h2>SOQL</h2>
          <div class="wl-actions">
            <button
              class="wl-btn"
              data-active={builderVisible ? 'true' : undefined}
              onClick={() => setBuilderVisible(v => !v)}
            >
              Builder
            </button>
            <button class="wl-buttonBrand" onClick={runQuery} disabled={busy || !context}>
              {busy ? 'Running…' : '▶ Run'}
            </button>
            <button class="wl-btn" onClick={loadMore} disabled={busy || !nextUrl}>Load More</button>
            <button class="wl-btn" onClick={saveQuery} disabled={!soql.trim()}>Save</button>
            <button class="wl-btn" data-active={managerVisible ? 'true' : undefined} onClick={() => setManagerVisible(v => !v)}>Manage</button>
            <button class="wl-btn" data-active={historyVisible ? 'true' : undefined} onClick={() => setHistoryVisible(v => !v)}>History</button>
            <button class="wl-btn" data-active={explainVisible ? 'true' : undefined} onClick={() => setExplainVisible(v => !v)}>Explain</button>
            <button class="wl-btn" onClick={exportCsv} disabled={flatRecords.length === 0}>CSV</button>
            <button class="wl-btn" onClick={exportJson} disabled={rawRecords.length === 0}>JSON</button>
          </div>
        </div>

        {builderVisible && (
          <QueryBuilder
            schema={schema}
            onApply={(generated) => {
              setSoql(generated);
              props.onSoqlChange?.(generated);
            }}
          />
        )}

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
          <div style="position:relative" class="wl-soql-editor">
            <SoqlHighlighter soql={soql} />
            <textarea
              ref={textareaRef}
              class="wl-textarea wl-soql-textarea"
              value={soql}
              onInput={(e) => {
                const ta = e.currentTarget as HTMLTextAreaElement;
                setSoql(ta.value);
                setCursorPos(ta.selectionStart);
              }}
              onClick={(e) => {
                setCursorPos((e.currentTarget as HTMLTextAreaElement).selectionStart);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Delay to allow dropdown mousedown to fire
                setTimeout(() => setAcDismissed(true), 200);
              }}
              spellcheck={false}
            />
            {acVisible && (
              <SoqlAutocomplete
                suggestions={acSuggestions}
                activeIndex={acActiveIndex}
                onAccept={acceptSuggestion}
                onHover={setAcActiveIndex}
              />
            )}
          </div>
          <div class="wl-muted" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span>
              {totalSize !== null ? `${rawRecords.length} loaded (totalSize: ${totalSize})` : `${rawRecords.length} loaded`}
              {nextUrl ? ' - more available' : ''}
            </span>
            {lastExecMs !== null && (
              <span style={`font-weight:600;color:${lastExecMs > 3000 ? 'var(--wl-danger)' : lastExecMs > 1000 ? '#f0a030' : 'var(--wl-accent)'}`}>
                {formatDuration(lastExecMs)}
              </span>
            )}
            <span style="opacity:0.6">Ctrl+Enter to run</span>
          </div>
        </div>
      </div>

      {explainVisible && (
        <QueryExplainPanel sf={sf} soql={soql} tabId={tabId} />
      )}

      {historyVisible && (
        <QueryHistory
          onLoadQuery={(historySoql) => {
            setSoql(historySoql);
            props.onSoqlChange?.(historySoql);
          }}
        />
      )}

      {managerVisible ? (
        <QueryManager
          sf={sf}
          queries={savedQueries}
          folders={queryFolders}
          onLoadQuery={(soql) => { setSoql(soql); props.onSoqlChange?.(soql); }}
          onQueriesChange={() => { sf.listSavedQueries().then(q => setSavedQueries(q)).catch(() => {}); }}
          onFoldersChange={() => { sf.listQueryFolders().then(f => setQueryFolders(f)).catch(() => {}); }}
        />
      ) : null}

      {flatRecords.length > 0 ? (
        <ResultsGrid
          instanceUrl={context?.instanceUrl}
          records={flatRecords}
          columns={columns}
          selectedColumns={selectedColumns.length ? selectedColumns : columns}
          onSelectedColumnsChange={setSelectedColumns}
          objectName={acCtx.fromObject ?? undefined}
          sf={sf}
          onInspectId={props.onInspectId}
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

      <PromptModal
        open={saveQueryOpen}
        title="Save Query"
        label="Saved query name"
        placeholder="e.g. Open opportunities this quarter"
        confirmText="Save"
        onCancel={() => setSaveQueryOpen(false)}
        onSubmit={confirmSaveQuery}
      />

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
