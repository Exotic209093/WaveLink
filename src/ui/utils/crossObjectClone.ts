/**
 * Cross-object data cloning utilities.
 * Builds dependency graphs, topologically sorts objects, and remaps IDs.
 * Complexity: O(O*F + E) for graph building and sorting.
 */

export interface CloneNode {
  objectName: string;
  referenceFields: Array<{ field: string; referenceTo: string }>;
}

export interface CloneGraph {
  nodes: Map<string, CloneNode>;
  edges: Array<{ from: string; field: string; to: string }>;
}

/** Build a dependency graph from SObject describe metadata. O(O*F). */
export function buildDependencyGraph(
  describes: Map<string, { name: string; fields: Array<{ name: string; type: string; referenceTo?: string[] }> }>,
  rootObjectName: string,
): CloneGraph {
  const nodes = new Map<string, CloneNode>();
  const edges: CloneGraph['edges'] = [];
  const visited = new Set<string>();
  const queue = [rootObjectName];

  while (queue.length > 0) {
    const objName = queue.shift()!;
    if (visited.has(objName)) continue;
    visited.add(objName);

    const describe = describes.get(objName);
    if (!describe) continue;

    const refFields: CloneNode['referenceFields'] = [];
    for (const field of describe.fields) {
      if (field.type === 'reference' && field.referenceTo && field.referenceTo.length > 0) {
        const target = field.referenceTo[0];
        refFields.push({ field: field.name, referenceTo: target });
        edges.push({ from: objName, field: field.name, to: target });
        if (describes.has(target) && !visited.has(target)) {
          queue.push(target);
        }
      }
    }

    nodes.set(objName, { objectName: objName, referenceFields: refFields });
  }

  return { nodes, edges };
}

/** Topological sort using Kahn's algorithm. Returns object names in insert order. O(O + E). */
export function topologicalSort(graph: CloneGraph): string[] {
  const inDegree = new Map<string, number>();
  for (const name of graph.nodes.keys()) inDegree.set(name, 0);

  for (const edge of graph.edges) {
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
    for (const edge of graph.edges) {
      if (edge.to === node) {
        const newDeg = (inDegree.get(edge.from) ?? 1) - 1;
        inDegree.set(edge.from, newDeg);
        if (newDeg === 0) queue.push(edge.from);
      }
    }
  }

  // Add any remaining nodes (cycles) at the end
  for (const name of graph.nodes.keys()) {
    if (!sorted.includes(name)) sorted.push(name);
  }

  return sorted;
}

/** Detect circular references in the graph. Returns arrays of cycle paths. O(O + E). */
export function detectCircularReferences(graph: CloneGraph): string[][] {
  const cycles: string[][] = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const name of graph.nodes.keys()) color.set(name, WHITE);

  // Build adjacency from edges (from depends on to, so from -> to)
  const adj = new Map<string, string[]>();
  for (const name of graph.nodes.keys()) adj.set(name, []);
  for (const edge of graph.edges) {
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
        parent.set(v, u);
        dfs(v, [...path]);
      }
    }

    color.set(u, BLACK);
  }

  for (const name of graph.nodes.keys()) {
    if (color.get(name) === WHITE) {
      dfs(name, []);
    }
  }

  return cycles;
}

/** Remap reference field values using an old->new ID map. O(N*R). */
export function remapIds(
  records: Record<string, unknown>[],
  idMap: Map<string, string>,
  referenceFields: string[],
): Record<string, unknown>[] {
  return records.map(r => {
    const remapped = { ...r };
    for (const field of referenceFields) {
      const oldId = remapped[field];
      if (typeof oldId === 'string' && idMap.has(oldId)) {
        remapped[field] = idMap.get(oldId);
      }
    }
    return remapped;
  });
}
