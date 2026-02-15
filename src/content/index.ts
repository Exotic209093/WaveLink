/**
 * Content Script - Salesforce Org Detection.
 *
 * Injected into Salesforce pages to:
 * - Detect which org the user is currently in
 * - Extract org metadata from the page context
 * - Relay org info to the background service worker
 */

import { MessageBus } from '../services/messaging';
import { isSalesforceUrl, extractSalesforceInstance } from '../core/utils';
import type { OrgDetectPayload } from '../core/types/messaging';
import { h, render } from 'preact';
import { uiCss } from '../ui/styles/uiCss';
import { injectCss } from '../ui/utils/injectCss';
import { SfApi } from '../ui/api/sf';
import { PanelRoot } from '../ui/panel/PanelRoot';

const messageBus = new MessageBus('content');

/**
 * Detect Salesforce org information from the current page.
 */
function detectSalesforceOrg(): OrgDetectPayload | null {
  const url = window.location.href;

  if (!isSalesforceUrl(url)) {
    return null;
  }

  const instance = extractSalesforceInstance(url);

  const payload: OrgDetectPayload = {
    url,
    instanceUrl: `https://${window.location.hostname}`,
  };

  // Try to extract org ID from page context
  const orgId = extractOrgIdFromPage();
  if (orgId) {
    payload.orgId = orgId;
  }

  // Try to extract username
  const username = extractUsernameFromPage();
  if (username) {
    payload.username = username;
  }

  return payload;
}

/**
 * Attempt to extract the Salesforce Org ID from the page.
 * Looks for common DOM patterns in Lightning Experience.
 */
function extractOrgIdFromPage(): string | null {
  // Method 1: Check for org ID in the aura framework context
  try {
    const auraConfig = document.querySelector('script[data-aura-config]');
    if (auraConfig) {
      const config = auraConfig.getAttribute('data-aura-config');
      if (config) {
        const parsed = JSON.parse(config);
        if (parsed.orgId) return parsed.orgId;
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Method 2: Check meta tags
  const metaOrgId = document.querySelector('meta[name="org-id"]');
  if (metaOrgId) {
    const content = metaOrgId.getAttribute('content');
    if (content) return content;
  }

  return null;
}

/**
 * Attempt to extract the current username from the page.
 */
function extractUsernameFromPage(): string | null {
  // Check for username in common Lightning elements
  const userNavItem = document.querySelector('.uiOutputText[data-aura-rendered-by]');
  if (userNavItem?.textContent) {
    return userNavItem.textContent.trim();
  }

  return null;
}

/**
 * Send detected org info to the background service worker.
 */
async function reportOrgDetection(): Promise<void> {
  const orgInfo = detectSalesforceOrg();
  if (!orgInfo) return;

  try {
    await messageBus.send('ORG_DETECT', orgInfo);
  } catch (error) {
    // Background may not be ready yet, fail silently
    console.debug('WaveLink: Could not report org detection', error);
  }
}

// ── Handle incoming messages from popup/background ───────────────────

messageBus.on('ORG_INFO', async (message) => {
  const orgInfo = detectSalesforceOrg();
  return {
    success: true,
    data: orgInfo,
    requestId: message.requestId,
  };
});

// ── Initialize ───────────────────────────────────────────────────────

// Report org detection when content script loads
reportOrgDetection();

// Re-detect on URL changes (SPA navigation in Lightning)
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    reportOrgDetection();
  }
});

urlObserver.observe(document.body, { childList: true, subtree: true });

console.debug('WaveLink content script initialized');

// ── In-Page Panel UI (Inspector-Style) ───────────────────────────────

let panelMounted = false;
let panelOpen = false;
let panelEl: HTMLDivElement | null = null;
let edgeBtn: HTMLButtonElement | null = null;
let resizeHandle: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;

async function mountPanel(): Promise<void> {
  if (panelMounted) return;
  panelMounted = true;

  const host = document.createElement('div');
  host.id = 'wavelink-panel-host';
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.pointerEvents = 'auto';
  host.style.zIndex = '999999';
  document.documentElement.appendChild(host);

  shadow = host.attachShadow({ mode: 'open' });
  injectCss(shadow, uiCss, 'wavelink-ui');

  panelEl = document.createElement('div');
  panelEl.className = 'wl-panelRoot';
  panelEl.dataset.open = 'false';
  panelEl.style.pointerEvents = 'auto';
  panelEl.style.setProperty('--wl-nav-w', '160px');

  edgeBtn = document.createElement('button');
  edgeBtn.className = 'wl-panelEdgeBtn';
  edgeBtn.textContent = 'WaveLink';
  edgeBtn.addEventListener('click', () => setPanelOpen(!panelOpen));

  resizeHandle = document.createElement('div');
  resizeHandle.className = 'wl-resizeHandle';

  const appMount = document.createElement('div');
  appMount.style.height = '100%';
  appMount.style.overflow = 'auto';

  panelEl.appendChild(edgeBtn);
  panelEl.appendChild(resizeHandle);
  panelEl.appendChild(appMount);
  shadow.appendChild(panelEl);

  const sf = new SfApi('content');
  try {
    const ui = await sf.getUiSettings();
    panelEl.style.setProperty('--wl-panel-w', `${ui.panelWidth}px`);
    if (ui.panelDock === 'left') {
      panelEl.classList.add('wl-panelDockLeft');
    }
  } catch {
    panelEl.style.setProperty('--wl-panel-w', '420px');
  }

  wireResize();
  render(h(PanelRoot, { shadowRoot: shadow }), appMount);
}

function setPanelOpen(next: boolean): void {
  panelOpen = next;
  if (panelEl) {
    panelEl.dataset.open = String(panelOpen);
  }
}

function wireResize(): void {
  if (!panelEl || !resizeHandle) return;
  const sf = new SfApi('content');

  let startX = 0;
  let startW = 0;
  let resizing = false;

  function onMove(e: PointerEvent): void {
    if (!resizing || !panelEl) return;
    const dockLeft = panelEl.classList.contains('wl-panelDockLeft');
    const dx = e.clientX - startX;
    const nextW = Math.max(320, Math.min(760, dockLeft ? startW + dx : startW - dx));
    panelEl.style.setProperty('--wl-panel-w', `${nextW}px`);
  }

  async function onUp(e: PointerEvent): Promise<void> {
    if (!resizing || !panelEl) return;
    resizing = false;
    try {
      const w = parseInt(getComputedStyle(panelEl).width, 10);
      await sf.setUiSettings({ panelWidth: w });
    } catch {
      // Ignore
    }
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp as unknown as EventListener);
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  resizeHandle.addEventListener('pointerdown', (e) => {
    if (!panelEl) return;
    resizing = true;
    startX = e.clientX;
    startW = parseInt(getComputedStyle(panelEl).width, 10);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp as unknown as EventListener);
  });
}

messageBus.on('PANEL_TOGGLE', async (message) => {
  await mountPanel();
  setPanelOpen(!panelOpen);
  return { success: true, requestId: message.requestId };
});
