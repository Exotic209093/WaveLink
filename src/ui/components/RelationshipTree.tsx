/**
 * Tree of objects with checkboxes and edge labels for the clone wizard.
 *
 * What this file does:
 * - Renders each node in a CloneGraph with object name and checkbox.
 * - Shows reference edges with field labels.
 * - Highlights cycle warnings in red.
 *
 * Why:
 * - Visual representation of SObject relationships helps users understand
 *   the dependency graph before cross-object cloning.
 *
 * Complexity:
 * - Rendering is O(N + E) where N = nodes and E = edges in the graph.
 * - Cycle warning check per node is O(C * P) where C = cycles and P = cycle path length.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useMemo } from 'preact/hooks';
import type { CloneGraph } from '../utils/crossObjectClone';

export interface RelationshipTreeProps {
  graph: CloneGraph;
  selectedObjects: Set<string>;
  onToggleObject: (name: string) => void;
  cycles: string[][];
}

/**
 * Build a set of object names involved in any cycle. O(C * P).
 */
function buildCycleSet(cycles: string[][]): Set<string> {
  const set = new Set<string>();
  for (const cycle of cycles) {
    for (const name of cycle) {
      set.add(name);
    }
  }
  return set;
}

/**
 * RelationshipTree renders the object dependency graph as a tree view.
 * O(N + E) where N = graph nodes, E = graph edges.
 */
export function RelationshipTree(props: RelationshipTreeProps): VNode {
  const { graph, selectedObjects, onToggleObject, cycles } = props;

  /** Set of objects in cycles for highlighting. O(C * P). */
  const cycleSet = useMemo(() => buildCycleSet(cycles), [cycles]);

  /** All node names sorted alphabetically. O(N log N). */
  const nodeNames = useMemo(() => {
    const names = Array.from(graph.nodes.keys());
    names.sort();
    return names;
  }, [graph.nodes]);

  /** Edges grouped by source object. O(E). */
  const edgesBySource = useMemo(() => {
    const map = new Map<string, Array<{ field: string; to: string }>>();
    for (const edge of graph.edges) {
      const list = map.get(edge.from) ?? [];
      list.push({ field: edge.field, to: edge.to });
      map.set(edge.from, list);
    }
    return map;
  }, [graph.edges]);

  return (
    <div class="wl-relationshipTree">
      {nodeNames.length === 0 && (
        <div class="wl-muted" style="padding:8px">
          No objects in the relationship graph.
        </div>
      )}

      {nodeNames.map((name) => {
        const inCycle = cycleSet.has(name);
        const edges = edgesBySource.get(name) ?? [];

        return (
          <div key={name}>
            {/* Node */}
            <div class="wl-relNode" data-cycle={inCycle ? 'true' : undefined}>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
                <input
                  type="checkbox"
                  checked={selectedObjects.has(name)}
                  onChange={() => onToggleObject(name)}
                  style="accent-color:var(--wl-accent)"
                />
                <span style="font-weight:700;font-size:13px">{name}</span>
              </label>
              {inCycle && (
                <span style="color:var(--wl-danger);font-size:11px;font-weight:700">
                  Circular reference
                </span>
              )}
            </div>

            {/* Edges from this node */}
            {edges.map((edge, ei) => (
              <div key={`${name}-${ei}`} style="padding-left:28px;display:flex;align-items:center;gap:6px">
                <span style="color:var(--wl-line);font-size:14px">&#x2514;</span>
                <span class="wl-relEdge">
                  {edge.field} &#x2192; {edge.to}
                </span>
              </div>
            ))}
          </div>
        );
      })}

      {/* Cycle warnings */}
      {cycles.length > 0 && (
        <div style="margin-top:12px;padding:8px;border:1px solid var(--wl-danger);border-radius:var(--wl-radius-sm);background:rgba(255,59,92,0.05)">
          <div style="font-weight:900;font-size:12px;color:var(--wl-danger);margin-bottom:4px">
            Circular References Detected ({cycles.length})
          </div>
          {cycles.map((cycle, ci) => (
            <div key={ci} class="wl-muted" style="font-size:11px;font-family:var(--wl-font-mono)">
              {cycle.join(' -> ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
