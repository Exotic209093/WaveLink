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
  /* Atkinson Hyperlegible (bundled in /fonts, see src/ui/styles/fontsCss.ts) keeps
     0/O and 1/l/I distinct, which matters for 15/18-character Salesforce IDs. */
  --wl-font-sans: "Atkinson Hyperlegible Next", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
  --wl-font-mono: "Atkinson Hyperlegible Mono", "Cascadia Mono", Consolas, monospace;
  --wl-mono: var(--wl-font-mono);

  /* Signal palette. Every text/background pair below meets WCAG AA. */
  --wl-ink: #13293d;
  --wl-ink-dim: #51667a;
  --wl-ground: #eef2f5;
  --wl-paper: #ffffff;
  --wl-paper-2: #f3f6f8;
  --wl-surface: #ffffff;
  --wl-surface-2: #f3f6f8;
  --wl-line: #d3dce4;
  --wl-line-2: #e3e9ee;

  --wl-accent: #00627f;
  --wl-accent-2: #2a8fae;
  --wl-accent-bg: rgba(0, 98, 127, 0.09);
  --wl-danger: #b0123f;
  --wl-danger-bg: rgba(176, 18, 63, 0.08);
  --wl-success: #1e7a46;
  --wl-success-bg: rgba(30, 122, 70, 0.10);
  --wl-warning: #a35a00;
  --wl-glow: rgba(0, 98, 127, 0.22);

  /* Environment band: which org you are touching. */
  --wl-env-prod: #b0123f;
  --wl-env-prod-fg: #ffffff;
  --wl-env-sandbox: #2f5d73;
  --wl-env-sandbox-fg: #ffffff;
  --wl-env-none: #dfe6ec;
  --wl-env-none-fg: #13293d;

  --wl-radius: 8px;
  --wl-radius-sm: 6px;
  --wl-shadow: 0 10px 30px rgba(19, 41, 61, 0.14);
  --wl-transition: 120ms ease;

  --wl-nav-w: 228px;
}

/* Dark Theme */
:host[data-theme="dark"], :root[data-theme="dark"] {
  --wl-ink: #e3ecf2;
  --wl-ink-dim: #93a7b8;
  --wl-ground: #0e1c28;
  --wl-paper: #15283a;
  --wl-paper-2: #1b3146;
  --wl-surface: #15283a;
  --wl-surface-2: #1b3146;
  --wl-line: #2c4256;
  --wl-line-2: #223649;

  --wl-accent: #4fc3e3;
  --wl-accent-2: #7fd6ec;
  --wl-accent-bg: rgba(79, 195, 227, 0.13);
  --wl-danger: #ff7a98;
  --wl-danger-bg: rgba(255, 122, 152, 0.13);
  --wl-success: #5fcf8b;
  --wl-success-bg: rgba(95, 207, 139, 0.13);
  --wl-warning: #f0b45a;
  --wl-glow: rgba(79, 195, 227, 0.26);

  --wl-env-prod: #6e0f2b;
  --wl-env-prod-fg: #ffd9e2;
  --wl-env-sandbox: #1d4256;
  --wl-env-sandbox-fg: #d8eef7;
  --wl-env-none: #1b3146;
  --wl-env-none-fg: #c9d6e0;

  --wl-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

/* Dark theme surfaces: flat, token-driven (no glass blur). */
:root[data-theme="dark"] .wl-app { background: var(--wl-ground); }

:root[data-theme="dark"] .wl-topbar,
:root[data-theme="dark"] .wl-navBar,
:root[data-theme="dark"] .wl-topNav,
:root[data-theme="dark"] .wl-subNav,
:root[data-theme="dark"] .wl-nav .wl-navCard,
:root[data-theme="dark"] .wl-card,
:root[data-theme="dark"] .wl-pane,
:root[data-theme="dark"] .wl-toast,
:root[data-theme="dark"] .wl-bulkBar,
:root[data-theme="dark"] .wl-qb-objList,
:root[data-theme="dark"] .wl-ac-dropdown {
  background: var(--wl-surface);
  backdrop-filter: none;
}

:root[data-theme="dark"] .wl-topNavBtn,
:root[data-theme="dark"] .wl-navGroupBtn,
:root[data-theme="dark"] .wl-subNavBtn { background: transparent; }
:root[data-theme="dark"] .wl-subNavBtn { color: var(--wl-ink-dim); }
:root[data-theme="dark"] .wl-subNavBtn:hover { background: var(--wl-accent-bg); color: var(--wl-ink); }
:root[data-theme="dark"] .wl-subNavBtn[data-active="true"] { color: var(--wl-ink); border-bottom-color: var(--wl-accent); }

:root[data-theme="dark"] .wl-chip,
:root[data-theme="dark"] .wl-btn,
:root[data-theme="dark"] .wl-qb-fieldChip,
:root[data-theme="dark"] .wl-badge { background: var(--wl-surface); }

:root[data-theme="dark"] .wl-input,
:root[data-theme="dark"] .wl-select,
:root[data-theme="dark"] .wl-textarea { background: var(--wl-ground); }

:root[data-theme="dark"] .wl-table th { background: var(--wl-surface-2); backdrop-filter: none; }

:root[data-theme="dark"] .wl-qb-fieldList,
:root[data-theme="dark"] .wl-qb-condCard,
:root[data-theme="dark"] .wl-qb-preview { background: var(--wl-ground); }

/* Edge button dark mode — applies to the shadow-sibling element (no :root ancestor) */
.wl-panelEdgeBtn {
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  .wl-panelEdgeBtn {
    background:
      radial-gradient(80px 60px at 20% 30%, rgba(86, 200, 232, 0.18), transparent 70%),
      rgba(17, 41, 62, 0.90);
    border-color: rgba(255,255,255,0.08);
    color: rgba(180,200,220,0.8);
  }
}

* { box-sizing: border-box; }

/* ── Scrollbars ── */
.wl-app * {
  scrollbar-width: thin;
  scrollbar-color: rgba(2, 132, 168, 0.25) transparent;
}
.wl-app *::-webkit-scrollbar { width: 4px; height: 4px; }
.wl-app *::-webkit-scrollbar-track { background: transparent; }
.wl-app *::-webkit-scrollbar-thumb {
  background: rgba(2, 132, 168, 0.28);
  border-radius: 999px;
}
.wl-app *::-webkit-scrollbar-thumb:hover { background: rgba(2, 132, 168, 0.55); }
.wl-app *::-webkit-scrollbar-corner { background: transparent; }

:root[data-theme="dark"] .wl-app * {
  scrollbar-color: rgba(72, 202, 228, 0.22) transparent;
}
:root[data-theme="dark"] .wl-app *::-webkit-scrollbar-thumb { background: rgba(72, 202, 228, 0.22); }
:root[data-theme="dark"] .wl-app *::-webkit-scrollbar-thumb:hover { background: rgba(72, 202, 228, 0.45); }

.wl-app {
  font-family: var(--wl-font-sans);
  color: var(--wl-ink);
  min-height: 100vh;
  background:
    radial-gradient(800px 480px at 10% 6%, rgba(2, 132, 168, 0.14), transparent 60%),
    radial-gradient(700px 480px at 86% 14%, rgba(72, 202, 228, 0.10), transparent 60%),
    linear-gradient(180deg, var(--wl-paper), #ffffff 70%);
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
  background: rgba(255, 255, 255, 0.60);
  backdrop-filter: blur(16px);
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
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(8px);
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

/* Panel mode: the wl-app is itself the flex column container inside panelRoot */
.wl-app[data-mode="panel"] {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.wl-app[data-mode="panel"] .wl-topbar {
  flex-shrink: 0;
  padding: 0 14px;
  min-height: 50px;
  height: 50px;
  background: linear-gradient(180deg, var(--wl-surface-2), var(--wl-surface));
  border-bottom: 1px solid var(--wl-line-2);
}
.wl-app[data-mode="panel"] .wl-brand { gap: 9px; }
.wl-app[data-mode="panel"] .wl-topbar .wl-brand h1 {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
/* Brand mark — a small gradient tile shown next to the wordmark in the panel. */
.wl-brandMark { display: none; }
.wl-app[data-mode="panel"] .wl-brandMark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: linear-gradient(135deg, var(--wl-accent), #2563eb);
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 2px 8px rgba(2, 132, 168, 0.35);
}

/* Sticky wrapper when using grouped two-tier nav */
.wl-navBar {
  position: sticky;
  top: 56px;
  z-index: 4;
}

/* Standalone sticky (flat nav, no groups) */
.wl-topNav--sticky {
  position: sticky;
  top: 56px;
  z-index: 4;
}

.wl-topNav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(14px);
  overflow: auto;
}

.wl-topNavBtn {
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.70);
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  color: var(--wl-ink-dim);
  transition: background var(--wl-transition), color var(--wl-transition), transform var(--wl-transition), border-color var(--wl-transition);
  white-space: nowrap;
}
.wl-topNavBtn:hover { background: rgba(2, 132, 168, 0.08); color: var(--wl-ink); transform: translateY(-1px); border-color: rgba(2, 132, 168, 0.28); }
.wl-topNavBtn[data-active="true"] { background: rgba(2, 132, 168, 0.12); color: var(--wl-ink); border-color: rgba(2, 132, 168, 0.28); }

/* ── Pinned items (Help, Settings) pushed to right ── */
.wl-navPinned {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Two-tier grouped nav (app mode) ── */
.wl-navGroupBtn {
  border: 1px solid transparent;
  background: transparent;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  color: var(--wl-ink-dim);
  cursor: pointer;
  transition: background var(--wl-transition), color var(--wl-transition), border-color var(--wl-transition);
  white-space: nowrap;
}
.wl-navGroupBtn:hover { background: rgba(2, 132, 168, 0.08); color: var(--wl-ink); }
.wl-navGroupBtn[data-active="true"] { background: rgba(2, 132, 168, 0.12); color: var(--wl-ink); border-color: rgba(2, 132, 168, 0.30); }

/* Sub-screen row */
.wl-subNav {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 18px;
  border-bottom: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.38);
  backdrop-filter: blur(10px);
  overflow: auto;
}

.wl-subNavBtn {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 13px;
  font-size: 12px;
  font-weight: 600;
  color: var(--wl-ink-dim);
  cursor: pointer;
  transition: color var(--wl-transition), border-color var(--wl-transition), background var(--wl-transition);
  white-space: nowrap;
  margin-bottom: -1px;
}
.wl-subNavBtn:hover { background: rgba(2, 132, 168, 0.06); color: var(--wl-ink); }
.wl-subNavBtn[data-active="true"] { color: var(--wl-accent); border-bottom-color: var(--wl-accent); }

.wl-nav {
  padding: 14px;
  border-right: 1px solid var(--wl-line-2);
}

.wl-main {
  padding: 16px 18px 40px 18px;
}

.wl-card {
  border: 1px solid var(--wl-line-2);
  border-radius: var(--wl-radius);
  background: rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.04);
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
.wl-card[aria-labelledby="activity-heading"] .wl-cardSection > .wl-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  width: 100%;
}

.wl-btn {
  border: 1px solid var(--wl-line);
  background: rgba(255, 255, 255, 0.80);
  backdrop-filter: blur(6px);
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  color: var(--wl-ink);
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background 140ms ease;
}
a.wl-btn { display: inline-block; text-decoration: none; }
.wl-btn:hover { border-color: rgba(2, 132, 168, 0.45); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(2, 90, 120, 0.08); }
.wl-btn:active { transform: translateY(0px); box-shadow: none; }
.wl-btnPrimary {
  border-color: rgba(2, 132, 168, 0.45);
  background: linear-gradient(135deg, rgba(2, 132, 168, 0.14), rgba(72, 202, 228, 0.10));
}
.wl-btnDanger { border-color: rgba(239, 68, 96, 0.45); }

.wl-btn[data-active="true"] {
  border-color: rgba(2, 132, 168, 0.45);
  background: rgba(2, 132, 168, 0.08);
}

.wl-input, .wl-select, .wl-textarea {
  width: 100%;
  border: 1px solid var(--wl-line);
  background: rgba(255, 255, 255, 0.85);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--wl-ink);
  outline: none;
  transition: border-color var(--wl-transition), box-shadow var(--wl-transition);
}
.wl-textarea { font-family: var(--wl-font-mono); min-height: 120px; resize: vertical; }
.wl-input:focus, .wl-select:focus, .wl-textarea:focus {
  border-color: rgba(2, 132, 168, 0.55);
  box-shadow: 0 0 0 3px var(--wl-glow);
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
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--wl-ink-dim);
  font-weight: 600;
}
.wl-table tr:hover td { background: rgba(2, 132, 168, 0.035); }
.wl-rowHighlight td { background: rgba(2, 132, 168, 0.06); }

.wl-toast {
  position: fixed;
  bottom: 18px;
  right: 18px;
  max-width: 520px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  box-shadow: var(--wl-shadow);
  font-size: 13px;
  animation: wl-toastIn 280ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
}
.wl-toastTitle { font-weight: 700; margin-bottom: 4px; }

.wl-toastHeader { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.wl-toastBody { color: var(--wl-ink-dim); font-size: 12px; }
.wl-toastBadge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 999px; flex-shrink: 0; }
.wl-toastBadge--error { background: rgba(239, 68, 96, 0.12); color: var(--wl-danger); }
.wl-toastBadge--warning { background: rgba(255, 167, 38, 0.14); color: #e09100; }
.wl-toastBadge--info { background: rgba(2, 132, 168, 0.12); color: var(--wl-accent); }
.wl-toastBadge--success { background: rgba(102, 187, 106, 0.14); color: #4caf50; }

.wl-toast--error { border-color: rgba(239, 68, 96, 0.35); }
.wl-toast--warning { border-color: rgba(255, 167, 38, 0.35); }
.wl-toast--info { border-color: var(--wl-line-2); }
.wl-toast--success { border-color: rgba(102, 187, 106, 0.35); }

.wl-toastHint { font-size: 12px; color: var(--wl-accent); margin-top: 6px; padding: 6px 8px; background: rgba(2, 132, 168, 0.05); border-radius: 8px; }
.wl-toastDetails { margin-top: 6px; }
.wl-toastDetailsToggle { background: none; border: none; color: var(--wl-ink-dim); font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; text-decoration: underline; }
.wl-toastDetailsToggle:hover { color: var(--wl-ink); }
.wl-toastDetailsPre { font-family: var(--wl-font-mono); font-size: 11px; background: rgba(7, 32, 51, 0.04); border: 1px solid var(--wl-line-2); border-radius: 8px; padding: 8px; margin: 6px 0 0 0; max-height: 160px; overflow: auto; white-space: pre-wrap; word-break: break-all; }

:root[data-theme="dark"] .wl-toastBadge--warning { color: #ffa726; }
:root[data-theme="dark"] .wl-toastBadge--success { color: #66bb6a; }
:root[data-theme="dark"] .wl-toastHint { background: rgba(86, 200, 232, 0.06); }
:root[data-theme="dark"] .wl-toastDetailsPre { background: rgba(9, 27, 42, 0.50); }

.wl-chipRow { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }

.wl-meter {
  height: 8px;
  width: 140px;
  border-radius: 999px;
  border: 1px solid var(--wl-line-2);
  background: rgba(7, 32, 51, 0.03);
  overflow: hidden;
}
.wl-meterFill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, rgba(2, 132, 168, 0.60), rgba(72, 202, 228, 0.50));
}
.wl-meterFillDanger {
  background: linear-gradient(90deg, rgba(239, 68, 96, 0.65), rgba(239, 68, 96, 0.35));
}

.wl-modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 32, 51, 0.35);
  backdrop-filter: blur(6px);
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
  border: 1px solid rgba(239, 68, 96, 0.40);
  background: rgba(239, 68, 96, 0.06);
  color: var(--wl-danger);
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 700;
}

.wl-bannerWarning {
  border: 1px solid rgba(255, 167, 38, 0.45);
  background: var(--wl-warning-soft);
  color: var(--wl-warning-2);
  padding: 10px 12px;
  border-radius: 12px;
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
  background: rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.04);
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
.wl-colRow:hover { background: rgba(2, 132, 168, 0.035); }
.wl-colRowSelected { background: rgba(2, 132, 168, 0.08); }

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
  background: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-dim);
  user-select: none;
}
.wl-badgeDrop { border-color: rgba(239, 68, 96, 0.40); color: var(--wl-danger); }
.wl-badgeErr { border-color: rgba(239, 68, 96, 0.50); background: rgba(239, 68, 96, 0.08); color: var(--wl-danger); }
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
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
}

.wl-sampleTable td { white-space: nowrap; }

/* ── Panel root ── */
.wl-panelRoot {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  width: var(--wl-panel-w, 420px);
  overflow: hidden;
  transform: translateX(0%);
  transition: transform 220ms cubic-bezier(0.2, 0.9, 0.25, 1);
  z-index: 999998;
  background: var(--wl-surface);
  border-left: 1px solid var(--wl-line-2);
  box-shadow: -10px 0 44px rgba(15, 23, 42, 0.14), -1px 0 0 rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
}
.wl-panelRoot[data-open="false"] { transform: translateX(100%); }
.wl-panelDockLeft { left: 0; right: auto; border-left: none; border-right: 1px solid var(--wl-line-2); box-shadow: 4px 0 24px rgba(0,0,0,0.10); }
.wl-panelDockLeft[data-open="false"] { transform: translateX(-100%); }

/* ── Edge (toggle) button — lives as a shadow sibling of panelEl so it is
      never clipped by panelEl's overflow:hidden.  Its position tracks the
      panel open/closed state via a CSS transition on the "right" property. ── */
.wl-panelEdgeBtn {
  position: fixed;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  width: 26px;
  height: 96px;
  border-radius: 10px 0 0 10px;
  border: 1px solid var(--wl-line-2);
  border-right: none;
  background: linear-gradient(180deg, var(--wl-surface), var(--wl-surface-2));
  box-shadow: -6px 0 18px rgba(15, 23, 42, 0.12);
  cursor: pointer;
  z-index: 999999;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--wl-ink-dim);
  writing-mode: vertical-rl;
  letter-spacing: 0.10em;
  transition: right 220ms cubic-bezier(0.2, 0.9, 0.25, 1), background 150ms, color 150ms, box-shadow 150ms, border-color 150ms;
}
.wl-panelEdgeBtn[data-open="true"] {
  right: var(--wl-panel-w, 420px);
  color: var(--wl-accent);
  border-color: rgba(2, 132, 168, 0.32);
}
.wl-panelEdgeBtn:hover { color: var(--wl-accent); box-shadow: -8px 0 24px rgba(2, 132, 168, 0.22); }
/* Left-docked variant */
.wl-edgeBtnLeft {
  right: auto;
  left: 0;
  border-radius: 0 8px 8px 0;
  border-right: 1px solid rgba(21,21,21,0.10);
  border-left: none;
  box-shadow: 3px 0 12px rgba(0,0,0,0.08);
  transition: left 220ms cubic-bezier(0.2, 0.9, 0.25, 1), background 150ms, color 150ms;
}
.wl-edgeBtnLeft[data-open="true"] { right: auto; left: var(--wl-panel-w, 420px); }

/* ── Resize handle ── */
.wl-resizeHandle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -6px;
  width: 10px;
  cursor: ew-resize;
  z-index: 1;
}
.wl-resizeHandle::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 6px;
  width: 2px;
  background: transparent;
  transition: background 150ms;
}
.wl-resizeHandle:hover::after { background: var(--wl-accent); }
.wl-panelDockLeft .wl-resizeHandle { left: auto; right: -6px; }
.wl-panelDockLeft .wl-resizeHandle::after { left: auto; right: 6px; }

/* ── Panel tab bar ── */
.wl-panelTabBar {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  padding: 8px 10px;
  background: var(--wl-surface);
  border-bottom: 1px solid var(--wl-line-2);
}
.wl-panelTab {
  flex: 1;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--wl-ink-dim);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: color 150ms, border-color 150ms, background 150ms, box-shadow 150ms;
}
.wl-panelTab:hover { color: var(--wl-ink); background: var(--wl-surface-2); }
.wl-panelTab[data-active="true"] {
  color: var(--wl-accent);
  background: rgba(2, 132, 168, 0.10);
  border-color: rgba(2, 132, 168, 0.30);
  box-shadow: 0 1px 4px rgba(2, 132, 168, 0.12);
}

/* ── Panel main content area ── */
.wl-panelMain {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding: 14px;
  background: var(--wl-surface-2);
}

.wl-link {
  color: var(--wl-accent);
  text-decoration: none;
  font-weight: 700;
}
.wl-link:hover { text-decoration: underline; }

/* ── Skeleton Loading Placeholders ── */
@keyframes wl-shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.wl-skeleton {
  background: linear-gradient(90deg, var(--wl-line-2) 25%, rgba(2, 132, 168, 0.06) 50%, var(--wl-line-2) 75%);
  background-size: 200px 100%;
  animation: wl-shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

.wl-skeleton--text { height: 14px; margin-bottom: 8px; }
.wl-skeleton--textGroup { padding: 14px; }

.wl-skeleton--card { padding: 14px; display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--wl-line-2); border-radius: var(--wl-radius); }
.wl-skeleton--card .wl-skeleton { height: 14px; }

.wl-skeleton--chipRow { display: flex; gap: 8px; padding: 14px; }
.wl-skeleton--chip { width: 80px; height: 28px; border-radius: 999px; }

.wl-skeleton--table { padding: 0; }
.wl-skeleton--tableRow { display: flex; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--wl-line-2); }
.wl-skeleton--tableHead { height: 12px; flex: 1; border-radius: 6px; }
.wl-skeleton--tableCell { height: 14px; flex: 1; border-radius: 6px; }

:root[data-theme="dark"] .wl-skeleton {
  background: linear-gradient(90deg, rgba(229, 242, 255, 0.06) 25%, rgba(86, 200, 232, 0.08) 50%, rgba(229, 242, 255, 0.06) 75%);
  background-size: 200px 100%;
}

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
  .wl-wavey__root, .wl-wavey__eyes, .wl-wavey__armR { animation: none !important; }
  .wl-btn, .wl-navBtn, .wl-topNavBtn, .wl-navGroupBtn, .wl-subNavBtn, .wl-panelRoot, .wl-panelEdgeBtn, .wl-panelTab { transition: none !important; animation: none !important; }
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
  font-weight: 700;
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
  border: 1px solid rgba(2, 132, 168, 0.30);
  background: linear-gradient(135deg, rgba(2, 132, 168, 0.06), rgba(72, 202, 228, 0.04));
  font-size: 13px;
  font-weight: 600;
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
  /* Reset UA button styles so this works identically on <span> and <button>. */
  border: none;
  background: transparent;
  padding: 0;
  font-family: inherit;
}
.wl-qb-chipX:hover {
  background: rgba(239, 68, 96, 0.14);
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
  border: 1px solid var(--wl-line-2);
  border-radius: var(--wl-radius-sm);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(14px);
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
.wl-qb-objItem:hover { background: rgba(2, 132, 168, 0.06); }

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
  background: rgba(255, 255, 255, 0.75);
  font-size: 11px;
  cursor: default;
  transition: border-color 120ms ease;
}
.wl-qb-fieldChip:hover { border-color: rgba(2, 132, 168, 0.40); }
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
  background: rgba(255, 255, 255, 0.50);
  backdrop-filter: blur(6px);
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
.wl-qb-fieldItem:hover { background: rgba(2, 132, 168, 0.06); }
.wl-qb-fieldItemSel { background: rgba(2, 132, 168, 0.05); }
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
  background: rgba(255, 255, 255, 0.50);
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
  border-color: rgba(239, 68, 96, 0.55);
  background: rgba(239, 68, 96, 0.08);
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
  border-color: rgba(2, 132, 168, 0.55);
  background: rgba(2, 132, 168, 0.04);
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
  font-weight: 700;
  color: var(--wl-ink-dim);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.wl-qb-segBtn:first-child { border-right: 1px solid var(--wl-line); }
.wl-qb-segBtnActive {
  background: rgba(2, 132, 168, 0.14);
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

/* The SOQL card must not clip the autocomplete dropdown, which is
   absolutely positioned below the textarea and extends past the card edge.
   (Default .wl-card uses overflow:hidden for its rounded corners.) */
.wl-card--soql { overflow: visible; }

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
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(14px);
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
.wl-ac-item:hover { background: rgba(2, 132, 168, 0.06); }
.wl-ac-itemActive { background: rgba(2, 132, 168, 0.12); }
.wl-ac-itemLeft {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}
.wl-ac-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wl-ac-kindDot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}
.wl-ac-type {
  font-family: var(--wl-font-sans);
  font-size: 10px;
  color: var(--wl-ink-dim);
  margin-left: 8px;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
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
  border-color: rgba(2, 132, 168, 0.40);
  background: rgba(2, 132, 168, 0.02);
}

.wl-dropZone:focus:not(.wl-dropZoneDisabled) {
  border-color: rgba(2, 132, 168, 0.55);
  box-shadow: 0 0 0 3px var(--wl-glow);
}

.wl-dropZoneActive {
  border-color: rgba(2, 132, 168, 0.55);
  background: rgba(2, 132, 168, 0.06);
}

.wl-dropZoneDisabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wl-dropZoneError {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(239, 68, 96, 0.45);
  background: rgba(239, 68, 96, 0.08);
  color: var(--wl-danger);
  font-size: 12px;
  font-weight: 700;
}

.wl-dropZoneOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 132, 168, 0.12);
  border-radius: var(--wl-radius);
  pointer-events: none;
  z-index: 10;
}

.wl-dropZoneOverlayText {
  font-size: 18px;
  font-weight: 700;
  color: var(--wl-ink);
  padding: 12px 24px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}

:root[data-theme="dark"] .wl-dropZoneOverlayText {
  background: rgba(17, 41, 62, 0.88);
  backdrop-filter: blur(10px);
}

/* ── Query Manager & Folders ── */
.wl-folderTree { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; }
.wl-folderNode { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: var(--wl-radius-sm); cursor: pointer; font-size: 13px; transition: background 120ms ease; }
.wl-folderNode:hover { background: rgba(0,166,200,0.08); }
.wl-folderNode[data-active="true"] { background: rgba(0,166,200,0.14); }
.wl-queryManager { display: grid; grid-template-columns: 200px 1fr; gap: 12px; max-height: 480px; overflow: hidden; }
.wl-queryList { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
.wl-queryRow { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: var(--wl-radius-sm); cursor: pointer; font-size: 12px; transition: background 120ms ease; }
.wl-queryRow:hover { background: var(--wl-paper-2); }
.wl-queryRow[data-drag-over="true"] { outline: 2px solid var(--wl-accent); }

/* ── Drag and Drop Reorder ── */
.wl-dragHandle { cursor: grab; color: var(--wl-ink-dim); user-select: none; font-size: 16px; padding: 0 4px; flex-shrink: 0; }
.wl-dragHandle:active { cursor: grabbing; }
.wl-dropIndicator { height: 2px; background: var(--wl-accent); border-radius: 2px; margin: 1px 0; }
.wl-colRow[data-dragging="true"] { opacity: 0.4; }

.wl-conditionalRow { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 8px; align-items: center; }

/* ── Command Palette ── */
.wl-commandPaletteBackdrop { position: fixed; inset: 0; background: rgba(7,32,51,0.20); backdrop-filter: blur(4px); z-index: 99; }
.wl-commandPalette { position: fixed; top: 20vh; left: 50%; transform: translateX(-50%); width: 520px; max-width: 90vw; background: var(--wl-paper); border: 1px solid var(--wl-line); border-radius: var(--wl-radius); box-shadow: var(--wl-shadow); z-index: 100; padding: 12px; display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow: hidden; }
.wl-commandList { overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.wl-commandItem { padding: 8px 12px; border-radius: var(--wl-radius-sm); cursor: pointer; display: flex; gap: 12px; align-items: baseline; transition: background 100ms ease; }
.wl-commandItem[data-active="true"] { background: var(--wl-paper-2); }
.wl-commandItem:hover { background: rgba(0,166,200,0.06); }
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
.wl-templateCardTitle { font-weight: 700; font-size: 14px; }
.wl-templateCardMeta { font-size: 12px; color: var(--wl-ink-dim); }

/* ── Schema Comparison ── */
.wl-diffView { display: flex; flex-direction: column; gap: 4px; }
.wl-diffRow { display: grid; grid-template-columns: 200px 80px 1fr; gap: 8px; padding: 5px 8px; border-radius: var(--wl-radius-sm); align-items: center; font-size: 13px; }
.wl-diffRow[data-status="added"] { background: rgba(102, 187, 106, 0.12); }
.wl-diffRow[data-status="removed"] { background: rgba(239, 68, 96, 0.10); }
.wl-diffRow[data-status="changed"] { background: rgba(2, 132, 168, 0.10); }
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
.wl-undoPanelHeader { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--wl-line-2); font-weight: 700; font-size: 13px; }
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
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(14px);
  overflow-x: auto;
  flex-wrap: wrap;
}

.wl-popupNavBtn {
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.70);
  padding: 5px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 11px;
  color: var(--wl-ink-dim);
  transition: background var(--wl-transition), color var(--wl-transition), border-color var(--wl-transition);
  white-space: nowrap;
}
.wl-popupNavBtn:hover { background: rgba(2, 132, 168, 0.08); color: var(--wl-ink); border-color: rgba(2, 132, 168, 0.28); }
.wl-popupNavBtn[data-active="true"] { background: rgba(2, 132, 168, 0.10); color: var(--wl-ink); border-color: rgba(2, 132, 168, 0.28); }

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

:root[data-theme="dark"] .wl-popupNav { background: rgba(17, 41, 62, 0.60); backdrop-filter: blur(14px); }
:root[data-theme="dark"] .wl-popupNavBtn { background: rgba(17, 41, 62, 0.70); }

/* ── Dark Theme Overrides for New Components ── */
:root[data-theme="dark"] .wl-commandPalette,
:root[data-theme="dark"] .wl-undoPanel { background: rgba(17, 41, 62, 0.96); }

:root[data-theme="dark"] .wl-templateCard,
:root[data-theme="dark"] .wl-pipelineStep { background: rgba(17, 41, 62, 0.85); }

:root[data-theme="dark"] .wl-diffRow[data-status="added"] { background: rgba(102, 187, 106, 0.08); }
:root[data-theme="dark"] .wl-diffRow[data-status="removed"] { background: rgba(239, 68, 96, 0.07); }
:root[data-theme="dark"] .wl-diffRow[data-status="changed"] { background: rgba(86, 200, 232, 0.08); }

:root[data-theme="dark"] .wl-stepLibCard,
:root[data-theme="dark"] .wl-dupGroup { background: rgba(17, 41, 62, 0.80); }

:root[data-theme="dark"] .wl-queryManager,
:root[data-theme="dark"] .wl-formulaPreview { background: rgba(9, 27, 42, 0.60); }

.wl-helpTooltip { position: relative; display: inline-flex; }
.wl-helpTooltipIcon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--wl-line); font-size: 10px; font-weight: 700; color: var(--wl-ink-dim); cursor: help; }
.wl-helpTooltipContent { position: absolute; z-index: 50; padding: 8px 10px; background: var(--wl-paper); border: 1px solid var(--wl-line); border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.12); font-size: 12px; white-space: normal; min-width: 200px; max-width: 280px; }

:root[data-theme="dark"] .wl-helpTooltipContent { background: rgba(17, 41, 62, 0.96); }

/* ── Keyboard Accessibility ── */
.wl-btn:focus-visible,
.wl-input:focus-visible,
.wl-select:focus-visible,
.wl-textarea:focus-visible,
.wl-link:focus-visible,
.wl-chip:focus-visible,
.wl-navCard:focus-visible,
.wl-topNavBtn:focus-visible,
.wl-popupNavBtn:focus-visible {
  outline: 2px solid var(--wl-accent);
  outline-offset: 2px;
}

/* ── Pipeline Debugger ── */
.wl-debugTimeline { display: flex; flex-direction: column; gap: 0; padding: 14px; }
.wl-debugConnector { width: 2px; height: 12px; background: var(--wl-line); margin: 0 auto; }
.wl-debugStep { padding: 10px 12px; border: 1px solid var(--wl-line); border-radius: var(--wl-radius-sm); cursor: pointer; transition: border-color 160ms ease, box-shadow 160ms ease; }
.wl-debugStep:hover { border-color: var(--wl-accent); }
.wl-debugStepActive { border-color: var(--wl-accent); box-shadow: 0 0 0 2px var(--wl-glow); }
.wl-debugStepDone { border-color: #66bb6a; }
.wl-debugStepError { border-color: var(--wl-danger); background: rgba(239, 68, 96, 0.04); }
.wl-debugStepCurrent { border-color: var(--wl-accent); border-style: dashed; }
.wl-debugStepHeader { display: flex; align-items: center; gap: 8px; }
.wl-debugStepBadge { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.wl-debugStepMeta { display: flex; align-items: center; gap: 10px; margin-top: 4px; font-size: 12px; padding-left: 30px; }

.wl-pipelineStep[data-debug="done"] { border-color: #66bb6a; }
.wl-pipelineStep[data-debug="error"] { border-color: var(--wl-danger); background: rgba(239, 68, 96, 0.04); }
.wl-pipelineStep[data-debug="current"] { border-color: var(--wl-accent); border-style: dashed; }

:root[data-theme="dark"] .wl-debugStep { background: rgba(17, 41, 62, 0.85); }
:root[data-theme="dark"] .wl-debugStepError { background: rgba(239, 68, 96, 0.08); }
:root[data-theme="dark"] .wl-pipelineStep[data-debug="error"] { background: rgba(239, 68, 96, 0.08); }

/* ── Org Switcher ── */
.wl-orgSwitcher { position: relative; }
.wl-orgSwitcherTrigger { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--wl-line); border-radius: var(--wl-radius-sm); background: var(--wl-paper); cursor: pointer; font-size: 13px; color: var(--wl-ink); max-width: 260px; transition: border-color 160ms ease; }
.wl-orgSwitcherTrigger:hover { border-color: var(--wl-accent); }
.wl-orgColorDot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.wl-orgFlyout { position: absolute; top: calc(100% + 4px); left: 0; min-width: 300px; max-width: 380px; background: var(--wl-paper); border: 1px solid var(--wl-line); border-radius: var(--wl-radius); box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 100; padding: 6px 0; max-height: 420px; overflow-y: auto; }
.wl-orgItem { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; transition: background 120ms ease; }
.wl-orgItem:hover { background: var(--wl-accent-bg); }
.wl-orgItem[data-active="true"] { border-left: 3px solid var(--wl-accent); background: var(--wl-accent-bg); }
.wl-orgBadge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.3px; flex-shrink: 0; }
.wl-orgBadge[data-env="production"] { background: rgba(239,68,96,0.12); color: var(--wl-danger); }
.wl-orgBadge[data-env="sandbox"] { background: rgba(243,156,18,0.12); color: #e67e22; }
.wl-orgMenu { padding: 4px 12px 4px 30px; display: flex; flex-direction: column; gap: 2px; border-top: 1px solid var(--wl-line); border-bottom: 1px solid var(--wl-line); background: var(--wl-base); }
.wl-orgMenuBtn { background: none; border: none; padding: 5px 8px; text-align: left; font-size: 12px; cursor: pointer; border-radius: var(--wl-radius-sm); color: var(--wl-ink); }
.wl-orgMenuBtn:hover { background: var(--wl-accent-bg); }
.wl-orgMenuBtnDanger { color: var(--wl-danger); }
.wl-orgMenuBtnDanger:hover { background: var(--wl-danger-bg); }
.wl-orgColorPicker { display: flex; gap: 6px; padding: 8px 12px 8px 30px; flex-wrap: wrap; }
.wl-orgColorSwatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: transform 120ms ease; }
.wl-orgColorSwatch:hover { transform: scale(1.2); }
.wl-orgColorSwatch[data-selected="true"] { border-color: var(--wl-ink); box-shadow: 0 0 0 2px var(--wl-paper); }

/* ── Org Picker (dual-dropdown) ── */
.wl-orgPicker { display: flex; gap: 12px; align-items: flex-end; }

/* ── Data Diff ── */
.wl-diffAdded { background: rgba(46,204,113,0.06); }
.wl-diffRemoved { background: rgba(239,68,96,0.06); }
.wl-diffChanged { background: rgba(2,132,168,0.06); }
.wl-diffCellChanged { background: rgba(2,132,168,0.10); }
:root[data-theme="dark"] .wl-diffAdded { background: rgba(46,204,113,0.10); }
:root[data-theme="dark"] .wl-diffRemoved { background: rgba(239,68,96,0.10); }
:root[data-theme="dark"] .wl-diffChanged { background: rgba(2,132,168,0.12); }
:root[data-theme="dark"] .wl-diffCellChanged { background: rgba(2,132,168,0.18); }
:root[data-theme="dark"] .wl-orgFlyout { box-shadow: 0 8px 24px rgba(0,0,0,0.3); }

/* ── SOQL Syntax Highlighting ── */
.wl-soql-editor {
  position: relative;
}
.wl-soql-highlight {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  margin: 0;
  padding: 10px 12px;
  font-family: var(--wl-font-mono);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: hidden;
  pointer-events: none;
  border: 1px solid transparent;
  border-radius: var(--wl-radius-sm);
  color: var(--wl-ink);
}
.wl-soql-textarea {
  position: relative;
  background: transparent !important;
  color: transparent;
  caret-color: var(--wl-ink);
  /* Typography MUST match .wl-soql-highlight exactly so the caret and typed
     text line up with the colored overlay on every line. A line-height
     mismatch causes progressive drift on multi-line queries. */
  font-family: var(--wl-font-mono);
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
}
.wl-hl-keyword { color: #0070c0; font-weight: 600; }
.wl-hl-string { color: #a31515; }
.wl-hl-number { color: #098658; }
.wl-hl-operator { color: #d4a530; }
.wl-hl-paren { color: var(--wl-ink-dim); }
.wl-hl-relation { color: #7c3aed; }

:root[data-theme="dark"] .wl-hl-keyword { color: #56c8e8; }
:root[data-theme="dark"] .wl-hl-string { color: #ce9178; }
:root[data-theme="dark"] .wl-hl-number { color: #b5cea8; }
:root[data-theme="dark"] .wl-hl-operator { color: #d4d4a8; }
:root[data-theme="dark"] .wl-hl-paren { color: rgba(229, 242, 255, 0.5); }
:root[data-theme="dark"] .wl-hl-relation { color: #c084fc; }
:root[data-theme="dark"] .wl-soql-textarea { caret-color: #e5f2ff; }

/* ── ResultsGrid Copy/Edit ── */
.wl-table tr:hover .wl-grid-copyRow { opacity: 0.5 !important; }
.wl-table tr:hover .wl-grid-copyRow:hover { opacity: 1 !important; }
.wl-table th:hover .wl-grid-copyCol { opacity: 0.5 !important; }
.wl-table th:hover .wl-grid-copyCol:hover { opacity: 1 !important; }
.wl-grid-cell { cursor: default; }
.wl-grid-cell:hover { background: rgba(2, 132, 168, 0.04); }

/* ════════════════════════════════════════════════════════════════════
   SLDS-shaped, Ocean-colored design layer (v0.2 — Export/Import pivot)
   Used by the new export/import/convert/diff/schedules flows.
   Existing .wl-* classes above remain unchanged so legacy (Advanced
   Lab) screens keep working.
   ════════════════════════════════════════════════════════════════════ */

:host, :root {
  --wl-space-1: 4px;
  --wl-space-2: 8px;
  --wl-space-3: 12px;
  --wl-space-4: 16px;
  --wl-space-5: 24px;
  --wl-space-6: 32px;

  --wl-brand: #00627f;
  --wl-brand-hover: #004e66;
  --wl-brand-soft: rgba(0, 98, 127, 0.09);
  --wl-brand-fg: #ffffff;

  --wl-success-2: #1e7a46;
  --wl-success-soft: rgba(30, 122, 70, 0.10);
  --wl-warning-2: #a35a00;
  --wl-warning-soft: rgba(214, 140, 30, 0.13);
  --wl-error: #b0123f;
  --wl-error-soft: rgba(176, 18, 63, 0.08);

  --wl-page-header-bg: transparent;
  --wl-page-header-border: transparent;
  --wl-card-section-border: var(--wl-line-2);
  --wl-table-row-hover: rgba(0, 98, 127, 0.05);
  --wl-table-stripe: transparent;
  --wl-surface-base: var(--wl-ground);
  --wl-surface-raised: #ffffff;
  --wl-surface-subtle: #f6f8fa;
  --wl-focus-ring: 0 0 0 2px var(--wl-surface-raised), 0 0 0 4px var(--wl-accent);
  --wl-elevation-1: none;
}

:host[data-theme="dark"], :root[data-theme="dark"] {
  --wl-brand: #4fc3e3;
  --wl-brand-hover: #7fd6ec;
  --wl-brand-soft: rgba(79, 195, 227, 0.12);
  --wl-brand-fg: #0e1c28;

  --wl-success-2: #5fcf8b;
  --wl-success-soft: rgba(95, 207, 139, 0.13);
  --wl-warning-2: #f0b45a;
  --wl-warning-soft: rgba(240, 180, 90, 0.13);
  --wl-error: #ff7a98;
  --wl-error-soft: rgba(255, 122, 152, 0.13);

  --wl-page-header-bg: transparent;
  --wl-table-row-hover: rgba(79, 195, 227, 0.07);
  --wl-table-stripe: transparent;
  --wl-surface-base: var(--wl-ground);
  --wl-surface-raised: #15283a;
  --wl-surface-subtle: #122434;
  --wl-focus-ring: 0 0 0 2px var(--wl-surface-raised), 0 0 0 4px var(--wl-accent);
  --wl-elevation-1: none;
}

/* ── Page header (SLDS-shaped) ── */
.wl-pageHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--wl-space-4);
  padding: var(--wl-space-4) var(--wl-space-5);
  background: var(--wl-surface-raised);
  border: 1px solid var(--wl-page-header-border);
  border-radius: var(--wl-radius);
  margin-bottom: var(--wl-space-4);
  box-shadow: var(--wl-elevation-1);
}
.wl-pageHeader__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.wl-pageHeader__title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: var(--wl-ink);
}
.wl-pageHeader__sub {
  font-size: 13px;
  color: var(--wl-ink-dim);
  margin-top: 2px;
}
.wl-pageHeader__actions {
  display: flex;
  align-items: center;
  gap: var(--wl-space-2);
  flex-wrap: wrap;
}

/* ── SLDS-style card sections ── */
.wl-cardSection {
  padding: var(--wl-space-4);
  border-bottom: 1px solid var(--wl-card-section-border);
}
.wl-cardSection:last-child { border-bottom: none; }
.wl-cardSection__title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--wl-ink-dim);
  margin: 0 0 var(--wl-space-3) 0;
  display: flex;
  align-items: center;
  gap: var(--wl-space-2);
}

/* ── Button hierarchy ── */
.wl-buttonBrand {
  border: 1px solid var(--wl-brand);
  background: var(--wl-brand);
  color: var(--wl-brand-fg);
  padding: 9px 16px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13px;
  min-height: 36px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
  box-shadow: none;
}
.wl-buttonBrand:hover { background: var(--wl-brand-hover); }
.wl-buttonBrand:active { transform: translateY(0); }
.wl-buttonBrand:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

.wl-buttonNeutral {
  border: 1px solid var(--wl-line);
  background: rgba(255, 255, 255, 0.85);
  color: var(--wl-ink);
  padding: 9px 16px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13px;
  min-height: 36px;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
}
.wl-buttonNeutral:hover { border-color: var(--wl-brand); background: var(--wl-brand-soft); transform: translateY(-1px); }
:root[data-theme="dark"] .wl-buttonNeutral { background: rgba(17, 41, 62, 0.75); }

.wl-buttonDestructive {
  border: 1px solid rgba(239, 68, 96, 0.55);
  background: rgba(239, 68, 96, 0.08);
  color: var(--wl-danger);
  padding: 9px 16px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  transition: background 140ms ease, transform 140ms ease;
}
.wl-buttonDestructive:hover { background: rgba(239, 68, 96, 0.18); transform: translateY(-1px); }
.wl-buttonNeutral:disabled,
.wl-buttonDestructive:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.wl-buttonNeutral:disabled:hover { border-color: var(--wl-line); background: rgba(255, 255, 255, 0.85); }
.wl-buttonDestructive:disabled:hover { background: rgba(239, 68, 96, 0.08); }

.wl-buttonText {
  border: none;
  background: transparent;
  color: var(--wl-brand);
  padding: 6px 8px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  transition: background 140ms ease;
}
.wl-buttonText:hover { background: var(--wl-brand-soft); }

/* ── Pills / badges ── */
.wl-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  border: 1px solid var(--wl-line-2);
  background: rgba(255, 255, 255, 0.78);
  color: var(--wl-ink-dim);
}
:root[data-theme="dark"] .wl-pill { background: rgba(17, 41, 62, 0.75); }
.wl-pill--brand { border-color: var(--wl-brand); background: var(--wl-brand-soft); color: var(--wl-brand); }
.wl-pill--success { border-color: rgba(46, 125, 50, 0.45); background: var(--wl-success-soft); color: var(--wl-success-2); }
.wl-pill--warning { border-color: rgba(255, 167, 38, 0.45); background: var(--wl-warning-soft); color: var(--wl-warning-2); }
.wl-pill--error { border-color: rgba(239, 68, 96, 0.45); background: var(--wl-error-soft); color: var(--wl-error); }

/* ── Form rows (label above input, SLDS density) ── */
.wl-formRow { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--wl-space-3); }
.wl-formRow__label {
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-ink);
  display: flex;
  align-items: center;
  gap: 6px;
}
.wl-formRow__label--required::after {
  content: "*";
  color: var(--wl-danger);
}
.wl-formRow__hint { font-size: 11px; color: var(--wl-ink-dim); }

/* ── Dense data table (SLDS-shaped) ── */
.wl-dataTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.55);
}
:root[data-theme="dark"] .wl-dataTable { background: rgba(11, 28, 46, 0.45); }
.wl-dataTable th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--wl-ink-dim);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 2px solid var(--wl-brand-soft);
  padding: 8px 12px;
}
:root[data-theme="dark"] .wl-dataTable th { background: rgba(17, 41, 62, 0.92); }
.wl-dataTable td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--wl-line-2);
  vertical-align: top;
}
.wl-dataTable tr:nth-child(even) td { background: var(--wl-table-stripe); }
.wl-dataTable tr:hover td { background: var(--wl-table-row-hover); }

/* ── Home hub action cards ── */
.wl-hubGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--wl-space-4);
}
.wl-hubCard {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--wl-space-3);
  padding: var(--wl-space-5);
  border: 1px solid var(--wl-line-2);
  border-radius: var(--wl-radius);
  background: var(--wl-surface-raised);
  box-shadow: var(--wl-elevation-1);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: box-shadow 160ms ease, border-color 160ms ease;
}
:root[data-theme="dark"] .wl-hubCard {
  background: var(--wl-surface-raised);
}
.wl-hubCard:hover {
  border-color: var(--wl-brand);
  box-shadow: 0 3px 10px rgba(2, 132, 168, 0.12);
}
.wl-hubCard__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  background: var(--wl-brand-soft);
  color: var(--wl-brand);
  box-shadow: none;
}
.wl-hubCard__title { font-size: 16px; font-weight: 800; letter-spacing: -0.2px; margin: 0; }
.wl-hubCard__desc { font-size: 13px; color: var(--wl-ink-dim); margin: 0; line-height: 1.45; }
.wl-hubCard__cta {
  margin-top: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-brand);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ── Wizard step indicator ── */
.wl-flowSteps {
  display: flex;
  align-items: center;
  gap: var(--wl-space-2);
  padding: var(--wl-space-3) var(--wl-space-4);
  border: 1px solid var(--wl-line-2);
  border-radius: var(--wl-radius);
  background: rgba(255, 255, 255, 0.60);
  backdrop-filter: blur(10px);
  margin-bottom: var(--wl-space-4);
  overflow-x: auto;
}
:root[data-theme="dark"] .wl-flowSteps { background: rgba(17, 41, 62, 0.55); }
.wl-flowStep {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-ink-dim);
  white-space: nowrap;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}
.wl-flowStep:hover { background: var(--wl-brand-soft); color: var(--wl-ink); }
.wl-flowStep[data-active="true"] {
  background: var(--wl-brand-soft);
  color: var(--wl-brand);
  border-color: var(--wl-brand);
}
.wl-flowStep[data-done="true"] {
  color: var(--wl-success-2);
}
.wl-flowStep__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--wl-line-2);
  font-size: 11px;
  font-weight: 800;
}
.wl-flowStep[data-active="true"] .wl-flowStep__num { background: var(--wl-brand); color: #fff; }
.wl-flowStep[data-done="true"] .wl-flowStep__num { background: var(--wl-success-2); color: #fff; }
.wl-flowStep:disabled { cursor: not-allowed; opacity: 0.48; }

.wl-jobContext {
  position: sticky;
  top: 104px;
  z-index: 3;
  display: flex;
  gap: var(--wl-space-4);
  flex-wrap: wrap;
  padding: 10px 14px;
  border: 1px solid var(--wl-line);
  border-radius: 10px;
  background: var(--wl-surface-raised);
  box-shadow: var(--wl-elevation-1);
  color: var(--wl-ink-dim);
  font-size: 12px;
}
.wl-jobContext strong { color: var(--wl-ink); margin-right: 4px; }
.wl-jobContext[data-environment="production"] {
  border-color: rgba(183, 110, 0, 0.42);
  box-shadow: inset 3px 0 0 var(--wl-warning-2), var(--wl-elevation-1);
}

.wl-stageActions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--wl-space-3);
  padding: var(--wl-space-3) var(--wl-space-4);
  border-top: 1px solid var(--wl-line-2);
  background: var(--wl-surface-subtle);
}

.wl-reviewGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--wl-space-3);
}
.wl-reviewGrid > div { display: flex; flex-direction: column; gap: 3px; }
.wl-reviewGrid span { color: var(--wl-ink-dim); font-size: 12px; }
.wl-reviewGrid strong { font-size: 14px; }

.wl-queryTabs {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  overflow-x: auto;
  padding: 0 4px;
  border-bottom: 1px solid var(--wl-line);
  margin-bottom: var(--wl-space-3);
}
.wl-queryTabWrap { display: inline-flex; align-items: center; border: 1px solid var(--wl-line); border-bottom: 0; border-radius: 8px 8px 0 0; background: var(--wl-surface-subtle); }
.wl-queryTab { min-height: 36px; padding: 7px 10px 7px 12px; border: 0; background: transparent; color: var(--wl-ink-dim); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.wl-queryTab[aria-selected="true"] { color: var(--wl-brand); background: var(--wl-surface-raised); }
.wl-queryTabClose { width: 28px; min-height: 36px; border: 0; background: transparent; color: var(--wl-ink-dim); cursor: pointer; }
.wl-queryTabClose:disabled { opacity: 0.25; cursor: default; }
.wl-queryTabAdd { min-height: 36px; padding: 7px 12px; border: 0; background: transparent; color: var(--wl-brand); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.wl-queryTabRename { width: 140px; min-height: 34px; padding: 5px 8px; border: 0; border-radius: 7px 0 0 0; background: var(--wl-surface-raised); color: var(--wl-ink); font: inherit; }

.wl-parameterGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--wl-space-3);
  padding: var(--wl-space-3);
  border: 1px solid var(--wl-line-2);
  border-radius: 10px;
  background: var(--wl-surface-subtle);
}
.wl-parameterGrid label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 700; }
.wl-parameterGrid p { grid-column: 1 / -1; margin: 0; }

/* Guided UI shell: flatter surfaces and a compact single-row desktop header. */
.wl-app { background: var(--wl-surface-base); animation: none; }
.wl-srOnly { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.wl-searchField { display: flex; align-items: center; gap: 8px; color: var(--wl-ink-dim); }
.wl-searchField .wl-input { flex: 1 1 auto; }
:root[data-theme="dark"] .wl-app { background: var(--wl-surface-base); }
.wl-topbar { background: var(--wl-surface-raised); backdrop-filter: none; }
.wl-topbar > .wl-actions { flex: 1 1 auto; flex-wrap: nowrap; justify-content: flex-end; align-items: center; }
.wl-card { background: var(--wl-surface-raised); backdrop-filter: none; box-shadow: var(--wl-elevation-1); animation: none; }
:root[data-theme="dark"] .wl-card,
:root[data-theme="dark"] .wl-pane { background: var(--wl-surface-raised); backdrop-filter: none; }
.wl-topNav { background: var(--wl-surface-raised); backdrop-filter: none; }

@media (max-width: 760px) {
  .wl-topbar { align-items: center; flex-wrap: wrap; padding: 10px 14px; }
  .wl-topbar .wl-brand { flex: 1 1 auto; }
  .wl-topbar > .wl-actions { flex: 1 0 100%; flex-wrap: nowrap; }
  .wl-topbar > .wl-actions .wl-select { width: auto; min-width: 0; flex: 1 1 auto; }
}

/* ── Recent activity list ── */
.wl-activityList { display: flex; flex-direction: column; gap: var(--wl-space-2); }
.wl-activityItem {
  display: flex;
  align-items: center;
  gap: var(--wl-space-3);
  padding: 10px 12px;
  border: 1px solid var(--wl-line-2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.60);
}
:root[data-theme="dark"] .wl-activityItem { background: rgba(17, 41, 62, 0.55); }
.wl-activityItem__icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  background: var(--wl-brand-soft);
  color: var(--wl-brand);
  flex-shrink: 0;
}
.wl-activityItem__body { flex: 1; min-width: 0; }
.wl-activityItem__title { font-size: 13px; font-weight: 700; color: var(--wl-ink); }
.wl-activityItem__sub { font-size: 11px; color: var(--wl-ink-dim); margin-top: 2px; }
.wl-activityItem__time { font-size: 11px; color: var(--wl-ink-dim); white-space: nowrap; }
.wl-statusDot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--wl-ink-dim);
}
.wl-statusDot[data-status="success"] { background: var(--wl-success-2); }
.wl-statusDot[data-status="warning"] { background: var(--wl-warning-2); }
.wl-statusDot[data-status="danger"] { background: var(--wl-error); }

.wl-topNavBtn,
.wl-navGroupBtn,
.wl-subNavBtn,
.wl-panelTab { min-height: 36px; }

.wl-hubCard:focus-visible,
.wl-topNavBtn:focus-visible,
.wl-buttonBrand:focus-visible,
.wl-buttonNeutral:focus-visible,
.wl-buttonText:focus-visible { outline: none; box-shadow: var(--wl-focus-ring); }

/* ── Section grid (two-column layout used by Export/Import/Diff) ── */
.wl-twoCol {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--wl-space-4);
}
@media (max-width: 980px) {
  .wl-twoCol { grid-template-columns: 1fr; }
}

/* ── Empty state ── */
.wl-emptyState {
  padding: var(--wl-space-6) var(--wl-space-5);
  text-align: center;
  color: var(--wl-ink-dim);
}
.wl-emptyState__icon { font-size: 32px; opacity: 0.5; margin-bottom: var(--wl-space-2); }
.wl-emptyState__title { font-size: 15px; font-weight: 700; color: var(--wl-ink); margin: 0 0 4px 0; }
.wl-emptyState__desc { font-size: 13px; margin: 0 auto; max-width: 380px; line-height: 1.5; }

/* ── Wavey (mascot) ── */
.wl-emptyState__mascot { display: flex; justify-content: center; margin-bottom: var(--wl-space-2); }
.wl-wavey { display: block; overflow: visible; }
.wl-wavey__shadow { fill: var(--wl-ink); opacity: 0.12; }
.wl-wavey__root { animation: wl-waveyBob 3.2s ease-in-out infinite alternate; }
.wl-wavey__eyes { transform-box: fill-box; transform-origin: center; animation: wl-waveyBlink 4.6s infinite; }
.wl-wavey--wave .wl-wavey__armR { transform-box: fill-box; transform-origin: 12% 12%; animation: wl-waveyWave 4.4s ease-in-out infinite; }
@keyframes wl-waveyBob { from { transform: translateY(0); } to { transform: translateY(-5px); } }
@keyframes wl-waveyBlink { 0%, 93%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
@keyframes wl-waveyWave {
  0%, 55%, 100% { transform: rotate(0deg); }
  62% { transform: rotate(-100deg); }
  70% { transform: rotate(-75deg); }
  78% { transform: rotate(-105deg); }
  86% { transform: rotate(-80deg); }
  93% { transform: rotate(-100deg); }
}
.wl-waveyCelebrate { display: flex; align-items: center; gap: var(--wl-space-3); padding: var(--wl-space-3) var(--wl-space-4); margin-bottom: var(--wl-space-3); border: 1px solid var(--wl-line); border-radius: 12px; background: var(--wl-surface-subtle); }
.wl-waveyCelebrate__title { font-weight: 700; color: var(--wl-ink); margin: 0 0 2px 0; }
.wl-waveyCelebrate__desc { font-size: 13px; color: var(--wl-ink-dim); margin: 0; }

/* ── Tab bar within a screen ── */
.wl-flowTabs {
  display: inline-flex;
  border: 1px solid var(--wl-line);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.65);
  margin-bottom: var(--wl-space-3);
}
:root[data-theme="dark"] .wl-flowTabs { background: rgba(17, 41, 62, 0.70); }
.wl-flowTab {
  border: none;
  background: transparent;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-ink-dim);
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}
.wl-flowTab:hover { background: var(--wl-brand-soft); color: var(--wl-ink); }
.wl-flowTab[data-active="true"] { background: var(--wl-brand); color: #fff; }
:root[data-theme="dark"] .wl-flowTab[data-active="true"] { color: #062436; }

/* ── Drop zone visual upgrade for new flows (overrides for the new look) ── */
.wl-dropZone--lg {
  padding: var(--wl-space-6) var(--wl-space-5);
  text-align: center;
}
.wl-dropZone--lg .wl-dropZone__icon { font-size: 36px; opacity: 0.6; margin-bottom: var(--wl-space-2); }
.wl-dropZone--lg .wl-dropZone__title { font-size: 15px; font-weight: 700; color: var(--wl-ink); margin: 0 0 4px 0; }
.wl-dropZone--lg .wl-dropZone__hint { font-size: 12px; color: var(--wl-ink-dim); }

/* ── SearchableSelect (type-to-filter dropdown for long object/field lists) ── */
.wl-ss-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  width: 100%;
}
.wl-ss-trigger:disabled { cursor: not-allowed; opacity: 0.6; }
.wl-ss-triggerText { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wl-ss-caret { flex-shrink: 0; font-size: 10px; opacity: 0.7; }
.wl-ss-panel {
  position: fixed;
  z-index: 1000001;
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
}
.wl-ss-search { width: 100%; }
.wl-ss-list { overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
.wl-ss-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.wl-ss-item:hover, .wl-ss-itemActive { background: var(--wl-brand-soft); }
.wl-ss-itemSel { font-weight: 700; }
.wl-ss-itemLabel { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wl-ss-itemSub { flex-shrink: 0; font-size: 11px; font-family: var(--wl-mono, monospace); }
.wl-ss-empty, .wl-ss-more { padding: 8px; font-size: 12px; text-align: center; }
:root[data-theme="dark"] .wl-ss-panel { background: rgba(17, 41, 62, 0.98); }

/* ════════════════════════════════════════════════════════════════════
   Signal layer (1.1 redesign). Loaded last, so it settles the earlier
   layers. One loud element, the environment band; everything else is
   flat sheets on a cool ground, 1px rules, no lift-on-hover.
   ════════════════════════════════════════════════════════════════════ */

.wl-app {
  font-family: var(--wl-font-sans);
  font-size: 14px;
  line-height: 1.45;
  color: var(--wl-ink);
  background: var(--wl-ground);
  animation: none;
  -webkit-font-smoothing: antialiased;
}
.wl-app button, .wl-app input, .wl-app select, .wl-app textarea { font-family: inherit; }
.wl-app .wl-mono, .wl-app code, .wl-app .wl-textarea, .wl-app .wl-link { font-family: var(--wl-font-mono); }
.wl-app :focus-visible { outline: 2px solid var(--wl-accent); outline-offset: 2px; }

/* ── Environment band ── */
.wl-envBand {
  position: sticky;
  top: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 14px;
  height: 30px;
  padding: 0 20px;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  background: var(--wl-env-none);
  color: var(--wl-env-none-fg);
}
.wl-envBand__label { font-weight: 700; flex: none; }
.wl-envBand__note { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.wl-envBand[data-env="production"] { background: var(--wl-env-prod); color: var(--wl-env-prod-fg); }
.wl-envBand[data-env="sandbox"] { background: var(--wl-env-sandbox); color: var(--wl-env-sandbox-fg); }
.wl-envBand[data-env="unknown"] {
  background: var(--wl-warning-soft);
  color: var(--wl-ink);
  box-shadow: inset 0 -1px 0 var(--wl-line);
}
.wl-app[data-mode="panel"] .wl-envBand { position: static; flex-shrink: 0; padding: 0 14px; font-size: 12px; height: 26px; }

/* ── Top bar and navigation ── */
.wl-app[data-mode="app"] .wl-topbar {
  position: relative;
  top: auto;
  padding: 10px 20px;
  background: var(--wl-surface);
  border-bottom: 1px solid var(--wl-line-2);
  backdrop-filter: none;
}
.wl-brand { align-items: center; }
.wl-brand h1 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }

.wl-app[data-mode="app"] .wl-topNav,
.wl-app[data-mode="app"] .wl-navBar {
  position: sticky;
  top: 30px;
  z-index: 6;
}
.wl-app[data-mode="app"] .wl-topNav {
  gap: 2px;
  padding: 0 14px;
  background: var(--wl-surface);
  border-bottom: 1px solid var(--wl-line);
  backdrop-filter: none;
}
.wl-app .wl-topNavBtn,
.wl-app .wl-navGroupBtn {
  min-height: 44px;
  padding: 11px 10px 9px;
  border: 0;
  border-bottom: 3px solid transparent;
  border-radius: 0;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: var(--wl-ink-dim);
  transform: none;
  transition: color var(--wl-transition), border-color var(--wl-transition);
}
.wl-app .wl-topNavBtn:hover,
.wl-app .wl-navGroupBtn:hover {
  background: transparent;
  color: var(--wl-ink);
  border-color: transparent;
  border-bottom-color: var(--wl-line);
  transform: none;
}
.wl-app .wl-topNavBtn[data-active="true"],
.wl-app .wl-navGroupBtn[data-active="true"] {
  background: transparent;
  color: var(--wl-ink);
  border-color: transparent;
  border-bottom-color: var(--wl-accent);
}
.wl-app .wl-topNavBtn:focus-visible { outline: 2px solid var(--wl-accent); outline-offset: -4px; box-shadow: none; }

/* The org switcher keeps its own badge; production reads in the band's crimson. */
.wl-orgSwitcherTrigger { border-radius: var(--wl-radius-sm); background: var(--wl-surface); min-height: 32px; }
.wl-orgBadge { border-radius: 3px; letter-spacing: 0.02em; }
.wl-orgBadge[data-env="production"] { background: var(--wl-env-prod); color: var(--wl-env-prod-fg); }
.wl-orgBadge[data-env="sandbox"] { background: var(--wl-env-sandbox); color: var(--wl-env-sandbox-fg); }

/* ── Page frame ── */
.wl-app[data-mode="app"] .wl-main {
  width: 100%;
  max-width: 1360px;
  margin: 0 auto;
  padding: 28px 24px 56px;
}

.wl-pageHeader {
  align-items: flex-end;
  padding: 0;
  margin-bottom: 20px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.wl-pageHeader__title { font-size: 28px; line-height: 1.15; font-weight: 700; letter-spacing: -0.015em; }
.wl-pageHeader__sub { max-width: 72ch; margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: var(--wl-ink-dim); }

/* ── Sheets ── */
.wl-card,
.wl-pane {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius);
  box-shadow: none;
  backdrop-filter: none;
  animation: none;
}
.wl-cardHeader,
.wl-paneHeader { min-height: 48px; padding: 10px 16px; border-bottom: 1px solid var(--wl-line-2); }
.wl-cardHeader h2 { font-size: 16px; font-weight: 700; letter-spacing: -0.005em; }
.wl-cardSection { padding: 16px; }
.wl-cardSection__title { font-size: 13px; font-weight: 700; letter-spacing: 0; text-transform: none; color: var(--wl-ink); }

/* ── Buttons ── */
.wl-app .wl-btn,
.wl-app .wl-buttonNeutral {
  min-height: 34px;
  padding: 7px 12px;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  background: var(--wl-surface);
  backdrop-filter: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--wl-ink);
  transition: background-color var(--wl-transition), border-color var(--wl-transition);
}
.wl-app .wl-btn:hover,
.wl-app .wl-buttonNeutral:hover {
  transform: none;
  box-shadow: none;
  border-color: var(--wl-ink-dim);
  background: var(--wl-surface-2);
}
.wl-app .wl-btn.wl-btnPrimary,
.wl-app .wl-buttonBrand {
  border-color: var(--wl-accent);
  background: var(--wl-accent);
  color: var(--wl-brand-fg);
  border-radius: var(--wl-radius-sm);
  font-weight: 600;
}
.wl-app .wl-btn.wl-btnPrimary:hover,
.wl-app .wl-buttonBrand:hover { border-color: var(--wl-brand-hover); background: var(--wl-brand-hover); transform: none; }
.wl-app .wl-btn.wl-btnDanger,
.wl-app .wl-buttonDestructive {
  border-color: var(--wl-danger);
  background: var(--wl-surface);
  color: var(--wl-danger);
  border-radius: var(--wl-radius-sm);
}
.wl-app .wl-btn.wl-btnDanger:hover,
.wl-app .wl-buttonDestructive:hover { background: var(--wl-danger-bg); transform: none; }
.wl-app .wl-btn[data-active="true"] { border-color: var(--wl-accent); background: var(--wl-accent-bg); }
.wl-app .wl-buttonText { padding: 6px 8px; border-radius: var(--wl-radius-sm); font-size: 13px; font-weight: 600; color: var(--wl-accent); }
.wl-app .wl-buttonText:hover { background: transparent; text-decoration: underline; text-underline-offset: 3px; }
.wl-app button:disabled:hover { transform: none; }

/* ── Inputs ── */
.wl-app .wl-input,
.wl-app .wl-select,
.wl-app .wl-textarea {
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  background: var(--wl-surface);
  padding: 8px 10px;
  font-size: 13px;
}
.wl-app .wl-input:focus,
.wl-app .wl-select:focus,
.wl-app .wl-textarea:focus { border-color: var(--wl-accent); box-shadow: 0 0 0 3px var(--wl-glow); }

/* ── Tables: headers read as written; Salesforce API names keep their case. ── */
.wl-table th,
.wl-dataTable th {
  text-transform: none;
  letter-spacing: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--wl-ink-dim);
  background: var(--wl-surface-2);
  backdrop-filter: none;
  border-bottom: 1px solid var(--wl-line);
}
.wl-resultsTable thead th { font-family: var(--wl-font-mono); }
.wl-table td,
.wl-dataTable td { font-variant-numeric: tabular-nums; }
.wl-table tr:hover td,
.wl-dataTable tr:hover td { background: var(--wl-table-row-hover); }

/* ── Status marks ── */
.wl-pill,
.wl-badge { border-radius: 4px; letter-spacing: 0; font-size: 12px; font-weight: 600; background: var(--wl-surface); }
.wl-pill--success { border-color: var(--wl-success-2); color: var(--wl-success-2); background: var(--wl-success-soft); }
.wl-pill--warning { border-color: var(--wl-warning-2); color: var(--wl-warning-2); background: var(--wl-warning-soft); }
.wl-pill--error { border-color: var(--wl-danger); color: var(--wl-danger); background: var(--wl-danger-bg); }
.wl-pill--brand { border-color: var(--wl-accent); color: var(--wl-accent); background: var(--wl-accent-bg); }

.wl-bannerWarning,
.wl-bannerDanger {
  border-radius: var(--wl-radius-sm);
  border: 1px solid var(--wl-line);
  border-left-width: 4px;
  background: var(--wl-surface);
  color: var(--wl-ink);
  font-weight: 400;
}
.wl-bannerWarning { border-left-color: var(--wl-warning-2); }
.wl-bannerDanger { border-left-color: var(--wl-danger); }
.wl-bannerWarning strong { color: var(--wl-warning-2); }
.wl-bannerDanger strong { color: var(--wl-danger); }

.wl-toast { border-radius: var(--wl-radius); background: var(--wl-surface); backdrop-filter: none; border-color: var(--wl-line); }
.wl-modalOverlay { backdrop-filter: none; background: rgba(19, 41, 61, 0.45); }

/* ── Import flow ── */
.wl-flowSteps { background: var(--wl-surface); border: 1px solid var(--wl-line); border-radius: var(--wl-radius); backdrop-filter: none; }
.wl-flowStep { border-radius: var(--wl-radius-sm); font-weight: 600; }
.wl-flowStep[data-active="true"] { background: var(--wl-accent-bg); color: var(--wl-ink); border-color: var(--wl-accent); }
.wl-flowStep[data-active="true"] .wl-flowStep__num { background: var(--wl-accent); color: var(--wl-brand-fg); }
.wl-flowStep[data-done="true"] .wl-flowStep__num { background: var(--wl-success-2); color: var(--wl-brand-fg); }
.wl-jobContext { top: 82px; border-radius: var(--wl-radius-sm); box-shadow: none; }
.wl-jobContext[data-environment="production"] { border-color: var(--wl-line); box-shadow: inset 4px 0 0 var(--wl-env-prod); }
.wl-stageActions { background: var(--wl-surface-2); }
.wl-flowTabs { border-radius: var(--wl-radius-sm); background: var(--wl-surface); }
.wl-flowTab[data-active="true"] { background: var(--wl-accent); color: var(--wl-brand-fg); }

/* ── Hub cards (Jobs & activity): flat, no icon tiles ── */
.wl-hubCard { padding: 16px; gap: 6px; border: 1px solid var(--wl-line); border-radius: var(--wl-radius); background: var(--wl-surface); box-shadow: none; }
.wl-hubCard:hover { border-color: var(--wl-accent); box-shadow: none; }
.wl-hubCard__icon { width: auto; height: auto; justify-content: flex-start; background: none; border-radius: 0; color: var(--wl-accent); }
.wl-hubCard__title { font-size: 16px; font-weight: 700; }
.wl-hubCard__cta { margin-top: 6px; font-size: 13px; font-weight: 600; color: var(--wl-accent); }

/* ── Activity rows: ruled list, not cards inside cards ── */
.wl-activityList { gap: 0; }
.wl-activityItem { padding: 10px 2px; border: 0; border-bottom: 1px solid var(--wl-line-2); border-radius: 0; background: transparent; }
.wl-activityList > .wl-activityItem:last-child { border-bottom: 0; }
.wl-activityItem__icon { width: auto; height: auto; background: none; color: var(--wl-ink-dim); }
.wl-activityItem__title { font-size: 14px; font-weight: 600; }
.wl-activityItem__sub,
.wl-activityItem__time { font-size: 12px; font-variant-numeric: tabular-nums; }

/* ── Home ── */
.wl-home {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.wl-startList {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius);
  background: var(--wl-surface);
}
.wl-startItem {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  border: 0;
  border-bottom: 1px solid var(--wl-line-2);
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--wl-transition), box-shadow var(--wl-transition);
}
.wl-startItem:last-child { border-bottom: 0; }
.wl-startItem:hover { background: var(--wl-surface-2); box-shadow: inset 3px 0 0 var(--wl-accent); }
.wl-app .wl-startItem:focus-visible { outline: 2px solid var(--wl-accent); outline-offset: -2px; }
.wl-startItem__icon { flex: none; margin-top: 2px; color: var(--wl-accent); }
.wl-startItem__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.wl-startItem__title { font-size: 16px; font-weight: 700; color: var(--wl-ink); }
.wl-startItem__desc { font-size: 13px; line-height: 1.45; color: var(--wl-ink-dim); }
.wl-startItem__note { margin-top: 2px; font-size: 12px; font-weight: 600; color: var(--wl-warning-2); }
.wl-home__more { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.wl-home__side { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.wl-home__summary { max-width: 60ch; margin: 0 0 12px; }

.wl-runTable { width: 100%; border-collapse: collapse; font-size: 13px; }
.wl-runTable thead th {
  padding: 8px 16px;
  border-bottom: 1px solid var(--wl-line-2);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  color: var(--wl-ink-dim);
}
.wl-runTable tbody th,
.wl-runTable tbody td { padding: 10px 16px; border-bottom: 1px solid var(--wl-line-2); text-align: left; vertical-align: middle; }
.wl-runTable tbody tr:last-child > * { border-bottom: 0; }
.wl-runTable__title { font-weight: 600; color: var(--wl-ink); white-space: nowrap; }
.wl-runTable .wl-runTable__when { width: 1%; text-align: right; white-space: nowrap; color: var(--wl-ink-dim); font-variant-numeric: tabular-nums; }
.wl-runResult { display: flex; align-items: center; gap: 10px; }
.wl-runBar { display: flex; flex: none; width: 96px; height: 6px; overflow: hidden; border-radius: 3px; background: var(--wl-line-2); }
.wl-runBar__ok { background: var(--wl-success-2); }
.wl-runBar__failed { background: var(--wl-danger); }
.wl-runResult__text { color: var(--wl-ink-dim); font-variant-numeric: tabular-nums; }
.wl-runResult[data-state="failed"] strong { font-weight: 600; color: var(--wl-danger); }

.wl-backupList { margin: 0 0 14px; padding: 0; list-style: none; border-top: 1px solid var(--wl-line-2); }
.wl-backupList__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 1px solid var(--wl-line-2);
  font-size: 13px;
}
.wl-backupList__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.wl-backupList__cadence,
.wl-backupList__next { white-space: nowrap; color: var(--wl-ink-dim); }
.wl-backupList__next { min-width: 56px; text-align: right; font-variant-numeric: tabular-nums; }

@media (max-width: 900px) {
  .wl-home { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .wl-app[data-mode="app"] .wl-main { padding: 20px 16px 48px; }
  .wl-envBand { padding: 0 16px; }
  .wl-pageHeader { flex-direction: column; align-items: stretch; }
  .wl-pageHeader__title { font-size: 24px; }
  .wl-runBar { width: 56px; }
  .wl-topbar > .wl-actions { min-width: 0; max-width: 100%; }
  .wl-topbar > .wl-actions .wl-select { flex: 1 1 0; width: 0; min-width: 0; }
  .wl-runTable thead th,
  .wl-runTable tbody th,
  .wl-runTable tbody td { padding-left: 12px; padding-right: 12px; }
  .wl-runTable__title { white-space: normal; }
}

/* ── Dark theme: settle the earlier layers' higher-specificity rules ── */
:root[data-theme="dark"] .wl-buttonNeutral,
:root[data-theme="dark"] .wl-pill,
:root[data-theme="dark"] .wl-hubCard,
:root[data-theme="dark"] .wl-flowSteps,
:root[data-theme="dark"] .wl-flowTabs { background: var(--wl-surface); }
:root[data-theme="dark"] .wl-activityItem { background: transparent; }
:root[data-theme="dark"] .wl-app .wl-btn.wl-btnPrimary { background: var(--wl-accent); }
:root[data-theme="dark"] .wl-app .wl-btn.wl-btnDanger { background: var(--wl-surface); }
:root[data-theme="dark"] .wl-dataTable { background: transparent; }
:root[data-theme="dark"] .wl-dataTable th { background: var(--wl-surface-2); }
:root[data-theme="dark"] .wl-modalOverlay { background: rgba(0, 0, 0, 0.55); }
:root[data-theme="dark"] .wl-flowTab[data-active="true"] { color: var(--wl-brand-fg); }

@media (prefers-reduced-motion: reduce) {
  .wl-app *, .wl-app *::before, .wl-app *::after { transition-duration: 0ms !important; animation-duration: 0ms !important; }
}
`;
