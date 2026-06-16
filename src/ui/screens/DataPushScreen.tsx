/**
 * Data push screen (full app).
 *
 * What this file does:
 * - Loads a CSV/JSON dataset, optionally uses cleaned records from the Cleanser.
 * - Auto-maps source headers to Salesforce fields (best-effort) using `DataMapper.autoMapFields`.
 * - Applies transformations and validates against `describeSObject` metadata via `DataValidator`.
 * - Starts a push job via background and listens for progress broadcasts.
 *
 * Why we split it this way:
 * - Background owns auth + network + push orchestration.
 * - UI owns mapping/validation decisions and showing the state machine to the user.
 *
 * Complexity:
 * - Mapping/validation are O(N*M) and O(N*K) respectively (see DataMapper/DataValidator).
 * - Rendering large tables can be expensive; we cap certain lists (e.g., 500 errors).
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import { Toast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { PromptModal } from '../components/PromptModal';
import { DropZone } from '../components/DropZone';
import { SearchableSelect } from '../components/SearchableSelect';
import { RetryModal } from '../components/RetryModal';
import { MigrationProgressDashboard } from '../components/MigrationProgressDashboard';
import { computePushProgress } from '../utils/pushMetrics';
import { DryRunPanel } from '../components/DryRunPanel';
import { simulatePush } from '../utils/pushDryRun';
import type { DryRunReport } from '../utils/pushDryRun';
import { buildRetryDataset } from '../utils/pushRetry';
import { parseCsvFile, parseJsonFile } from '../utils/fileParse';
import { DataMapper } from '../../data/mappers';
import { DataValidator } from '../../data/validators';
import type { FieldMapping, TransformationType, DataTemplate } from '../../core/types/storage';
import type { SObjectField } from '../../core/types/salesforce';
import { MessageBus } from '../../services/messaging';
import { TRANSFORM_OPTIONS } from '../utils/transforms';
import { validateIdFirst } from '../utils/pushGuards';
import { clampBatchSize, clampThreads } from '../utils/pushOptions';

type Strategy = 'auto' | 'rest' | 'bulk';

function makeEmptyMappings(headers: string[]): FieldMapping[] {
  return headers.map(h => ({
    sourceField: h,
    targetField: '',
    transformation: 'none',
    required: false,
  }));
}

function estimateTooLarge(fileSizeBytes: number, recordCount: number): string | null {
  if (recordCount > 25_000) return 'Dataset too large (over 25,000 rows). Please split the file or reduce the number of rows.';
  if (fileSizeBytes > 10 * 1024 * 1024) return 'Dataset too large (over ~10MB). Please split the file or reduce the number of columns.';
  return null;
}

export function DataPushScreen(props: {
  sf: SfApi;
  tabId: number;
  dataset: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json';
    headers: string[];
    bytes?: number;
  } | null;
  cleanedRecords: Record<string, unknown>[] | null;
  cleanedHeaders: string[] | null;
  onDataset: (d: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json';
    headers: string[];
    bytes?: number;
  } | null) => void;
  onRequestCleanser: () => void;
}): VNode {
  const { sf, tabId } = props;
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [objectName, setObjectName] = useState<string>('Account');
  const [operation, setOperation] = useState<'insert' | 'update' | 'upsert' | 'delete'>('insert');
  const [strategy, setStrategy] = useState<Strategy>('auto');
  const [externalIdField, setExternalIdField] = useState<string>('');
  const [batchSize, setBatchSize] = useState<number>(200);
  const [threads, setThreads] = useState<number>(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplate, setLoadTemplate] = useState<{ templates: DataTemplate[]; selected: string } | null>(null);

  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; label: string; createable: boolean; updateable: boolean; deletable: boolean }>>([]);
  const [describeFields, setDescribeFields] = useState<SObjectField[] | null>(null);

  const dataset = props.dataset;
  const datasetBytes = (dataset as unknown as { bytes?: number } | null)?.bytes ?? 0;
  const sourceRecords = props.cleanedRecords ?? dataset?.sourceRecords ?? [];
  const sourceHeaders = props.cleanedHeaders ?? dataset?.headers ?? (sourceRecords[0] ? Object.keys(sourceRecords[0]) : []);

  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [mappingErrors, setMappingErrors] = useState<Array<{ recordIndex: number; field: string; message: string; value?: unknown }> | null>(null);
  const [mappedRecords, setMappedRecords] = useState<Record<string, unknown>[] | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ field: string; message: string; value?: unknown }> | null>(null);
  const [dryRun, setDryRun] = useState<DryRunReport | null>(null);

  const [push, setPush] = useState<{ pushId: string; status: string; processed: number; failed: number; total: number; error?: string; startedAt: number; completedAt?: number } | null>(null);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [pushResult, setPushResult] = useState<{ ids: string[]; capturedAt: number } | null>(null);
  const [pushErrors, setPushErrors] = useState<Array<{ recordIndex: number; message: string }> | null>(null);
  const [lastPushConfig, setLastPushConfig] = useState<{
    sourceRecords: Record<string, unknown>[];
    mappings: FieldMapping[];
  } | null>(null);
  const busRef = useRef<MessageBus | null>(null);

  useEffect(() => {
    busRef.current = new MessageBus('app');
    const bus = busRef.current;

    bus.on('DATA_PUSH_PROGRESS', async (message) => {
      const data = message.payload as { pushId: string; totalRecords: number; processedRecords: number; failedRecords: number; status: string };
      setPush(prev => {
        if (!prev || prev.pushId !== data.pushId) return prev;
        return { ...prev, status: data.status, processed: data.processedRecords, failed: data.failedRecords, total: data.totalRecords };
      });
      return { success: true, requestId: message.requestId };
    });

    bus.on('DATA_PUSH_COMPLETE', async (message) => {
      const data = message.payload as { pushId: string; totalRecords: number; processedRecords: number; failedRecords: number; status?: string; errors?: Array<{ recordIndex: number; message: string }> };
      setPush(prev => {
        if (!prev || prev.pushId !== data.pushId) return prev;
        return {
          ...prev,
          status: data.status ?? 'complete',
          processed: data.processedRecords,
          failed: data.failedRecords,
          total: data.totalRecords,
          completedAt: Date.now(),
        };
      });
      if (data.errors && data.errors.length > 0) {
        setPushErrors(data.errors);
      }
      return { success: true, requestId: message.requestId };
    });

    bus.on('DATA_PUSH_ERROR', async (message) => {
      const data = message.payload as { pushId?: string; error?: string };
      setPush(prev => {
        if (!prev) return prev;
        if (data.pushId && prev.pushId !== data.pushId) return prev;
        return { ...prev, status: 'error', error: data.error ?? 'Push failed', completedAt: Date.now() };
      });
      return { success: true, requestId: message.requestId };
    });

    return () => {
      bus.destroy();
      busRef.current = null;
    };
  }, []);

  // Tick once a second while a push is in flight so elapsed/throughput/ETA stay live.
  useEffect(() => {
    if (push?.status !== 'processing') return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [push?.status]);

  useEffect(() => {
    sf.describeGlobal(tabId)
      .then(res => setAvailableObjects(res.sobjects.map(s => ({ name: s.name, label: s.label, createable: s.createable, updateable: s.updateable, deletable: s.deletable }))))
      .catch(() => {
        // Ignore
      });
  }, [sf, tabId]);

  useEffect(() => {
    if (!objectName) return;
    sf.describeSObject(objectName, tabId)
      .then(d => setDescribeFields(d.fields))
      .catch(e => setToast({ title: 'Describe Failed', body: e instanceof Error ? e.message : 'Unknown error' }));
  }, [sf, tabId, objectName]);

  useEffect(() => {
    if (!dataset) {
      setMappings([]);
      setMappingErrors(null);
      setMappedRecords(null);
      setValidationErrors(null);
      return;
    }
    const mapper = new DataMapper();
    const auto = describeFields ? mapper.autoMapFields(sourceHeaders, describeFields) : [];
    const autoMap = new Map(auto.map(m => [m.sourceField, m]));

    const next = sourceHeaders.map(h => {
      const found = autoMap.get(h);
      return {
        sourceField: h,
        targetField: found?.targetField ?? '',
        transformation: found?.transformation ?? 'none',
        required: found?.required ?? false,
      } as FieldMapping;
    });
    setMappings(next.length ? next : makeEmptyMappings(sourceHeaders));
  }, [dataset?.filename, describeFields, sourceHeaders.join('|')]);

  // Ensure Id mapping is prefilled for update/delete when the source provides an Id column.
  useEffect(() => {
    if (!dataset) return;
    if (operation !== 'update' && operation !== 'delete') return;
    setMappings(prev => prev.map(m => {
      if (String(m.sourceField).trim().toLowerCase() !== 'id') return m;
      return { ...m, targetField: 'Id', required: true };
    }));
  }, [dataset?.filename, operation, sourceHeaders.join('|')]);

  const targetableFields = useMemo(() => {
    if (!describeFields) return [];
    return describeFields.filter(f => {
      if (operation === 'insert') return f.createable;
      if (operation === 'update' || operation === 'upsert') return f.updateable || f.name === 'Id';
      if (operation === 'delete') return f.name === 'Id';
      return f.createable;
    });
  }, [describeFields, operation]);

  const externalIdFields = useMemo(() => {
    if (!describeFields) return [];
    return describeFields.filter(f => f.externalId);
  }, [describeFields]);

  // Required, createable fields with no mapping — surfaces REQUIRED_FIELD_MISSING
  // before the push rather than after it fails. Only meaningful for insert/upsert.
  const unmappedRequired = useMemo(() => {
    if (!describeFields || (operation !== 'insert' && operation !== 'upsert')) return [];
    return new DataMapper().findUnmappedRequiredFields(describeFields, mappings);
  }, [describeFields, mappings, operation]);

  async function onFileSelected(file: File): Promise<void> {
    try {
      setBusy(true);
      const isJson = file.name.toLowerCase().endsWith('.json');
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      if (!isJson && !isCsv) {
        setToast({ title: 'Unsupported File', body: 'Upload a .csv or .json file.' });
        return;
      }
      const parsed = isJson ? await parseJsonFile(file) : await parseCsvFile(file);
      const tooLarge = estimateTooLarge(file.size, parsed.records.length);
      if (tooLarge) {
        setToast({ title: 'Too Large', body: tooLarge });
        props.onDataset({
          sourceRecords: parsed.records,
          headers: parsed.headers,
          filename: file.name,
          format: isJson ? 'json' : 'csv',
          bytes: file.size,
        });
        return;
      }
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
    } finally {
      setBusy(false);
    }
  }

  function applyMapping(): void {
    if (!dataset) return;
    const mapper = new DataMapper();
    const usable = mappings.filter(m => m.targetField && m.targetField.trim().length > 0);
    const res = mapper.mapRecords(sourceRecords, usable);
    setMappedRecords(res.mappedRecords);
    setMappingErrors(res.errors);
    setValidationErrors(null);
    setDryRun(null);
  }

  function runDryRun(): void {
    if (!mappedRecords || !describeFields) return;
    const report = simulatePush(mappedRecords, describeFields, operation, {
      externalIdField: operation === 'upsert' ? externalIdField : null,
    });
    setDryRun(report);
    setToast({
      title: report.failed === 0 ? 'Dry Run Passed' : 'Dry Run Found Issues',
      body: `${report.ok} of ${report.total} rows would succeed.`,
    });
  }

  function validate(): void {
    if (!mappedRecords || !describeFields) return;
    const validator = new DataValidator();
    const res = validator.validateRecords(mappedRecords, describeFields, operation);
    if (res.valid) {
      setValidationErrors([]);
      setToast({ title: 'Validation Passed', body: 'No errors found.' });
    } else {
      setValidationErrors(res.errors.map(e => ({ field: e.field, message: e.message, value: e.value })));
      setToast({ title: 'Validation Failed', body: `${res.errors.length} errors.` });
    }
  }

  async function openLoadTemplate(): Promise<void> {
    try {
      const templates = await sf.listTemplates();
      if (templates.length === 0) {
        setToast({ title: 'No Templates', body: 'No saved templates to load yet.' });
        return;
      }
      setLoadTemplate({ templates, selected: templates[0].name });
    } catch (e) {
      setToast({ title: 'Load Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  function confirmLoadTemplate(): void {
    if (!loadTemplate) return;
    const tmpl = loadTemplate.templates.find(t => t.name === loadTemplate.selected);
    setLoadTemplate(null);
    if (!tmpl) return;
    if (tmpl.objectName) setObjectName(tmpl.objectName);
    if (tmpl.fieldMappings) setMappings(tmpl.fieldMappings);
    setToast({ title: 'Template Loaded', body: tmpl.name });
  }

  async function confirmSaveTemplate(name: string): Promise<void> {
    setSaveTemplateOpen(false);
    try {
      await sf.upsertTemplate({ id: `tmpl_${Date.now()}`, name, objectName, fieldMappings: mappings });
      setToast({ title: 'Saved', body: `Template "${name}" saved.` });
    } catch (e) {
      setToast({ title: 'Save Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  async function cancelActivePush(): Promise<void> {
    if (!push || push.status !== 'processing') return;
    try {
      setBusy(true);
      await sf.cancelDataPush(push.pushId);
      setToast({ title: 'Cancel Requested', body: push.pushId });
    } catch (e) {
      setToast({ title: 'Cancel Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  async function loadPushIds(): Promise<void> {
    if (!push) return;
    try {
      setBusy(true);
      const res = await sf.getDataPushResult(push.pushId);
      if (!res) {
        setToast({ title: 'No IDs Found', body: 'No stored IDs for this push (session-only retention).' });
        setPushResult(null);
        return;
      }
      setPushResult({ ids: res.ids, capturedAt: res.capturedAt });
      setToast({ title: 'IDs Loaded', body: `${res.ids.length} IDs` });
    } catch (e) {
      setToast({ title: 'Load IDs Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  async function prepareDeletePushFromIds(): Promise<void> {
    if (!push) return;
    try {
      setBusy(true);
      const res = await sf.getDataPushResult(push.pushId);
      if (!res) {
        setToast({ title: 'No IDs Found', body: 'No stored IDs for this push (session-only retention).' });
        return;
      }
      if (res.ids.length === 0) {
        setToast({ title: 'No Successful IDs', body: 'This push did not store any successful record IDs.' });
        return;
      }

      const records = res.ids.map(id => ({ Id: id }));
      props.onDataset({
        sourceRecords: records,
        filename: `rollback-${push.pushId}.json`,
        format: 'json',
        headers: ['Id'],
      });
      setOperation('delete');
      setStrategy('rest');
      setExternalIdField('');
      setMappings(makeEmptyMappings(['Id']));
      setMappedRecords(records);
      setMappingErrors(null);
      setValidationErrors([]);
      setToast({ title: 'Prepared Delete Push', body: `${records.length} IDs` });
    } catch (e) {
      setToast({ title: 'Prepare Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  function handleRetry(): void {
    if (!pushErrors || !lastPushConfig) {
      setToast({ title: 'Retry Failed', body: 'Missing error data or push configuration.' });
      return;
    }

    try {
      const retryData = buildRetryDataset(lastPushConfig.sourceRecords, pushErrors);

      // Load retry dataset
      props.onDataset({
        sourceRecords: retryData.records,
        filename: `retry-${push?.pushId || 'failed'}.json`,
        format: 'json',
        headers: retryData.headers,
      });

      // Restore field mappings from original push
      setMappings(lastPushConfig.mappings);

      setRetryModalOpen(false);
      setToast({ title: 'Retry Dataset Loaded', body: `${retryData.records.length} failed records loaded. Review mappings and push again.` });
    } catch (e) {
      setToast({ title: 'Retry Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  const hasDataset = !!dataset;
  const datasetTooLarge = hasDataset ? estimateTooLarge(datasetBytes, sourceRecords.length) : null;
  const idFirstError = hasDataset ? validateIdFirst(sourceHeaders, operation) : null;
  const isBlocked = !!datasetTooLarge || !!idFirstError;
  const effectiveBatchSizeUi = operation === 'upsert' ? 25 : batchSize;

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Data Push</h2>
          <div class="wl-actions">
            <label class="wl-btn">
              Upload CSV/JSON
              <input
                type="file"
                accept=".csv,.json"
                style="display:none"
                onChange={(e) => {
                  const f = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (f) onFileSelected(f);
                }}
              />
            </label>
            <button class="wl-btn" onClick={props.onRequestCleanser} disabled={!hasDataset}>Open Cleanser</button>
            <button class="wl-btn" onClick={openLoadTemplate} disabled={!hasDataset}>Load Template</button>
            <button class="wl-btn" onClick={() => setSaveTemplateOpen(true)} disabled={!hasDataset || mappings.length === 0}>Save Template</button>
            <button class="wl-buttonDestructive" onClick={() => props.onDataset(null)} disabled={!hasDataset}>Clear</button>
          </div>
        </div>

        <div class="wl-row">
          {idFirstError ? (
            <div class="wl-bannerDanger">
              {idFirstError} Fix it by reordering your dataset columns so the header row starts with "Id".
            </div>
          ) : null}

          <div class="wl-row2">
            <SearchableSelect
              ariaLabel="Target object"
              placeholder="Search objects..."
              value={objectName}
              onChange={setObjectName}
              options={availableObjects
                .filter(o => {
                  if (operation === 'insert') return o.createable;
                  if (operation === 'update' || operation === 'upsert') return o.updateable;
                  if (operation === 'delete') return o.deletable;
                  return o.createable;
                })
                .map(o => ({ value: o.name, label: o.label, sublabel: o.name }))}
            />
            <select class="wl-select" value={operation} onChange={(e) => setOperation((e.currentTarget as HTMLSelectElement).value as never)}>
              <option value="insert">insert</option>
              <option value="update">update</option>
              <option value="upsert">upsert</option>
              <option value="delete">delete</option>
            </select>
          </div>

          <div class="wl-row2">
            <select class="wl-select" value={strategy} onChange={(e) => setStrategy((e.currentTarget as HTMLSelectElement).value as Strategy)}>
              <option value="auto">Auto</option>
              <option value="rest">REST</option>
              <option value="bulk">Bulk</option>
            </select>
            {operation === 'upsert' ? (
              <select class="wl-select" value={externalIdField} onChange={(e) => setExternalIdField((e.currentTarget as HTMLSelectElement).value)}>
                <option value="">External ID field...</option>
                {externalIdFields.map(f => <option key={f.name} value={f.name}>{f.label} ({f.name})</option>)}
              </select>
            ) : (
              <input class="wl-input" disabled value={dataset ? `${dataset.filename} - ${sourceRecords.length} records` : 'Upload a file'} />
            )}
          </div>

          <div class="wl-row2">
            <input
              class="wl-input"
              type="number"
              min={1}
              max={200}
              disabled={operation === 'upsert'}
              value={effectiveBatchSizeUi}
              onInput={(e) => {
                const n = parseInt((e.currentTarget as HTMLInputElement).value || '0', 10);
                setBatchSize(clampBatchSize(n));
              }}
              placeholder="Batch size (REST)"
              title={operation === 'upsert' ? 'Upsert uses 25 per request (Composite API limit).' : 'REST batch size (1-200).'}
            />
            <input
              class="wl-input"
              type="number"
              min={1}
              max={4}
              value={threads}
              onInput={(e) => {
                const n = parseInt((e.currentTarget as HTMLInputElement).value || '0', 10);
                setThreads(clampThreads(n));
              }}
              placeholder="Threads (REST)"
              title="REST only: max concurrent batch requests (1-4)."
            />
          </div>

          <div class="wl-muted">
            REST only: batch size (1-200) and threads (1-4). Upsert uses 25 per request. Bulk ignores these settings.
          </div>

          {props.cleanedRecords ? (
            <div class="wl-muted">Using cleaned records from Cleanser.</div>
          ) : null}

          {datasetTooLarge ? (
            <div class="wl-muted" style="color:var(--wl-danger)">
              {datasetTooLarge} (You can still cleanse/export, but pushing is blocked at large sizes.)
            </div>
          ) : null}
        </div>
      </div>

      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Mapping</h2>
          <div class="wl-actions">
            <button class="wl-btn" onClick={applyMapping} disabled={!hasDataset || !describeFields || isBlocked}>Apply Mapping</button>
            <button class="wl-btn" onClick={validate} disabled={!mappedRecords || !describeFields || isBlocked}>Validate</button>
            <button class="wl-btn" onClick={runDryRun} disabled={!mappedRecords || !describeFields || isBlocked} title="Simulate this push against the schema without writing to the org">Dry Run</button>
            <button
              class="wl-buttonBrand"
              onClick={() => setConfirmOpen(true)}
              disabled={!mappedRecords || isBlocked || (validationErrors !== null && validationErrors.length > 0) || busy}
            >
              ⬆ Review &amp; Push
            </button>
          </div>
        </div>

        {hasDataset && unmappedRequired.length > 0 ? (
          <div class="wl-bannerWarning" style="margin-bottom:10px">
            <strong>{unmappedRequired.length} required field{unmappedRequired.length === 1 ? '' : 's'} not mapped.</strong>{' '}
            Salesforce will reject rows with <span class="wl-mono">REQUIRED_FIELD_MISSING</span> unless these are mapped or given a default:{' '}
            {unmappedRequired.map(f => `${f.label} (${f.name})`).join(', ')}.
          </div>
        ) : null}

        {hasDataset ? (
          <div class="wl-tableWrap" style="max-height:360px">
            <table class="wl-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Target</th>
                  <th>Transform</th>
                  <th>Req</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m, idx) => (
                  <tr key={m.sourceField}>
                    <td class="wl-mono">{m.sourceField}</td>
                    <td>
                      <SearchableSelect
                        ariaLabel={`Target field for ${m.sourceField}`}
                        placeholder="(skip)"
                        value={m.targetField}
                        onChange={(v) => {
                          const field = targetableFields.find(f => f.name === v);
                          setMappings(prev => prev.map((p, i) => i === idx ? { ...p, targetField: v, required: field?.required ?? false } : p));
                        }}
                        options={[
                          { value: '', label: '(skip)' },
                          ...targetableFields.map(f => ({ value: f.name, label: f.label, sublabel: f.name })),
                        ]}
                      />
                    </td>
                    <td>
                      <select
                        class="wl-select"
                        value={m.transformation ?? 'none'}
                        onChange={(e) => {
                          const v = (e.currentTarget as HTMLSelectElement).value as TransformationType;
                          setMappings(prev => prev.map((p, i) => i === idx ? { ...p, transformation: v } : p));
                        }}
                      >
                        {TRANSFORM_OPTIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                    </td>
                    <td style="text-align:center">{m.required ? 'Yes' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="wl-row">
            <DropZone accept={['.csv', '.json']} onDrop={onFileSelected}>
              <div style="text-align:center;padding:20px">
                <div style="font-size:48px;margin-bottom:12px">📂</div>
                <div style="font-weight:900;font-size:14px;margin-bottom:6px">Drag & Drop CSV or JSON</div>
                <div class="wl-muted">Or click to browse files</div>
              </div>
            </DropZone>
          </div>
        )}
      </div>

      {mappingErrors && mappingErrors.length > 0 ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Mapping Errors ({mappingErrors.length})</h2>
          </div>
          <div class="wl-tableWrap">
            <table class="wl-table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Field</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {mappingErrors.slice(0, 500).map((e, idx) => (
                  <tr key={idx}>
                    <td class="wl-mono">{e.recordIndex}</td>
                    <td class="wl-mono">{e.field}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="wl-row">
            <div class="wl-muted">Showing first 500 errors.</div>
          </div>
        </div>
      ) : null}

      {validationErrors && validationErrors.length > 0 ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Validation Errors ({validationErrors.length})</h2>
          </div>
          <div class="wl-tableWrap">
            <table class="wl-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Message</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {validationErrors.slice(0, 500).map((e, idx) => (
                  <tr key={idx}>
                    <td class="wl-mono">{e.field}</td>
                    <td>{e.message}</td>
                    <td class="wl-mono">{e.value === undefined ? '' : String(e.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="wl-row">
            <div class="wl-muted">Showing first 500 errors.</div>
          </div>
        </div>
      ) : null}

      {dryRun ? (
        <DryRunPanel
          report={dryRun}
          objectName={objectName}
          operation={operation}
          onClose={() => setDryRun(null)}
        />
      ) : null}

      {push ? (
        <MigrationProgressDashboard
          progress={computePushProgress({
            status: push.status,
            processed: push.processed,
            failed: push.failed,
            total: push.total,
            startedAt: push.startedAt,
            completedAt: push.completedAt,
            now: nowTs,
          })}
          pushId={push.pushId}
          status={push.status}
          error={push.error}
          actions={
            <>
              {push.status === 'processing' ? (
                <button class="wl-buttonDestructive" disabled={busy} onClick={cancelActivePush}>Cancel Push</button>
              ) : null}
              {push.status === 'complete' ? (
                <>
                  <button class="wl-btn" disabled={busy} onClick={loadPushIds}>View IDs</button>
                  <button class="wl-buttonBrand" disabled={busy} onClick={prepareDeletePushFromIds}>Prepare Delete Push</button>
                  {push.failed > 0 && pushErrors && pushErrors.length > 0 ? (
                    <button class="wl-buttonBrand" disabled={busy} onClick={() => setRetryModalOpen(true)}>Retry Failed Rows</button>
                  ) : null}
                </>
              ) : null}
            </>
          }
        />
      ) : null}

      {pushResult ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Stored Record IDs</h2>
            <div class="wl-muted">{pushResult.ids.length} IDs</div>
          </div>
          <div class="wl-row" style="flex-direction:column;gap:6px;align-items:flex-start">
            {pushResult.ids.length > 0 ? (
              <div class="wl-mono" style="max-width:100%;overflow:auto">
                {pushResult.ids.slice(0, 10).join('\n')}
                {pushResult.ids.length > 10 ? `\n... (${pushResult.ids.length - 10} more)` : ''}
              </div>
            ) : null}
            <div class="wl-muted">Session-only: IDs are cleared when the browser closes.</div>
          </div>
        </div>
      ) : null}

      {operation === 'delete' ? (
        <TypedConfirmModal
          open={confirmOpen}
          title="Confirm Delete Operation"
          confirmationPhrase={`DELETE ${mappedRecords ? mappedRecords.length : 0} RECORDS`}
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            if (!mappedRecords || !dataset) return;
            if (validationErrors && validationErrors.length > 0) {
              setToast({ title: 'Blocked', body: 'Fix validation errors before pushing.' });
              return;
            }
            if (idFirstError) {
              setToast({ title: 'Blocked', body: idFirstError });
              return;
            }

            setBusy(true);
            try {
              const useBulkApi = strategy === 'auto' ? undefined : strategy === 'bulk';
              const res = await sf.startDataPush({
                tabId,
                objectName,
                operation,
                records: mappedRecords,
                externalIdField: undefined,
                batchSize: clampBatchSize(batchSize),
                threads: clampThreads(threads),
                useBulkApi,
              });
              setConfirmOpen(false);
              setPush({ pushId: res.pushId, status: 'processing', processed: 0, failed: 0, total: mappedRecords.length, startedAt: Date.now() });
              setPushResult(null);
              setPushErrors(null);
              // Save push config for retry
              setLastPushConfig({
                sourceRecords,
                mappings: [...mappings],
              });
              setToast({ title: 'Push Started', body: `${res.strategy.toUpperCase()} - ${res.pushId}` });
            } catch (e) {
              setToast({ title: 'Push Failed', body: e instanceof Error ? e.message : 'Unknown error' });
            } finally {
              setBusy(false);
            }
          }}
        >
          <div style="font-size:14px;margin-bottom:16px">
            <div style="font-weight:900;margin-bottom:8px;color:var(--wl-danger)">⚠️ Warning: Permanent Deletion</div>
            <div class="wl-muted">
              You are about to <strong>permanently delete {mappedRecords ? mappedRecords.length : 0} records</strong> from <strong>{objectName}</strong> in Salesforce. This action cannot be undone.
            </div>
          </div>
          <div class="wl-chipRow">
            <span class="wl-chip"><span style="font-weight:900">Object:</span> {objectName}</span>
            <span class="wl-chip"><span style="font-weight:900">Op:</span> {operation}</span>
            <span class="wl-chip"><span style="font-weight:900">Records:</span> {mappedRecords ? mappedRecords.length : 0}</span>
            <span class="wl-chip"><span style="font-weight:900">Strategy:</span> {strategy.toUpperCase()}</span>
            <span class="wl-chip"><span style="font-weight:900">Batch:</span> {clampBatchSize(batchSize)}</span>
            <span class="wl-chip"><span style="font-weight:900">Threads:</span> {clampThreads(threads)}</span>
          </div>
          <div class="wl-muted" style="margin-top:8px">Delete safety: the first dataset column header must be "Id".</div>
        </TypedConfirmModal>
      ) : (
        <ConfirmModal
          open={confirmOpen}
          title="Confirm Data Push"
          busy={busy}
          confirmDisabled={
            !mappedRecords
            || !dataset
            || isBlocked
            || (validationErrors !== null && validationErrors.length > 0)
            || (operation === 'upsert' && !externalIdField)
          }
          confirmText="Start Push"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            if (!mappedRecords || !dataset) return;
            if (validationErrors && validationErrors.length > 0) {
              setToast({ title: 'Blocked', body: 'Fix validation errors before pushing.' });
              return;
            }
            if (idFirstError) {
              setToast({ title: 'Blocked', body: idFirstError });
              return;
            }
            if (operation === 'upsert' && !externalIdField) {
              setToast({ title: 'Blocked', body: 'Select an external ID field for upsert.' });
              return;
            }

            setBusy(true);
            try {
              const useBulkApi = strategy === 'auto' ? undefined : strategy === 'bulk';
              const res = await sf.startDataPush({
                tabId,
                objectName,
                operation,
                records: mappedRecords,
                externalIdField: operation === 'upsert' ? (externalIdField || undefined) : undefined,
                batchSize: operation === 'upsert' ? undefined : clampBatchSize(batchSize),
                threads: clampThreads(threads),
                useBulkApi,
              });
              setConfirmOpen(false);
              setPush({ pushId: res.pushId, status: 'processing', processed: 0, failed: 0, total: mappedRecords.length, startedAt: Date.now() });
              setPushResult(null);
              setPushErrors(null);
              // Save push config for retry
              setLastPushConfig({
                sourceRecords,
                mappings: [...mappings],
              });
              setToast({ title: 'Push Started', body: `${res.strategy.toUpperCase()} - ${res.pushId}` });
            } catch (e) {
              setToast({ title: 'Push Failed', body: e instanceof Error ? e.message : 'Unknown error' });
            } finally {
              setBusy(false);
            }
          }}
        >
          <div class="wl-chipRow">
            <span class="wl-chip"><span style="font-weight:900">Object:</span> {objectName}</span>
            <span class="wl-chip"><span style="font-weight:900">Op:</span> {operation}</span>
            <span class="wl-chip"><span style="font-weight:900">Records:</span> {mappedRecords ? mappedRecords.length : 0}</span>
            <span class="wl-chip"><span style="font-weight:900">Strategy:</span> {strategy.toUpperCase()}</span>
            {operation === 'upsert' ? (
              <span class="wl-chip"><span style="font-weight:900">External ID:</span> {externalIdField || '(not set)'}</span>
            ) : null}
            <span class="wl-chip"><span style="font-weight:900">Batch:</span> {operation === 'upsert' ? '25 (fixed)' : clampBatchSize(batchSize)}</span>
            <span class="wl-chip"><span style="font-weight:900">Threads:</span> {clampThreads(threads)}</span>
          </div>
          {operation === 'upsert' ? (
            <div class="wl-muted">Upsert requires an External ID field; upsert requests are sent in batches of 25 (Composite API limit).</div>
          ) : null}
          {operation === 'update' ? (
            <div class="wl-muted">Update safety: the first dataset column header must be "Id".</div>
          ) : null}
          {strategy === 'bulk' ? (
            <div class="wl-muted">Bulk strategy ignores batch size and threads settings.</div>
          ) : null}
        </ConfirmModal>
      )}

      <RetryModal
        open={retryModalOpen}
        totalFailed={push?.failed ?? 0}
        errors={pushErrors ?? []}
        onRetry={handleRetry}
        onClose={() => setRetryModalOpen(false)}
      />

      <PromptModal
        open={saveTemplateOpen}
        title="Save Template"
        label="Template name"
        placeholder="e.g. Account upsert mapping"
        confirmText="Save"
        onCancel={() => setSaveTemplateOpen(false)}
        onSubmit={confirmSaveTemplate}
      />

      <ConfirmModal
        open={loadTemplate !== null}
        title="Load Template"
        confirmText="Load"
        confirmDisabled={!loadTemplate || loadTemplate.templates.length === 0}
        onCancel={() => setLoadTemplate(null)}
        onConfirm={confirmLoadTemplate}
      >
        <label style="font-weight:900;font-size:12px">Template</label>
        <select
          class="wl-select"
          value={loadTemplate?.selected ?? ''}
          onChange={(e) => {
            const selected = (e.currentTarget as HTMLSelectElement).value;
            setLoadTemplate(prev => (prev ? { ...prev, selected } : prev));
          }}
        >
          {loadTemplate?.templates.map(t => (
            <option key={t.id} value={t.name}>{t.name}{t.objectName ? ` (${t.objectName})` : ''}</option>
          ))}
        </select>
      </ConfirmModal>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
