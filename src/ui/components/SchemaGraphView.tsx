/**
 * Visual schema relationship graph component (CSS-only, no external libs).
 *
 * What this file does:
 * - Renders a scrollable container with absolutely-positioned node cards.
 * - Draws SVG lines (edges) between connected nodes.
 * - Highlights the root object and selected object with accent styling.
 * - Clicking a node triggers the onSelectObject callback.
 *
 * Complexity:
 * - O(N + E) where N is the number of nodes and E is the number of edges.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { SchemaGraph } from '../utils/schemaGraph';

/** Node dimensions must match the layout spacing for edge endpoints. */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

export function SchemaGraphView(props: {
  graph: SchemaGraph;
  rootObject: string;
  layout: Map<string, { x: number; y: number; level: number }>;
  selectedObject: string | null;
  onSelectObject: (name: string) => void;
}): VNode {
  const { graph, rootObject, layout, selectedObject, onSelectObject } = props;

  // Compute bounds for the container by finding min/max coordinates
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pos of layout.values()) {
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
    if (pos.x > maxX) maxX = pos.x;
    if (pos.y > maxY) maxY = pos.y;
  }

  // Add padding around the graph
  const padding = 60;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;
  const containerWidth = maxX - minX + NODE_WIDTH + padding * 2;
  const containerHeight = maxY - minY + NODE_HEIGHT + padding * 2;

  /** Get the center point of a node for edge drawing. */
  function getNodeCenter(name: string): { cx: number; cy: number } | null {
    const pos = layout.get(name);
    if (!pos) return null;
    return {
      cx: pos.x + offsetX + NODE_WIDTH / 2,
      cy: pos.y + offsetY + NODE_HEIGHT / 2,
    };
  }

  /** Determine the node border color. */
  function getNodeBorderColor(name: string): string {
    if (name === rootObject) return 'var(--wl-accent)';
    if (name === selectedObject) return 'var(--wl-accent)';
    return 'var(--wl-line)';
  }

  /** Determine the node border width. */
  function getNodeBorderWidth(name: string): string {
    if (name === rootObject || name === selectedObject) return '2px';
    return '1px';
  }

  // Build edge lines
  const edgeLines: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    key: string;
  }> = [];

  for (const edge of graph.edges) {
    const fromCenter = getNodeCenter(edge.from);
    const toCenter = getNodeCenter(edge.to);
    if (!fromCenter || !toCenter) continue;

    edgeLines.push({
      x1: fromCenter.cx,
      y1: fromCenter.cy,
      x2: toCenter.cx,
      y2: toCenter.cy,
      key: `${edge.from}-${edge.to}-${edge.field}`,
    });
  }

  return (
    <div
      style={`position:relative;overflow:auto;width:100%;min-height:400px;max-height:600px;border:1px solid var(--wl-line-2);border-radius:var(--wl-radius-sm);background:rgba(7,32,51,0.02)`}
    >
      <div style={`position:relative;width:${containerWidth}px;height:${containerHeight}px`}>
        {/* SVG layer for edges */}
        <svg
          style={`position:absolute;top:0;left:0;width:${containerWidth}px;height:${containerHeight}px;pointer-events:none`}
        >
          {edgeLines.map((line) => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--wl-line)"
              stroke-width="1.5"
              stroke-opacity="0.5"
            />
          ))}
        </svg>

        {/* Node cards */}
        {Array.from(layout.entries()).map(([name, pos]) => {
          const node = graph.nodes.get(name);
          if (!node) return null;

          const isRoot = name === rootObject;
          const isSelected = name === selectedObject;
          const borderColor = getNodeBorderColor(name);
          const borderWidth = getNodeBorderWidth(name);

          return (
            <div
              key={name}
              class="wl-card"
              style={`position:absolute;left:${pos.x + offsetX}px;top:${pos.y + offsetY}px;width:${NODE_WIDTH}px;height:${NODE_HEIGHT}px;cursor:pointer;border:${borderWidth} solid ${borderColor};display:flex;flex-direction:column;justify-content:center;padding:8px 10px;overflow:hidden;animation:none;${
                isRoot || isSelected ? 'box-shadow:0 0 0 3px var(--wl-glow);' : ''
              }`}
              onClick={() => onSelectObject(name)}
            >
              <div
                style={`font-weight:900;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${
                  isRoot ? 'color:var(--wl-accent);' : ''
                }`}
                title={node.label}
              >
                {node.objectName}
              </div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                <span class="wl-badge" style="font-size:10px;padding:2px 6px">
                  {node.fields.length} fields
                </span>
                {isRoot ? (
                  <span class="wl-badge" style="font-size:10px;padding:2px 6px;border-color:rgba(0,166,200,0.55);color:var(--wl-accent)">
                    root
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
