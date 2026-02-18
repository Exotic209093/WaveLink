/**
 * Schema relationship graph builder.
 * Constructs a directed graph of SObject relationships from field metadata,
 * supports BFS traversal and basic hierarchical layout computation.
 * Complexity: O(N*F) for graph construction where N=objects, F=fields.
 */

/** A node in the schema graph representing a single SObject. */
export interface SchemaNode {
  objectName: string;
  label: string;
  fields: Array<{ name: string; type: string; referenceTo?: string[]; nillable?: boolean }>;
  childRelationships: Array<{ childSObject: string; field: string; relationshipName: string | null; restrictedDelete: boolean }>;
}

/** A directed edge representing a reference (lookup/master-detail) between objects. */
export interface SchemaEdge {
  from: string;
  to: string;
  field: string;
  relationshipName?: string;
  type: 'lookup' | 'masterDetail';
}

/** The complete schema graph with nodes and edges. */
export interface SchemaGraph {
  nodes: Map<string, SchemaNode>;
  edges: SchemaEdge[];
}

/**
 * Build a schema graph from a map of SObject describes. O(N*F).
 *
 * Iterates over all fields in every describe, extracting reference-type fields
 * as directed edges. Uses `nillable: false` as a heuristic for master-detail,
 * and cross-checks against childRelationships.restrictedDelete when available.
 *
 * @param describes - Map of objectName to SchemaNode.
 * @returns A SchemaGraph with all nodes and extracted edges.
 */
export function buildSchemaGraph(describes: Map<string, SchemaNode>): SchemaGraph {
  const nodes = new Map(describes);
  const edges: SchemaEdge[] = [];

  // Build a lookup of restrictedDelete by (parentObject, field) for master-detail detection
  const restrictedDeleteKeys = new Set<string>();
  for (const node of Array.from(describes.values())) {
    for (const cr of node.childRelationships) {
      if (cr.restrictedDelete) {
        restrictedDeleteKeys.add(`${cr.childSObject}:${cr.field}`);
      }
    }
  }

  for (const [objectName, node] of Array.from(describes.entries())) {
    for (const field of node.fields) {
      if (!field.referenceTo || field.referenceTo.length === 0) continue;

      const isReference = field.type.toLowerCase() === 'reference';
      if (!isReference) continue;

      for (const target of field.referenceTo) {
        const relationshipName = field.name.endsWith('Id')
          ? field.name.slice(0, -2)
          : field.name.replace(/__c$/, '__r');

        // Master-detail: restrictedDelete on the parent OR nillable:false on the field
        const isMasterDetail =
          restrictedDeleteKeys.has(`${objectName}:${field.name}`) ||
          field.nillable === false;

        edges.push({
          from: objectName,
          to: target,
          field: field.name,
          relationshipName,
          type: isMasterDetail ? 'masterDetail' : 'lookup',
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Get all objects related to a given object within `depth` hops via BFS. O(N+E).
 *
 * @param graph - The schema graph to traverse.
 * @param objectName - The starting object name.
 * @param depth - Maximum BFS depth (number of hops).
 * @returns A set of related object names (excludes the starting object).
 */
export function getRelatedObjects(
  graph: SchemaGraph,
  objectName: string,
  depth: number,
): Set<string> {
  const visited = new Set<string>();
  const queue: Array<{ name: string; level: number }> = [{ name: objectName, level: 0 }];
  visited.add(objectName);

  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from)!.push(edge.to);
    adjacency.get(edge.to)!.push(edge.from);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.level >= depth) continue;

    const neighbors = adjacency.get(current.name) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ name: neighbor, level: current.level + 1 });
      }
    }
  }

  visited.delete(objectName);
  return visited;
}

/**
 * Get all edges that connect from or to a specific object. O(E).
 *
 * @param graph - The schema graph to query.
 * @param objectName - The object name to find relationships for.
 * @returns An array of edges where the object is either the source or target.
 */
export function getFieldRelationships(
  graph: SchemaGraph,
  objectName: string,
): SchemaEdge[] {
  return graph.edges.filter(e => e.from === objectName || e.to === objectName);
}

/**
 * Find the shortest edge-path between two objects via BFS. O(N+E).
 *
 * @param graph - The schema graph to search.
 * @param fromObject - Starting object name.
 * @param toObject - Target object name.
 * @returns Ordered array of edges forming the path, or null if no path exists.
 */
export function findPath(
  graph: SchemaGraph,
  fromObject: string,
  toObject: string,
): SchemaEdge[] | null {
  if (fromObject === toObject) return [];

  // BFS tracking the edge used to reach each node
  const cameFrom = new Map<string, { via: SchemaEdge; from: string } | null>();
  cameFrom.set(fromObject, null);
  const queue: string[] = [fromObject];

  outer: while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      let neighbor: string | null = null;
      if (edge.from === current && !cameFrom.has(edge.to)) {
        neighbor = edge.to;
        cameFrom.set(neighbor, { via: edge, from: current });
      } else if (edge.to === current && !cameFrom.has(edge.from)) {
        neighbor = edge.from;
        cameFrom.set(neighbor, { via: edge, from: current });
      }
      if (neighbor) {
        if (neighbor === toObject) break outer;
        queue.push(neighbor);
      }
    }
  }

  if (!cameFrom.has(toObject)) return null;

  // Reconstruct path
  const path: SchemaEdge[] = [];
  let current: string | null = toObject;
  while (current && current !== fromObject) {
    const entry = cameFrom.get(current);
    if (!entry) break;
    path.unshift(entry.via);
    current = entry.from;
  }
  return path;
}

/**
 * Compute a radial (solar-system) layout for visualization via BFS from a root. O(N+E).
 *
 * The root object sits at the origin (0, 0). Each subsequent depth level is
 * placed on a concentric orbit ring, spaced evenly around the circumference.
 * The orbit radius grows to ensure nodes never overlap regardless of count.
 *
 * Positions represent the CENTER of each node.
 *
 * @param graph - The schema graph to lay out.
 * @param rootObject - The root object to place at center.
 * @returns A map of objectName to position `{ x, y, level }`.
 */
export function computeLayout(
  graph: SchemaGraph,
  rootObject: string,
): Map<string, { x: number; y: number; level: number }> {
  const layout = new Map<string, { x: number; y: number; level: number }>();
  const visited = new Set<string>();
  const levelBuckets = new Map<number, string[]>();

  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from)!.push(edge.to);
    adjacency.get(edge.to)!.push(edge.from);
  }

  const queue: Array<{ name: string; level: number }> = [{ name: rootObject, level: 0 }];
  visited.add(rootObject);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!levelBuckets.has(current.level)) levelBuckets.set(current.level, []);
    levelBuckets.get(current.level)!.push(current.name);

    const neighbors = adjacency.get(current.name) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor) && graph.nodes.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ name: neighbor, level: current.level + 1 });
      }
    }
  }

  // Root at the center
  layout.set(rootObject, { x: 0, y: 0, level: 0 });

  // Base orbit radii per depth level (px between centers)
  const BASE_RADII = [0, 260, 500, 760, 1020];
  // Minimum arc distance between adjacent node centers at each ring
  const MIN_ARC_SPACING = 180;

  for (const [level, objects] of Array.from(levelBuckets.entries())) {
    if (level === 0) continue;

    const count = objects.length;
    const baseR = BASE_RADII[Math.min(level, BASE_RADII.length - 1)];
    // Increase radius if there are too many objects to fit without overlap
    const minRForCount = (count * MIN_ARC_SPACING) / (2 * Math.PI);
    const radius = Math.max(baseR, minRForCount);

    for (let i = 0; i < count; i++) {
      // Offset starting angle so first node is at top (-π/2)
      // Rotate each level slightly so rings don't stack vertically
      const angleOffset = (level % 2 === 0) ? 0 : Math.PI / count;
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2 + angleOffset;

      layout.set(objects[i], {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
        level,
      });
    }
  }

  return layout;
}
