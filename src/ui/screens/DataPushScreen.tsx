import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import { Toast } from '../components/Toast';
import { parseCsvFile, parseJsonFile } from '../utils/fileParse';
import { DataMapper } from '../../data/mappers';
import { DataValidator } from '../../data/validators';
import type { FieldMapping, TransformationType } from '../../core/types/storage';
import type { SObjectField } from '../../core/types/salesforce';
import { MessageBus } from '../../services/messaging';
import { TRANSFORM_OPTIONS } from '../utils/transforms';

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
  if (recordCount > 25_000) return 'Dataset too large for MVP push pipeline (over 25,000 rows). Split the file or reduce rows.';
  if (fileSizeBytes > 10 * 1024 * 1024) return 'Dataset too large for MVP push pipeline (over ~10MB). Split the file or reduce columns.';
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

  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; label: string; createable: boolean }>>([]);
  const [describeFields, setDescribeFields] = useState<SObjectField[] | null>(null);

  const dataset = props.dataset;
  const datasetBytes = (dataset as unknown as { bytes?: number } | null)?.bytes ?? 0;
  const sourceRecords = props.cleanedRecords ?? dataset?.sourceRecords ?? [];
  const sourceHeaders = props.cleanedHeaders ?? dataset?.headers ?? (sourceRecords[0] ? Object.keys(sourceRecords[0]) : []);

  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [mappingErrors, setMappingErrors] = useState<Array<{ recordIndex: number; field: string; message: string; value?: unknown }> | null>(null);
  const [mappedRecords, setMappedRecords] = useState<Record<string, unknown>[] | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ field: string; message: string; value?: unknown }> | null>(null);

  const [push, setPush] = useState<{ pushId: string; status: string; processed: number; failed: number; total: number; error?: string } | null>(null);
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
      const data = message.payload as { pushId: string; totalRecords: number; processedRecords: number; failedRecords: number; status?: string };
      setPush(prev => {
        if (!prev || prev.pushId !== data.pushId) return prev;
        return { ...prev, status: 'complete', processed: data.processedRecords, failed: data.failedRecords, total: data.totalRecords };
      });
      return { success: true, requestId: message.requestId };
    });

    bus.on('DATA_PUSH_ERROR', async (message) => {
      const data = message.payload as { pushId?: string; error?: string };
      setPush(prev => {
        if (!prev) return prev;
        if (data.pushId && prev.pushId !== data.pushId) return prev;
        return { ...prev, status: 'error', error: data.error ?? 'Push failed' };
      });
      return { success: true, requestId: message.requestId };
    });
  }, []);

  useEffect(() => {
    sf.describeGlobal(tabId)
      .then(res => setAvailableObjects(res.sobjects.map(s => ({ name: s.name, label: s.label, createable: s.createable }))))
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

  async function startPush(): Promise<void> {
    if (!mappedRecords || !dataset) return;
    if (validationErrors && validationErrors.length > 0) {
      setToast({ title: 'Blocked', body: 'Fix validation errors before pushing.' });
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
        useBulkApi,
      });
      setPush({ pushId: res.pushId, status: 'processing', processed: 0, failed: 0, total: mappedRecords.length });
      setToast({ title: 'Push Started', body: `${res.strategy.toUpperCase()} - ${res.pushId}` });
    } catch (e) {
      setToast({ title: 'Push Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  const hasDataset = !!dataset;
  const datasetTooLarge = hasDataset ? estimateTooLarge(datasetBytes, sourceRecords.length) : null;

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
            <button class="wl-btn wl-btnDanger" onClick={() => props.onDataset(null)} disabled={!hasDataset}>Clear</button>
          </div>
        </div>

        <div class="wl-row">
          <div class="wl-row2">
            <select class="wl-select" value={objectName} onChange={(e) => setObjectName((e.currentTarget as HTMLSelectElement).value)}>
              {availableObjects
                .filter(o => o.createable)
                .slice(0, 2000)
                .map(o => (
                  <option key={o.name} value={o.name}>
                    {o.label} ({o.name})
                  </option>
                ))}
            </select>
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
            <button class="wl-btn wl-btnPrimary" onClick={applyMapping} disabled={!hasDataset || !describeFields || !!datasetTooLarge}>Apply Mapping</button>
            <button class="wl-btn" onClick={validate} disabled={!mappedRecords || !describeFields}>Validate</button>
            <button class="wl-btn wl-btnPrimary" onClick={startPush} disabled={!mappedRecords || !!datasetTooLarge || (validationErrors !== null && validationErrors.length > 0) || busy}>
              Push
            </button>
          </div>
        </div>

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
                      <select
                        class="wl-select"
                        value={m.targetField}
                        onChange={(e) => {
                          const v = (e.currentTarget as HTMLSelectElement).value;
                          const field = targetableFields.find(f => f.name === v);
                          setMappings(prev => prev.map((p, i) => i === idx ? { ...p, targetField: v, required: field?.required ?? false } : p));
                        }}
                      >
                        <option value="">(skip)</option>
                        {targetableFields.map(f => (
                          <option key={f.name} value={f.name}>{f.label} ({f.name})</option>
                        ))}
                      </select>
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
          <div class="wl-row"><div class="wl-muted">Upload data to configure mapping.</div></div>
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

      {push ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Push Progress</h2>
            <div class="wl-muted">{push.pushId}</div>
          </div>
          <div class="wl-row">
            <div style="font-weight:900">{push.status}</div>
            <div class="wl-muted">{push.processed} / {push.total} processed - {push.failed} failed</div>
            {push.error ? <div class="wl-muted" style="color:var(--wl-danger)">{push.error}</div> : null}
          </div>
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
