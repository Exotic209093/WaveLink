/**
 * Visual relationship explorer screen.
 *
 * What this file does:
 * - Lets the user pick a root SObject and a traversal depth (1-4).
 * - Fetches describeGlobal and describeSObject for the root + related objects.
 * - Traverses BOTH outgoing lookups (reference fields) AND incoming child
 *   relationships, producing a bidirectional graph.
 * - Builds a SchemaGraph and computes a hierarchical layout.
 * - Renders the graph using SchemaGraphView with a detail panel for the selected node.
 * - Detail panel supports field-type filtering and SOQL path copy.
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
  findPath,
} from '../utils/schemaGraph';
import { SchemaGraphView } from '../components/SchemaGraphView';
import { Toast } from '../components/Toast';
import { downloadTextFile } from '../utils/download';

type FieldFilter = 'all' | 'reference' | 'text' | 'number' | 'date' | 'other';

const TEXT_TYPES = new Set(['string', 'textarea', 'email', 'phone', 'url', 'picklist', 'multipicklist', 'combobox', 'encryptedstring']);
const NUMBER_TYPES = new Set(['int', 'double', 'currency', 'percent']);
const DATE_TYPES = new Set(['date', 'datetime', 'time']);

function matchesFilter(fieldType: string, filter: FieldFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'reference') return fieldType === 'reference';
  if (filter === 'text') return TEXT_TYPES.has(fieldType);
  if (filter === 'number') return NUMBER_TYPES.has(fieldType);
  if (filter === 'date') return DATE_TYPES.has(fieldType);
  if (filter === 'other') return !TEXT_TYPES.has(fieldType) && !NUMBER_TYPES.has(fieldType) && !DATE_TYPES.has(fieldType) && fieldType !== 'reference';
  return true;
}

export function RelationshipExplorerScreen(props: {
  sf: SfApi;
  tabId: number;
}): VNode {
  const { sf, tabId } = props;

  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [objects, setObjects] = useState<Array<{ name: string; label: string }>>([]);
  const [objSearch, setObjSearch] = useState('');

  const [rootObject, setRootObject] = useState('');
  const [depth, setDepth] = useState(2);

  const [graph, setGraph] = useState<SchemaGraph | null>(null);
  const [layout, setLayout] = useState<Map<string, { x: number; y: number; level: number }> | null>(null);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [fieldFilter, setFieldFilter] = useState<FieldFilter>('all');

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

  const filteredObjects = useMemo(() => {
    const q = objSearch.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter(
      (o) => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
    );
  }, [objects, objSearch]);

  /**
   * Explore relationships bidirectionally: traverse outgoing reference fields
   * AND incoming childRelationships at each depth level.
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
      const rootDescribe = await sf.describeSObject(rootObject, tabId);

      const describes = new Map<string, SchemaNode>();
      describes.set(rootObject, {
        objectName: rootObject,
        label: rootDescribe.label,
        fields: rootDescribe.fields.map((f) => ({
          name: f.name,
          type: f.type,
          referenceTo: f.referenceTo,
          nillable: f.nillable,
        })),
        childRelationships: (rootDescribe.childRelationships ?? [])
          .filter(cr => !cr.deprecatedAndHidden && cr.relationshipName)
          .map(cr => ({
            childSObject: cr.childSObject,
            field: cr.field,
            relationshipName: cr.relationshipName,
            restrictedDelete: cr.restrictedDelete,
          })),
      });

      let currentFrontier = new Set<string>([rootObject]);

      for (let d = 0; d < depth; d++) {
        const nextFrontier = new Set<string>();

        for (const objName of currentFrontier) {
          const node = describes.get(objName);
          if (!node) continue;

          // Outgoing: follow reference fields
          for (const field of node.fields) {
            if (field.type !== 'reference' || !field.referenceTo) continue;
            for (const refTarget of field.referenceTo) {
              if (!describes.has(refTarget)) nextFrontier.add(refTarget);
            }
          }

          // Incoming: follow child relationships (objects that point TO this one)
          for (const cr of node.childRelationships) {
            if (!describes.has(cr.childSObject)) nextFrontier.add(cr.childSObject);
          }
        }

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
                nillable: f.nillable,
              })),
              childRelationships: (desc.childRelationships ?? [])
                .filter(cr => !cr.deprecatedAndHidden && cr.relationshipName)
                .map(cr => ({
                  childSObject: cr.childSObject,
                  field: cr.field,
                  relationshipName: cr.relationshipName,
                  restrictedDelete: cr.restrictedDelete,
                })),
            });
          } catch {
            // Skip objects we cannot describe
          }
        });

        await Promise.all(fetches);
        currentFrontier = nextFrontier;
        if (nextFrontier.size === 0) break;
      }

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

  const selectedNode: SchemaNode | null =
    graph && selectedObject ? graph.nodes.get(selectedObject) ?? null : null;

  const selectedRelationships = useMemo(() => {
    if (!graph || !selectedObject) return [];
    return getFieldRelationships(graph, selectedObject);
  }, [graph, selectedObject]);

  const selectedRelatedObjects = useMemo(() => {
    if (!graph || !selectedObject) return new Set<string>();
    return getRelatedObjects(graph, selectedObject, 1);
  }, [graph, selectedObject]);

  /** SOQL traversal path from root to the selected object. */
  const soqlPath = useMemo((): string | null => {
    if (!graph || !selectedObject || selectedObject === rootObject) return null;
    const pathEdges = findPath(graph, rootObject, selectedObject);
    if (!pathEdges || pathEdges.length === 0) return null;
    return pathEdges
      .map(e => e.relationshipName ?? e.field)
      .join('.');
  }, [graph, rootObject, selectedObject]);

  function copyToClipboard(text: string, label: string): void {
    navigator.clipboard.writeText(text).then(() => {
      setToast({ title: `Copied`, body: `${label} copied to clipboard.` });
    }).catch(() => {
      setToast({ title: 'Copy Failed', body: 'Could not access clipboard.' });
    });
  }

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
    downloadTextFile(
      `wavelink-relationships-${rootObject}-depth${depth}-${Date.now()}.json`,
      JSON.stringify(exportData, null, 2),
      'application/json',
    );
    setToast({ title: 'Exported', body: 'Relationship data saved as JSON.' });
  }

  const filteredFields = useMemo(() => {
    if (!selectedNode) return [];
    return selectedNode.fields.filter(f => matchesFilter(f.type, fieldFilter));
  }, [selectedNode, fieldFilter]);

  const filterCounts = useMemo((): Record<FieldFilter, number> => {
    if (!selectedNode) return { all: 0, reference: 0, text: 0, number: 0, date: 0, other: 0 };
    const counts: Record<FieldFilter, number> = { all: selectedNode.fields.length, reference: 0, text: 0, number: 0, date: 0, other: 0 };
    for (const f of selectedNode.fields) {
      if (f.type === 'reference') counts.reference++;
      else if (TEXT_TYPES.has(f.type)) counts.text++;
      else if (NUMBER_TYPES.has(f.type)) counts.number++;
      else if (DATE_TYPES.has(f.type)) counts.date++;
      else counts.other++;
    }
    return counts;
  }, [selectedNode]);

  const FILTER_TABS: Array<{ key: FieldFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'reference', label: 'Reference' },
    { key: 'text', label: 'Text' },
    { key: 'number', label: 'Number' },
    { key: 'date', label: 'Date' },
    { key: 'other', label: 'Other' },
  ];

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      {/* Controls */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Relationship Explorer</h2>
          <div class="wl-actions">
            <button class="wl-btn wl-btnPrimary" onClick={explore} disabled={busy || !rootObject}>
              {busy ? 'Exploring...' : 'Explore'}
            </button>
            {graph ? <button class="wl-btn" onClick={exportGraph}>Export JSON</button> : null}
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
                  if (rootObject) { setObjSearch(rootObject); setRootObject(''); }
                }}
                placeholder="Search objects..."
              />
              {objSearch && !rootObject ? (
                <div style="position:absolute;top:100%;left:0;right:0;z-index:50;max-height:200px;overflow:auto;border:1px solid var(--wl-line);border-radius:var(--wl-radius-sm);background:rgba(255,255,255,0.96);box-shadow:0 8px 24px rgba(0,0,0,0.10);margin-top:2px">
                  {filteredObjects.slice(0, 40).map((o) => (
                    <div
                      key={o.name}
                      class="wl-qb-objItem"
                      onClick={() => { setRootObject(o.name); setObjSearch(''); }}
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
              <span class="wl-chip"><span style="font-weight:900">Root:</span> {rootObject}</span>
              <span class="wl-chip"><span style="font-weight:900">Depth:</span> {depth}</span>
              {graph ? <span class="wl-chip"><span style="font-weight:900">Objects:</span> {graph.nodes.size}</span> : null}
              {graph ? <span class="wl-chip"><span style="font-weight:900">Edges:</span> {graph.edges.length}</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Graph + Detail split layout */}
      {graph && layout ? (
        <div class="wl-split" style="grid-template-columns:minmax(0,1fr) 380px">
          {/* Graph pane */}
          <div class="wl-card">
            <div class="wl-cardHeader">
              <h2>Relationship Graph</h2>
              <div class="wl-muted">{graph.nodes.size} objects · {graph.edges.length} edges</div>
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
          <div class="wl-card" style="overflow:hidden">
            <div class="wl-cardHeader">
              <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
                <h2 style="margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  {selectedNode ? selectedNode.objectName : 'Select an Object'}
                </h2>
                {selectedNode && selectedNode.label !== selectedNode.objectName ? (
                  <div class="wl-muted" style="font-size:11px">{selectedNode.label}</div>
                ) : null}
              </div>
              <div class="wl-actions" style="flex-shrink:0">
                {selectedNode ? <span class="wl-badge">{selectedNode.fields.length} fields</span> : null}
                {soqlPath ? (
                  <button
                    class="wl-btn"
                    style="font-size:11px;padding:4px 8px"
                    title={`Copy SOQL path: ${soqlPath}`}
                    onClick={() => copyToClipboard(soqlPath, 'SOQL path')}
                  >
                    Copy path
                  </button>
                ) : null}
              </div>
            </div>

            {selectedNode ? (
              <div style="display:flex;flex-direction:column;overflow:hidden">
                {/* SOQL path chip */}
                {soqlPath ? (
                  <div style="padding:6px 14px;border-bottom:1px solid var(--wl-line-2)">
                    <code style="font-size:11px;color:var(--wl-accent);font-family:var(--wl-font-mono)">
                      {rootObject}.{soqlPath}
                    </code>
                  </div>
                ) : null}

                {/* Object stats */}
                <div class="wl-row" style="gap:4px;padding:8px 14px">
                  <div class="wl-muted" style="font-size:12px">
                    <strong>Related to:</strong> {selectedRelatedObjects.size} object{selectedRelatedObjects.size !== 1 ? 's' : ''}
                    {' · '}
                    <strong>Relationships:</strong> {selectedRelationships.length}
                  </div>
                </div>

                {/* Relationships table */}
                {selectedRelationships.length > 0 ? (
                  <div style="border-top:1px solid var(--wl-line-2)">
                    <div style="padding:8px 14px;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">
                      Relationships ({selectedRelationships.length})
                    </div>
                    <div class="wl-tableWrap" style="max-height:180px">
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
                          {selectedRelationships.map((edge) => {
                            const isOutgoing = edge.from === selectedObject;
                            const targetObj = isOutgoing ? edge.to : edge.from;
                            return (
                              <tr
                                key={`${edge.from}-${edge.to}-${edge.field}`}
                                style="cursor:pointer"
                                onClick={() => {
                                  if (graph.nodes.has(targetObj)) setSelectedObject(targetObj);
                                }}
                              >
                                <td class="wl-muted">{isOutgoing ? '→ out' : '← in'}</td>
                                <td class="wl-mono" style="font-size:11px">{edge.field}</td>
                                <td class="wl-mono" style="color:var(--wl-accent);font-size:11px">{targetObj}</td>
                                <td>
                                  <span
                                    class="wl-badge"
                                    style={`font-size:10px;padding:2px 5px${edge.type === 'masterDetail' ? ';border-color:rgba(239,68,96,0.4);color:var(--wl-danger)' : ''}`}
                                  >
                                    {edge.type === 'masterDetail' ? 'M-D' : 'lookup'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {/* Fields section with type filter */}
                <div style="border-top:1px solid var(--wl-line-2)">
                  <div style="padding:8px 14px 4px;display:flex;align-items:center;justify-content:space-between;gap:8px">
                    <div style="font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim)">
                      Fields ({filteredFields.length}{fieldFilter !== 'all' ? `/${selectedNode.fields.length}` : ''})
                    </div>
                  </div>
                  {/* Filter tabs */}
                  <div style="display:flex;gap:4px;padding:0 14px 8px;flex-wrap:wrap">
                    {FILTER_TABS.map(tab => (
                      <button
                        key={tab.key}
                        class="wl-subNavBtn"
                        data-active={fieldFilter === tab.key}
                        style="padding:3px 8px;font-size:11px;margin-bottom:0;border-bottom:2px solid transparent"
                        onClick={() => setFieldFilter(tab.key)}
                      >
                        {tab.label} {filterCounts[tab.key] > 0 ? <span class="wl-muted">({filterCounts[tab.key]})</span> : null}
                      </button>
                    ))}
                  </div>
                  <div class="wl-tableWrap" style="max-height:220px">
                    <table class="wl-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>References</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFields.map((f) => (
                          <tr key={f.name}>
                            <td class="wl-mono" style="font-size:11px">{f.name}</td>
                            <td style="font-size:11px">{f.type}</td>
                            <td class="wl-mono" style="color:var(--wl-accent);font-size:11px">
                              {f.referenceTo && f.referenceTo.length > 0 ? f.referenceTo.join(', ') : ''}
                            </td>
                          </tr>
                        ))}
                        {filteredFields.length === 0 ? (
                          <tr>
                            <td colspan={3} class="wl-muted" style="text-align:center;padding:12px">No {fieldFilter} fields</td>
                          </tr>
                        ) : null}
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
