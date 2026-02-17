/**
 * Table showing records in a duplicate group with per-field radio selectors.
 *
 * What this file does:
 * - Renders all records in a duplicate group side-by-side as columns.
 * - Each field row has radio buttons to select which record's value to use for merging.
 * - The master record column is visually highlighted.
 *
 * Why:
 * - Lets users make granular, field-level merge decisions when resolving duplicates.
 *
 * Complexity:
 * - Rendering is O(F * R) where F=fields and R=records in the group.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { DuplicateGroup } from '../utils/duplicateDetection';

export interface DuplicateGroupViewProps {
  records: Record<string, unknown>[];
  group: DuplicateGroup;
  fields: string[];
  resolutions: Record<string, 'master' | number>;
  onResolutionChange: (field: string, source: 'master' | number) => void;
}

/**
 * Build the list of record indexes present in a group (master + duplicates). O(D).
 */
function getGroupIndexes(group: DuplicateGroup): number[] {
  return [group.masterIndex, ...group.duplicateIndexes];
}

/**
 * Format a cell value for display. O(1).
 */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * DuplicateGroupView renders a comparison table for a single duplicate group.
 * O(F * R) where F = fields.length and R = records in the group.
 */
export function DuplicateGroupView(props: DuplicateGroupViewProps): VNode {
  const { records, group, fields, resolutions, onResolutionChange } = props;
  const indexes = getGroupIndexes(group);

  return (
    <div class="wl-dupGroup">
      <div class="wl-tableWrap">
        <table class="wl-dupGroupTable">
          <thead>
            <tr>
              <th style="padding:4px 8px;border-bottom:1px solid var(--wl-line-2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">
                Field
              </th>
              {indexes.map((idx) => (
                <th
                  key={idx}
                  class={idx === group.masterIndex ? 'wl-dupMasterRow' : ''}
                  style="padding:4px 8px;border-bottom:1px solid var(--wl-line-2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)"
                >
                  {idx === group.masterIndex ? 'Master' : `Record #${idx}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field}>
                <td style="font-weight:700;font-family:var(--wl-font-mono);font-size:12px;padding:4px 8px;border-bottom:1px solid var(--wl-line-2)">
                  {field}
                </td>
                {indexes.map((idx) => {
                  const isMaster = idx === group.masterIndex;
                  const source: 'master' | number = isMaster ? 'master' : idx;
                  const isSelected = resolutions[field] === source ||
                    (resolutions[field] === undefined && isMaster);

                  return (
                    <td
                      key={idx}
                      class={isMaster ? 'wl-dupMasterRow' : ''}
                      style="padding:4px 8px;border-bottom:1px solid var(--wl-line-2)"
                    >
                      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px">
                        <input
                          type="radio"
                          name={`dup-${group.masterIndex}-${field}`}
                          checked={isSelected}
                          onChange={() => onResolutionChange(field, source)}
                          style="accent-color:var(--wl-accent)"
                        />
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px" title={formatCell(records[idx]?.[field])}>
                          {formatCell(records[idx]?.[field])}
                        </span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="wl-muted" style="padding:6px 8px 0">
        Score: {group.score.toFixed(2)} | Master index: {group.masterIndex} | Duplicates: {group.duplicateIndexes.length}
      </div>
    </div>
  );
}
