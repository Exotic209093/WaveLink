/**
 * Visual relationship explorer screen.
 *
 * What this file does:
 * - Lets the user pick a root SObject and a traversal depth (1-4).
 * - Fetches describeGlobal and describeSObject for the root + related objects.
 * - Builds a SchemaGraph and computes a hierarchical layout.
 * - Renders the graph using SchemaGraphView with a detail panel for the selected node.
 * - Supports exporting relationship data as JSON.
 *
 * Complexity:
 * - O(O) for global describe list filtering, O(D * F) for multi-object describes
 *   where D is depth-related object count and F is average fields per object.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { SchemaGraph, SchemaNode } from '../utils/schemaGraph';
import {
  buildSchemaGraph,
  computeLayout,
  getRelatedObjects,
  getFieldRelationships,
} from '../utils/schemaGraph';
import { SchemaGraphView } from '../components/SchemaGraphView';
import { Toast } from '../components/Toast';
import { downloadTextFile } from '../utils/download';

export function RelationshipExplorerScreen(props: {
  sf: SfApi;
  tabId: number;
}): VNode {
  const { sf, tabId } = props;

  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Object list for the selector
  const [objects, setObjects] = useState<Array<{ name: string; label: string }>>([]);
  const [objSearch, setObjSearch] = useState('');

  // Exploration controls
  const [rootObject, setRootObject] = useState('');
  const [depth, setDepth] = useState(2);

  // Graph state
  const [graph, setGraph] = useState<SchemaGraph | null>(null);
  const [layout, setLayout] = useState<Map<string, { x: number; y: number; level: number }> | null>(null);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);

  /** Load global object list on mount. */
  useEffect(() => {
    let cancelled = false;
    sf.describeGlobal(tabId)
      .then((res) => {
        if (cancelled) return;
        setObjects(res.sobjects.map((s) => ({ name: s.name, label: s.label })));
      })
      .catch((e) => {
        if (!cancelled) {
          setToast({ title: 'Failed to Load Objects', body: e instanceof Error ? e.message : 'Unknown error' });
        }
      });
    return () => { cancelled = true; };
  }, [sf, tabId]);

  /** Filtered objects for the selector dropdown. */
  const filteredObjects = useMemo(() => {
    const q = objSearch.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter(
      (o) => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
    );
  }, [objects, objSearch]);

  /**
   * Explore relationships: describe root object, find related objects at the
   * specified depth, describe them all, build graph and layout.
   */
  async function explore(): Promise<void> {
    if (!rootObject) {
      setToast({ title: 'Select an Object', body: 'Choose a root object to explore.' });
      return;
    }

    setBusy(true);
    setGraph(null);
    setLayout(null);
    setSelectedObject(null);

    try {
      // Step 1: Describe root object
      const rootDescribe = await sf.describeSObject(rootObject, tabId);

      // Step 2: Build initial node for the root
      const describes = new Map<string, SchemaNode>();
      describes.set(rootObject, {
        objectName: rootObject,
        label: rootDescribe.label,
        fields: rootDescribe.fields.map((f) => ({
          name: f.name,
          type: f.type,
          referenceTo: f.referenceTo,
        })),
      });

      // Step 3: Iteratively fetch related objects up to the specified depth
      let currentFrontier = new Set<string>([rootObject]);

      for (let d = 0; d < depth; d++) {
        const nextFrontier = new Set<string>();

        for (const objName of currentFrontier) {
          const node = describes.get(objName);
          if (!node) continue;

          for (const field of node.fields) {
            if (field.type !== 'reference' || !field.referenceTo) continue;
            for (const refTarget of field.referenceTo) {
              if (!describes.has(refTarget)) {
                nextFrontier.add(refTarget);
              }
            }
          }
        }

        // Describe all newly discovered objects
        const fetches = Array.from(nextFrontier).map(async (name) => {
          try {
            const desc = await sf.describeSObject(name, tabId);
            describes.set(name, {
              objectName: name,
              label: desc.label,
              fields: desc.fields.map((f) => ({
                name: f.name,
                type: f.type,
                referenceTo: f.referenceTo,
              })),
            });
          } catch {
            // Skip objects we cannot describe (e.g., insufficient permissions)
          }
        });

        await Promise.all(fetches);
        currentFrontier = nextFrontier;

        // Stop early if no new objects were discovered
        if (nextFrontier.size === 0) break;
      }

      // Step 4: Build graph and layout
      const builtGraph = buildSchemaGraph(describes);
      const builtLayout = computeLayout(builtGraph, rootObject);

      setGraph(builtGraph);
      setLayout(builtLayout);
      setSelectedObject(rootObject);
      setToast({
        title: 'Exploration Complete',
        body: `${builtGraph.nodes.size} objects, ${builtGraph.edges.length} relationships`,
      });
    } catch (e) {
      setToast({ title: 'Exploration Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  /** Get the selected node from the graph. */
  const selectedNode: SchemaNode | null =
    graph && selectedObject ? graph.nodes.get(selectedObject) ?? null : null;

  /** Get field relationships for the selected node. */
  const selectedRelationships = useMemo(() => {
    if (!graph || !selectedObject) return [];
    return getFieldRelationships(graph, selectedObject);
  }, [graph, selectedObject]);

  /** Get related object names for the selected node. */
  const selectedRelatedObjects = useMemo(() => {
    if (!graph || !selectedObject) return new Set<string>();
    return getRelatedObjects(graph, selectedObject, 1);
  }, [graph, selectedObject]);

  /** Export the relationship graph data as JSON. */
  function exportGraph(): void {
    if (!graph) return;

    const exportData = {
      rootObject,
      depth,
      nodes: Array.from(graph.nodes.values()).map((n) => ({
        objectName: n.objectName,
        label: n.label,
        fieldCount: n.fields.length,
      })),
      edges: graph.edges.map((e) => ({
        from: e.from,
        to: e.to,
        field: e.field,
        relationshipName: e.relationshipName,
        type: e.type,
      })),
    };

    const json = JSON.stringify(exportData, null, 2);
    downloadTextFile(
      `wavelink-relationships-${rootObject}-depth${depth}-${Date.now()}.json`,
      json,
      'application/json',
    );
    setToast({ title: 'Exported', body: 'Relationship data saved as JSON.' });
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      {/* Controls */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Relationship Explorer</h2>
          <div class="wl-actions">
            <button
              class="wl-btn wl-btnPrimary"
              onClick={explore}
              disabled={busy || !rootObject}
            >
              {busy ? 'Exploring...' : 'Explore'}
            </button>
            {graph ? (
              <button class="wl-btn" onClick={exportGraph}>Export JSON</button>
            ) : null}
          </div>
        </div>

        <div class="wl-row">
          <div class="wl-row2">
            {/* Object selector */}
            <div style="display:flex;flex-direction:column;gap:6px;position:relative">
              <label style="font-weight:900;font-size:12px">Root Object</label>
              <input
                class="wl-input"
                type="text"
                value={rootObject || objSearch}
                onInput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value;
                  setObjSearch(v);
                  setRootObject('');
                }}
                onFocus={() => {
                  if (rootObject) {
                    setObjSearch(rootObject);
                    setRootObject('');
                  }
                }}
                placeholder="Search objects..."
              />
              {objSearch && !rootObject ? (
                <div style="position:absolute;top:100%;left:0;right:0;z-index:50;max-height:200px;overflow:auto;border:1px solid var(--wl-line);border-radius:var(--wl-radius-sm);background:rgba(255,255,255,0.96);box-shadow:0 8px 24px rgba(0,0,0,0.10);margin-top:2px">
                  {filteredObjects.slice(0, 40).map((o) => (
                    <div
                      key={o.name}
                      class="wl-qb-objItem"
                      onClick={() => {
                        setRootObject(o.name);
                        setObjSearch('');
                      }}
                    >
                      <span class="wl-mono" style="font-size:12px">{o.name}</span>
                      <span class="wl-muted">{o.label}</span>
                    </div>
                  ))}
                  {filteredObjects.length === 0 ? (
                    <div class="wl-muted" style="padding:8px 12px">No matching objects</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Depth control */}
            <div style="display:flex;flex-direction:column;gap:6px">
              <label style="font-weight:900;font-size:12px">Depth (1-4)</label>
              <input
                class="wl-input"
                type="number"
                min={1}
                max={4}
                value={depth}
                onInput={(e) => {
                  const n = parseInt((e.currentTarget as HTMLInputElement).value || '2', 10);
                  setDepth(Math.max(1, Math.min(4, n)));
                }}
              />
            </div>
          </div>

          {rootObject ? (
            <div class="wl-chipRow">
              <span class="wl-chip">
                <span style="font-weight:900">Root:</span> {rootObject}
              </span>
              <span class="wl-chip">
                <span style="font-weight:900">Depth:</span> {depth}
              </span>
              {graph ? (
                <span class="wl-chip">
                  <span style="font-weight:900">Objects:</span> {graph.nodes.size}
                </span>
              ) : null}
              {graph ? (
                <span class="wl-chip">
                  <span style="font-weight:900">Edges:</span> {graph.edges.length}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Graph + Detail split layout */}
      {graph && layout ? (
        <div class="wl-split" style="grid-template-columns:minmax(0,1fr) 360px">
          {/* Graph pane */}
          <div class="wl-card">
            <div class="wl-cardHeader">
              <h2>Relationship Graph</h2>
              <div class="wl-muted">{graph.nodes.size} objects</div>
            </div>
            <div class="wl-row" style="padding:0">
              <SchemaGraphView
                graph={graph}
                rootObject={rootObject}
                layout={layout}
                selectedObject={selectedObject}
                onSelectObject={setSelectedObject}
              />
            </div>
          </div>

          {/* Detail pane */}
          <div class="wl-card">
            <div class="wl-cardHeader">
              <h2>{selectedNode ? selectedNode.objectName : 'Select an Object'}</h2>
              {selectedNode ? (
                <span class="wl-badge">{selectedNode.fields.length} fields</span>
              ) : null}
            </div>

            {selectedNode ? (
              <div style="display:flex;flex-direction:column;overflow:hidden">
                {/* Object info */}
                <div class="wl-row" style="gap:6px">
                  <div class="wl-muted" style="font-size:12px">
                    <strong>Label:</strong> {selectedNode.label}
                  </div>
                  <div class="wl-muted" style="font-size:12px">
                    <strong>Related to:</strong> {selectedRelatedObjects.size} object{selectedRelatedObjects.size !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Relationships */}
                {selectedRelationships.length > 0 ? (
                  <div style="border-top:1px solid var(--wl-line-2)">
                    <div style="padding:10px 14px;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">
                      Relationships ({selectedRelationships.length})
                    </div>
                    <div class="wl-tableWrap" style="max-height:200px">
                      <table class="wl-table">
                        <thead>
                          <tr>
                            <th>Direction</th>
                            <th>Field</th>
                            <th>Object</th>
                            <th>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRelationships.map((edge) => (
                            <tr
                              key={`${edge.from}-${edge.to}-${edge.field}`}
                              style="cursor:pointer"
                              onClick={() => {
                                const target = edge.from === selectedObject ? edge.to : edge.from;
                                if (graph.nodes.has(target)) {
                                  setSelectedObject(target);
                                }
                              }}
                            >
                              <td class="wl-muted">
                                {edge.from === selectedObject ? 'outgoing' : 'incoming'}
                              </td>
                              <td class="wl-mono">{edge.field}</td>
                              <td class="wl-mono" style="color:var(--wl-accent)">
                                {edge.from === selectedObject ? edge.to : edge.from}
                              </td>
                              <td>
                                <span class="wl-badge" style="font-size:10px;padding:2px 6px">
                                  {edge.type}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {/* Fields */}
                <div style="border-top:1px solid var(--wl-line-2)">
                  <div style="padding:10px 14px;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">
                    Fields ({selectedNode.fields.length})
                  </div>
                  <div class="wl-tableWrap" style="max-height:240px">
                    <table class="wl-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>References</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedNode.fields.map((f) => (
                          <tr key={f.name}>
                            <td class="wl-mono">{f.name}</td>
                            <td>{f.type}</td>
                            <td class="wl-mono" style="color:var(--wl-accent)">
                              {f.referenceTo && f.referenceTo.length > 0
                                ? f.referenceTo.join(', ')
                                : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div class="wl-row">
                <div class="wl-muted">Click a node in the graph to view its details.</div>
              </div>
            )}
          </div>
        </div>
      ) : !busy ? (
        <div class="wl-card">
          <div class="wl-row">
            <div class="wl-muted" style="text-align:center;padding:40px 0">
              Select a root object and click "Explore" to visualize relationships.
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
