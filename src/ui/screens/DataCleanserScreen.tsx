/**
 * Data cleanser screen.
 *
 * What this file does:
 * - Loads a dataset and lets users drop/rename/transform columns.
 * - Produces a "snapshot" of cleaned records and headers for the Data Push screen.
 * - Optionally validates cleaned records against Salesforce field metadata (`describeSObject` + DataValidator).
 *
 * Why:
 * - CSV/JSON from external sources rarely matches Salesforce field rules; cleanser reduces push failures.
 *
 * Complexity:
 * - Most operations are O(N*K) over records/columns (cleanse + preview).
 * - UI limits previews (100 rows, 12 columns) to keep rendering bounded.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import { Toast } from '../components/Toast';
import { parseCsvFile, parseJsonFile } from '../utils/fileParse';
import type { ColumnOp } from '../utils/cleanse';
import { cleanseRecords, computeConflicts, computeSummary } from '../utils/cleanse';
import { DatasetHeader } from '../components/cleanser/DatasetHeader';
import { ColumnList } from '../components/cleanser/ColumnList';
import { BulkActions } from '../components/cleanser/BulkActions';
import { ColumnEditor } from '../components/cleanser/ColumnEditor';
import { PreviewGrid } from '../components/cleanser/PreviewGrid';
import { ValidationPanel } from '../components/cleanser/ValidationPanel';
import { downloadTextFile } from '../utils/download';
import { flattenRecord } from '../utils/records';
import { recordsToCsv } from '../utils/csv';
import { DataValidator } from '../../data/validators';
import { OrgHealthScreen } from './OrgHealthScreen';
import { CoverageScreen } from './CoverageScreen';
import { useDragList } from '../utils/dragDrop';
import { BulkUpdateModal } from '../components/BulkUpdateModal';
import { QualityScorecard } from '../components/QualityScorecard';
import { inferQualityRules, scoreDataset } from '../utils/dataQuality';
import type { ScorecardResult } from '../utils/dataQuality';

type Operation = 'insert' | 'update' | 'upsert' | 'delete';

function normalizeName(name: string, fallback: string): string {
  const t = name.trim();
  return t.length ? t : fallback;
}

function getTargetName(op: ColumnOp): string {
  return normalizeName(op.renameTo || op.source, op.source);
}

function takeSampleValues(records: Array<Record<string, unknown>>, key: string, limit: number = 10): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < records.length && out.length < limit; i++) {
    const v = records[i]?.[key];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function DataCleanserScreen(props: {
  sf: SfApi;
  tabId: number;
  dataset: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json';
    headers: string[];
    bytes?: number;
  } | null;
  onDataset: (d: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json';
    headers: string[];
    bytes?: number;
  }) => void;
  onCleaned: (result: { records: Record<string, unknown>[]; headers: string[] } | null) => void;
  onGoToPush?: () => void;
  onClearDataset?: () => void;
}): VNode {
  const { sf, tabId, dataset } = props;

  const [view, setView] = useState<'cleanser' | 'health' | 'coverage'>('cleanser');
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [ops, setOps] = useState<ColumnOp[]>([]);
  const [snapshot, setSnapshot] = useState<{ records: Record<string, unknown>[]; headers: string[] } | null>(null);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);

  const [validateEnabled, setValidateEnabled] = useState(false);
  const [validateObject, setValidateObject] = useState('Account');
  const [validateOperation, setValidateOperation] = useState<Operation>('insert');
  const [validationErrors, setValidationErrors] = useState<Array<{ field: string; message: string; value?: unknown }> | null>(null);
  const [objects, setObjects] = useState<Array<{ name: string; label: string }>>([]);
  const [showOnlyErrorFields, setShowOnlyErrorFields] = useState(false);
  const [bulkUpdateModalOpen, setBulkUpdateModalOpen] = useState(false);
  const [scorecard, setScorecard] = useState<ScorecardResult | null>(null);

  useDragList({
    items: ops,
    onReorder: (newOps) => {
      setOps(newOps);
      setSnapshot(null);
      props.onCleaned(null);
    },
    getDragId: (op) => op.source,
  });

  // Clear local state if dataset is cleared from above (e.g., Data Push "Clear")
  useEffect(() => {
    if (dataset) return;
    setOps([]);
    setSnapshot(null);
    setValidationErrors(null);
    setScorecard(null);
    setSelected(new Set());
    lastClickedIndexRef.current = null;
    props.onCleaned(null);
  }, [dataset]);

  // Initialize ops on dataset change
  useEffect(() => {
    if (!dataset) return;
    const nextOps: ColumnOp[] = dataset.headers.map(h => ({
      source: h,
      renameTo: h,
      drop: false,
      transform: 'none',
    }));
    setOps(nextOps);
    setSnapshot(null);
    setValidationErrors(null);
    setSelected(new Set());
    lastClickedIndexRef.current = null;
    props.onCleaned(null);
  }, [dataset?.filename]);

  // Fetch object list for validation (cached)
  useEffect(() => {
    if (!validateEnabled) return;
    sf.describeGlobal(tabId)
      .then(res => setObjects(res.sobjects.map(s => ({ name: s.name, label: s.label }))))
      .catch(() => {
        // ignore
      });
  }, [sf, tabId, validateEnabled]);

  const summary = useMemo(() => computeSummary(ops), [ops]);
  const conflicts = useMemo(() => computeConflicts(ops), [ops]);

  const allDropped = useMemo(() => (dataset && ops.length > 0) ? ops.every(o => o.drop) : false, [dataset, ops]);

  const blockingMessage = useMemo(() => {
    if (!dataset) return null;
    if (conflicts.hasBlocking) {
      const firstTarget = Object.keys(conflicts.conflicts)[0];
      const sources = conflicts.conflicts[firstTarget].join(', ');
      return `Rename conflict: "${firstTarget}" is produced by multiple columns (${sources}).`;
    }
    if (allDropped) return 'All columns are dropped. Undrop at least one column.';
    return null;
  }, [dataset, conflicts, allDropped]);

  const canApply = !!dataset && !blockingMessage;

  const errorFields = useMemo(() => {
    if (!validationErrors || validationErrors.length === 0) return undefined;
    const set = new Set<string>();
    for (const e of validationErrors) set.add(e.field);
    return set;
  }, [validationErrors]);

  const filteredSources = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySource = new Map(ops.map(o => [o.source, o]));

    const base = ops
      .map(o => o.source)
      .filter(source => {
        const op = bySource.get(source)!;
        const target = getTargetName(op);
        const matchesSearch = !q || source.toLowerCase().includes(q) || target.toLowerCase().includes(q);
        if (!matchesSearch) return false;
        if (showOnlyErrorFields && errorFields) {
          return errorFields.has(target) || errorFields.has(source);
        }
        return true;
      });

    return base;
  }, [ops, search, showOnlyErrorFields, errorFields]);

  const selectedCount = selected.size;
  const selectedSources = useMemo(() => Array.from(selected), [selected]);
  const selectedOps = useMemo(() => {
    const bySource = new Map(ops.map(o => [o.source, o]));
    return selectedSources.map(s => bySource.get(s)).filter(Boolean) as ColumnOp[];
  }, [ops, selectedSources]);

  const singleSelectedOp = selectedCount === 1 ? selectedOps[0] : null;

  const previewSourceRows = useMemo(() => (dataset?.sourceRecords ?? []).slice(0, 100), [dataset?.sourceRecords]);
  const preview = useMemo(() => {
    if (!dataset) return { records: [] as Record<string, unknown>[], headers: [] as string[] };
    const { cleanedRecords, cleanedHeaders } = cleanseRecords(previewSourceRows, ops);
    return { records: cleanedRecords, headers: cleanedHeaders };
  }, [dataset, previewSourceRows, ops]);

  const previewHeaders = useMemo(() => {
    if (!dataset) return [];

    const bySource = new Map(ops.map(o => [o.source, o]));
    if (selectedCount > 0) {
      const cols = selectedSources
        .map(s => bySource.get(s))
        .filter(Boolean)
        .filter(o => !o!.drop)
        .map(o => getTargetName(o!))
        .slice(0, 12);
      if (cols.length) return cols;
    }

    return preview.headers.filter(h => h).slice(0, 12);
  }, [dataset, ops, preview.headers, selectedCount, selectedSources]);

  const previewRows = useMemo(() => {
    if (!previewHeaders.length) return [];
    return preview.records.map(r => r).slice(0, 100);
  }, [preview.records, previewHeaders.length]);

  async function onUpload(file: File): Promise<void> {
    try {
      const isJson = file.name.toLowerCase().endsWith('.json');
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      if (!isJson && !isCsv) {
        setToast({ title: 'Unsupported File', body: 'Upload a .csv or .json file.' });
        return;
      }
      const parsed = isJson ? await parseJsonFile(file) : await parseCsvFile(file);
      props.onDataset({
        sourceRecords: parsed.records,
        headers: parsed.headers,
        filename: file.name,
        format: isJson ? 'json' : 'csv',
        bytes: file.size,
      });
      setToast({ title: 'Loaded', body: `${parsed.records.length} records from ${file.name}` });
    } catch (e) {
      setToast({ title: 'Load Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  function onClear(): void {
    if (dataset && props.onClearDataset) {
      props.onClearDataset();
      setToast({ title: 'Cleared', body: 'Upload a new file to start.' });
      return;
    }

    setOps([]);
    setSnapshot(null);
    setValidationErrors(null);
    setSelected(new Set());
    lastClickedIndexRef.current = null;
    props.onCleaned(null);
    setToast({ title: 'Cleared', body: 'Upload a new file to start.' });
  }

  function applySnapshot(): void {
    if (!dataset) return;
    if (blockingMessage) {
      setToast({ title: 'Fix Issues First', body: blockingMessage });
      return;
    }

    const { cleanedRecords, cleanedHeaders } = cleanseRecords(dataset.sourceRecords, ops);
    const next = { records: cleanedRecords, headers: cleanedHeaders };
    setSnapshot(next);
    props.onCleaned(next);
    setToast({ title: 'Applied', body: `${cleanedRecords.length} records in snapshot.` });
    setValidationErrors(null);
  }

  function exportJson(): void {
    if (!dataset) return;
    if (blockingMessage) {
      setToast({ title: 'Fix Issues First', body: blockingMessage });
      return;
    }

    const next = snapshot ?? (() => {
      const { cleanedRecords, cleanedHeaders } = cleanseRecords(dataset.sourceRecords, ops);
      const built = { records: cleanedRecords, headers: cleanedHeaders };
      setSnapshot(built);
      props.onCleaned(built);
      return built;
    })();

    downloadTextFile(`wavelink-clean-${Date.now()}.json`, JSON.stringify(next.records, null, 2), 'application/json');
  }

  function exportCsv(): void {
    if (!dataset) return;
    if (blockingMessage) {
      setToast({ title: 'Fix Issues First', body: blockingMessage });
      return;
    }

    const next = snapshot ?? (() => {
      const { cleanedRecords, cleanedHeaders } = cleanseRecords(dataset.sourceRecords, ops);
      const built = { records: cleanedRecords, headers: cleanedHeaders };
      setSnapshot(built);
      props.onCleaned(built);
      return built;
    })();

    const flat = next.records.map(r => flattenRecord(r));
    const csv = recordsToCsv(flat, next.headers);
    downloadTextFile(`wavelink-clean-${Date.now()}.csv`, csv, 'text/csv');
  }

  function goToPush(): void {
    if (!snapshot) return;
    props.onGoToPush?.();
  }

  function updateOp(source: string, patch: Partial<ColumnOp>): void {
    setOps(prev => prev.map(o => {
      if (o.source !== source) return o;
      const next: ColumnOp = { ...o, ...patch };
      next.renameTo = normalizeName(next.renameTo || '', o.source);
      return next;
    }));
    setSnapshot(null);
    props.onCleaned(null);
  }

  function resetColumns(sources: string[]): void {
    setOps(prev => prev.map(o => {
      if (!sources.includes(o.source)) return o;
      return { ...o, renameTo: o.source, drop: false, transform: 'none' };
    }));
    setSnapshot(null);
    props.onCleaned(null);
  }

  function onToggleSelected(source: string, ev: MouseEvent): void {
    const idx = filteredSources.indexOf(source);
    const isShift = ev.shiftKey;
    const isToggle = (ev.ctrlKey || ev.metaKey);

    setSelected(prev => {
      const next = new Set(prev);

      if (isShift && lastClickedIndexRef.current !== null) {
        const start = Math.min(lastClickedIndexRef.current, idx);
        const end = Math.max(lastClickedIndexRef.current, idx);
        for (let i = start; i <= end; i++) {
          next.add(filteredSources[i]);
        }
        return next;
      }

      lastClickedIndexRef.current = idx;

      if (isToggle) {
        if (next.has(source)) next.delete(source);
        else next.add(source);
        return next;
      }

      // Single select
      next.clear();
      next.add(source);
      return next;
    });
  }

  function onToggleDrop(source: string): void {
    const op = ops.find(o => o.source === source);
    if (!op) return;
    updateOp(source, { drop: !op.drop });
  }

  async function runValidation(): Promise<void> {
    if (!validateEnabled || !dataset) return;

    if (blockingMessage) {
      setToast({ title: 'Fix Issues First', body: blockingMessage });
      return;
    }

    let records: Record<string, unknown>[];
    if (snapshot) {
      records = snapshot.records;
    } else {
      applySnapshot();
      // state update is async; compute locally for validation
      records = cleanseRecords(dataset.sourceRecords, ops).cleanedRecords;
    }

    try {
      const describe = await sf.describeSObject(validateObject, tabId);
      const validator = new DataValidator();
      const res = validator.validateRecords(records, describe.fields, validateOperation);
      if (res.valid) {
        setValidationErrors([]);
        setToast({ title: 'Validation Passed', body: 'No errors found.' });
      } else {
        setValidationErrors(res.errors.map(e => ({ field: e.field, message: e.message, value: e.value })));
        setToast({ title: 'Validation Failed', body: `${res.errors.length} errors.` });
      }
    } catch (e) {
      setToast({ title: 'Validation Error', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  function runQualityScore(): void {
    if (!dataset) return;
    const { cleanedRecords, cleanedHeaders } = cleanseRecords(dataset.sourceRecords, ops);
    if (cleanedHeaders.length === 0) {
      setToast({ title: 'Nothing to Score', body: 'All columns are dropped.' });
      return;
    }
    const rules = inferQualityRules(cleanedHeaders);
    const result = scoreDataset(cleanedRecords, rules);
    setScorecard(result);
    setToast({ title: 'Quality Scored', body: `Score ${result.score}/100 across ${result.totalRecords} records.` });
  }

  const datasetHeaderModel = dataset ? {
    filename: dataset.filename,
    rows: dataset.sourceRecords.length,
    columns: dataset.headers.length,
    bytes: dataset.bytes,
  } : null;

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Cleanser</h2>
          <div class="wl-actions">
            <button class="wl-btn" data-active={view === 'cleanser'} onClick={() => setView('cleanser')}>Cleanser</button>
            <button class="wl-btn" data-active={view === 'health'} onClick={() => setView('health')}>Org Health</button>
            <button class="wl-btn" data-active={view === 'coverage'} onClick={() => setView('coverage')}>Coverage</button>
          </div>
        </div>
        <div class="wl-row">
          <div class="wl-muted">
            Cleanser is for shaping datasets before pushing. Org Health shows limits/context. Coverage shows Apex coverage from the org.
          </div>
        </div>
      </div>

      {view === 'health' ? (
        <OrgHealthScreen sf={sf} tabId={tabId} />
      ) : view === 'coverage' ? (
        <CoverageScreen sf={sf} tabId={tabId} />
      ) : (
        <>
      <DatasetHeader
        dataset={datasetHeaderModel}
        summary={summary}
        blockingMessage={blockingMessage}
        canApply={canApply}
        hasSnapshot={!!snapshot}
        onUpload={onUpload}
        onClear={onClear}
        onApply={applySnapshot}
        onExportCsv={exportCsv}
        onExportJson={exportJson}
        onGoToPush={goToPush}
      />

      <div class="wl-split">
        <div class="wl-pane">
          <div class="wl-paneHeader">
            <div>
              <div style="font-weight:900">Columns</div>
              <div class="wl-muted">{filteredSources.length} shown</div>
            </div>
            <input
              class="wl-input"
              placeholder="Search columns..."
              value={search}
              onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
          <ColumnList
            ops={ops}
            filteredSources={filteredSources}
            selected={selected}
            errorFields={errorFields}
            onToggleSelected={onToggleSelected}
            onToggleDrop={onToggleDrop}
          />
        </div>

        <div class="wl-pane">
          {selectedCount > 1 ? (
            <BulkActions
              selectedCount={selectedCount}
              filteredCount={filteredSources.length}
              onSetTransform={(t) => {
                if (!t) return;
                setOps(prev => prev.map(o => selected.has(o.source) ? { ...o, transform: t } : o));
                setSnapshot(null);
                props.onCleaned(null);
              }}
              onDrop={(drop) => {
                setOps(prev => prev.map(o => selected.has(o.source) ? { ...o, drop } : o));
                setSnapshot(null);
                props.onCleaned(null);
              }}
              onReset={() => resetColumns(selectedSources)}
              onRenameAffix={(prefix, suffix) => {
                if (!prefix && !suffix) return;
                setOps(prev => prev.map(o => {
                  if (!selected.has(o.source)) return o;
                  const base = (o.renameTo || o.source).trim() || o.source;
                  return { ...o, renameTo: `${prefix}${base}${suffix}` };
                }));
                setSnapshot(null);
                props.onCleaned(null);
              }}
            />
          ) : null}
          <button class="wl-btn wl-btnPrimary" onClick={() => setBulkUpdateModalOpen(true)} disabled={!dataset}>Bulk Update</button>

          {singleSelectedOp ? (
            <ColumnEditor
              op={singleSelectedOp}
              sampleValues={takeSampleValues(previewSourceRows, singleSelectedOp.source, 10)}
              onChange={(patch) => updateOp(singleSelectedOp.source, patch)}
              onReset={() => resetColumns([singleSelectedOp.source])}
            />
          ) : selectedCount === 0 ? (
            <div class="wl-card">
              <div class="wl-row">
                <div style="font-weight:900">Select a column to edit</div>
                <div class="wl-muted">Use Ctrl/Cmd and Shift for multi-select; apply bulk actions when multiple columns are selected.</div>
              </div>
            </div>
          ) : (
            <div class="wl-card">
              <div class="wl-row">
                <div style="font-weight:900">Bulk edit ready</div>
                <div class="wl-muted">Use the bulk bar above to apply transforms, drop/undrop, reset, or rename selected columns.</div>
              </div>
            </div>
          )}

          <div style="height:14px" />

          <PreviewGrid headers={previewHeaders} rows={previewRows} />
        </div>
      </div>

      <ValidationPanel
        enabled={validateEnabled}
        onEnabledChange={(v) => setValidateEnabled(v)}
        objects={objects.length ? objects : [{ name: 'Account', label: 'Account' }]}
        objectName={validateObject}
        onObjectName={setValidateObject}
        operation={validateOperation}
        onOperation={setValidateOperation}
        errors={validationErrors}
        onRun={runValidation}
        canRun={!!dataset && !blockingMessage}
        showOnlyErrorFields={showOnlyErrorFields}
        onShowOnlyErrorFields={setShowOnlyErrorFields}
      />

      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Data Quality</h2>
          <div class="wl-actions">
            <button class="wl-buttonBrand" onClick={runQualityScore} disabled={!dataset || !!blockingMessage}>
              Score data quality
            </button>
            {scorecard ? (
              <button class="wl-btn" onClick={() => setScorecard(null)}>Clear</button>
            ) : null}
          </div>
        </div>
        <div class="wl-row">
          <div class="wl-muted">
            Scores the current cleaned dataset for completeness and basic formatting (email / URL / phone),
            inferred from your column names. Run it again after edits to see the score change.
          </div>
        </div>
      </div>

      {scorecard ? <QualityScorecard result={scorecard} /> : null}
        </>
      )}

      <BulkUpdateModal
        open={bulkUpdateModalOpen && !!dataset}
        fields={dataset?.headers ?? []}
        records={dataset?.sourceRecords ?? []}
        onApply={(updatedRecords) => {
          if (!dataset) return;
          props.onDataset({ ...dataset, sourceRecords: updatedRecords });
          setBulkUpdateModalOpen(false);
        }}
        onClose={() => setBulkUpdateModalOpen(false)}
      />

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
