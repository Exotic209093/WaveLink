/**
 * Vertical list of addable pipeline step types.
 *
 * What this file does:
 * - Displays a card for each pipeline step type (filter, transform, lookup, aggregate, join).
 * - Clicking a card invokes `onAddStep` with the selected type.
 *
 * Why:
 * - Provides a discoverable, one-click way to add pipeline steps in the Pipeline Builder.
 *
 * Complexity:
 * - Rendering is O(S) where S = number of step types (constant 5).
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { StepType } from '../utils/pipelineExecutor';

export interface StepLibraryProps {
  onAddStep: (type: StepType) => void;
}

/** Step type metadata for display. O(1). */
const STEP_TYPES: Array<{ type: StepType; label: string; icon: string; description: string }> = [
  { type: 'filter', label: 'Filter', icon: '\u2261', description: 'Remove records matching a condition' },
  { type: 'transform', label: 'Transform', icon: '\u21C4', description: 'Modify field values with expressions' },
  { type: 'lookup', label: 'Lookup', icon: '\u2197', description: 'Enrich records from a lookup table' },
  { type: 'aggregate', label: 'Aggregate', icon: '\u03A3', description: 'Group and summarize records' },
  { type: 'join', label: 'Join', icon: '\u22C8', description: 'Combine with another record set' },
];

/**
 * StepLibrary renders a vertical list of pipeline step type cards.
 * O(1) since the number of step types is constant.
 */
export function StepLibrary(props: StepLibraryProps): VNode {
  const { onAddStep } = props;

  return (
    <div class="wl-stepLibrary">
      <div style="font-weight:900;font-size:12px;color:var(--wl-ink-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
        Add Step
      </div>
      {STEP_TYPES.map((s) => (
        <div
          key={s.type}
          class="wl-stepLibCard"
          onClick={() => onAddStep(s.type)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAddStep(s.type);
            }
          }}
        >
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:16px;line-height:1">{s.icon}</span>
            <span style="font-weight:800;font-size:12px">{s.label}</span>
          </div>
          <div class="wl-muted" style="margin-top:2px;font-size:11px">
            {s.description}
          </div>
        </div>
      ))}
    </div>
  );
}
