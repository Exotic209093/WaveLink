/**
 * Pipeline builder full screen with 3-column layout.
 *
 * What this file does:
 * - 3-column layout: StepLibrary (left) | PipelineCanvas (center) | StepConfigPanel (right).
 * - Manages pipeline step state, selection, reordering, and configuration.
 * - Run Preview executes the pipeline on the input dataset and shows a preview table.
 * - Save/Load pipelines via SfApi (listPipelines, upsertPipeline, deletePipeline).
 * - "Send to Push" option for transformed output.
 *
 * Why:
 * - Visual pipeline building makes complex transformations accessible without code.
 *
 * Complexity:
 * - Pipeline execution is O(S * N) where S = steps, N = records.
 * - Rendering is O(S + R) where R = preview row count (capped at 10).
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { PipelineStep, StepType } from '../utils/pipelineExecutor';
import { executePipeline } from '../utils/pipelineExecutor';
import type { Pipeline } from '../../core/types/storage';
import { StepLibrary } from '../components/StepLibrary';
import { PipelineCanvas } from '../components/PipelineCanvas';
import type { DebugStepState } from '../components/PipelineCanvas';
import { StepConfigPanel } from '../components/StepConfigPanel';
import { PipelineDebugger } from '../components/PipelineDebugger';
import type { StepDebugResult } from '../components/PipelineDebugger';
import { Toast } from '../components/Toast';
import { TypedConfirmModal } from '../components/TypedConfirmModal';

export interface PipelineBuilderScreenProps {
  sf: SfApi;
  tabId?: number;
  dataset?: { records: Record<string, unknown>[]; headers: string[] } | null;
}

/** Generate a unique step ID. O(1). */
function makeStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique pipeline ID. O(1). */
function makePipelineId(): string {
  return `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a default step config for a given type. O(1). */
function defaultConfig(type: StepType): Record<string, unknown> {
  switch (type) {
    case 'filter':
      return { field: '', operator: 'eq', value: '' };
    case 'transform':
      return { field: '', expression: '' };
    case 'lookup':
      return { lookupField: '', lookupKey: '', outputField: '', lookupTable: [], _lookupTableJson: '[]' };
    case 'aggregate':
      return { groupBy: [], aggregations: [] };
    case 'join':
      return { joinField: '', rightJoinField: '', joinType: 'inner', rightRecords: [], _rightRecordsJson: '[]' };
    default:
      return {};
  }
}

/**
 * PipelineBuilderScreen provides the full pipeline editing and execution experience.
 * O(S * N) for pipeline execution; O(S) for rendering.
 */
export function PipelineBuilderScreen(props: PipelineBuilderScreenProps): VNode {
  const { sf, dataset } = props;

  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // Preview state
  const [previewResult, setPreviewResult] = useState<Record<string, unknown>[] | null>(null);

  // Save/Load state
  const [savedPipelines, setSavedPipelines] = useState<Pipeline[]>([]);
  const [pipelineName, setPipelineName] = useState('');
  const [loadedPipelineId, setLoadedPipelineId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Debug mode
  const [debugMode, setDebugMode] = useState(false);
  const [debugResults, setDebugResults] = useState<StepDebugResult[]>([]);

  // UI
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  // Load saved pipelines on mount. O(1) JS + network.
  useEffect(() => {
    sf.listPipelines()
      .then((p) => setSavedPipelines(p))
      .catch(() => {
        // Ignore load failures
      });
  }, [sf]);

  /** The currently selected step. O(S). */
  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  );

  /** Preview headers derived from preview results. O(C). */
  const previewHeaders = useMemo(() => {
    if (!previewResult || previewResult.length === 0) return [];
    const keys = new Set<string>();
    for (const r of previewResult.slice(0, 10)) {
      for (const k of Object.keys(r)) keys.add(k);
    }
    return Array.from(keys);
  }, [previewResult]);

  /** Preview rows (capped at 10). O(1). */
  const previewRows = useMemo(
    () => (previewResult ?? []).slice(0, 10),
    [previewResult],
  );

  /** Build debug states map for canvas highlighting. O(S). */
  const canvasDebugStates = useMemo(() => {
    if (!debugMode || debugResults.length === 0) return undefined;
    const map = new Map<number, DebugStepState>();
    for (const r of debugResults) {
      map.set(r.stepIndex, {
        status: r.error ? 'error' : 'done',
        recordsOut: r.recordsOut,
      });
    }
    // Mark next unexecuted step as current if no error
    const lastResult = debugResults[debugResults.length - 1];
    if (!lastResult.error && debugResults.length < steps.length) {
      map.set(debugResults.length, { status: 'current' });
    }
    return map;
  }, [debugMode, debugResults, steps.length]);

  /** Add a step from the library. O(1). */
  function handleAddStep(type: StepType): void {
    const newStep: PipelineStep = {
      id: makeStepId(),
      type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
      config: defaultConfig(type),
    };
    setSteps((prev) => [...prev, newStep]);
    setSelectedStepId(newStep.id);
    setPreviewResult(null);
  }

  /** Update a step. O(S). */
  function handleStepChange(updated: PipelineStep): void {
    setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setPreviewResult(null);
  }

  /** Remove the selected step. O(S). */
  function handleRemoveStep(): void {
    if (!selectedStepId) return;
    setSteps((prev) => prev.filter((s) => s.id !== selectedStepId));
    setSelectedStepId(null);
    setPreviewResult(null);
  }

  /** Reorder steps via drag. O(S). */
  function handleReorder(reordered: PipelineStep[]): void {
    setSteps(reordered);
    setPreviewResult(null);
  }

  /** Run preview: execute the pipeline on input dataset. O(S * N). */
  function runPreview(): void {
    if (!dataset || dataset.records.length === 0) {
      setToast({ title: 'No Dataset', body: 'Load a dataset before running the pipeline.' });
      return;
    }
    if (steps.length === 0) {
      setToast({ title: 'No Steps', body: 'Add at least one step to the pipeline.' });
      return;
    }

    try {
      const { result } = executePipeline(dataset.records, steps);
      setPreviewResult(result);
      setToast({ title: 'Preview Ready', body: `${result.length} records after pipeline.` });
    } catch (e) {
      setToast({ title: 'Pipeline Error', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  /** Save current pipeline. O(1) JS + network. */
  async function savePipeline(): Promise<void> {
    const name = pipelineName.trim() || `Pipeline ${Date.now()}`;
    const id = loadedPipelineId ?? makePipelineId();
    try {
      const saved = await sf.upsertPipeline({ id, name, steps });
      setLoadedPipelineId(saved.id);
      setPipelineName(saved.name);
      setSavedPipelines((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      setToast({ title: 'Saved', body: `Pipeline "${saved.name}" saved.` });
    } catch (e) {
      setToast({ title: 'Save Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  /** Load a saved pipeline. O(S). */
  function loadPipeline(id: string): void {
    const p = savedPipelines.find((pl) => pl.id === id);
    if (!p) return;
    setSteps(p.steps as PipelineStep[]);
    setSelectedStepId(null);
    setLoadedPipelineId(p.id);
    setPipelineName(p.name);
    setPreviewResult(null);
    setToast({ title: 'Loaded', body: `Pipeline "${p.name}" loaded.` });
  }

  /** Delete a saved pipeline. O(1) JS + network. */
  async function deletePipeline(id: string): Promise<void> {
    try {
      await sf.deletePipeline(id);
      setSavedPipelines((prev) => prev.filter((p) => p.id !== id));
      if (loadedPipelineId === id) {
        setLoadedPipelineId(null);
      }
      setToast({ title: 'Deleted', body: 'Pipeline removed.' });
    } catch (e) {
      setToast({ title: 'Delete Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      {/* Toolbar */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Pipeline Builder</h2>
          <div class="wl-actions">
            <button class="wl-btn wl-btnPrimary" onClick={runPreview} disabled={debugMode}>
              Run Preview
            </button>
            <button
              class={`wl-btn${debugMode ? ' wl-btnPrimary' : ''}`}
              onClick={() => { setDebugMode((v) => !v); setDebugResults([]); }}
              disabled={steps.length === 0}
            >
              {debugMode ? 'Exit Debug' : 'Debug'}
            </button>
            <button class="wl-btn" onClick={savePipeline}>
              Save
            </button>
          </div>
        </div>
        <div class="wl-row">
          <div class="wl-row2">
            <div>
              <div class="wl-muted" style="margin-bottom:4px">Pipeline Name</div>
              <input
                class="wl-input"
                value={pipelineName}
                placeholder="My Pipeline"
                onInput={(e) => setPipelineName((e.currentTarget as HTMLInputElement).value)}
              />
            </div>
            <div>
              <div class="wl-muted" style="margin-bottom:4px">Load Saved Pipeline</div>
              <div style="display:flex;gap:6px">
                <select
                  class="wl-select"
                  value={loadedPipelineId ?? ''}
                  onChange={(e) => {
                    const id = (e.currentTarget as HTMLSelectElement).value;
                    if (id) loadPipeline(id);
                  }}
                >
                  <option value="">Select pipeline...</option>
                  {savedPipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {loadedPipelineId && (
                  <button
                    class="wl-btn wl-btnDanger"
                    style="flex-shrink:0"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
          <div class="wl-chipRow">
            <span class="wl-chip">
              <span>Steps</span>
              <strong>{steps.length}</strong>
            </span>
            <span class="wl-chip">
              <span>Input Records</span>
              <strong>{dataset?.records.length ?? 0}</strong>
            </span>
            {previewResult && (
              <span class="wl-chip">
                <span>Output Records</span>
                <strong>{previewResult.length}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3-column layout */}
      <div class="wl-pipelineLayout">
        {/* Left: Step Library */}
        <StepLibrary onAddStep={handleAddStep} />

        {/* Center: Canvas */}
        <PipelineCanvas
          steps={steps}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          onReorder={handleReorder}
          debugStates={canvasDebugStates}
        />

        {/* Right: Config Panel */}
        {selectedStep ? (
          <StepConfigPanel
            step={selectedStep}
            onChange={handleStepChange}
            onRemove={handleRemoveStep}
          />
        ) : (
          <div class="wl-configPanel">
            <div class="wl-muted" style="padding:16px;text-align:center">
              Select a step to configure it.
            </div>
          </div>
        )}
      </div>

      {/* Debug panel */}
      {debugMode && dataset && dataset.records.length > 0 && (
        <PipelineDebugger
          steps={steps}
          inputRecords={dataset.records}
          onClose={() => { setDebugMode(false); setDebugResults([]); }}
          onStepResultsChange={setDebugResults}
        />
      )}

      {debugMode && (!dataset || dataset.records.length === 0) && (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-muted">Load a dataset before using the debugger.</div>
          </div>
        </div>
      )}

      {/* Preview table */}
      {!debugMode && previewRows.length > 0 && (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Preview (first 10 rows)</h2>
            <div class="wl-muted">{previewResult?.length ?? 0} total output records</div>
          </div>
          <div class="wl-tableWrap" style="max-height:320px">
            <table class="wl-table">
              <thead>
                <tr>
                  {previewHeaders.map((h_) => (
                    <th key={h_}>{h_}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri}>
                    {previewHeaders.map((h_) => (
                      <td key={h_} style="max-width:200px;overflow:hidden;text-overflow:ellipsis">
                        {row[h_] === null || row[h_] === undefined ? '' : String(row[h_])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Send to Push hint */}
      {!debugMode && previewResult && previewResult.length > 0 && (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-muted">
              Pipeline output ready with {previewResult.length} records. Navigate to Data Push to send these records to Salesforce.
            </div>
          </div>
        </div>
      )}

      <TypedConfirmModal
        open={deleteConfirmOpen}
        title="Delete Pipeline"
        confirmationPhrase="DELETE PIPELINE"
        busy={false}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          if (loadedPipelineId) {
            await deletePipeline(loadedPipelineId);
          }
          setDeleteConfirmOpen(false);
        }}
      >
        <div class="wl-muted">
          This will permanently delete the saved pipeline. This action cannot be undone.
        </div>
      </TypedConfirmModal>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
