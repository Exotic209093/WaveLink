/**
 * Configuration component for lookup relationship fields.
 *
 * Provides a textarea for entering lookup record IDs (one per line)
 * and displays the count of loaded IDs with an explanation of
 * round-robin assignment behaviour.
 *
 * Complexity: O(L) where L is the number of lines in the textarea.
 */

import { h } from 'preact';
import type { VNode } from 'preact';

export interface RelationshipConfigProps {
  fieldName: string;
  lookupValues: string[];
  onChange: (values: string[]) => void;
}

/** Render a relationship field config block. O(L) for line parsing. */
export function RelationshipConfig(props: RelationshipConfigProps): VNode {
  const { fieldName, lookupValues, onChange } = props;

  /** Parse textarea content into trimmed, non-empty lines. O(L). */
  function handleInput(e: Event): void {
    const raw = (e.currentTarget as HTMLTextAreaElement).value;
    const values = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    onChange(values);
  }

  return (
    <div style="display:flex;flex-direction:column;gap:6px;padding:8px 0">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="wl-mono" style="font-weight:700;font-size:13px">{fieldName}</span>
        <span class="wl-badge" style="font-size:10px">reference</span>
        <span class="wl-chip" style="font-size:11px">
          {lookupValues.length} ID{lookupValues.length !== 1 ? 's' : ''} loaded
        </span>
      </div>

      <textarea
        class="wl-textarea"
        style="min-height:80px;font-size:12px"
        placeholder={"Enter lookup record IDs (one per line):\n001xx000003abc1\n001xx000003abc2\n001xx000003abc3"}
        value={lookupValues.join('\n')}
        onInput={handleInput}
      />

      <div class="wl-muted" style="font-size:11px">
        IDs are assigned to generated records using round-robin: record 0 gets ID 0,
        record 1 gets ID 1, and so on, cycling back to the start when all IDs have been used.
        This ensures an even distribution across lookup targets.
      </div>
    </div>
  );
}
