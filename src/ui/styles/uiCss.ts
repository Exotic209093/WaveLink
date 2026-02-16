/**
 * Shared CSS (as a string) for the full app and in-page panel.
 *
 * Why:
 * - We inject the same style text into Document (app) and ShadowRoot (panel) for consistent visuals.
 *
 * Complexity: O(1).
 */

export const uiCss = `
:host, :root {
  --wl-font-sans: "Aptos", "Segoe UI Variable Text", "Candara", "Trebuchet MS", Verdana, sans-serif;
  --wl-font-mono: "Cascadia Mono", Consolas, "Courier New", monospace;

  --wl-ink: #072033;
  --wl-ink-dim: rgba(7, 32, 51, 0.72);
  --wl-paper: #f5fbff;
  --wl-paper-2: #eaf4ff;
  --wl-line: rgba(7, 32, 51, 0.18);
  --wl-line-2: rgba(7, 32, 51, 0.10);

  --wl-accent: #00a6c8;
  --wl-accent-2: #2de2c5;
  --wl-danger: #ff3b5c;
  --wl-glow: rgba(0, 166, 200, 0.22);

  --wl-radius: 16px;
  --wl-radius-sm: 12px;
  --wl-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);

  --wl-nav-w: 228px;
}

* { box-sizing: border-box; }

.wl-app {
  font-family: var(--wl-font-sans);
  color: var(--wl-ink);
  min-height: 100vh;
  background:
    radial-gradient(900px 520px at 10% 6%, rgba(0, 166, 200, 0.20), transparent 62%),
    radial-gradient(780px 520px at 86% 14%, rgba(45, 226, 197, 0.16), transparent 62%),
    radial-gradient(920px 620px at 60% 110%, rgba(4, 60, 82, 0.18), transparent 58%),
    linear-gradient(180deg, var(--wl-paper), #ffffff 62%),
    repeating-linear-gradient(135deg, rgba(0, 110, 140, 0.028) 0 2px, transparent 2px 10px);
  animation: wl-pageIn 520ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
}

.wl-topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(10px);
}

.wl-brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.wl-brand h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.5px;
}

.wl-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.8);
  border-radius: 999px;
  color: var(--wl-ink-dim);
  font-size: 12px;
}

.wl-layout {
  display: grid;
  grid-template-columns: var(--wl-nav-w) 1fr;
  min-height: calc(100vh - 56px);
}

.wl-app[data-mode="app"] .wl-layout {
  grid-template-columns: 1fr;
}

.wl-topNav {
  position: sticky;
  top: 56px;
  z-index: 4;
  display: flex;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(10px);
  overflow: auto;
}

.wl-topNavBtn {
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.80);
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
  color: var(--wl-ink-dim);
  transition: background 160ms ease, color 160ms ease, transform 160ms ease, border-color 160ms ease;
  white-space: nowrap;
}
.wl-topNavBtn:hover { background: rgba(0, 166, 200, 0.08); color: var(--wl-ink); transform: translateY(-1px); border-color: rgba(0, 166, 200, 0.32); }
.wl-topNavBtn[data-active="true"] { background: rgba(0, 166, 200, 0.14); color: var(--wl-ink); border-color: rgba(0, 166, 200, 0.32); }

.wl-nav {
  padding: 14px;
  border-right: 1px solid var(--wl-line-2);
}

.wl-nav .wl-navCard {
  border: 1px solid var(--wl-line-2);
  border-radius: var(--wl-radius);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.wl-navBtn {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  color: var(--wl-ink-dim);
  border-bottom: 1px solid var(--wl-line-2);
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
}

.wl-navBtn:last-child { border-bottom: none; }
.wl-navBtn:hover { background: rgba(0, 166, 200, 0.07); color: var(--wl-ink); transform: translateX(2px); }
.wl-navBtn[data-active="true"] {
  background: rgba(0, 166, 200, 0.12);
  color: var(--wl-ink);
}

.wl-main {
  padding: 16px 18px 40px 18px;
}

.wl-card {
  border: 1px solid var(--wl-line-2);
  border-radius: var(--wl-radius);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  animation: wl-rise 420ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
}

.wl-cardHeader {
  padding: 12px 14px;
  border-bottom: 1px solid var(--wl-line-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.wl-cardHeader h2 {
  margin: 0;
  font-size: 14px;
  letter-spacing: -0.2px;
}

.wl-actions { display: inline-flex; gap: 8px; flex-wrap: wrap; }

.wl-btn {
  border: 1px solid var(--wl-line);
  background: #fff;
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
  font-size: 12px;
  color: var(--wl-ink);
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background 140ms ease;
}
.wl-btn:hover { border-color: rgba(0, 166, 200, 0.55); transform: translateY(-1px); box-shadow: 0 10px 22px rgba(4, 60, 82, 0.10); }
.wl-btn:active { transform: translateY(0px); box-shadow: none; }
.wl-btnPrimary {
  border-color: rgba(0, 166, 200, 0.55);
  background: linear-gradient(135deg, rgba(0, 166, 200, 0.18), rgba(45, 226, 197, 0.14));
}
.wl-btnDanger { border-color: rgba(255, 59, 92, 0.55); }

.wl-btn[data-active="true"] {
  border-color: rgba(0, 166, 200, 0.55);
  background: rgba(0, 166, 200, 0.10);
}

.wl-input, .wl-select, .wl-textarea {
  width: 100%;
  border: 1px solid var(--wl-line);
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--wl-ink);
  outline: none;
}
.wl-textarea { font-family: var(--wl-font-mono); min-height: 120px; resize: vertical; }
.wl-input:focus, .wl-select:focus, .wl-textarea:focus {
  border-color: rgba(0, 166, 200, 0.70);
  box-shadow: 0 0 0 4px var(--wl-glow);
}

.wl-row { display: grid; grid-template-columns: 1fr; gap: 10px; padding: 14px; }
.wl-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.wl-muted { color: var(--wl-ink-dim); font-size: 12px; }
.wl-mono { font-family: var(--wl-font-mono); }

.wl-tableWrap { overflow: auto; max-height: 520px; border-top: 1px solid var(--wl-line-2); }
.wl-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.wl-table th, .wl-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--wl-line-2);
  white-space: nowrap;
  vertical-align: top;
}
.wl-table th {
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--wl-ink-dim);
}
.wl-table tr:hover td { background: rgba(0, 166, 200, 0.040); }

.wl-toast {
  position: fixed;
  bottom: 18px;
  right: 18px;
  max-width: 520px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--wl-line);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--wl-shadow);
  font-size: 13px;
  animation: wl-toastIn 280ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
}
.wl-toastTitle { font-weight: 900; margin-bottom: 4px; }

.wl-chipRow { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }

.wl-meter {
  height: 10px;
  width: 140px;
  border-radius: 999px;
  border: 1px solid var(--wl-line-2);
  background: rgba(7, 32, 51, 0.04);
  overflow: hidden;
}
.wl-meterFill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, rgba(0, 166, 200, 0.65), rgba(45, 226, 197, 0.55));
}
.wl-meterFillDanger {
  background: linear-gradient(90deg, rgba(255, 59, 92, 0.72), rgba(255, 59, 92, 0.40));
}

.wl-modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 1000000;
}

.wl-modal {
  width: min(720px, 100%);
}

.wl-bannerDanger {
  border: 1px solid rgba(255, 59, 92, 0.55);
  background: rgba(255, 59, 92, 0.08);
  color: var(--wl-danger);
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 900;
}

.wl-split {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
@media (max-width: 980px) {
  .wl-split { grid-template-columns: 1fr; }
}

.wl-pane {
  border: 1px solid var(--wl-line-2);
  border-radius: var(--wl-radius);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  min-height: 420px;
  display: flex;
  flex-direction: column;
}

.wl-paneHeader {
  padding: 12px 14px;
  border-bottom: 1px solid var(--wl-line-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.wl-colList {
  overflow: auto;
  max-height: 680px;
}

.wl-colRow {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--wl-line-2);
  cursor: pointer;
}
.wl-colRow:hover { background: rgba(11, 102, 255, 0.035); }
.wl-colRow:hover { background: rgba(0, 166, 200, 0.040); }
.wl-colRowSelected { background: rgba(0, 166, 200, 0.12); }

.wl-colRowLeft { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.wl-colNames { min-width: 0; }
.wl-colNames .wl-mono { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wl-colBadges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

.wl-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  font-weight: 900;
  color: var(--wl-ink-dim);
  user-select: none;
}
.wl-badgeDrop { border-color: rgba(215, 38, 61, 0.55); color: var(--wl-danger); }
.wl-badgeErr { border-color: rgba(215, 38, 61, 0.65); background: rgba(215, 38, 61, 0.10); color: var(--wl-danger); }
.wl-badgeBtn { cursor: pointer; }
.wl-badgeBtn input { margin: 0; }

.wl-bulkBar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
}

.wl-sampleTable td { white-space: nowrap; }

/* Panel-specific layout (in-page) */
.wl-panelRoot {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  width: var(--wl-panel-w, 420px);
  transform: translateX(0%);
  transition: transform 220ms cubic-bezier(0.2, 0.9, 0.25, 1);
  z-index: 999999;
}
.wl-panelRoot[data-open="false"] { transform: translateX(calc(100% - 52px)); }
.wl-panelDockLeft { left: 0; right: auto; }
.wl-panelDockLeft[data-open="false"] { transform: translateX(calc(-100% + 52px)); }

.wl-panelEdgeBtn {
  position: absolute;
  top: 18px;
  left: -10px;
  width: 64px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(21,21,21,0.12);
  background:
    radial-gradient(120px 80px at 30% 30%, rgba(0, 166, 200, 0.22), transparent 60%),
    rgba(255,255,255,0.92);
  box-shadow: 0 10px 28px rgba(0,0,0,0.10);
  cursor: pointer;
  font-weight: 900;
}
.wl-panelDockLeft .wl-panelEdgeBtn { left: auto; right: -10px; }

.wl-resizeHandle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -6px;
  width: 10px;
  cursor: ew-resize;
}
.wl-panelDockLeft .wl-resizeHandle { left: auto; right: -6px; }

.wl-link {
  color: var(--wl-accent);
  text-decoration: none;
  font-weight: 800;
}
.wl-link:hover { text-decoration: underline; }

@keyframes wl-pageIn {
  from { opacity: 0; filter: saturate(0.9); }
  to { opacity: 1; filter: saturate(1); }
}

@keyframes wl-rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0px); }
}

@keyframes wl-toastIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0px); }
}

@media (prefers-reduced-motion: reduce) {
  .wl-app, .wl-card, .wl-toast { animation: none !important; }
  .wl-btn, .wl-navBtn, .wl-topNavBtn, .wl-panelRoot { transition: none !important; }
}
`;
