/**
 * Solar-system schema relationship graph with pan + zoom.
 *
 * Interaction:
 * - Drag anywhere on the canvas to pan.
 * - Scroll wheel to zoom in/out, centred on the cursor position.
 * - Click a node (without dragging) to select it.
 * - Hover a node to dim unrelated nodes and edges.
 * - Toolbar buttons: zoom-in, zoom-out, fit, reset, labels, legend, fullscreen.
 * - Search overlay (top-left) filters visible nodes by name.
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
import { memo } from 'preact/compat';
import type { VNode } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
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

const TOOLBAR_PILL = 'background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border:1px solid var(--wl-line-2);border-radius:999px;';

type EP = {
  d: string; markerId: string; stroke: string; label: string;
  key: string; highlight: boolean; edgeActive: boolean;
  mx: number; my: number; fieldLabel: string;
};

function SchemaGraphViewInner(props: {
  graph: SchemaGraph;
  rootObject: string;
  layout: Map<string, { x: number; y: number; level: number }>;
  selectedObject: string | null;
  onSelectObject: (name: string) => void;
  showRings?: boolean;
}): VNode {
  const { graph, rootObject, layout, selectedObject, onSelectObject, showRings = true } = props;

  // ── Pan / zoom state ─────────────────────────────────────────────
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Feature toggles ──────────────────────────────────────────────
  const [hoveredObject, setHoveredObject] = useState<string | null>(null);
  const [graphSearch, setGraphSearch] = useState('');
  const [showLegend, setShowLegend] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const dragMovedRef = useRef(false);

  // ── Bounds & offsets — memoized, only recomputes when layout changes ──
  const { minX, minY, maxX, maxY } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of layout.values()) {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y > maxY) maxY = pos.y;
    }
    return { minX, minY, maxX, maxY };
  }, [layout]);

  const offX = -minX + PADDING + ROOT_W / 2;
  const offY = -minY + PADDING + ROOT_H / 2;
  const svgW = maxX - minX + ROOT_W + PADDING * 2;
  const svgH = maxY - minY + ROOT_H + PADDING * 2;
  const centerX = offX; // root centre in SVG coords
  const centerY = offY;

  // ── Hover connectivity set — memoized, only recomputes when hover or edges change ──
  const connectedTo = useMemo(() => {
    const set = new Set<string>();
    if (hoveredObject) {
      for (const edge of graph.edges) {
        if (edge.from === hoveredObject) set.add(edge.to);
        if (edge.to === hoveredObject) set.add(edge.from);
      }
    }
    return set;
  }, [graph.edges, hoveredObject]);

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

  function fitAll() {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 48;
    const newZoom = Math.max(0.1, Math.min(1, Math.min(
      (width - margin * 2) / svgW,
      (height - margin * 2) / svgH,
    )));
    setPanX((width - svgW * newZoom) / 2);
    setPanY((height - svgH * newZoom) / 2);
    setZoom(newZoom);
  }

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Auto-fit when entering fullscreen (after DOM updates)
  useEffect(() => {
    if (!isFullscreen) return;
    const id = requestAnimationFrame(() => fitAll());
    return () => cancelAnimationFrame(id);
  }, [isFullscreen]);

  // ── Orbit rings — memoized, only recomputes when layout changes ──
  const orbitRadii = useMemo(() => {
    const radii = new Map<number, number>();
    for (const pos of layout.values()) {
      if (pos.level === 0) continue;
      const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      if (r > (radii.get(pos.level) ?? 0)) radii.set(pos.level, r);
    }
    return radii;
  }, [layout]);

  // ── Edge counts per node — memoized to avoid O(N×E) in node render loop ──
  const relCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of graph.edges) {
      counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
      counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
    }
    return counts;
  }, [graph.edges]);

  // ── Edge paths — memoized, recomputes when graph, layout, or interaction state changes ──
  const edgePaths = useMemo(() => {
    const paths: EP[] = [];
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
      const edgeActive = !hoveredObject ||
        edge.from === hoveredObject || edge.to === hoveredObject;

      // Quadratic bezier midpoint at t=0.5: (P0 + 2*P1 + P2) / 4
      const bmx = (src.x + 2 * cp.x + dst.x) / 4;
      const bmy = (src.y + 2 * cp.y + dst.y) / 4;

      paths.push({
        d: `M${src.x},${src.y} Q${cp.x},${cp.y} ${dst.x},${dst.y}`,
        markerId: isMD ? 'wlg-arrow-md' : 'wlg-arrow-lk',
        stroke: isMD ? 'rgba(239,68,96,0.55)' : 'rgba(2,132,168,0.40)',
        label: `${edge.from} → ${edge.to}  [${edge.field}]`,
        key: `${edge.from}-${edge.to}-${edge.field}`,
        highlight,
        edgeActive,
        mx: bmx,
        my: bmy,
        fieldLabel: edge.field,
      });
    }
    return paths;
  }, [graph.edges, layout, hoveredObject, selectedObject, rootObject, offX, offY, centerX, centerY]);

  // ── Search matches — memoized, only recomputes when search query or nodes change ──
  const searchMatches = useMemo(() => {
    const query = graphSearch.trim().toLowerCase();
    if (!query) return null; // null means "no active search"
    const matches = new Set<string>();
    for (const [name, node] of graph.nodes.entries()) {
      if (name.toLowerCase().includes(query) || node.label.toLowerCase().includes(query)) {
        matches.add(name);
      }
    }
    return matches;
  }, [graph.nodes, graphSearch]);

  const zoomPct = Math.round(zoom * 100);

  const outerStyle = isFullscreen
    ? 'position:fixed;inset:0;z-index:9999;background:var(--wl-bg, #0a1628);display:flex;flex-direction:column;overflow:hidden;'
    : 'position:relative;border-radius:var(--wl-radius-sm);overflow:hidden;';

  const btnBase = 'padding:2px 8px;font-size:11px;border:none;background:transparent;white-space:nowrap';

  return (
    <div style={outerStyle}>

      {/* ── In-graph search overlay ── */}
      <div style="position:absolute;top:10px;left:10px;z-index:10">
        <input
          type="text"
          value={graphSearch}
          onInput={(e) => setGraphSearch((e.currentTarget as HTMLInputElement).value)}
          onMouseDown={(e: MouseEvent) => e.stopPropagation()}
          placeholder="Search nodes…"
          style={`${TOOLBAR_PILL}padding:4px 12px;font-size:11px;font-weight:600;outline:none;color:var(--wl-ink);width:148px;${graphSearch ? 'border-color:rgba(2,132,168,0.50);box-shadow:0 0 0 2px rgba(2,132,168,0.12);' : ''}`}
        />
      </div>

      {/* ── Toolbar ── */}
      <div style={`position:absolute;top:10px;right:10px;z-index:10;display:flex;align-items:center;gap:4px;${TOOLBAR_PILL}padding:4px 8px`}>
        <button class="wl-btn" style={`${btnBase};font-size:13px;font-weight:900`} onClick={() => zoomBy(1.25)} title="Zoom in" aria-label="Zoom in">+</button>
        <span style="font-size:11px;color:var(--wl-ink-dim);min-width:36px;text-align:center;font-weight:700">{zoomPct}%</span>
        <button class="wl-btn" style={`${btnBase};font-size:13px;font-weight:900`} onClick={() => zoomBy(0.8)} title="Zoom out" aria-label="Zoom out">−</button>
        <div style="width:1px;height:14px;background:var(--wl-line-2);margin:0 2px" />
        <button class="wl-btn" style={btnBase} onClick={fitAll} title="Zoom to fit all nodes">⊡ Fit</button>
        <button class="wl-btn" style={btnBase} onClick={resetView} title="Reset view">⌂ Reset</button>
        <div style="width:1px;height:14px;background:var(--wl-line-2);margin:0 2px" />
        <button
          class="wl-btn"
          style={`${btnBase}${showEdgeLabels ? ';background:rgba(2,132,168,0.10);border-color:rgba(2,132,168,0.35);color:var(--wl-accent);font-weight:700' : ''}`}
          onClick={() => setShowEdgeLabels(l => !l)}
          title="Toggle field labels on edges"
        >≡ Labels</button>
        <button
          class="wl-btn"
          style={`${btnBase}${showLegend ? ';background:rgba(2,132,168,0.10);border-color:rgba(2,132,168,0.35);color:var(--wl-accent);font-weight:700' : ''}`}
          onClick={() => setShowLegend(l => !l)}
          title="Toggle legend"
        >⊞ Legend</button>
        <div style="width:1px;height:14px;background:var(--wl-line-2);margin:0 2px" />
        <button
          class="wl-btn"
          style={btnBase}
          onClick={() => setIsFullscreen(f => !f)}
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        >{isFullscreen ? '⤡ Exit' : '⤢ Full'}</button>
      </div>

      {/* ── Pan / zoom canvas ── */}
      <div
        ref={containerRef}
        style={`width:100%;${isFullscreen ? 'flex:1;' : 'height:680px;'}overflow:hidden;cursor:${isDragging ? 'grabbing' : 'grab'};user-select:none;background:rgba(4,20,34,0.04);border-radius:${isFullscreen ? '0' : 'var(--wl-radius-sm)'};`}
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

              {/* Orbit rings (orbital mode only) */}
              {showRings && Array.from(orbitRadii.entries()).sort((a, b) => a[0] - b[0]).map(([level, r]) => (
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
                <g
                  key={ep.key}
                  style={`pointer-events:all;opacity:${ep.edgeActive ? 1 : 0.07};transition:opacity 140ms ease`}
                >
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

              {/* Edge field labels (toggled) */}
              {showEdgeLabels && edgePaths.map(ep => (
                <text
                  key={`lbl-${ep.key}`}
                  x={ep.mx} y={ep.my}
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size="9"
                  font-family="inherit"
                  fill={ep.highlight ? 'var(--wl-accent, #0284a8)' : 'rgba(7,32,51,0.60)'}
                  stroke="rgba(255,255,255,0.88)"
                  stroke-width="3"
                  stroke-linejoin="round"
                  style={`pointer-events:none;paint-order:stroke;opacity:${ep.edgeActive ? 1 : 0.15};transition:opacity 140ms ease`}
                >
                  {ep.fieldLabel}
                </text>
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
              const relCount = relCounts.get(name) ?? 0;

              // Hover dimming
              const nodeActive = !hoveredObject || name === hoveredObject || connectedTo.has(name);

              // Search matching — O(1) Set lookup instead of per-node string ops
              const searchMatch = searchMatches === null || searchMatches.has(name);

              // Final opacity: search takes precedence over hover
              let nodeOpacity = nodeActive ? 1 : 0.12;
              if (searchMatches !== null) nodeOpacity = searchMatch ? 1 : 0.08;

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
              } else if (searchMatches !== null && searchMatch) {
                // Search hit highlight
                border = '2px solid var(--wl-accent)';
                shadow = '0 0 0 3px rgba(2,132,168,0.22),0 0 14px rgba(2,132,168,0.18)';
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
                    opacity:${nodeOpacity};
                    transition:border-color 120ms ease,box-shadow 120ms ease,opacity 140ms ease;
                  `}
                  onMouseDown={(e: MouseEvent) => e.stopPropagation()}
                  onMouseEnter={() => setHoveredObject(name)}
                  onMouseLeave={() => setHoveredObject(null)}
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

      {/* ── Legend panel ── */}
      {showLegend ? (
        <div style={`position:absolute;bottom:28px;left:12px;z-index:10;${TOOLBAR_PILL}border-radius:12px;padding:10px 14px;font-size:11px;line-height:1.7;min-width:168px`}>
          <div style="font-weight:900;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--wl-ink-dim);margin-bottom:6px">Legend</div>
          <div style="display:flex;align-items:center;gap:8px">
            <svg width="28" height="10" style="flex-shrink:0"><line x1="0" y1="5" x2="28" y2="5" stroke="rgba(2,132,168,0.70)" stroke-width="2" /><polygon points="21,2 28,5 21,8" fill="rgba(2,132,168,0.70)" /></svg>
            <span style="color:var(--wl-ink)">Lookup</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <svg width="28" height="10" style="flex-shrink:0"><line x1="0" y1="5" x2="28" y2="5" stroke="rgba(239,68,96,0.75)" stroke-width="2" /><polygon points="21,2 28,5 21,8" fill="rgba(239,68,96,0.75)" /></svg>
            <span style="color:var(--wl-ink)">Master-Detail</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
            <div style="width:28px;height:16px;flex-shrink:0;border:2px solid var(--wl-accent);border-radius:4px;background:rgba(2,132,168,0.09)"></div>
            <span style="color:var(--wl-ink)">Root Object</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:16px;flex-shrink:0;border:1px solid rgba(240,160,40,0.60);border-radius:4px"></div>
            <span style="color:var(--wl-ink)">Custom (__c)</span>
          </div>
        </div>
      ) : null}

      {/* Usage hint */}
      <div style="position:absolute;bottom:8px;left:12px;font-size:10px;color:var(--wl-ink-dim);pointer-events:none;font-weight:600;letter-spacing:0.2px">
        Drag to pan · Scroll to zoom{isFullscreen ? ' · Esc to exit' : ''}
      </div>
    </div>
  );
}

/** Memoized schema graph — prevents re-renders when parent re-renders with unchanged props. */
export const SchemaGraphView = memo(SchemaGraphViewInner);
