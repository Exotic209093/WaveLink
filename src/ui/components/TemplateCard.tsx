/**
 * Card component for displaying a saved data template.
 *
 * Renders the template name, object badge, category, usage count,
 * last-used timestamp, and action buttons (Edit, Delete, Use).
 *
 * Complexity: O(1).
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { DataTemplate } from '../../core/types/storage';

export interface TemplateCardProps {
  template: DataTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onUse: () => void;
}

/** Format a timestamp to a locale-friendly string. O(1). */
function formatTime(ts: number | undefined): string {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Render a template card. O(1). */
export function TemplateCard(props: TemplateCardProps): VNode {
  const { template, onEdit, onDelete, onUse } = props;

  return (
    <div class="wl-templateCard">
      <div class="wl-templateCardTitle">{template.name}</div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <span class="wl-badge">{template.objectName}</span>
        {template.category ? (
          <span class="wl-badge" style="font-size:10px">{template.category}</span>
        ) : null}
      </div>

      {template.description ? (
        <div class="wl-muted" style="font-size:12px;line-height:1.4">
          {template.description}
        </div>
      ) : null}

      <div class="wl-templateCardMeta">
        <span>Used {template.usageCount ?? 0} time{(template.usageCount ?? 0) !== 1 ? 's' : ''}</span>
        <span> &middot; </span>
        <span>Last: {formatTime(template.lastUsedAt)}</span>
      </div>

      <div class="wl-actions" style="margin-top:auto;padding-top:4px">
        <button class="wl-btn" onClick={onEdit} style="font-size:11px;padding:5px 8px">Edit</button>
        <button class="wl-btn wl-btnDanger" onClick={onDelete} style="font-size:11px;padding:5px 8px">Delete</button>
        <button class="wl-btn wl-btnPrimary" onClick={onUse} style="font-size:11px;padding:5px 8px">Use</button>
      </div>
    </div>
  );
}
