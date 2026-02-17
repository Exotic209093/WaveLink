/**
 * Saved query management panel with folder organisation, search, and import/export.
 *
 * What this file does:
 * - Two-column layout: QueryFolderTree on the left, query list on the right.
 * - Supports fuzzy search, favorite filtering, drag-to-folder, and JSON import/export.
 *
 * Complexity:
 * - Filtering and rendering are O(N) where N is total saved query count.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useMemo, useCallback } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { SavedQuery, QueryFolder } from '../../core/types/storage';
import { fuzzyFilter } from '../utils/fuzzyMatch';
import { downloadTextFile } from '../utils/download';
import { QueryFolderTree } from './QueryFolderTree';

export interface QueryManagerProps {
  sf: SfApi;
  queries: SavedQuery[];
  folders: QueryFolder[];
  onLoadQuery: (soql: string) => void;
  onQueriesChange: () => void;
  onFoldersChange: () => void;
}

/**
 * Query management component with folder tree, search, and import/export.
 * O(N) filtering per render where N is the number of saved queries.
 */
export function QueryManager(props: QueryManagerProps): VNode {
  const { sf, queries, folders, onLoadQuery, onQueriesChange, onFoldersChange } = props;

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [searchText, setSearchText] = useState('');

  /** Visible queries filtered by folder, favorites, and search text. O(N). */
  const visibleQueries = useMemo(() => {
    let filtered = queries;

    // Filter by folder
    if (selectedFolderId !== null) {
      filtered = filtered.filter(q => q.folderId === selectedFolderId);
    }

    // Filter favorites
    if (showFavorites) {
      filtered = filtered.filter(q => q.favorite);
    }

    // Fuzzy search
    if (searchText.trim()) {
      filtered = fuzzyFilter(filtered, searchText, q => `${q.name} ${q.soql}`);
    }

    return filtered;
  }, [queries, selectedFolderId, showFavorites, searchText]);

  /** Toggle the favorite flag on a query. */
  const toggleFavorite = useCallback(async (query: SavedQuery) => {
    await sf.upsertSavedQuery({
      id: query.id,
      name: query.name,
      soql: query.soql,
      ...({ favorite: !query.favorite } as Record<string, unknown>),
    } as { id: string; name: string; soql: string });
    onQueriesChange();
  }, [sf, onQueriesChange]);

  /** Delete a saved query. */
  const deleteQuery = useCallback(async (id: string) => {
    await sf.deleteSavedQuery(id);
    onQueriesChange();
  }, [sf, onQueriesChange]);

  /** Handle dropping a query onto a folder. */
  const handleQueryDrop = useCallback(async (e: DragEvent, folderId: string | null) => {
    e.preventDefault();
    const queryId = e.dataTransfer?.getData('application/wl-query-id');
    if (!queryId) return;
    const query = queries.find(q => q.id === queryId);
    if (!query) return;

    await sf.upsertSavedQuery({
      id: query.id,
      name: query.name,
      soql: query.soql,
      ...({ folderId: folderId ?? undefined } as Record<string, unknown>),
    } as { id: string; name: string; soql: string });
    onQueriesChange();
  }, [queries, sf, onQueriesChange]);

  // ── Folder handlers ───────────────────────────────────────────

  const handleFolderRename = useCallback(async (id: string, name: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    await sf.upsertQueryFolder({ id, name, parentId: folder.parentId });
    onFoldersChange();
  }, [folders, sf, onFoldersChange]);

  const handleFolderDelete = useCallback(async (id: string) => {
    await sf.deleteQueryFolder(id);
    onFoldersChange();
  }, [sf, onFoldersChange]);

  const handleCreateChild = useCallback(async (parentId: string | null) => {
    const id = crypto.randomUUID();
    await sf.upsertQueryFolder({
      id,
      name: 'New Folder',
      parentId: parentId ?? undefined,
    });
    onFoldersChange();
  }, [sf, onFoldersChange]);

  // ── Import / Export ───────────────────────────────────────────

  const handleExport = useCallback(() => {
    const data = JSON.stringify({ queries, folders }, null, 2);
    downloadTextFile('wavelink-queries.json', data, 'application/json');
  }, [queries, folders]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as { queries?: SavedQuery[]; folders?: QueryFolder[] };

        if (Array.isArray(data.folders)) {
          for (const f of data.folders) {
            await sf.upsertQueryFolder({ id: f.id, name: f.name, parentId: f.parentId });
          }
          onFoldersChange();
        }

        if (Array.isArray(data.queries)) {
          for (const q of data.queries) {
            await sf.upsertSavedQuery({ id: q.id, name: q.name, soql: q.soql });
          }
          onQueriesChange();
        }
      } catch {
        // Silently ignore malformed files
      }
    };
    input.click();
  }, [sf, onQueriesChange, onFoldersChange]);

  // ── Truncate helper ───────────────────────────────────────────

  const truncate = (str: string, max: number): string =>
    str.length > max ? str.slice(0, max) + '...' : str;

  // ── Render ────────────────────────────────────────────────────

  return (
    <div class="wl-queryManager" style="display:flex;gap:12px">
      {/* Left: Folder tree */}
      <div style="min-width:180px;max-width:220px;flex-shrink:0"
        onDragOver={(e: DragEvent) => e.preventDefault()}
        onDrop={(e: DragEvent) => handleQueryDrop(e, selectedFolderId)}
      >
        <QueryFolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelect={setSelectedFolderId}
          onRename={handleFolderRename}
          onDelete={handleFolderDelete}
          onCreateChild={handleCreateChild}
        />
      </div>

      {/* Right: Query list */}
      <div style="flex:1;min-width:0">
        {/* Toolbar */}
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <input
            class="wl-input"
            type="text"
            placeholder="Search queries..."
            value={searchText}
            onInput={(e) => setSearchText((e.currentTarget as HTMLInputElement).value)}
            style="flex:1;min-width:120px"
          />
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;white-space:nowrap">
            <input
              type="checkbox"
              checked={showFavorites}
              onChange={(e) => setShowFavorites((e.currentTarget as HTMLInputElement).checked)}
            />
            Favorites
          </label>
          <button class="wl-btn" onClick={handleImport}>Import</button>
          <button class="wl-btn" onClick={handleExport}>Export</button>
        </div>

        {/* Query rows */}
        <div class="wl-queryList">
          {visibleQueries.length === 0 ? (
            <div class="wl-muted" style="padding:12px;text-align:center">
              No queries found.
            </div>
          ) : (
            visibleQueries.map(query => (
              <div
                key={query.id}
                class="wl-queryRow"
                draggable
                onDragStart={(e: DragEvent) => {
                  e.dataTransfer?.setData('application/wl-query-id', query.id);
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                }}
                style="display:flex;align-items:center;gap:8px;padding:8px;cursor:pointer"
              >
                <div
                  style="flex:1;min-width:0;overflow:hidden"
                  onClick={() => onLoadQuery(query.soql)}
                >
                  <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    {query.name}
                  </div>
                  <div class="wl-muted wl-mono" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    {truncate(query.soql, 80)}
                  </div>
                </div>

                <button
                  class="wl-btn"
                  style="padding:0 6px;font-size:14px"
                  onClick={() => toggleFavorite(query)}
                  title={query.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-label="Toggle favorite"
                >
                  {query.favorite ? '\u2605' : '\u2606'}
                </button>

                <button
                  class="wl-btn"
                  style="padding:0 6px;font-size:12px"
                  onClick={() => deleteQuery(query.id)}
                  title="Delete query"
                  aria-label="Delete query"
                >
                  x
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
