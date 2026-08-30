/**
 * SOQL query screen.
 *
 * What this file does:
 * - Runs SOQL queries against the selected Salesforce tab/org.
 * - Supports pagination (queryMore), multi-format exports, and saved queries.
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
import type { SavedQuery, QueryFolder, SavedJob, BulkQueryCheckpoint } from '../../core/types/storage';
import { Toast } from '../components/Toast';
import { PromptModal } from '../components/PromptModal';
import { deriveColumns, flattenRecord } from '../utils/records';
import type { FlatRecord } from '../utils/records';
import { ResultsGrid } from '../components/ResultsGrid';
import { ExportModal } from '../components/ExportModal';
import type { ExportPreferences } from '../components/ExportModal';
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
import { extractQueryParameters, renderParameterizedQuery } from '../utils/queryParameters';
import { sleep } from '../../core/utils';

export function QueryScreen(props: {
  sf: SfApi;
  tabId?: number;
  context?: SfContext;
  onSoqlChange?: (soql: string) => void;
  soql?: string;
  selectedColumns?: string[];
  exportPreferences?: ExportPreferences;
  queryMode?: 'rest' | 'bulk';
  onSelectedColumnsChange?: (columns: string[]) => void;
  onExportPreferencesChange?: (preferences: ExportPreferences) => void;
  onQueryModeChange?: (mode: 'rest' | 'bulk') => void;
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
  const [selectedColumns, setSelectedColumns] = useState<string[]>(props.selectedColumns ?? []);

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<string>('');

  const [managerVisible, setManagerVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [explainVisible, setExplainVisible] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveQueryOpen, setSaveQueryOpen] = useState(false);
  const [queryFolders, setQueryFolders] = useState<QueryFolder[]>([]);
  const [lastExecMs, setLastExecMs] = useState<number | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [queryMode, setQueryMode] = useState<'rest' | 'bulk'>(props.queryMode ?? 'rest');
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkLocator, setBulkLocator] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [recoverableBulkQuery, setRecoverableBulkQuery] = useState<BulkQueryCheckpoint | null>(null);
  const cancelRequested = useRef(false);
  const parameterNames = useMemo(() => extractQueryParameters(soql), [soql]);

  // Builder & autocomplete state
  const [builderVisible, setBuilderVisible] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [acDismissed, setAcDismissed] = useState(false);
  const [acActiveIndex, setAcActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Shared schema loader
  const schema = useSchemaLoader(sf, tabId);

  useEffect(() => {
    if (props.soql !== undefined && props.soql !== soql) setSoql(props.soql);
  }, [props.soql]);

  function updateSelectedColumns(next: string[]): void {
    setSelectedColumns(next);
    props.onSelectedColumnsChange?.(next);
  }

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
    if (!context?.orgId) {
      setRecoverableBulkQuery(null);
      return;
    }
    const key = `bulkQueryCheckpoint:${context.orgId}`;
    chrome.storage.local.get([key, 'bulkQueryCheckpoints']).then(result => {
      const checkpoint = (result.bulkQueryCheckpoints as Record<string, BulkQueryCheckpoint> | undefined)?.[context.orgId]
        ?? result[key] as BulkQueryCheckpoint | undefined;
      setRecoverableBulkQuery(checkpoint && !['Aborted', 'Failed'].includes(checkpoint.state) ? checkpoint : null);
    }).catch(() => setRecoverableBulkQuery(null));
  }, [context?.orgId]);

  async function saveBulkCheckpoint(jobId: string, state: string, query: string): Promise<void> {
    if (!context?.orgId) return;
    const checkpoint: BulkQueryCheckpoint = { jobId, orgId: context.orgId, soql: query, state, updatedAt: Date.now() };
    const stored = await chrome.storage.local.get('bulkQueryCheckpoints');
    const checkpoints = (stored.bulkQueryCheckpoints as Record<string, BulkQueryCheckpoint>) ?? {};
    await chrome.storage.local.set({ [`bulkQueryCheckpoint:${context.orgId}`]: checkpoint, bulkQueryCheckpoints: { ...checkpoints, [context.orgId]: checkpoint } });
    setRecoverableBulkQuery(checkpoint);
  }

  async function resumeBulkQuery(checkpoint: BulkQueryCheckpoint): Promise<void> {
    setBusy(true);
    cancelRequested.current = false;
    setQueryMode('bulk');
    props.onQueryModeChange?.('bulk');
    setSoql(checkpoint.soql);
    props.onSoqlChange?.(checkpoint.soql);
    setBulkJobId(checkpoint.jobId);
    setBulkStatus(checkpoint.state);
    try {
      let completed = await sf.getBulkQueryStatus(checkpoint.jobId, tabId);
      for (let attempt = 0; completed.state !== 'JobComplete'; attempt++) {
        if (cancelRequested.current) throw new Error('Bulk query cancelled.');
        if (completed.state === 'Failed') throw new Error(completed.errorMessage ?? 'Bulk query failed.');
        if (completed.state === 'Aborted') throw new Error('Bulk query cancelled.');
        if (attempt >= 300) throw new Error('Bulk query did not finish within 10 minutes.');
        setBulkStatus(completed.state);
        setTotalSize(completed.numberRecordsProcessed ?? null);
        await saveBulkCheckpoint(checkpoint.jobId, completed.state, checkpoint.soql);
        await sleep(2000);
        completed = await sf.getBulkQueryStatus(checkpoint.jobId, tabId);
      }
      const page = await sf.getBulkQueryResults(checkpoint.jobId, undefined, tabId);
      setRawRecords(page.records);
      setBulkLocator(page.locator);
      setTotalSize(completed.numberRecordsProcessed ?? page.records.length);
      setBulkStatus('JobComplete');
      await saveBulkCheckpoint(checkpoint.jobId, 'ResultsReady', checkpoint.soql);
    } catch (error) {
      setToast({ title: 'Resume Failed', body: error instanceof Error ? error.message : 'Unable to resume Bulk query' });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (selectedColumns.length === 0 && columns.length > 0) {
      const defaults = ['Id', 'Name'].filter(c => columns.includes(c));
      const rest = columns.filter(c => !defaults.includes(c));
      updateSelectedColumns([...defaults, ...rest].slice(0, 14));
    }
  }, [columns, selectedColumns.length]);

  async function runQuery(): Promise<void> {
    setBusy(true);
    cancelRequested.current = false;
    updateSelectedColumns([]); // Reset columns so new results get fresh defaults
    setLastExecMs(null);
    setNextUrl(undefined);
    setBulkJobId(null);
    setBulkLocator(null);
    setBulkStatus(null);
    const t0 = performance.now();
    try {
      const executableSoql = renderParameterizedQuery(soql, parameterValues);
      let records: Array<Record<string, unknown>> = [];
      let recordTotal: number | null = null;
      let hasMore = false;
      if (queryMode === 'bulk') {
        const started = await sf.startBulkQuery(executableSoql, tabId);
        setBulkJobId(started.id);
        setBulkStatus(started.state);
        await saveBulkCheckpoint(started.id, started.state, executableSoql);
        let completed = started;
        for (let attempt = 0; completed.state !== 'JobComplete'; attempt++) {
          if (cancelRequested.current) throw new Error('Bulk query cancelled.');
          if (completed.state === 'Failed') throw new Error(completed.errorMessage ?? 'Bulk query failed.');
          if (completed.state === 'Aborted') throw new Error('Bulk query cancelled.');
          if (attempt >= 300) throw new Error('Bulk query did not finish within 10 minutes. Check the Salesforce job using the displayed job ID.');
          await sleep(2000);
          completed = await sf.getBulkQueryStatus(started.id, tabId);
          setBulkStatus(completed.state);
          setTotalSize(completed.numberRecordsProcessed ?? null);
          await saveBulkCheckpoint(started.id, completed.state, executableSoql);
        }
        const page = await sf.getBulkQueryResults(started.id, undefined, tabId);
        records = page.records;
        recordTotal = completed.numberRecordsProcessed;
        hasMore = Boolean(page.locator);
        setBulkLocator(page.locator);
        await saveBulkCheckpoint(started.id, 'ResultsReady', executableSoql);
      } else {
        const res = await sf.runQuery(executableSoql, tabId);
        records = res.records ?? [];
        recordTotal = res.totalSize ?? null;
        hasMore = Boolean(res.nextRecordsUrl);
        setNextUrl(res.nextRecordsUrl);
      }
      const elapsed = Math.round(performance.now() - t0);
      setLastExecMs(elapsed);
      setRawRecords(records);
      setTotalSize(recordTotal);
      props.onSoqlChange?.(soql);

      // Track in metrics store
      QueryMetricsStore.getInstance().add({
        id: crypto.randomUUID(),
        soql: executableSoql,
        executionTimeMs: elapsed,
        recordCount: records.length,
        timestamp: Date.now(),
        hasMore,
        objectName: extractFromObject(executableSoql) ?? undefined,
      });
    } catch (e) {
      setLastExecMs(Math.round(performance.now() - t0));
      setToast({ title: 'Query Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  async function loadMore(): Promise<void> {
    if (queryMode === 'bulk' ? (!bulkJobId || !bulkLocator) : !nextUrl) return;
    setBusy(true);
    try {
      if (queryMode === 'bulk' && bulkJobId && bulkLocator) {
        const page = await sf.getBulkQueryResults(bulkJobId, bulkLocator, tabId);
        setRawRecords(prev => [...prev, ...page.records]);
        setBulkLocator(page.locator);
      } else if (nextUrl) {
        const res = await sf.queryMore(nextUrl, tabId);
        setRawRecords(prev => [...prev, ...(res.records ?? [])]);
        setNextUrl(res.nextRecordsUrl);
        setTotalSize(res.totalSize ?? totalSize);
      }
    } catch (e) {
      setToast({ title: 'Load More Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  async function cancelBulkQuery(): Promise<void> {
    if (!bulkJobId) return;
    cancelRequested.current = true;
    try {
      await sf.cancelBulkQuery(bulkJobId, tabId);
      setBulkStatus('Aborted');
      if (context?.orgId) {
        const stored = await chrome.storage.local.get('bulkQueryCheckpoints');
        const checkpoints = { ...((stored.bulkQueryCheckpoints as Record<string, BulkQueryCheckpoint>) ?? {}) };
        delete checkpoints[context.orgId];
        await chrome.storage.local.remove(`bulkQueryCheckpoint:${context.orgId}`);
        await chrome.storage.local.set({ bulkQueryCheckpoints: checkpoints });
        setRecoverableBulkQuery(null);
      }
    } catch (error) {
      setToast({ title: 'Cancellation Failed', body: error instanceof Error ? error.message : 'Unable to cancel bulk query' });
    }
  }

  function saveQuery(): void {
    setSaveQueryOpen(true);
  }

  async function confirmSaveQuery(name: string): Promise<void> {
    setSaveQueryOpen(false);
    try {
      const saved = await sf.upsertSavedQuery({ id: `q_${Date.now()}`, name, soql });
      const now = Date.now();
      const savedJob: SavedJob = {
        schemaVersion: 1, id: `job-export-${now}`, name, favorite: false,
        definition: {
          kind: 'export', operation: 'query', query: soql,
          orgRoles: { source: 'active-org' },
          columns: selectedColumns.length ? selectedColumns : undefined,
          api: { strategy: queryMode },
          safety: { dryRun: false, requireProductionConfirmation: false },
          output: { format: props.exportPreferences?.format ?? 'csv' },
        },
        version: 1, revisions: [], createdAt: now, updatedAt: now, usageCount: 0,
      };
      const stored = await chrome.storage.local.get('savedJobs');
      await chrome.storage.local.set({ savedJobs: [...((stored.savedJobs as SavedJob[]) ?? []), savedJob] });
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
    updateSelectedColumns([]);
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
              {busy ? 'Running…' : 'Run query'}
            </button>
            <button class="wl-btn" onClick={loadMore} disabled={busy || (queryMode === 'bulk' ? !bulkLocator : !nextUrl)}>Load More</button>
            {busy && queryMode === 'bulk' && bulkJobId ? <button class="wl-btn" onClick={cancelBulkQuery}>Cancel</button> : null}
            <button class="wl-btn" onClick={saveQuery} disabled={!soql.trim()}>Save</button>
            <button class="wl-btn" data-active={managerVisible ? 'true' : undefined} onClick={() => setManagerVisible(v => !v)}>Manage</button>
            <button class="wl-btn" data-active={historyVisible ? 'true' : undefined} onClick={() => setHistoryVisible(v => !v)}>History</button>
            <button class="wl-btn" data-active={explainVisible ? 'true' : undefined} onClick={() => setExplainVisible(v => !v)}>Explain</button>
            <button class="wl-btn" onClick={() => setExportOpen(true)} disabled={flatRecords.length === 0}>Export…</button>
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
            <select class="wl-select" aria-label="Query API" value={queryMode} onChange={(event) => {
              const next = (event.currentTarget as HTMLSelectElement).value as 'rest' | 'bulk';
              setQueryMode(next);
              props.onQueryModeChange?.(next);
            }}>
              <option value="rest">REST Query — best for interactive exports</option>
              <option value="bulk">Bulk API 2.0 Query — large asynchronous exports</option>
            </select>
            <select
              class="wl-select"
              aria-label="Saved queries"
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
              aria-label="Connected Salesforce org"
              value={context ? `${context.orgId}` : 'Open a logged-in Salesforce tab'}
              disabled
            />
          </div>
          <div class="wl-formRow__hint">REST returns an interactive first page. Bulk API 2.0 runs asynchronously and retrieves results in resumable 10,000-record pages.</div>
          {recoverableBulkQuery && recoverableBulkQuery.jobId !== bulkJobId ? (
            <div class="wl-inlineNotice" role="status">
              <span>Recoverable Bulk query <code>{recoverableBulkQuery.jobId}</code> ({recoverableBulkQuery.state})</span>
              <button class="wl-buttonNeutral" onClick={() => resumeBulkQuery(recoverableBulkQuery)} disabled={busy}>Resume</button>
            </div>
          ) : null}
          <div style="position:relative" class="wl-soql-editor">
            <SoqlHighlighter soql={soql} />
            <textarea
              ref={textareaRef}
              class="wl-textarea wl-soql-textarea"
              aria-label="SOQL query"
              value={soql}
              onInput={(e) => {
                const ta = e.currentTarget as HTMLTextAreaElement;
                setSoql(ta.value);
                props.onSoqlChange?.(ta.value);
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
          {parameterNames.length > 0 ? (
            <div class="wl-parameterGrid" aria-label="Query parameters">
              {parameterNames.map(name => (
                <label key={name}>
                  <span>{name}</span>
                  <input
                    class="wl-input"
                    value={parameterValues[name] ?? ''}
                    onInput={(event) => setParameterValues(current => ({ ...current, [name]: (event.currentTarget as HTMLInputElement).value }))}
                    placeholder={`Value for ${name}`}
                  />
                </label>
              ))}
              <p class="wl-muted">Parameters are inserted as escaped SOQL string values when the query runs.</p>
            </div>
          ) : null}
          <div class="wl-muted" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span>
              {totalSize !== null ? `${rawRecords.length} loaded (totalSize: ${totalSize})` : `${rawRecords.length} loaded`}
              {(queryMode === 'bulk' ? bulkLocator : nextUrl) ? ' - more available' : ''}
            </span>
            {bulkStatus ? <span class="wl-pill wl-pill--brand">Bulk: {bulkStatus}</span> : null}
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
          onSelectedColumnsChange={updateSelectedColumns}
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

      <ExportModal
        open={exportOpen}
        records={flatRecords}
        columns={selectedColumns.length ? selectedColumns : columns}
        defaultFilename={`wavelink-query-${Date.now()}`}
        preferences={props.exportPreferences}
        onPreferencesChange={props.onExportPreferencesChange}
        onClose={() => setExportOpen(false)}
      />

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
