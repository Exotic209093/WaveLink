/**
 * Bulk action bar for the cleanser column list.
 *
 * What this file does:
 * - Applies the same action (transform/drop/reset/rename affix) to many selected columns.
 *
 * Complexity: O(1) render; parent applies changes across selected columns (typically O(S)).
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { TransformationType } from '../../../core/types/storage';
import { TRANSFORM_OPTIONS } from '../../utils/transforms';

export function BulkActions(props: {
  selectedCount: number;
  filteredCount: number;
  onSetTransform: (t: TransformationType) => void;
  onDrop: (drop: boolean) => void;
  onReset: () => void;
  onRenameAffix: (prefix: string, suffix: string) => void;
}): VNode {
  const { selectedCount, filteredCount, onSetTransform, onDrop, onReset, onRenameAffix } = props;
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');

  return (
    <div class="wl-bulkBar">
      <div style="font-weight:900">{selectedCount} selected</div>
      <div class="wl-muted">({filteredCount} filtered)</div>
      <div style="flex:1" />

      <select class="wl-select" style="max-width:220px" onChange={(e) => onSetTransform((e.currentTarget as HTMLSelectElement).value as TransformationType)}>
        <option value="">Set transform...</option>
        {TRANSFORM_OPTIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>

      <button class="wl-btn" onClick={() => onDrop(true)}>Drop</button>
      <button class="wl-btn" onClick={() => onDrop(false)}>Undrop</button>
      <button class="wl-btn wl-btnDanger" onClick={onReset}>Reset</button>

      <input
        class="wl-input"
        style="max-width:140px"
        placeholder="Prefix"
        value={prefix}
        onInput={(e) => setPrefix((e.currentTarget as HTMLInputElement).value)}
      />
      <input
        class="wl-input"
        style="max-width:140px"
        placeholder="Suffix"
        value={suffix}
        onInput={(e) => setSuffix((e.currentTarget as HTMLInputElement).value)}
      />
      <button class="wl-btn" onClick={() => onRenameAffix(prefix, suffix)}>Rename</button>
    </div>
  );
}
