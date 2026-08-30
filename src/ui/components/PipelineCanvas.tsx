/**
 * Vertical flow canvas for pipeline steps with drag-to-reorder.
 *
 * What this file does:
 * - Renders each pipeline step as a card with a type badge, label, and drag handle.
 * - Connector lines between steps create a visual flow.
 * - Uses `useDragList` from dragDrop for HTML5 drag reordering.
 * - Highlights the active/selected step.
 *
 * Why:
 * - Visual pipeline representation with drag reorder gives users an intuitive editing experience.
 *
 * Complexity:
 * - Rendering is O(S) where S = number of steps.
 * - Drag reorder is O(S) per operation (handled by useDragList).
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { PipelineStep } from '../utils/pipelineExecutor';
import { useDragList } from '../utils/dragDrop';

export interface DebugStepState {
  status: 'pending' | 'done' | 'error' | 'current';
  recordsOut?: number;
}

export interface PipelineCanvasProps {
  steps: PipelineStep[];
  selectedStepId: string | null;
  onSelectStep: (id: string) => void;
  onReorder: (steps: PipelineStep[]) => void;
  /** Optional debug state per step (keyed by step index). */
  debugStates?: Map<number, DebugStepState>;
}

/** Map step types to display badges. O(1). */
const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  filter: { label: 'FLT', color: 'var(--wl-accent)' },
  transform: { label: 'TFM', color: '#4caf50' },
  lookup: { label: 'LKP', color: '#ff9800' },
  aggregate: { label: 'AGG', color: '#9c27b0' },
  join: { label: 'JON', color: '#e91e63' },
};

/**
 * PipelineCanvas renders a vertical flow of pipeline step cards.
 * O(S) where S = number of steps.
 */
export function PipelineCanvas(props: PipelineCanvasProps): VNode {
  const { steps, selectedStepId, onSelectStep, onReorder, debugStates } = props;

  const { dragHandlers, dragOverIndex } = useDragList<PipelineStep>({
    items: steps,
    onReorder,
    getDragId: (step) => step.id,
  });

  if (steps.length === 0) {
    return (
      <div class="wl-canvas" style="justify-content:center">
        <div class="wl-muted" style="text-align:center;padding:40px 0">
          No steps yet. Add a step from the library on the left.
        </div>
      </div>
    );
  }

  return (
    <div class="wl-canvas">
      {steps.map((step, index) => {
        const badge = TYPE_BADGES[step.type] ?? { label: '???', color: 'var(--wl-ink-dim)' };
        const isSelected = step.id === selectedStepId;
        const isDragOver = dragOverIndex === index;
        const handlers = dragHandlers(index);
        const dbg = debugStates?.get(index);

        let debugAttr: string | undefined;
        if (dbg?.status === 'done') debugAttr = 'done';
        else if (dbg?.status === 'error') debugAttr = 'error';
        else if (dbg?.status === 'current') debugAttr = 'current';

        return (
          <div key={step.id}>
            {/* Connector line (not shown before first step) */}
            {index > 0 && (
              <div class="wl-stepConnector" />
            )}

            {/* Drop indicator */}
            {isDragOver && (
              <div class="wl-dropIndicator" />
            )}

            {/* Step card */}
            <div
              class="wl-pipelineStep"
              role="button"
              tabIndex={0}
              data-active={isSelected ? 'true' : undefined}
              data-debug={debugAttr}
              onClick={() => onSelectStep(step.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectStep(step.id);
                }
              }}
              {...handlers}
            >
              <div style="display:flex;align-items:center;gap:8px">
                {/* Drag handle */}
                <span class="wl-dragHandle" title="Drag to reorder">
                  &#8942;&#8942;
                </span>

                {/* Type badge */}
                <span
                  class="wl-badge"
                  style={`border-color:${badge.color};color:${badge.color};font-size:10px;padding:2px 6px`}
                >
                  {badge.label}
                </span>

                {/* Label */}
                <span style="font-weight:700;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">
                  {step.label || `${step.type} step`}
                </span>

                {/* Debug record count */}
                {dbg && dbg.recordsOut !== undefined && !dbg.status.includes('error') && (
                  <span class="wl-muted" style="font-size:10px;flex-shrink:0">
                    {dbg.recordsOut} rec
                  </span>
                )}

                {/* Step number */}
                <span class="wl-muted" style="font-size:10px;flex-shrink:0">
                  #{index + 1}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
