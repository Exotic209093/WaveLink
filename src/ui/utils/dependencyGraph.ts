/**
 * Generalised dependency graph for multi-object migration.
 *
 * Extends the original single-root `buildDependencyGraph()` from crossObjectClone.ts
 * to support arbitrary multi-object sets, circular reference detection with
 * null-then-backfill resolution, and topological ordering.
 *
 * Complexity: O(O*F + E) for graph building and sorting.
 */

import type { DependencyNode, DependencyEdge, DependencyGraph } from '../../core/types/migration';

type FieldDescribe = { name: string; type: string; referenceTo?: string[] };
type ObjectDescribe = { name: string; fields: FieldDescribe[] };

/**
 * Build a generalised dependency graph from a set of SObject describes.
 * Unlike the clone-specific version, this accepts multiple root objects and
 * only includes edges between objects that are in the provided set.
 *
 * @param describes - Map of objectName → describe metadata
 * @param objectNames - The set of objects to include in the graph
 * @returns Complete DependencyGraph with cycle detection and insertion order
 */
export function buildMigrationGraph(
  describes: Map<string, ObjectDescribe>,
  objectNames: string[],
): DependencyGraph {
  const included = new Set(objectNames.map(n => n.toLowerCase()));
  const nodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];

  // Build nodes and edges for each included object
  for (const objName of objectNames) {
    const describe = describes.get(objName);
    if (!describe) {
      // Object not described — add as a leaf node with no references
      nodes.set(objName, { objectName: objName, referenceFields: [] });
      continue;
    }

    const refFields: DependencyNode['referenceFields'] = [];
    for (const field of describe.fields) {
      if (field.type === 'reference' && field.referenceTo && field.referenceTo.length > 0) {
        const target = field.referenceTo[0];
        // Only include edges to objects that are part of this migration
        if (included.has(target.toLowerCase())) {
          refFields.push({ field: field.name, referenceTo: target });
          edges.push({ from: objName, field: field.name, to: target });
        }
      }
    }

    nodes.set(objName, { objectName: objName, referenceFields: refFields });
  }

  // Detect cycles
  const cycles = detectCycles(nodes, edges);

  // Mark cycle edges for null-then-backfill
  const cycleBreakEdges = selectCycleBreakEdges(edges, cycles);
  const breakEdgeSet = new Set(cycleBreakEdges.map(e => `${e.from}:${e.field}:${e.to}`));

  // Mark edges and nodes
  for (const edge of edges) {
    edge.isCycleEdge = breakEdgeSet.has(`${edge.from}:${edge.field}:${edge.to}`);
  }
  for (const cycle of cycles) {
    for (const objName of cycle) {
      const node = nodes.get(objName);
      if (node) node.inCycle = true;
    }
  }

  // Compute topological order excluding broken cycle edges
  const nonCycleEdges = edges.filter(e => !e.isCycleEdge);
  const insertionOrder = topologicalSort(nodes, nonCycleEdges);

  return { nodes, edges, cycles, cycleBreakEdges, insertionOrder };
}

/**
 * Detect circular references using DFS with 3-colour marking.
 * Returns arrays of cycle paths.
 */
function detectCycles(
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
): string[][] {
  const cycles: string[][] = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();

  for (const name of nodes.keys()) color.set(name, WHITE);

  // Build adjacency
  const adj = new Map<string, string[]>();
  for (const name of nodes.keys()) adj.set(name, []);
  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to);
  }

  function dfs(u: string, path: string[]): void {
    color.set(u, GRAY);
    path.push(u);

    for (const v of (adj.get(u) ?? [])) {
      if (color.get(v) === GRAY) {
        const cycleStart = path.indexOf(v);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart).concat(v));
        }
      } else if (color.get(v) === WHITE) {
        dfs(v, [...path]);
      }
    }

    color.set(u, BLACK);
  }

  for (const name of nodes.keys()) {
    if (color.get(name) === WHITE) {
      dfs(name, []);
    }
  }

  return cycles;
}

/**
 * Select edges to break cycles using the null-then-backfill strategy.
 * For each cycle, picks the last edge (arbitrary but deterministic).
 */
function selectCycleBreakEdges(
  allEdges: DependencyEdge[],
  cycles: string[][],
): DependencyEdge[] {
  const selected = new Map<string, DependencyEdge>();

  for (const cycle of cycles) {
    // Pick the edge from the second-to-last to the last node in the cycle path
    // (which is the same as the first, completing the loop)
    if (cycle.length < 3) continue;
    const from = cycle[cycle.length - 2];
    const to = cycle[cycle.length - 1];
    const edge = allEdges.find(e => e.from === from && e.to === to);
    if (edge) {
      const key = `${edge.from}:${edge.field}:${edge.to}`;
      selected.set(key, edge);
    }
  }

  return Array.from(selected.values());
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns object names in dependency-safe insertion order.
 */
function topologicalSort(
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
): string[] {
  const inDegree = new Map<string, number>();
  for (const name of nodes.keys()) inDegree.set(name, 0);

  for (const edge of edges) {
    if (inDegree.has(edge.from)) {
      inDegree.set(edge.from, (inDegree.get(edge.from) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [name, deg] of inDegree) {
    if (deg === 0) queue.push(name);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const edge of edges) {
      if (edge.to === node) {
        const newDeg = (inDegree.get(edge.from) ?? 1) - 1;
        inDegree.set(edge.from, newDeg);
        if (newDeg === 0) queue.push(edge.from);
      }
    }
  }

  // Append any remaining (should only happen with residual cycles)
  for (const name of nodes.keys()) {
    if (!sorted.includes(name)) sorted.push(name);
  }

  return sorted;
}
