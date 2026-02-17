/**
 * Step-by-step pipeline debugger with intermediate data preview.
 *
 * What this file does:
 * - Executes pipeline steps one at a time, pausing between each.
 * - Shows intermediate data preview (first 10 rows) after each step.
 * - Displays step metadata: records in → records out, duration.
 * - Highlights errors and allows re-running from the failed step.
 *
 * Complexity: O(N) per step execution; O(10) for preview rendering.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import type { PipelineStep } from '../utils/pipelineExecutor';
import { executeStep } from '../utils/pipelineExecutor';

export interface StepDebugResult {
  stepId: string;
  stepIndex: number;
  recordsIn: number;
  recordsOut: number;
  durationMs: number;
  error: string | null;
  output: Record<string, unknown>[];
}

export interface PipelineDebuggerProps {
  steps: PipelineStep[];
  inputRecords: Record<string, unknown>[];
  onClose: () => void;
  onStepResultsChange?: (results: StepDebugResult[]) => void;
}

/**
 * PipelineDebugger provides step-by-step pipeline execution with intermediate previews.
 */
export function PipelineDebugger(props: PipelineDebuggerProps): VNode {
  const { steps, inputRecords, onClose, onStepResultsChange } = props;

  const [stepResults, setStepResultsRaw] = useState<StepDebugResult[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [selectedPreview, setSelectedPreview] = useState<number>(-1);

  /** Update stepResults and notify parent. */
  function setStepResults(updater: StepDebugResult[] | ((prev: StepDebugResult[]) => StepDebugResult[])): void {
    setStepResultsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onStepResultsChange?.(next);
      return next;
    });
  }

  /** Whether all steps have been executed (or an error occurred). */
  const isComplete = stepResults.length > 0 && (
    stepResults.length === steps.length ||
    stepResults[stepResults.length - 1]?.error !== null
  );

  const hasError = stepResults.length > 0 && stepResults[stepResults.length - 1]?.error !== null;

  /** The preview data to display: selected step output or input. */
  const previewData = useMemo(() => {
    if (selectedPreview === -1) return inputRecords.slice(0, 10);
    const result = stepResults[selectedPreview];
    if (!result) return [];
    return result.output.slice(0, 10);
  }, [selectedPreview, stepResults, inputRecords]);

  /** Preview headers derived from previewData. */
  const previewHeaders = useMemo(() => {
    if (previewData.length === 0) return [];
    const keys = new Set<string>();
    for (const r of previewData) {
      for (const k of Object.keys(r)) keys.add(k);
    }
    return Array.from(keys);
  }, [previewData]);

  /** The record count label for the selected preview. */
  const previewTotalCount = useMemo(() => {
    if (selectedPreview === -1) return inputRecords.length;
    const result = stepResults[selectedPreview];
    return result?.output.length ?? 0;
  }, [selectedPreview, stepResults, inputRecords]);

  /** Execute the next step. O(N). */
  function executeNextStep(): void {
    const nextIndex = stepResults.length;
    if (nextIndex >= steps.length) return;

    const step = steps[nextIndex];
    const input = nextIndex === 0
      ? inputRecords
      : stepResults[nextIndex - 1].output;

    setCurrentStepIndex(nextIndex);

    const start = performance.now();
    try {
      const output = executeStep(input, step);
      const durationMs = Math.round(performance.now() - start);

      const result: StepDebugResult = {
        stepId: step.id,
        stepIndex: nextIndex,
        recordsIn: input.length,
        recordsOut: output.length,
        durationMs,
        error: null,
        output,
      };

      setStepResults((prev) => [...prev, result]);
      setSelectedPreview(nextIndex);
      setCurrentStepIndex(nextIndex);
    } catch (e) {
      const durationMs = Math.round(performance.now() - start);
      const result: StepDebugResult = {
        stepId: step.id,
        stepIndex: nextIndex,
        recordsIn: input.length,
        recordsOut: 0,
        durationMs,
        error: e instanceof Error ? e.message : 'Unknown error',
        output: [],
      };

      setStepResults((prev) => [...prev, result]);
      setSelectedPreview(nextIndex);
      setCurrentStepIndex(nextIndex);
    }
  }

  /** Run all remaining steps. O(S * N). */
  function runAll(): void {
    let nextIndex = stepResults.length;
    const results = [...stepResults];

    while (nextIndex < steps.length) {
      const step = steps[nextIndex];
      const input = nextIndex === 0
        ? inputRecords
        : results[nextIndex - 1].output;

      const start = performance.now();
      try {
        const output = executeStep(input, step);
        const durationMs = Math.round(performance.now() - start);
        results.push({
          stepId: step.id,
          stepIndex: nextIndex,
          recordsIn: input.length,
          recordsOut: output.length,
          durationMs,
          error: null,
          output,
        });
      } catch (e) {
        const durationMs = Math.round(performance.now() - start);
        results.push({
          stepId: step.id,
          stepIndex: nextIndex,
          recordsIn: input.length,
          recordsOut: 0,
          durationMs,
          error: e instanceof Error ? e.message : 'Unknown error',
          output: [],
        });
        break;
      }
      nextIndex++;
    }

    setStepResults(results);
    setCurrentStepIndex(results.length - 1);
    setSelectedPreview(results.length - 1);
  }

  /** Reset debug state. O(1). */
  function reset(): void {
    setStepResults([]);
    setCurrentStepIndex(-1);
    setSelectedPreview(-1);
  }

  return (
    <div class="wl-card" style="border:2px solid var(--wl-accent)">
      <div class="wl-cardHeader">
        <h2>Pipeline Debugger</h2>
        <div class="wl-actions">
          <button
            class="wl-btn wl-btnPrimary"
            onClick={executeNextStep}
            disabled={isComplete}
          >
            Next Step
          </button>
          <button
            class="wl-btn"
            onClick={runAll}
            disabled={isComplete}
          >
            Run All
          </button>
          <button class="wl-btn" onClick={reset}>
            Reset
          </button>
          <button class="wl-btn" onClick={onClose}>
            Close Debugger
          </button>
        </div>
      </div>

      {/* Step progress timeline */}
      <div class="wl-debugTimeline">
        {/* Input chip */}
        <div
          class={`wl-debugStep${selectedPreview === -1 ? ' wl-debugStepActive' : ''}`}
          onClick={() => setSelectedPreview(-1)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPreview(-1); } }}
        >
          <div class="wl-debugStepHeader">
            <span class="wl-debugStepBadge" style="background:var(--wl-accent);color:#fff">IN</span>
            <span style="font-weight:700;font-size:12px">Input</span>
          </div>
          <div class="wl-debugStepMeta">
            <span>{inputRecords.length} records</span>
          </div>
        </div>

        {steps.map((step, i) => {
          const result = stepResults[i];
          const isExecuted = !!result;
          const isCurrent = i === currentStepIndex;
          const isError = result?.error !== null && result?.error !== undefined;
          const isPending = !isExecuted && !isCurrent;

          let statusClass = '';
          if (isError) statusClass = ' wl-debugStepError';
          else if (isExecuted) statusClass = ' wl-debugStepDone';
          else if (isCurrent && !isExecuted) statusClass = ' wl-debugStepCurrent';

          return (
            <div key={step.id}>
              <div class="wl-debugConnector" />
              <div
                class={`wl-debugStep${statusClass}${selectedPreview === i ? ' wl-debugStepActive' : ''}`}
                onClick={() => { if (isExecuted) setSelectedPreview(i); }}
                role="button"
                tabIndex={isExecuted ? 0 : -1}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && isExecuted) { e.preventDefault(); setSelectedPreview(i); } }}
                style={isPending ? 'opacity:0.45;cursor:default' : undefined}
              >
                <div class="wl-debugStepHeader">
                  <span class="wl-debugStepBadge" style={
                    isError ? 'background:var(--wl-danger);color:#fff'
                    : isExecuted ? 'background:#66bb6a;color:#fff'
                    : 'background:var(--wl-line);color:var(--wl-ink-dim)'
                  }>
                    {isError ? '!' : isExecuted ? '\u2713' : `${i + 1}`}
                  </span>
                  <span style="font-weight:700;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">
                    {step.label || `${step.type} step`}
                  </span>
                  <span class="wl-muted" style="font-size:10px;flex-shrink:0">{step.type.toUpperCase()}</span>
                </div>
                {isExecuted && (
                  <div class="wl-debugStepMeta">
                    {isError ? (
                      <span style="color:var(--wl-danger);font-size:11px">{result.error}</span>
                    ) : (
                      <>
                        <span>{result.recordsIn} \u2192 {result.recordsOut}</span>
                        <span class="wl-muted">{result.durationMs}ms</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary chips */}
      {stepResults.length > 0 && (
        <div class="wl-row" style="padding:0 14px">
          <div class="wl-chipRow">
            <span class="wl-chip">
              <span>Steps Run</span>
              <strong>{stepResults.filter(r => !r.error).length}/{steps.length}</strong>
            </span>
            <span class="wl-chip">
              <span>Total Time</span>
              <strong>{stepResults.reduce((sum, r) => sum + r.durationMs, 0)}ms</strong>
            </span>
            {hasError && (
              <span class="wl-chip" style="border-color:var(--wl-danger)">
                <span style="color:var(--wl-danger)">Error at Step {stepResults.length}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Preview table */}
      <div style="padding:0 14px 14px">
        <div class="wl-muted" style="margin-bottom:6px;font-size:12px">
          {selectedPreview === -1
            ? `Input Data (${previewTotalCount} total, showing first ${Math.min(10, previewTotalCount)})`
            : `Step ${selectedPreview + 1} Output (${previewTotalCount} total, showing first ${Math.min(10, previewTotalCount)})`}
        </div>
        {previewData.length > 0 ? (
          <div class="wl-tableWrap" style="max-height:260px">
            <table class="wl-table">
              <thead>
                <tr>
                  {previewHeaders.map((col) => (
                    <th key={col} style="min-width:80px;max-width:200px">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, ri) => (
                  <tr key={ri}>
                    {previewHeaders.map((col) => (
                      <td key={col} style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                        {row[col] === null || row[col] === undefined ? '' : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="wl-muted" style="padding:20px;text-align:center">
            {selectedPreview === -1 ? 'No input records.' : 'No output records from this step.'}
          </div>
        )}
      </div>
    </div>
  );
}
