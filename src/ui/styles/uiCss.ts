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

/* Dark Theme */
:host[data-theme="dark"], :root[data-theme="dark"] {
  --wl-ink: #e5f2ff;
  --wl-ink-dim: rgba(229, 242, 255, 0.72);
  --wl-paper: #0a1929;
  --wl-paper-2: #132f4c;
  --wl-line: rgba(229, 242, 255, 0.18);
  --wl-line-2: rgba(229, 242, 255, 0.10);

  --wl-accent: #29b6f6;
  --wl-accent-2: #4dd0e1;
  --wl-accent-bg: rgba(41, 182, 246, 0.15);
  --wl-danger: #ff6b8a;
  --wl-danger-bg: rgba(255, 107, 138, 0.15);
  --wl-success: #66bb6a;
  --wl-success-bg: rgba(102, 187, 106, 0.15);
  --wl-glow: rgba(41, 182, 246, 0.22);

  --wl-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
}

:root[data-theme="dark"] .wl-app {
  background:
    radial-gradient(900px 520px at 10% 6%, rgba(41, 182, 246, 0.12), transparent 62%),
    radial-gradient(780px 520px at 86% 14%, rgba(77, 208, 225, 0.10), transparent 62%),
    radial-gradient(920px 620px at 60% 110%, rgba(19, 47, 76, 0.35), transparent 58%),
    linear-gradient(180deg, var(--wl-paper), #001e3c 62%),
    repeating-linear-gradient(135deg, rgba(41, 182, 246, 0.028) 0 2px, transparent 2px 10px);
}

:root[data-theme="dark"] .wl-topbar {
  background: rgba(19, 47, 76, 0.72);
}

:root[data-theme="dark"] .wl-topNav {
  background: rgba(19, 47, 76, 0.68);
}

:root[data-theme="dark"] .wl-topNavBtn {
  background: rgba(19, 47, 76, 0.80);
}

:root[data-theme="dark"] .wl-chip {
  background: rgba(19, 47, 76, 0.8);
}

:root[data-theme="dark"] .wl-nav .wl-navCard {
  background: rgba(19, 47, 76, 0.78);
}

:root[data-theme="dark"] .wl-card,
:root[data-theme="dark"] .wl-pane {
  background: rgba(19, 47, 76, 0.85);
}

:root[data-theme="dark"] .wl-btn {
  background: rgba(19, 47, 76, 0.95);
}

:root[data-theme="dark"] .wl-input,
:root[data-theme="dark"] .wl-select,
:root[data-theme="dark"] .wl-textarea {
  background: rgba(10, 25, 41, 0.95);
}

:root[data-theme="dark"] .wl-table th {
  background: rgba(19, 47, 76, 0.92);
}

:root[data-theme="dark"] .wl-toast {
  background: rgba(19, 47, 76, 0.92);
}

:root[data-theme="dark"] .wl-qb-objList,
:root[data-theme="dark"] .wl-ac-dropdown {
  background: rgba(19, 47, 76, 0.96);
}

:root[data-theme="dark"] .wl-qb-fieldList,
:root[data-theme="dark"] .wl-qb-condCard {
  background: rgba(10, 25, 41, 0.60);
}

:root[data-theme="dark"] .wl-qb-fieldChip,
:root[data-theme="dark"] .wl-badge {
  background: rgba(19, 47, 76, 0.85);
}

:root[data-theme="dark"] .wl-qb-preview {
  background: rgba(10, 25, 41, 0.50);
}

:root[data-theme="dark"] .wl-bulkBar {
  background: rgba(19, 47, 76, 0.92);
}

:root[data-theme="dark"] .wl-panelEdgeBtn {
  background:
    radial-gradient(120px 80px at 30% 30%, rgba(41, 182, 246, 0.22), transparent 60%),
    rgba(19, 47, 76, 0.92);
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
.wl-rowHighlight td { background: rgba(41, 182, 246, 0.08); }

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

/* ── Query Builder ── */
.wl-qb-container {
  border-bottom: 1px solid var(--wl-line-2);
  animation: wl-rise 320ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
}
.wl-qb-section {
  padding: 12px 14px;
  border-bottom: 1px solid var(--wl-line-2);
}
.wl-qb-section:last-child { border-bottom: none; }
.wl-qb-sectionLabel {
  font-weight: 900;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--wl-ink-dim);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

/* Object Selector */
.wl-qb-objSelected { display: flex; align-items: center; }
.wl-qb-objChip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 166, 200, 0.40);
  background: linear-gradient(135deg, rgba(0, 166, 200, 0.08), rgba(45, 226, 197, 0.06));
  font-size: 13px;
  font-weight: 700;
}
.wl-qb-chipX {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  color: var(--wl-ink-dim);
  transition: background 120ms ease, color 120ms ease;
}
.wl-qb-chipX:hover {
  background: rgba(255, 59, 92, 0.14);
  color: var(--wl-danger);
}
.wl-qb-objList {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  max-height: 240px;
  overflow: auto;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.10);
  backdrop-filter: blur(8px);
  z-index: 50;
}
.wl-qb-objItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  border-bottom: 1px solid var(--wl-line-2);
  transition: background 120ms ease;
}
.wl-qb-objItem:last-child { border-bottom: none; }
.wl-qb-objItem:hover { background: rgba(0, 166, 200, 0.06); }

/* Field Selector */
.wl-qb-fieldChips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.wl-qb-fieldChip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.90);
  font-size: 11px;
  cursor: default;
  transition: border-color 120ms ease;
}
.wl-qb-fieldChip:hover { border-color: rgba(0, 166, 200, 0.40); }
.wl-qb-fieldChip .wl-qb-chipX { width: 14px; height: 14px; font-size: 12px; }
.wl-qb-fieldControls {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}
.wl-qb-fieldList {
  max-height: 260px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  border-radius: 10px;
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.60);
}
@media (max-width: 600px) {
  .wl-qb-fieldList { grid-template-columns: 1fr; }
}
.wl-qb-fieldItem {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  cursor: pointer;
  font-size: 12px;
  transition: background 120ms ease;
}
.wl-qb-fieldItem:hover { background: rgba(0, 166, 200, 0.06); }
.wl-qb-fieldItemSel { background: rgba(0, 166, 200, 0.05); }
.wl-qb-fieldItem input[type="checkbox"] { margin: 0; accent-color: var(--wl-accent); }
.wl-qb-typeBadge {
  font-size: 10px;
  color: var(--wl-ink-dim);
  background: rgba(7, 32, 51, 0.06);
  padding: 2px 6px;
  border-radius: 999px;
  white-space: nowrap;
  margin-left: auto;
  flex-shrink: 0;
}

/* Where Builder */
.wl-qb-condGroup {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
.wl-qb-condConnectorRow {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 2px 0;
}
.wl-qb-condConnectorLine {
  flex: 1;
  height: 1px;
  background: var(--wl-line-2);
}
.wl-qb-condCard {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--wl-line-2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.60);
}
.wl-qb-condField { flex: 1; min-width: 100px; }
.wl-qb-condOp { width: 90px; flex-shrink: 0; }
.wl-qb-condVal { flex: 1; min-width: 80px; }
.wl-qb-condRemove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--wl-line-2);
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--wl-ink-dim);
  flex-shrink: 0;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}
.wl-qb-condRemove:hover {
  border-color: rgba(255, 59, 92, 0.55);
  background: rgba(255, 59, 92, 0.08);
  color: var(--wl-danger);
}
.wl-qb-addBtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  border: 1px dashed var(--wl-line);
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-dim);
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
}
.wl-qb-addBtn:hover {
  border-color: rgba(0, 166, 200, 0.55);
  background: rgba(0, 166, 200, 0.04);
  color: var(--wl-accent);
}
.wl-qb-addBtn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Segmented Control (ASC/DESC, AND/OR) */
.wl-qb-segmented {
  display: inline-flex;
  border: 1px solid var(--wl-line);
  border-radius: 10px;
  overflow: hidden;
}
.wl-qb-segBtn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  font-size: 11px;
  font-weight: 800;
  color: var(--wl-ink-dim);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.wl-qb-segBtn:first-child { border-right: 1px solid var(--wl-line); }
.wl-qb-segBtnActive {
  background: rgba(0, 166, 200, 0.14);
  color: var(--wl-ink);
}
.wl-qb-segSm .wl-qb-segBtn { padding: 3px 10px; font-size: 10px; }

/* Order By */
.wl-qb-orderRow {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Preview */
.wl-qb-previewHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.wl-qb-preview {
  font-family: var(--wl-font-mono);
  font-size: 12px;
  background: rgba(7, 32, 51, 0.04);
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--wl-line-2);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

/* ── Autocomplete ── */
.wl-ac-dropdown {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 4px;
  z-index: 100;
  max-height: 240px;
  width: min(360px, 100%);
  overflow: auto;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(8px);
}
.wl-ac-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 10px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--wl-font-mono);
  border-bottom: 1px solid var(--wl-line-2);
  transition: background 100ms ease;
}
.wl-ac-item:last-child { border-bottom: none; }
.wl-ac-item:hover { background: rgba(0, 166, 200, 0.06); }
.wl-ac-itemActive { background: rgba(0, 166, 200, 0.12); }
.wl-ac-itemLeft {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.wl-ac-kindDot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}
.wl-ac-kind-object { background: var(--wl-accent); }
.wl-ac-kind-field { background: var(--wl-accent-2); }
.wl-ac-kind-value { background: #f0a030; }
.wl-ac-kind-keyword { background: var(--wl-ink-dim); }
.wl-ac-type {
  font-family: var(--wl-font-sans);
  font-size: 10px;
  color: var(--wl-ink-dim);
  margin-left: 8px;
  white-space: nowrap;
}

/* ── Drag and Drop ── */
.wl-dropZone {
  position: relative;
  border: 2px dashed var(--wl-line);
  border-radius: var(--wl-radius);
  padding: 24px;
  cursor: pointer;
  transition: border-color 200ms ease, background 200ms ease;
  outline: none;
}

.wl-dropZone:hover:not(.wl-dropZoneDisabled) {
  border-color: rgba(0, 166, 200, 0.55);
  background: rgba(0, 166, 200, 0.02);
}

.wl-dropZone:focus:not(.wl-dropZoneDisabled) {
  border-color: rgba(0, 166, 200, 0.70);
  box-shadow: 0 0 0 4px var(--wl-glow);
}

.wl-dropZoneActive {
  border-color: rgba(0, 166, 200, 0.70);
  background: rgba(0, 166, 200, 0.08);
}

.wl-dropZoneDisabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wl-dropZoneOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 166, 200, 0.12);
  border-radius: var(--wl-radius);
  pointer-events: none;
  z-index: 10;
}

.wl-dropZoneOverlayText {
  font-size: 18px;
  font-weight: 900;
  color: var(--wl-ink);
  padding: 12px 24px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

:root[data-theme="dark"] .wl-dropZoneOverlayText {
  background: rgba(19, 47, 76, 0.95);
}

/* ── Query Manager & Folders ── */
.wl-folderTree { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; }
.wl-folderNode { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: var(--wl-radius-sm); cursor: pointer; font-size: 13px; transition: background 120ms ease; }
.wl-folderNode:hover { background: rgba(0,166,200,0.08); }
.wl-folderNode[data-active="true"] { background: rgba(0,166,200,0.14); }
.wl-folderNodeIndent { padding-left: 4px; }
.wl-queryManager { display: grid; grid-template-columns: 200px 1fr; gap: 12px; max-height: 480px; overflow: hidden; }
.wl-queryManagerLeft { overflow-y: auto; border-right: 1px solid var(--wl-line-2); padding-right: 8px; }
.wl-queryList { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
.wl-queryRow { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: var(--wl-radius-sm); cursor: pointer; font-size: 12px; transition: background 120ms ease; }
.wl-queryRow:hover { background: var(--wl-paper-2); }
.wl-queryRow[data-drag-over="true"] { outline: 2px solid var(--wl-accent); }

/* ── Drag and Drop Reorder ── */
.wl-dragHandle { cursor: grab; color: var(--wl-ink-dim); user-select: none; font-size: 16px; padding: 0 4px; flex-shrink: 0; }
.wl-dragHandle:active { cursor: grabbing; }
.wl-dropIndicator { height: 2px; background: var(--wl-accent); border-radius: 2px; margin: 1px 0; }
.wl-colRow[data-dragging="true"] { opacity: 0.4; }

/* ── Bulk Update Modal ── */
.wl-bulkUpdateModal { display: flex; flex-direction: column; gap: 16px; min-width: 480px; }
.wl-conditionalRow { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 8px; align-items: center; }
.wl-formulaPreview { font-family: var(--wl-font-mono); font-size: 12px; background: var(--wl-paper-2); padding: 8px; border-radius: var(--wl-radius-sm); }

/* ── Command Palette ── */
.wl-commandPaletteBackdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.25); z-index: 99; }
.wl-commandPalette { position: fixed; top: 20vh; left: 50%; transform: translateX(-50%); width: 520px; max-width: 90vw; background: var(--wl-paper); border: 1px solid var(--wl-line); border-radius: var(--wl-radius); box-shadow: var(--wl-shadow); z-index: 100; padding: 12px; display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow: hidden; }
.wl-commandList { overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.wl-commandItem { padding: 8px 12px; border-radius: var(--wl-radius-sm); cursor: pointer; display: flex; gap: 12px; align-items: baseline; transition: background 100ms ease; }
.wl-commandItem[data-active="true"] { background: var(--wl-paper-2); }
.wl-commandItem:hover { background: rgba(0,166,200,0.06); }
.wl-commandItemLabel { font-weight: 700; font-size: 13px; }
.wl-commandItemDesc { font-size: 12px; color: var(--wl-ink-dim); }
.wl-commandItemKeys { margin-left: auto; }
.wl-kbdChip { font-family: var(--wl-font-mono); font-size: 11px; background: var(--wl-paper-2); padding: 2px 6px; border-radius: 6px; border: 1px solid var(--wl-line); }
.wl-shortcutTable { width: 100%; border-collapse: collapse; }
.wl-shortcutTable td, .wl-shortcutTable th { padding: 6px 8px; font-size: 13px; border-bottom: 1px solid var(--wl-line-2); text-align: left; }

/* ── Test Data Generator ── */
.wl-genScreen { display: flex; flex-direction: column; gap: 14px; }
.wl-fieldConfigList { display: flex; flex-direction: column; gap: 6px; max-height: 400px; overflow-y: auto; }
.wl-fieldConfigRow { display: grid; grid-template-columns: 160px 1fr 1fr auto; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--wl-line-2); font-size: 13px; }
.wl-countInput { width: 100px; }

/* ── Templates ── */
.wl-templateGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.wl-templateCard { padding: 14px; border: 1px solid var(--wl-line); border-radius: var(--wl-radius); background: var(--wl-paper); display: flex; flex-direction: column; gap: 8px; transition: border-color 160ms ease; }
.wl-templateCard:hover { border-color: var(--wl-accent); }
.wl-templateCardTitle { font-weight: 900; font-size: 14px; }
.wl-templateCardMeta { font-size: 12px; color: var(--wl-ink-dim); }

/* ── Schema Comparison ── */
.wl-diffView { display: flex; flex-direction: column; gap: 4px; }
.wl-diffRow { display: grid; grid-template-columns: 200px 80px 1fr; gap: 8px; padding: 5px 8px; border-radius: var(--wl-radius-sm); align-items: center; font-size: 13px; }
.wl-diffRow[data-status="added"] { background: rgba(102, 187, 106, 0.12); }
.wl-diffRow[data-status="removed"] { background: rgba(255, 59, 92, 0.10); }
.wl-diffRow[data-status="changed"] { background: rgba(0, 166, 200, 0.10); }
.wl-diffBadge { font-size: 11px; padding: 2px 6px; border-radius: 999px; font-weight: 700; display: inline-block; }
.wl-diffBadge[data-status="added"] { background: rgba(102,187,106,0.2); color: #4caf50; }
.wl-diffBadge[data-status="removed"] { background: rgba(255,59,92,0.15); color: var(--wl-danger); }
.wl-diffBadge[data-status="changed"] { background: rgba(0,166,200,0.15); color: var(--wl-accent); }
.wl-diffBadge[data-status="unchanged"] { background: rgba(128,128,128,0.15); color: var(--wl-ink-dim); }

/* ── Field Analytics ── */
.wl-analyticsChart { display: flex; flex-direction: column; gap: 6px; }
.wl-analyticsRow { display: grid; grid-template-columns: 180px 1fr 60px; gap: 8px; align-items: center; font-size: 13px; }
.wl-analyticsBar { height: 10px; background: var(--wl-line); border-radius: 5px; overflow: hidden; }
.wl-analyticsBarFill { height: 100%; background: var(--wl-accent); border-radius: 5px; transition: width 300ms ease; }
.wl-analyticsBarFillLow { background: var(--wl-danger); }
.wl-recommendations { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.wl-recommendations li { padding: 6px 10px; background: var(--wl-paper-2); border-radius: var(--wl-radius-sm); font-size: 13px; }

/* ── Duplicate Detection ── */
.wl-dupGroup { border: 1px solid var(--wl-line); border-radius: var(--wl-radius-sm); padding: 10px; margin-bottom: 8px; }
.wl-dupGroupTable { width: 100%; border-collapse: collapse; font-size: 12px; }
.wl-dupGroupTable td { padding: 4px 8px; border-bottom: 1px solid var(--wl-line-2); }
.wl-dupMasterRow { background: rgba(0,166,200,0.08); font-weight: 700; }
.wl-wizardStep { display: flex; flex-direction: column; gap: 14px; }
.wl-wizardNav { display: flex; gap: 8px; justify-content: flex-end; padding-top: 12px; border-top: 1px solid var(--wl-line-2); }

/* ── Undo Panel ── */
.wl-undoPanel { position: fixed; bottom: 16px; right: 16px; width: 340px; background: var(--wl-paper); border: 1px solid var(--wl-line); border-radius: var(--wl-radius); box-shadow: var(--wl-shadow); z-index: 90; display: flex; flex-direction: column; max-height: 400px; }
.wl-undoPanelHeader { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--wl-line-2); font-weight: 900; font-size: 13px; }
.wl-undoPanelBody { overflow-y: auto; }
.wl-undoRow { display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 12px; border-bottom: 1px solid var(--wl-line-2); }
.wl-undoRow[data-expired="true"] { opacity: 0.4; }

/* ── Pipeline Builder ── */
.wl-pipelineLayout { display: grid; grid-template-columns: 180px 1fr 280px; gap: 0; height: calc(100vh - 160px); }
.wl-stepLibrary { border-right: 1px solid var(--wl-line-2); padding: 12px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
.wl-stepLibCard { padding: 8px 10px; border: 1px solid var(--wl-line); border-radius: var(--wl-radius-sm); cursor: pointer; font-size: 12px; transition: border-color 160ms ease; }
.wl-stepLibCard:hover { border-color: var(--wl-accent); }
.wl-canvas { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.wl-pipelineStep { width: 240px; border: 1px solid var(--wl-line); border-radius: var(--wl-radius-sm); padding: 10px; background: var(--wl-paper); transition: border-color 160ms ease, box-shadow 160ms ease; }
.wl-pipelineStep[data-active="true"] { border-color: var(--wl-accent); box-shadow: 0 0 0 2px var(--wl-glow); }
.wl-stepConnector { width: 2px; height: 16px; background: var(--wl-line); margin: 0 auto; }
.wl-configPanel { border-left: 1px solid var(--wl-line-2); padding: 12px; overflow-y: auto; }

/* ── Clone Wizard ── */
.wl-relationshipTree { display: flex; flex-direction: column; gap: 4px; padding: 8px; }
.wl-relNode { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: var(--wl-radius-sm); }
.wl-relNode[data-cycle="true"] { background: rgba(255,59,92,0.08); }
.wl-relEdge { font-size: 11px; color: var(--wl-ink-dim); font-family: var(--wl-font-mono); }
.wl-cloneWizard { max-width: 720px; }
.wl-cloneStepHeader { font-size: 12px; font-weight: 700; color: var(--wl-ink-dim); margin-bottom: 4px; }

/* ── Popup Mode ── */
.wl-app[data-mode="popup"] { min-height: auto; }
.wl-app[data-mode="popup"] .wl-topbar { padding: 10px 14px; }
.wl-app[data-mode="popup"] .wl-topbar h1 { font-size: 15px; }
.wl-app[data-mode="popup"] .wl-layout { grid-template-columns: 1fr; min-height: auto; }
.wl-app[data-mode="popup"] .wl-main { padding: 12px 14px 20px 14px; }
.wl-app[data-mode="popup"] .wl-card { box-shadow: none; }

.wl-popupNav {
  display: flex;
  gap: 4px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(10px);
  overflow-x: auto;
  flex-wrap: wrap;
}

.wl-popupNavBtn {
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.80);
  padding: 5px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 800;
  font-size: 11px;
  color: var(--wl-ink-dim);
  transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
  white-space: nowrap;
}
.wl-popupNavBtn:hover { background: rgba(0, 166, 200, 0.08); color: var(--wl-ink); border-color: rgba(0, 166, 200, 0.32); }
.wl-popupNavBtn[data-active="true"] { background: rgba(0, 166, 200, 0.14); color: var(--wl-ink); border-color: rgba(0, 166, 200, 0.32); }

.wl-popupOrgInfo {
  background: var(--wl-paper-2);
  border-radius: var(--wl-radius-sm);
  padding: 8px 10px;
  margin-bottom: 10px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.wl-popupOrgRow { display: flex; justify-content: space-between; }
.wl-popupOrgLabel { color: var(--wl-ink-dim); font-weight: 600; }
.wl-popupOrgValue { font-weight: 700; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wl-popupDisconnected {
  text-align: center;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}
.wl-popupDisconnected p { color: var(--wl-ink-dim); font-size: 13px; line-height: 1.5; }

.wl-popupQuickActions {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

:root[data-theme="dark"] .wl-popupNav { background: rgba(19, 47, 76, 0.68); }
:root[data-theme="dark"] .wl-popupNavBtn { background: rgba(19, 47, 76, 0.80); }

/* ── Dark Theme Overrides for New Components ── */
:root[data-theme="dark"] .wl-commandPalette,
:root[data-theme="dark"] .wl-undoPanel { background: rgba(19, 47, 76, 0.96); }

:root[data-theme="dark"] .wl-templateCard,
:root[data-theme="dark"] .wl-pipelineStep { background: rgba(19, 47, 76, 0.85); }

:root[data-theme="dark"] .wl-diffRow[data-status="added"] { background: rgba(102, 187, 106, 0.08); }
:root[data-theme="dark"] .wl-diffRow[data-status="removed"] { background: rgba(255, 59, 92, 0.07); }
:root[data-theme="dark"] .wl-diffRow[data-status="changed"] { background: rgba(41, 182, 246, 0.08); }

:root[data-theme="dark"] .wl-stepLibCard,
:root[data-theme="dark"] .wl-dupGroup { background: rgba(19, 47, 76, 0.80); }

:root[data-theme="dark"] .wl-queryManager,
:root[data-theme="dark"] .wl-formulaPreview { background: rgba(10, 25, 41, 0.60); }

/* ── Data Quality Scorecards ── */
.wl-qualityScore {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  font-size: 28px;
  font-weight: 900;
  border: 4px solid var(--wl-line);
}
.wl-qualityScore[data-grade="good"] { border-color: #66bb6a; color: #66bb6a; }
.wl-qualityScore[data-grade="warning"] { border-color: #ffa726; color: #ffa726; }
.wl-qualityScore[data-grade="bad"] { border-color: var(--wl-danger); color: var(--wl-danger); }

.wl-qualitySummary { display: flex; gap: 16px; flex-wrap: wrap; padding: 12px 0; }
.wl-qualityStat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.wl-qualityStatValue { font-size: 20px; font-weight: 900; }
.wl-qualityStatLabel { font-size: 11px; color: var(--wl-ink-dim); text-transform: uppercase; letter-spacing: 0.5px; }

.wl-ruleRow { display: grid; grid-template-columns: 140px 120px 90px 1fr auto; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--wl-line-2); font-size: 13px; }
.wl-ruleConfigRow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

/* ── Query Metrics ── */
.wl-metricsPanel { padding: 10px 14px; border-top: 1px solid var(--wl-line-2); }
.wl-metricRow { display: flex; align-items: center; gap: 10px; padding: 4px 0; font-size: 12px; }
.wl-metricTime { font-family: var(--wl-font-mono); font-weight: 700; min-width: 60px; }
.wl-metricAvg { font-size: 14px; font-weight: 900; color: var(--wl-accent); }

/* ── API Usage Dashboard ── */
.wl-limitsGrid { display: flex; flex-direction: column; gap: 6px; }
.wl-limitRow { display: grid; grid-template-columns: 1fr 200px 60px 80px; gap: 8px; align-items: center; padding: 6px 10px; border-radius: var(--wl-radius-sm); font-size: 13px; }
.wl-limitRow:hover { background: rgba(0, 166, 200, 0.04); }
.wl-limitName { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wl-limitPct { font-family: var(--wl-font-mono); font-weight: 700; text-align: right; }
.wl-limitRemaining { font-size: 12px; color: var(--wl-ink-dim); text-align: right; }

/* ── Bulk Object Operations ── */
.wl-bulkOpsSection { display: flex; flex-direction: column; gap: 12px; }
.wl-bulkOpsActions { display: flex; gap: 8px; flex-wrap: wrap; }
.wl-bulkOpsResult { padding: 10px 12px; border-radius: var(--wl-radius-sm); background: var(--wl-paper-2); font-size: 13px; }

/* ── Onboarding & Help ── */
.wl-onboardingOverlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; padding: 18px; z-index: 1000001; }
.wl-onboardingCard { width: min(560px, 100%); background: var(--wl-paper); border-radius: var(--wl-radius); box-shadow: var(--wl-shadow); overflow: hidden; }
.wl-onboardingHeader { padding: 16px 18px; border-bottom: 1px solid var(--wl-line-2); display: flex; align-items: center; justify-content: space-between; }
.wl-onboardingBody { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.wl-onboardingFooter { padding: 12px 18px; border-top: 1px solid var(--wl-line-2); display: flex; justify-content: space-between; align-items: center; }
.wl-onboardingStep { display: flex; flex-direction: column; gap: 8px; }
.wl-onboardingStepTitle { font-size: 16px; font-weight: 900; }
.wl-onboardingStepDesc { color: var(--wl-ink-dim); font-size: 13px; line-height: 1.5; }
.wl-onboardingProgress { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--wl-ink-dim); }
.wl-onboardingCategoryTabs { display: flex; gap: 6px; flex-wrap: wrap; }

.wl-helpGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.wl-helpCard { padding: 14px; border: 1px solid var(--wl-line); border-radius: var(--wl-radius); background: var(--wl-paper); display: flex; flex-direction: column; gap: 8px; transition: border-color 160ms ease; cursor: pointer; }
.wl-helpCard:hover { border-color: var(--wl-accent); }
.wl-helpCardTitle { font-weight: 900; font-size: 14px; }
.wl-helpCardDesc { font-size: 12px; color: var(--wl-ink-dim); }
.wl-helpTopic { padding: 4px 0; font-size: 13px; color: var(--wl-accent); cursor: pointer; }
.wl-helpTopic:hover { text-decoration: underline; }

.wl-helpTooltip { position: relative; display: inline-flex; }
.wl-helpTooltipIcon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--wl-line); font-size: 10px; font-weight: 900; color: var(--wl-ink-dim); cursor: help; }
.wl-helpTooltipContent { position: absolute; z-index: 50; padding: 8px 10px; background: var(--wl-paper); border: 1px solid var(--wl-line); border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.12); font-size: 12px; white-space: normal; min-width: 200px; max-width: 280px; }

/* ── Schema Graph / Relationship Explorer ── */
.wl-graphContainer { position: relative; min-height: 500px; border: 1px solid var(--wl-line-2); border-radius: var(--wl-radius); overflow: auto; background: var(--wl-paper); }
.wl-graphNode { position: absolute; padding: 8px 12px; border: 2px solid var(--wl-line); border-radius: var(--wl-radius-sm); background: var(--wl-paper); cursor: pointer; font-size: 12px; font-weight: 700; transition: border-color 160ms ease, box-shadow 160ms ease; white-space: nowrap; min-width: 120px; text-align: center; }
.wl-graphNode:hover { border-color: rgba(0, 166, 200, 0.55); }
.wl-graphNode[data-selected="true"] { border-color: var(--wl-accent); box-shadow: 0 0 0 3px var(--wl-glow); }
.wl-graphNode[data-root="true"] { border-color: var(--wl-accent); background: rgba(0, 166, 200, 0.06); }
.wl-graphSvg { position: absolute; top: 0; left: 0; pointer-events: none; }
.wl-graphEdge { stroke: var(--wl-line); stroke-width: 1.5; }

.wl-explorerDetail { display: flex; flex-direction: column; gap: 8px; }
.wl-explorerFieldList { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.wl-explorerFieldRow { display: flex; justify-content: space-between; padding: 4px 8px; font-size: 12px; border-bottom: 1px solid var(--wl-line-2); }

/* ── Dark Theme Overrides for Future Possibilities ── */
:root[data-theme="dark"] .wl-onboardingCard,
:root[data-theme="dark"] .wl-helpCard { background: rgba(19, 47, 76, 0.92); }

:root[data-theme="dark"] .wl-graphContainer { background: rgba(10, 25, 41, 0.60); }
:root[data-theme="dark"] .wl-graphNode { background: rgba(19, 47, 76, 0.90); }
:root[data-theme="dark"] .wl-helpTooltipContent { background: rgba(19, 47, 76, 0.96); }
`;
