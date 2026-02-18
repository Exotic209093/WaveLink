/**
 * Solar-system schema relationship graph with pan + zoom.
 *
 * Interaction:
 * - Drag anywhere on the canvas to pan.
 * - Scroll wheel to zoom in/out, centred on the cursor position.
 * - Click a node (without dragging) to select it.
 * - Toolbar buttons: zoom-in, zoom-out, reset view.
 *
 * Rendering:
 * - Root object ("Sun") sits at centre with a glow ring.
 * - Related objects orbit on concentric depth rings.
 * - Faint dashed orbit guides and DEPTH N labels.
 * - Quadratic bezier edges with directional arrowheads.
 * - Hovering an edge shows the field name via SVG <title>.
 * - Custom objects (ending __c) have an amber accent border.
 *
 * Complexity: O(N + E).
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { SchemaGraph } from '../utils/schemaGraph';

const NODE_W = 164;
const NODE_H = 60;
const ROOT_W = 200;
const ROOT_H = 72;
const PADDING = 80;

/** Find the exit point on the rectangle border (half-dims hw×hh centred at cx,cy)
 *  of a line arriving from (ox,oy), set back by `inset` pixels. */
function rectEdgePoint(
  ox: number, oy: number,
  cx: number, cy: number,
  hw: number, hh: number,
  inset: number,
): { x: number; y: number } {
  const dx = cx - ox, dy = cy - oy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { x: cx, y: cy };
  const nx = dx / len, ny = dy / len;
  const tx = nx !== 0 ? hw / Math.abs(nx) : Infinity;
  const ty = ny !== 0 ? hh / Math.abs(ny) : Infinity;
  const t = Math.min(tx, ty) + inset;
  return { x: cx - nx * t, y: cy - ny * t };
}

/** Bow an edge slightly outward from the graph centre. */
function controlPoint(
  x1: number, y1: number,
  x2: number, y2: number,
  cx: number, cy: number,
): { x: number; y: number } {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const vx = mx - cx, vy = my - cy;
  const vlen = Math.sqrt(vx * vx + vy * vy);
  if (vlen < 10) return { x: mx, y: my };
  const bow = 0.12;
  return { x: mx + (vx / vlen) * vlen * bow, y: my + (vy / vlen) * vlen * bow };
}

const LEVEL_FILLS = [
  '',
  'rgba(2,132,168,0.07)',
  'rgba(72,202,228,0.05)',
  'rgba(109,213,208,0.04)',
  'rgba(150,220,210,0.03)',
];

export function SchemaGraphView(props: {
  graph: SchemaGraph;
  rootObject: string;
  layout: Map<string, { x: number; y: number; level: number }>;
  selectedObject: string | null;
  onSelectObject: (name: string) => void;
}): VNode {
  const { graph, rootObject, layout, selectedObject, onSelectObject } = props;

  // ── Pan / zoom state ─────────────────────────────────────────────
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const dragMovedRef = useRef(false);

  // ── Bounds & offsets ─────────────────────────────────────────────
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pos of layout.values()) {
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
    if (pos.x > maxX) maxX = pos.x;
    if (pos.y > maxY) maxY = pos.y;
  }
  const offX = -minX + PADDING + ROOT_W / 2;
  const offY = -minY + PADDING + ROOT_H / 2;
  const svgW = maxX - minX + ROOT_W + PADDING * 2;
  const svgH = maxY - minY + ROOT_H + PADDING * 2;
  const centerX = offX; // root centre in SVG coords
  const centerY = offY;

  // Centre on root whenever the graph changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPanX(width / 2 - offX);
    setPanY(height / 2 - offY);
    setZoom(1);
  }, [offX, offY]);

  // ── Drag listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;

    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMovedRef.current = true;
      setPanX(dragRef.current.startPanX + dx);
      setPanY(dragRef.current.startPanY + dy);
    }

    function onUp() {
      setIsDragging(false);
      dragRef.current = null;
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // ── Wheel zoom (non-passive so we can preventDefault) ────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      setZoom(prevZoom => {
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.12, Math.min(5, prevZoom * factor));
        const ratio = newZoom / prevZoom;
        setPanX(prev => mx - (mx - prev) * ratio);
        setPanY(prev => my - (my - prev) * ratio);
        return newZoom;
      });
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    dragMovedRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };
    setIsDragging(true);
  }

  function handleNodeClick(name: string) {
    if (dragMovedRef.current) return; // was a pan, not a click
    onSelectObject(name);
  }

  function resetView() {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPanX(width / 2 - offX);
    setPanY(height / 2 - offY);
    setZoom(1);
  }

  function zoomBy(factor: number) {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const mx = width / 2, my = height / 2;
    setZoom(prev => {
      const newZoom = Math.max(0.12, Math.min(5, prev * factor));
      const ratio = newZoom / prev;
      setPanX(p => mx - (mx - p) * ratio);
      setPanY(p => my - (my - p) * ratio);
      return newZoom;
    });
  }

  // ── Orbit rings ───────────────────────────────────────────────────
  const orbitRadii = new Map<number, number>();
  for (const pos of layout.values()) {
    if (pos.level === 0) continue;
    const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
    if (r > (orbitRadii.get(pos.level) ?? 0)) orbitRadii.set(pos.level, r);
  }

  // ── Edges ─────────────────────────────────────────────────────────
  type EP = { d: string; markerId: string; stroke: string; label: string; key: string; highlight: boolean };
  const edgePaths: EP[] = [];

  for (const edge of graph.edges) {
    const fp = layout.get(edge.from), tp = layout.get(edge.to);
    if (!fp || !tp) continue;

    const fCx = fp.x + offX, fCy = fp.y + offY;
    const tCx = tp.x + offX, tCy = tp.y + offY;
    const fromHW = edge.from === rootObject ? ROOT_W / 2 : NODE_W / 2;
    const fromHH = edge.from === rootObject ? ROOT_H / 2 : NODE_H / 2;
    const toHW = edge.to === rootObject ? ROOT_W / 2 : NODE_W / 2;
    const toHH = edge.to === rootObject ? ROOT_H / 2 : NODE_H / 2;

    const src = rectEdgePoint(tCx, tCy, fCx, fCy, fromHW, fromHH, 4);
    const dst = rectEdgePoint(fCx, fCy, tCx, tCy, toHW, toHH, 7);
    const cp = (edge.from === rootObject || edge.to === rootObject)
      ? { x: (src.x + dst.x) / 2, y: (src.y + dst.y) / 2 }
      : controlPoint(src.x, src.y, dst.x, dst.y, centerX, centerY);

    const isMD = edge.type === 'masterDetail';
    const highlight = selectedObject !== null &&
      (edge.from === selectedObject || edge.to === selectedObject);

    edgePaths.push({
      d: `M${src.x},${src.y} Q${cp.x},${cp.y} ${dst.x},${dst.y}`,
      markerId: isMD ? 'wlg-arrow-md' : 'wlg-arrow-lk',
      stroke: isMD ? 'rgba(239,68,96,0.55)' : 'rgba(2,132,168,0.40)',
      label: `${edge.from} → ${edge.to}  [${edge.field}]`,
      key: `${edge.from}-${edge.to}-${edge.field}`,
      highlight,
    });
  }

  const zoomPct = Math.round(zoom * 100);

  return (
    <div style="position:relative;border-radius:var(--wl-radius-sm);overflow:hidden">
      {/* ── Toolbar ── */}
      <div style="position:absolute;top:10px;right:10px;z-index:10;display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border:1px solid var(--wl-line-2);border-radius:999px;padding:4px 8px">
        <button
          class="wl-btn"
          style="padding:2px 8px;font-size:13px;font-weight:900;border:none;background:transparent"
          onClick={() => zoomBy(1.25)}
          title="Zoom in"
        >+</button>
        <span style="font-size:11px;color:var(--wl-ink-dim);min-width:36px;text-align:center;font-weight:700">{zoomPct}%</span>
        <button
          class="wl-btn"
          style="padding:2px 8px;font-size:13px;font-weight:900;border:none;background:transparent"
          onClick={() => zoomBy(0.8)}
          title="Zoom out"
        >−</button>
        <div style="width:1px;height:14px;background:var(--wl-line-2);margin:0 2px" />
        <button
          class="wl-btn"
          style="padding:2px 8px;font-size:11px;border:none;background:transparent;white-space:nowrap"
          onClick={resetView}
          title="Reset view"
        >⌂ Reset</button>
      </div>

      {/* ── Pan / zoom canvas ── */}
      <div
        ref={containerRef}
        style={`width:100%;height:540px;overflow:hidden;cursor:${isDragging ? 'grabbing' : 'grab'};user-select:none;background:rgba(4,20,34,0.04);border-radius:var(--wl-radius-sm);`}
        onMouseDown={handleMouseDown}
      >
        {/* Transformed inner world */}
        <div style={`position:absolute;top:0;left:0;transform:translate(${panX}px,${panY}px) scale(${zoom});transform-origin:0 0;will-change:transform;`}>
          <div style={`position:relative;width:${svgW}px;height:${svgH}px`}>

            {/* SVG: rings + edges */}
            <svg
              style={`position:absolute;top:0;left:0;width:${svgW}px;height:${svgH}px;pointer-events:none;overflow:visible`}
              aria-hidden="true"
            >
              <defs>
                <marker id="wlg-arrow-lk" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,1.5 L7,4 L0,6.5 Z" fill="rgba(2,132,168,0.7)" />
                </marker>
                <marker id="wlg-arrow-md" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,1.5 L7,4 L0,6.5 Z" fill="rgba(239,68,96,0.7)" />
                </marker>
              </defs>

              {/* Orbit rings */}
              {Array.from(orbitRadii.entries()).sort((a, b) => a[0] - b[0]).map(([level, r]) => (
                <g key={`ring-${level}`}>
                  <circle
                    cx={centerX} cy={centerY} r={r}
                    fill={LEVEL_FILLS[Math.min(level, LEVEL_FILLS.length - 1)]}
                    stroke="rgba(2,132,168,0.15)"
                    stroke-width="1"
                    stroke-dasharray="6 5"
                  />
                  <text
                    x={centerX} y={centerY - r - 7}
                    text-anchor="middle"
                    font-size="10"
                    font-weight="700"
                    letter-spacing="0.6"
                    fill="rgba(2,132,168,0.40)"
                    font-family="inherit"
                    style="pointer-events:none"
                  >
                    DEPTH {level}
                  </text>
                </g>
              ))}

              {/* Edges */}
              {edgePaths.map(ep => (
                <g key={ep.key} style="pointer-events:all">
                  <path d={ep.d} fill="none" stroke="transparent" stroke-width="14">
                    <title>{ep.label}</title>
                  </path>
                  <path
                    d={ep.d}
                    fill="none"
                    stroke={ep.stroke}
                    stroke-width={ep.highlight ? 2.5 : 1.5}
                    stroke-opacity={ep.highlight ? 1 : 0.75}
                    marker-end={`url(#${ep.markerId})`}
                    style="pointer-events:none"
                  >
                    <title>{ep.label}</title>
                  </path>
                </g>
              ))}
            </svg>

            {/* Node cards */}
            {Array.from(layout.entries()).map(([name, pos]) => {
              const node = graph.nodes.get(name);
              if (!node) return null;

              const isRoot = name === rootObject;
              const isSelected = name === selectedObject;
              const isCustom = name.endsWith('__c');
              const nw = isRoot ? ROOT_W : NODE_W;
              const nh = isRoot ? ROOT_H : NODE_H;
              const relCount = graph.edges.filter(e => e.from === name || e.to === name).length;

              let border = '1px solid var(--wl-line)';
              let shadow = '';
              let bg = '';

              if (isRoot) {
                border = '2px solid var(--wl-accent)';
                shadow = '0 0 0 5px rgba(2,132,168,0.16),0 0 28px rgba(2,132,168,0.20)';
                bg = 'background:rgba(2,132,168,0.09);';
              } else if (isSelected) {
                border = '2px solid var(--wl-accent)';
                shadow = '0 0 0 3px rgba(2,132,168,0.20)';
              } else if (isCustom) {
                border = '1px solid rgba(240,160,40,0.55)';
              }

              return (
                <div
                  key={name}
                  class="wl-card"
                  style={`
                    position:absolute;
                    left:${pos.x + offX - nw / 2}px;
                    top:${pos.y + offY - nh / 2}px;
                    width:${nw}px;height:${nh}px;
                    cursor:pointer;border:${border};${bg}
                    display:flex;flex-direction:column;justify-content:center;
                    padding:6px 10px;overflow:hidden;animation:none;
                    ${shadow ? `box-shadow:${shadow};` : ''}
                    transition:border-color 120ms ease,box-shadow 120ms ease;
                  `}
                  onMouseDown={(e: MouseEvent) => e.stopPropagation()}
                  onClick={() => handleNodeClick(name)}
                >
                  <div
                    style={`font-weight:900;font-size:${isRoot ? 13 : 11}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${isRoot ? 'var(--wl-accent)' : 'var(--wl-ink)'}`}
                    title={node.label !== node.objectName ? `${node.label} (${node.objectName})` : node.objectName}
                  >
                    {node.objectName}
                  </div>
                  {node.label !== node.objectName ? (
                    <div style="font-size:10px;color:var(--wl-ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">
                      {node.label}
                    </div>
                  ) : null}
                  <div style="display:flex;align-items:center;gap:4px;margin-top:5px;flex-wrap:wrap">
                    <span class="wl-badge" style="font-size:10px;padding:1px 5px" title={`${node.fields.length} fields`}>
                      {node.fields.length}f
                    </span>
                    {relCount > 0 ? (
                      <span class="wl-badge" style="font-size:10px;padding:1px 5px;border-color:rgba(2,132,168,0.30);color:var(--wl-accent)" title={`${relCount} edges in graph`}>
                        {relCount}r
                      </span>
                    ) : null}
                    {isRoot ? (
                      <span class="wl-badge" style="font-size:10px;padding:1px 5px;border-color:rgba(2,132,168,0.55);color:var(--wl-accent);font-weight:900">ROOT</span>
                    ) : null}
                    {isCustom ? (
                      <span class="wl-badge" style="font-size:10px;padding:1px 5px;border-color:rgba(240,160,40,0.5);color:rgba(200,130,20,0.9)">custom</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Usage hint */}
      <div style="position:absolute;bottom:8px;left:12px;font-size:10px;color:var(--wl-ink-dim);pointer-events:none;font-weight:600;letter-spacing:0.2px">
        Drag to pan · Scroll to zoom
      </div>
    </div>
  );
}
