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
import { buildPushOutcomeDatasets, buildRetryDataset } from '../utils/pushRetry';
import { parseAnyFile } from '../utils/fileParse';
import { DataMapper } from '../../data/mappers';
import type { MappingMatchKind } from '../../data/mappers';
import { DataValidator } from '../../data/validators';
import type { FieldMapping, TransformationType, DataTemplate, SavedJob } from '../../core/types/storage';
import type { SObjectField } from '../../core/types/salesforce';
import { MessageBus } from '../../services/messaging';
import { TRANSFORM_OPTIONS } from '../utils/transforms';
import { pushConfirmationPhrase, validateIdFirst } from '../utils/pushGuards';
import { clampBatchSize, clampThreads } from '../utils/pushOptions';
import { Icon } from '../components/Icon';
import { exportRecords } from '../utils/export';

type Strategy = 'auto' | 'rest' | 'bulk';
type ImportStage = 'upload' | 'configure' | 'mapping' | 'validate' | 'review' | 'run' | 'results';

const IMPORT_STAGES: Array<{ key: ImportStage; label: string }> = [
  { key: 'upload', label: 'Upload' },
  { key: 'configure', label: 'Object & operation' },
  { key: 'mapping', label: 'Mapping' },
  { key: 'validate', label: 'Clean & validate' },
  { key: 'review', label: 'Review' },
  { key: 'run', label: 'Run' },
  { key: 'results', label: 'Results' },
];

/** Small pill describing how a header was auto-matched to a field. */
function matchBadge(kind: MappingMatchKind): { text: string; cls: string } | null {
  switch (kind) {
    case 'name-exact':
    case 'name-normalized':
      return { text: 'auto', cls: 'wl-pill--success' };
    case 'label-exact':
    case 'label-normalized':
      return { text: 'via label', cls: 'wl-pill--brand' };
    default:
      return null;
  }
}

function makeEmptyMappings(headers: string[]): FieldMapping[] {
  return headers.map(h => ({
    sourceField: h,
    targetField: '',
    transformation: 'none',
    required: false,
  }));
}

function estimateTooLarge(fileSizeBytes: number, recordCount: number): string | null {
  if (recordCount > 100_000) return 'Dataset exceeds the measured local limit of 100,000 rows. Split the file into smaller jobs.';
  if (fileSizeBytes > 50 * 1024 * 1024) return 'Dataset exceeds the measured local limit of 50 MB. Split the file into smaller jobs.';
  return null;
}

function relationshipNameFor(field: SObjectField): string {
  if (field.relationshipName) return field.relationshipName;
  if (field.name.endsWith('__c')) return field.name.replace(/__c$/, '__r');
  return field.name.replace(/Id$/, '');
}

function estimateSizeWarning(fileSizeBytes: number, recordCount: number): string | null {
  if (recordCount > 25_000 || fileSizeBytes > 10 * 1024 * 1024) {
    return 'Large local dataset: validation and mapping may use substantial memory. Auto API mode will use Bulk API 2.0 for the write.';
  }
  return null;
}

export function DataPushScreen(props: {
  sf: SfApi;
  tabId: number;
  context?: { orgId?: string; instanceUrl?: string; environment?: 'production' | 'sandbox' };
  dataset: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json' | 'excel' | 'xml';
    headers: string[];
    bytes?: number;
  } | null;
  cleanedRecords: Record<string, unknown>[] | null;
  cleanedHeaders: string[] | null;
  onDataset: (d: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json' | 'excel' | 'xml';
    headers: string[];
    bytes?: number;
  } | null) => void;
  onRequestCleanser: () => void;
  savedJobDraft?: SavedJob;
  onSavedJobDraftConsumed?: () => void;
}): VNode {
  const { sf, tabId } = props;
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<ImportStage>(props.dataset ? 'configure' : 'upload');
  const [furthestStage, setFurthestStage] = useState<number>(props.dataset ? 1 : 0);
  const [savedJobPreset] = useState<SavedJob | undefined>(props.savedJobDraft);

  useEffect(() => {
    if (savedJobPreset) props.onSavedJobDraftConsumed?.();
  }, []);

  function moveToStage(next: ImportStage): void {
    const index = IMPORT_STAGES.findIndex(item => item.key === next);
    setStage(next);
    setFurthestStage(current => Math.max(current, index));
  }

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
  // All saved templates, used to auto-surface a reusable mapping for the current object.
  const [allTemplates, setAllTemplates] = useState<DataTemplate[]>([]);

  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; label: string; createable: boolean; updateable: boolean; deletable: boolean }>>([]);
  const [describeFields, setDescribeFields] = useState<SObjectField[] | null>(null);

  const dataset = props.dataset;
  const datasetBytes = (dataset as unknown as { bytes?: number } | null)?.bytes ?? 0;
  const sourceRecords = props.cleanedRecords ?? dataset?.sourceRecords ?? [];
  const sourceHeaders = props.cleanedHeaders ?? dataset?.headers ?? (sourceRecords[0] ? Object.keys(sourceRecords[0]) : []);

  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const hasRelationshipLookups = mappings.some(mapping => mapping.lookup && mapping.lookup.mode !== 'id');
  // How each source header was auto-matched (for the "auto"/"guess" hint badges),
  // plus low-confidence suggestions the user can accept with one click.
  const [matchInfo, setMatchInfo] = useState<Record<string, { kind: MappingMatchKind; confidence: number }>>({});
  const [suggestions, setSuggestions] = useState<Record<string, { target: string; label: string }>>({});
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
    if (!savedJobPreset || savedJobPreset.definition.kind !== 'import') return;
    if (savedJobPreset.definition.objectName) setObjectName(savedJobPreset.definition.objectName);
    const savedOperation = savedJobPreset.definition.operation;
    if (savedOperation && savedOperation !== 'query') setOperation(savedOperation);
    setExternalIdField(savedJobPreset.definition.externalIdField ?? '');
    setStrategy(savedJobPreset.definition.api.strategy);
    if (savedJobPreset.definition.api.batchSize) setBatchSize(savedJobPreset.definition.api.batchSize);
    if (savedJobPreset.definition.api.concurrency) setThreads(savedJobPreset.definition.api.concurrency);
  }, [savedJobPreset]);

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

  function refreshTemplates(): void {
    sf.listTemplates().then(setAllTemplates).catch(() => undefined);
  }
  useEffect(() => { refreshTemplates(); }, [sf]);

  // Saved mappings that target the currently selected object.
  const objectProfiles = useMemo(
    () => allTemplates.filter(t => t.objectName === objectName && t.fieldMappings && t.fieldMappings.length > 0),
    [allTemplates, objectName],
  );

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
    if (savedJobPreset?.definition.mappings?.length) {
      const bySource = new Map(savedJobPreset.definition.mappings.map(mapping => [mapping.sourceField, mapping]));
      setMappings(sourceHeaders.map(header => bySource.get(header) ?? {
        sourceField: header,
        targetField: '',
        transformation: 'none',
        required: false,
      }));
      setMatchInfo({});
      setSuggestions({});
      return;
    }
    const mapper = new DataMapper();
    // Score every header; auto-apply confident matches (>= 0.9) and keep the
    // weaker fuzzy hits as one-click suggestions rather than silently applying them.
    const scored = describeFields ? mapper.suggestFieldMappings(sourceHeaders, describeFields, { minConfidence: 0.6 }) : [];
    const applied = new Map(scored.filter(s => s.confidence >= 0.9).map(s => [s.sourceField, s]));
    const guesses = scored.filter(s => s.confidence < 0.9);

    const info: Record<string, { kind: MappingMatchKind; confidence: number }> = {};
    const sugg: Record<string, { target: string; label: string }> = {};
    for (const s of applied.values()) info[s.sourceField] = { kind: s.matchedOn, confidence: s.confidence };
    for (const g of guesses) {
      if (applied.has(g.sourceField)) continue;
      const target = describeFields?.find(f => f.name === g.targetField);
      sugg[g.sourceField] = { target: g.targetField, label: target?.label ?? g.targetField };
    }
    setMatchInfo(info);
    setSuggestions(sugg);

    const next = sourceHeaders.map(h => {
      const found = applied.get(h);
      return {
        sourceField: h,
        targetField: found?.targetField ?? '',
        transformation: found?.transformation ?? 'none',
        required: found?.required ?? false,
      } as FieldMapping;
    });
    setMappings(next.length ? next : makeEmptyMappings(sourceHeaders));
  }, [dataset?.filename, describeFields, sourceHeaders.join('|'), savedJobPreset]);

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
      const parsed = await parseAnyFile(file);
      const tooLarge = estimateTooLarge(file.size, parsed.records.length);
      props.onDataset({
        sourceRecords: parsed.records,
        headers: parsed.headers,
        filename: file.name,
        format: parsed.format,
        bytes: file.size,
      });
      if (tooLarge) setToast({ title: 'Local Limit Exceeded', body: tooLarge });
      else {
        const warning = estimateSizeWarning(file.size, parsed.records.length);
        if (warning) setToast({ title: 'Large Dataset', body: warning });
      }
      moveToStage('configure');
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
    moveToStage('validate');
  }

  function runDryRun(): void {
    if (!mappedRecords || !describeFields) return;
    const report = simulatePush(mappedRecords, describeFields, operation, {
      externalIdField: operation === 'upsert' ? externalIdField : null,
    });
    setDryRun(report);
    moveToStage('review');
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
      moveToStage('review');
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
      const now = Date.now();
      const savedJob: SavedJob = {
        schemaVersion: 1,
        id: `job-import-${now}`,
        name,
        favorite: false,
        definition: {
          kind: 'import', objectName, operation, inputSource: 'local-file', mappings,
          orgRoles: { target: 'active-org' },
          externalIdField: operation === 'upsert' ? externalIdField : undefined,
          api: { strategy, batchSize, concurrency: threads },
          safety: { dryRun: true, requireProductionConfirmation: true },
        },
        version: 1, revisions: [], createdAt: now, updatedAt: now, usageCount: 0,
      };
      const stored = await chrome.storage.local.get('savedJobs');
      await chrome.storage.local.set({ savedJobs: [...((stored.savedJobs as SavedJob[]) ?? []), savedJob] });
      refreshTemplates();
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

  async function downloadOutcome(kind: 'success' | 'error'): Promise<void> {
    if (!push || !lastPushConfig) return;
    setBusy(true);
    try {
      const stored = kind === 'success' ? await sf.getDataPushResult(push.pushId) : null;
      const datasets = buildPushOutcomeDatasets(lastPushConfig.sourceRecords, pushErrors ?? [], stored?.ids ?? []);
      const selected = datasets[kind];
      await exportRecords(selected.records, selected.headers, {
        format: 'csv',
        filename: `${objectName}-${push.pushId}-${kind}.csv`,
      });
      setToast({ title: 'Downloaded', body: `${selected.records.length.toLocaleString()} ${kind} rows.` });
    } catch (error) {
      setToast({ title: 'Download Failed', body: error instanceof Error ? error.message : 'Unable to create result file.' });
    } finally {
      setBusy(false);
    }
  }

  const hasDataset = !!dataset;
  const datasetTooLarge = hasDataset ? estimateTooLarge(datasetBytes, sourceRecords.length) : null;
  const datasetSizeWarning = hasDataset ? estimateSizeWarning(datasetBytes, sourceRecords.length) : null;
  const idFirstError = hasDataset ? validateIdFirst(sourceHeaders, operation) : null;
  const confirmationPhrase = pushConfirmationPhrase(
    operation,
    mappedRecords?.length ?? 0,
    objectName,
    props.context?.environment,
  );
  const isBlocked = !!datasetTooLarge || !!idFirstError;
  const effectiveBatchSizeUi = operation === 'upsert' ? 25 : batchSize;
  const predictedBulk = !hasRelationshipLookups && (strategy === 'bulk' || (strategy === 'auto' && sourceRecords.length >= 2_000));
  const likelyApiUsage = predictedBulk
    ? '1 Bulk ingest job plus status/result requests'
    : `About ${Math.max(1, Math.ceil(sourceRecords.length / Math.max(1, operation === 'upsert' ? 25 : clampBatchSize(batchSize)))).toLocaleString()} REST batch requests`;

  useEffect(() => {
    if (!dataset && stage !== 'upload') {
      setStage('upload');
      setFurthestStage(0);
    }
  }, [dataset, stage]);

  useEffect(() => {
    if (push?.status === 'processing') moveToStage('run');
    if (push?.status === 'complete' || push?.status === 'error' || push?.status === 'cancelled') moveToStage('results');
  }, [push?.status]);

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <nav class="wl-flowSteps" aria-label="Import progress">
        {IMPORT_STAGES.map((item, index) => {
          const activeIndex = IMPORT_STAGES.findIndex(candidate => candidate.key === stage);
          return (
            <button
              type="button"
              key={item.key}
              class="wl-flowStep"
              data-active={stage === item.key}
              data-done={index < activeIndex}
              aria-current={stage === item.key ? 'step' : undefined}
              disabled={index > furthestStage}
              onClick={() => setStage(item.key)}
            >
              <span class="wl-flowStep__num">{index + 1}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {savedJobPreset ? <div class="wl-bannerInfo">Loaded saved job <strong>{savedJobPreset.name}</strong> v{savedJobPreset.version}. Choose a source file; its object, operation, API, and mappings are prefilled.</div> : null}

      {dataset ? (
        <div class="wl-jobContext" data-environment={props.context?.environment ?? 'unknown'} role="status">
          <span><strong>File</strong> {dataset.filename}</span>
          <span><strong>Org</strong> {props.context?.instanceUrl ? new URL(props.context.instanceUrl).hostname : props.context?.orgId ?? 'Selected Salesforce tab'}</span>
          <span><strong>Environment</strong> {props.context?.environment === 'sandbox' ? 'Sandbox' : props.context?.environment === 'production' ? 'Production' : 'Not detected'}</span>
          <span><strong>Object</strong> {objectName}</span>
          <span><strong>Operation</strong> {operation}</span>
          <span><strong>Records</strong> {sourceRecords.length.toLocaleString()}</span>
          <span><strong>API</strong> {strategy === 'auto' ? 'Automatic' : strategy.toUpperCase()}</span>
        </div>
      ) : null}
      {dataset && props.context?.environment === 'production' && ['review', 'run', 'results'].includes(stage) ? (
        <div class="wl-bannerWarning" role="alert"><strong>Production org.</strong> This job targets live Salesforce data. Verify the org, operation, and record count before continuing.</div>
      ) : null}
      <div class="wl-card" hidden={stage !== 'configure'}>
        <div class="wl-cardHeader">
          <h2>Choose target and operation</h2>
          <div class="wl-actions">
            <label class="wl-btn">
              Upload data file
              <input
                type="file"
                accept=".csv,.tsv,.json,.xlsx,.xml"
                style="display:none"
                onChange={(e) => {
                  const f = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (f) onFileSelected(f);
                }}
              />
            </label>
            <button class="wl-buttonDestructive" onClick={() => { props.onDataset(null); moveToStage('upload'); }} disabled={!hasDataset}>Clear file</button>
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
            <select aria-label="Import operation" class="wl-select" value={operation} onChange={(e) => setOperation((e.currentTarget as HTMLSelectElement).value as never)}>
              <option value="insert">insert</option>
              <option value="update">update</option>
              <option value="upsert">upsert</option>
              <option value="delete">delete</option>
            </select>
          </div>

          <div class="wl-row2">
            <select aria-label="API strategy" class="wl-select" value={strategy} onChange={(e) => setStrategy((e.currentTarget as HTMLSelectElement).value as Strategy)}>
              <option value="auto">Auto</option>
              <option value="rest">REST</option>
              <option value="bulk">Bulk</option>
            </select>
            {operation === 'upsert' ? (
              <select aria-label="External ID field" class="wl-select" value={externalIdField} onChange={(e) => setExternalIdField((e.currentTarget as HTMLSelectElement).value)}>
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
              aria-label="REST batch size"
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
              aria-label="REST concurrency"
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
            <div class="wl-bannerDanger" role="alert">
              {datasetTooLarge} You can still cleanse or export the loaded data, but writing is blocked.
            </div>
          ) : null}
          {!datasetTooLarge && datasetSizeWarning ? <div class="wl-bannerWarning">{datasetSizeWarning}</div> : null}
        </div>
      </div>

      <div class="wl-card" hidden={stage !== 'upload' && stage !== 'mapping'}>
        <div class="wl-cardHeader">
          <h2>{stage === 'upload' ? 'Upload your data file' : 'Map source columns'}</h2>
          {stage === 'mapping' ? (
            <div class="wl-actions">
              <button class="wl-buttonText" onClick={props.onRequestCleanser} disabled={!hasDataset}>Clean data</button>
              <button class="wl-buttonText" onClick={openLoadTemplate} disabled={!hasDataset}>Load mapping</button>
              <button class="wl-buttonText" onClick={() => setSaveTemplateOpen(true)} disabled={!hasDataset || mappings.length === 0}>Save mapping</button>
            </div>
          ) : null}
        </div>

        {hasDataset && objectProfiles.length > 0 ? (
          <div class="wl-row" style="margin-bottom:10px;gap:8px;align-items:center;flex-wrap:wrap">
            <span class="wl-muted">Saved mapping{objectProfiles.length === 1 ? '' : 's'} for {objectName}:</span>
            {objectProfiles.map(t => (
              <button
                key={t.id}
                class="wl-pill wl-pill--brand"
                style="padding:2px 10px;font-size:12px;cursor:pointer;border:none"
                title={`Apply the saved field mapping "${t.name}"`}
                onClick={() => {
                  if (t.fieldMappings) setMappings(t.fieldMappings);
                  setMatchInfo({});
                  setSuggestions({});
                  setToast({ title: 'Mapping Applied', body: `Applied saved mapping "${t.name}".` });
                }}
              >
                Apply: {t.name}
              </button>
            ))}
          </div>
        ) : null}

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
                  <th>Blank cells</th>
                  <th>Reference lookup</th>
                  <th>Req</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m, idx) => (
                  <tr key={m.sourceField}>
                    <td class="wl-mono">
                      {m.sourceField}
                      {(() => {
                        const info = matchInfo[m.sourceField];
                        const badge = info ? matchBadge(info.kind) : null;
                        return badge ? <span class={`wl-pill ${badge.cls}`} style="margin-left:6px;padding:1px 6px;font-size:10px">{badge.text}</span> : null;
                      })()}
                    </td>
                    <td>
                      <SearchableSelect
                        ariaLabel={`Target field for ${m.sourceField}`}
                        placeholder="(skip)"
                        value={m.targetField}
                        onChange={(v) => {
                          const field = targetableFields.find(f => f.name === v);
                          setMappings(prev => prev.map((p, i) => i === idx ? {
                            ...p,
                            targetField: v,
                            required: field?.required ?? false,
                            lookup: field?.type === 'reference' ? { mode: 'id' } : undefined,
                          } : p));
                          // A manual choice overrides the auto-hint for this row.
                          setMatchInfo(prev => { const n = { ...prev }; delete n[m.sourceField]; return n; });
                          setSuggestions(prev => { const n = { ...prev }; delete n[m.sourceField]; return n; });
                        }}
                        options={[
                          { value: '', label: '(skip)' },
                          ...targetableFields.map(f => ({ value: f.name, label: f.label, sublabel: f.name })),
                        ]}
                      />
                      {!m.targetField && suggestions[m.sourceField] ? (
                        <button
                          class="wl-pill wl-pill--warning"
                          style="margin-top:4px;padding:1px 8px;font-size:11px;cursor:pointer;border:none"
                          title="Apply this suggested mapping"
                          onClick={() => {
                            const s = suggestions[m.sourceField];
                            const field = targetableFields.find(f => f.name === s.target);
                            setMappings(prev => prev.map((p, i) => i === idx ? {
                              ...p,
                              targetField: s.target,
                              required: field?.required ?? false,
                              lookup: field?.type === 'reference' ? { mode: 'id' } : undefined,
                            } : p));
                            setSuggestions(prev => { const n = { ...prev }; delete n[m.sourceField]; return n; });
                          }}
                        >
                          Suggest: {suggestions[m.sourceField].label} ↵
                        </button>
                      ) : null}
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
                    <td>
                      <select
                        class="wl-select"
                        aria-label={`Blank-cell behavior for ${m.sourceField}`}
                        value={m.blankBehavior ?? 'ignore'}
                        onChange={(event) => {
                          const blankBehavior = (event.currentTarget as HTMLSelectElement).value as 'ignore' | 'clear';
                          setMappings(prev => prev.map((item, i) => i === idx ? { ...item, blankBehavior } : item));
                        }}
                      >
                        <option value="ignore">Ignore blank</option>
                        <option value="clear">Clear field</option>
                      </select>
                    </td>
                    <td>
                      {(() => {
                        const field = targetableFields.find(candidate => candidate.name === m.targetField);
                        if (field?.type !== 'reference') return <span class="wl-muted">Not a reference</span>;
                        const mode = m.lookup?.mode ?? 'id';
                        const relationshipName = m.lookup?.relationshipName ?? relationshipNameFor(field);
                        return <div style="display:flex;flex-direction:column;gap:4px;min-width:180px">
                          <select
                            class="wl-select"
                            aria-label={`Lookup mode for ${m.sourceField}`}
                            value={mode}
                            onChange={(event) => {
                              const nextMode = (event.currentTarget as HTMLSelectElement).value as NonNullable<FieldMapping['lookup']>['mode'];
                              setMappings(prev => prev.map((item, i) => i === idx ? {
                                ...item,
                                lookup: nextMode === 'id'
                                  ? { mode: 'id' }
                                  : { mode: nextMode, relationshipName, matchField: item.lookup?.matchField ?? '' },
                              } : item));
                            }}
                          >
                            <option value="id">Salesforce ID</option>
                            <option value="externalId">External ID</option>
                            <option value="relatedField">Related-record field</option>
                          </select>
                          {mode !== 'id' ? <>
                            <input
                              class="wl-input"
                              aria-label={`Relationship API name for ${m.sourceField}`}
                              value={relationshipName}
                              placeholder="Account or Parent__r"
                              onInput={(event) => setMappings(prev => prev.map((item, i) => i === idx ? {
                                ...item, lookup: { ...item.lookup!, relationshipName: (event.currentTarget as HTMLInputElement).value },
                              } : item))}
                            />
                            <input
                              class="wl-input"
                              aria-label={`Related match field for ${m.sourceField}`}
                              value={m.lookup?.matchField ?? ''}
                              placeholder={mode === 'externalId' ? 'External_Key__c' : 'Name'}
                              onInput={(event) => setMappings(prev => prev.map((item, i) => i === idx ? {
                                ...item, lookup: { ...item.lookup!, relationshipName, matchField: (event.currentTarget as HTMLInputElement).value },
                              } : item))}
                            />
                          </> : null}
                        </div>;
                      })()}
                    </td>
                    <td style="text-align:center">{m.required ? 'Yes' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="wl-row">
            <DropZone accept={['.csv', '.tsv', '.json', '.xlsx', '.xml']} onDrop={onFileSelected}>
              <div style="text-align:center;padding:20px">
                <div style="margin-bottom:12px;color:var(--wl-brand)"><Icon name="folder" size={40} /></div>
                <div style="font-weight:900;font-size:14px;margin-bottom:6px">Drag and drop CSV, JSON, Excel, or XML</div>
                <div class="wl-muted">Or click to browse files</div>
              </div>
            </DropZone>
          </div>
        )}
      </div>

      {stage === 'configure' ? (
        <div class="wl-stageActions">
          <button class="wl-buttonText" onClick={() => moveToStage('upload')}>Back</button>
          <button class="wl-buttonBrand" disabled={!hasDataset || !objectName || isBlocked} onClick={() => moveToStage('mapping')}>
            Continue to mapping
          </button>
        </div>
      ) : null}

      {stage === 'mapping' ? (
        <div class="wl-stageActions">
          <button class="wl-buttonText" onClick={() => moveToStage('configure')}>Back</button>
          <button class="wl-buttonBrand" disabled={!hasDataset || !describeFields || isBlocked} onClick={applyMapping}>
            Apply mapping and continue
          </button>
        </div>
      ) : null}

      {stage === 'validate' ? (
        <div class="wl-card">
          <div class="wl-cardHeader"><h2>Clean and validate</h2></div>
          <div class="wl-cardSection">
            <p class="wl-muted">Check mapped values against the target schema before any Salesforce write begins.</p>
            <div class="wl-actions" style="margin-top:12px">
              <button class="wl-buttonNeutral" onClick={props.onRequestCleanser}>Open cleaning tools</button>
              <button class="wl-buttonNeutral" onClick={runDryRun} disabled={!mappedRecords || !describeFields || isBlocked}>Run dry run</button>
              <button class="wl-buttonBrand" onClick={validate} disabled={!mappedRecords || !describeFields || isBlocked}>Validate and review</button>
            </div>
          </div>
          <div class="wl-stageActions">
            <button class="wl-buttonText" onClick={() => moveToStage('mapping')}>Back to mapping</button>
          </div>
        </div>
      ) : null}

      {stage === 'review' ? (
        <div class="wl-card">
          <div class="wl-cardHeader"><h2>Review impact</h2></div>
          <div class="wl-cardSection">
            {props.context?.environment === 'production' ? (
              <div class="wl-bannerWarning" style="margin-bottom:12px">
                Production org: this operation can change live Salesforce data. Confirm the target, operation, and record count below.
              </div>
            ) : null}
            <div class="wl-reviewGrid">
              <div><span>Target object</span><strong>{objectName}</strong></div>
              <div><span>Operation</span><strong>{operation.toUpperCase()}</strong></div>
              <div><span>Records</span><strong>{mappedRecords?.length.toLocaleString() ?? 0}</strong></div>
              <div><span>API mode</span><strong>{hasRelationshipLookups ? 'REST (relationship-safe)' : strategy === 'auto' ? 'Automatic' : strategy.toUpperCase()}</strong></div>
              <div><span>Validation</span><strong>{validationErrors === null ? 'Not run' : validationErrors.length === 0 ? 'Passed' : `${validationErrors.length} errors`}</strong></div>
              <div><span>Dry run</span><strong>{dryRun ? `${dryRun.ok}/${dryRun.total} rows pass` : 'Not run'}</strong></div>
              <div><span>Blank cells</span><strong>{mappings.some(mapping => mapping.blankBehavior === 'clear') ? 'Per-field ignore / clear' : 'Ignore (no field change)'}</strong></div>
              <div><span>References</span><strong>{mappings.filter(mapping => mapping.lookup && mapping.lookup.mode !== 'id').length} relationship lookups</strong></div>
              <div><span>Likely API usage</span><strong>{likelyApiUsage}</strong></div>
            </div>
          </div>
          <div class="wl-stageActions">
            <button class="wl-buttonText" onClick={() => moveToStage('validate')}>Back to validation</button>
            <button
              class="wl-buttonBrand"
              onClick={() => setConfirmOpen(true)}
              disabled={!mappedRecords || isBlocked || validationErrors === null || validationErrors.length > 0 || busy}
            >
              Review confirmation
            </button>
          </div>
        </div>
      ) : null}

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
                  <button class="wl-buttonNeutral" disabled={busy} onClick={() => downloadOutcome('success')}>Download success file</button>
                  {push.failed > 0 ? <button class="wl-buttonNeutral" disabled={busy} onClick={() => downloadOutcome('error')}>Download error file</button> : null}
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

      {confirmationPhrase ? (
        <TypedConfirmModal
          open={confirmOpen}
          title={operation === 'delete' ? 'Confirm Delete Operation' : 'Confirm Production Data Push'}
          confirmationPhrase={confirmationPhrase}
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
            if (operation === 'upsert' && !externalIdField) {
              setToast({ title: 'Blocked', body: 'Select an external ID field for upsert.' });
              return;
            }

            setBusy(true);
            try {
              const useBulkApi = hasRelationshipLookups ? false : strategy === 'auto' ? undefined : strategy === 'bulk';
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
          {operation === 'delete' ? (
            <div style="font-size:14px;margin-bottom:16px">
              <div style="font-weight:900;margin-bottom:8px;color:var(--wl-danger)">Warning: Permanent deletion</div>
              <div class="wl-muted">
                You are about to <strong>permanently delete {mappedRecords ? mappedRecords.length : 0} records</strong> from <strong>{objectName}</strong> in Salesforce. This action cannot be undone.
              </div>
            </div>
          ) : (
            <div class="wl-bannerWarning" style="margin-bottom:16px">
              Production guard: verify the target, operation, and record count, then type the exact phrase below before WaveLink can write.
            </div>
          )}
          <div class="wl-chipRow">
            <span class="wl-chip"><span style="font-weight:900">Object:</span> {objectName}</span>
            <span class="wl-chip"><span style="font-weight:900">Op:</span> {operation}</span>
            <span class="wl-chip"><span style="font-weight:900">Records:</span> {mappedRecords ? mappedRecords.length : 0}</span>
            <span class="wl-chip"><span style="font-weight:900">Strategy:</span> {strategy.toUpperCase()}</span>
            <span class="wl-chip"><span style="font-weight:900">Batch:</span> {clampBatchSize(batchSize)}</span>
            <span class="wl-chip"><span style="font-weight:900">Threads:</span> {clampThreads(threads)}</span>
          </div>
          {operation === 'delete' ? (
            <div class="wl-muted" style="margin-top:8px">Delete safety: the first dataset column header must be "Id".</div>
          ) : null}
          {operation === 'upsert' ? (
            <div class="wl-muted">Upsert requires an External ID field; upsert requests are sent in batches of 25.</div>
          ) : null}
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
              const useBulkApi = hasRelationshipLookups ? false : strategy === 'auto' ? undefined : strategy === 'bulk';
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
          {hasRelationshipLookups ? (
            <div class="wl-muted">Relationship lookups use REST so nested relationship values are preserved; a Bulk selection is overridden for this run.</div>
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
        <label htmlFor="load-push-template" style="font-weight:900;font-size:12px">Template</label>
        <select
          id="load-push-template"
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
