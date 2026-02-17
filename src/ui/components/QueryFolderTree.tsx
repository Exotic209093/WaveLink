/**
 * Collapsible folder tree for organizing saved queries.
 *
 * What this file does:
 * - Renders a recursive tree of QueryFolder nodes with expand/collapse, inline rename, delete, and create-child.
 * - "All Queries" root node (id null) is always shown at the top.
 *
 * Complexity:
 * - Rendering is O(N) where N is the total number of folders (each folder visited once).
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { QueryFolder } from '../../core/types/storage';

export interface QueryFolderTreeProps {
  folders: QueryFolder[];
  selectedFolderId: string | null;
  onSelect: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCreateChild: (parentId: string | null) => void;
}

/**
 * Recursive folder tree component.
 * O(N) render where N is the total folder count.
 */
export function QueryFolderTree(props: QueryFolderTreeProps): VNode {
  const { folders, selectedFolderId, onSelect, onRename, onDelete, onCreateChild } = props;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  /** Toggle a folder's expanded state. */
  const toggleExpand = (id: string): void => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Begin inline editing for a folder. */
  const startEditing = (folder: QueryFolder): void => {
    setEditingId(folder.id);
    setEditText(folder.name);
  };

  /** Commit the inline rename. */
  const commitRename = (): void => {
    if (editingId && editText.trim()) {
      onRename(editingId, editText.trim());
    }
    setEditingId(null);
    setEditText('');
  };

  /** Get child folders for a given parentId. O(N) scan per level, O(N) total across tree. */
  const getChildren = (parentId: string | undefined): QueryFolder[] =>
    folders.filter(f => (f.parentId ?? undefined) === parentId);

  /** Render a single folder node and its children recursively. */
  const renderNode = (folder: QueryFolder): VNode => {
    const children = getChildren(folder.id);
    const isExpanded = expandedIds.has(folder.id);
    const isActive = selectedFolderId === folder.id;
    const isEditing = editingId === folder.id;

    return (
      <div key={folder.id} class="wl-folderNode" data-active={isActive ? 'true' : undefined}>
        <div
          style="display:flex;align-items:center;gap:4px;padding:4px 6px;cursor:pointer"
          onClick={() => onSelect(folder.id)}
        >
          {children.length > 0 ? (
            <button
              class="wl-btn"
              style="padding:0 4px;font-size:10px;min-width:18px"
              onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '\u25BC' : '\u25B6'}
            </button>
          ) : (
            <span style="display:inline-block;width:18px" />
          )}

          {isEditing ? (
            <input
              class="wl-input"
              style="flex:1;font-size:12px;padding:2px 4px"
              value={editText}
              onInput={(e) => setEditText((e.currentTarget as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
              }}
              onBlur={commitRename}
              autoFocus
            />
          ) : (
            <span
              style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
              onDblClick={(e) => { e.stopPropagation(); startEditing(folder); }}
              title={folder.name}
            >
              {folder.name}
            </span>
          )}

          <button
            class="wl-btn"
            style="padding:0 4px;font-size:10px"
            onClick={(e) => { e.stopPropagation(); onCreateChild(folder.id); }}
            title="New sub-folder"
            aria-label="Create child folder"
          >
            +
          </button>

          <button
            class="wl-btn"
            style="padding:0 4px;font-size:10px"
            onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }}
            title="Delete folder"
            aria-label="Delete folder"
          >
            x
          </button>
        </div>

        {isExpanded && children.length > 0 ? (
          <div style="padding-left:16px">
            {children.map(child => renderNode(child))}
          </div>
        ) : null}
      </div>
    );
  };

  const rootFolders = getChildren(undefined);

  return (
    <div class="wl-folderTree">
      {/* Root "All Queries" node */}
      <div
        class="wl-folderNode"
        data-active={selectedFolderId === null ? 'true' : undefined}
        style="display:flex;align-items:center;gap:4px;padding:4px 6px;cursor:pointer"
        onClick={() => onSelect(null)}
      >
        <span style="display:inline-block;width:18px" />
        <span style="flex:1;font-size:12px;font-weight:700">All Queries</span>
        <button
          class="wl-btn"
          style="padding:0 4px;font-size:10px"
          onClick={(e) => { e.stopPropagation(); onCreateChild(null); }}
          title="New root folder"
          aria-label="Create root folder"
        >
          +
        </button>
      </div>

      {rootFolders.map(folder => renderNode(folder))}
    </div>
  );
}
