/**
 * Popup entry point.
 *
 * What this file does:
 * - Renders the extension popup UI (DOM-based, no framework).
 * - Derives Salesforce "context" (org/user/instance) from the *currently active Salesforce tab*.
 * - Starts data pushes scoped to that tab by calling background handlers with `{ tabId }`.
 * - Launches the full WaveLink App tab pinned to the active Salesforce tab (`app.html?tabId=...`).
 *
 * Why we do it this way (vs a manual Connect step):
 * - It keeps popup usage per-tab and avoids global "active org" state.
 * - It mirrors Salesforce Inspector behavior: reuse the browser session via cookies on demand.
 *
 * Complexity:
 * - Context resolution is O(1) JS work (auth may do network validation).
 * - Listing SObjects is O(S) over `DescribeGlobalResult.sobjects`.
 * - Focusing an existing WaveLink App tab is O(T) over open tabs.
 */

import { MessageBus } from '../services/messaging';
import type { DescribeGlobalResult } from '../services/salesforce/api-client';
import { extractTabIdFromUrl, isSalesforceUrl } from '../core/utils';

const messageBus = new MessageBus('popup');

// ── DOM References ───────────────────────────────────────────────────

const elements = {
  connectionStatus: document.getElementById('connection-status')!,
  authSection: document.getElementById('auth-section')!,
  connectedSection: document.getElementById('connected-section')!,
  btnOpenApp: document.getElementById('btn-open-app')!,
  btnTogglePanel: document.getElementById('btn-toggle-panel')!,
  btnLoginProd: document.getElementById('btn-login-prod')!,
  btnDisconnect: document.getElementById('btn-disconnect')!,
  orgName: document.getElementById('org-name')!,
  orgUsername: document.getElementById('org-username')!,
  orgInstance: document.getElementById('org-instance')!,
  objectSelect: document.getElementById('object-select') as HTMLSelectElement,
  operationSelect: document.getElementById('operation-select') as HTMLSelectElement,
  fileDropZone: document.getElementById('file-drop-zone')!,
  fileInput: document.getElementById('file-input') as HTMLInputElement,
  dataPreview: document.getElementById('data-preview')!,
  previewStats: document.getElementById('preview-stats')!,
  previewTableContainer: document.getElementById('preview-table-container')!,
  fieldMappingSection: document.getElementById('field-mapping-section')!,
  btnPush: document.getElementById('btn-push')!,
  progressOverlay: document.getElementById('progress-overlay')!,
  progressFill: document.getElementById('progress-fill')!,
  progressStats: document.getElementById('progress-stats')!,
  btnCancelPush: document.getElementById('btn-cancel-push')!,
  tabs: document.querySelectorAll<HTMLElement>('.tab'),
  tabContents: document.querySelectorAll<HTMLElement>('.tab-content'),
};

// ── State ────────────────────────────────────────────────────────────

type SfContext = {
  orgId: string;
  username: string;
  instanceUrl: string;
  apiVersion: string;
  environment: 'production' | 'sandbox';
};

let currentTabId: number | null = null;
let currentContext: SfContext | null = null;
let loadedRecords: Record<string, unknown>[] = [];
let currentPushId: string | null = null;

// ── Initialization ───────────────────────────────────────────────────

async function initialize(): Promise<void> {
  /**
   * Popup boot:
   * - Wire DOM listeners.
   * - Immediately attempt to resolve context from the active tab.
   *
   * Complexity: O(1).
   */
  setupEventListeners();
  await refreshActiveTabContext();
}

// ── Auth ─────────────────────────────────────────────────────────────

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  /**
   * Returns the active tab in the focused window (or null).
   *
   * Why:
   * - All popup actions are scoped to "what the user is looking at right now".
   *
   * Complexity: O(1).
   */
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] ?? null;
}

async function refreshActiveTabContext(): Promise<void> {
  /**
   * Resolve Salesforce context from the active tab and update popup state.
   *
   * Why:
   * - In MV3, we don't keep long-lived connections; we derive state from the tab + cookies on demand.
   *
   * Data types:
   * - Background returns `SfContext` (`orgId`, `username`, `instanceUrl`, etc).
   *
   * Complexity: O(1) JS work (auth may validate session via network).
   */
  try {
    setButtonLoading(elements.btnLoginProd, true, 'Refreshing...');
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url || !isSalesforceUrl(tab.url)) {
      showDisconnectedState();
      return;
    }

    const response = await messageBus.send<{ tabId: number }, SfContext>('SF_CONTEXT_GET', { tabId: tab.id });
    if (!response.success || !response.data) {
      showDisconnectedState();
      return;
    }

    showConnectedState(response.data, tab.id);
  } catch {
    showDisconnectedState();
  } finally {
    setButtonLoading(elements.btnLoginProd, false);
  }
}

async function handleDisconnect(): Promise<void> {
  showDisconnectedState();
}

// ── UI State ─────────────────────────────────────────────────────────

function showConnectedState(ctx: SfContext, tabId: number): void {
  /**
   * Enter "connected" UI state for the resolved Salesforce context.
   *
   * Complexity: O(1) DOM updates + triggers an async SObject load.
   */
  currentTabId = tabId;
  currentContext = ctx;
  elements.authSection.classList.add('hidden');
  elements.connectedSection.classList.remove('hidden');
  elements.connectionStatus.textContent = 'Connected';
  elements.connectionStatus.className = 'status-badge connected';
  elements.orgName.textContent = ctx.orgId;
  elements.orgUsername.textContent = ctx.username;
  elements.orgInstance.textContent = new URL(ctx.instanceUrl).hostname;

  loadSObjects();
}

function showDisconnectedState(): void {
  /**
   * Reset popup state back to "disconnected".
   *
   * Note:
   * - This does NOT log the user out of Salesforce; it's only clearing extension UI state.
   *
   * Complexity: O(1).
   */
  currentTabId = null;
  currentContext = null;
  loadedRecords = [];
  elements.authSection.classList.remove('hidden');
  elements.connectedSection.classList.add('hidden');
  elements.connectionStatus.textContent = 'Disconnected';
  elements.connectionStatus.className = 'status-badge disconnected';
}

// ── SObject Loading ──────────────────────────────────────────────────

async function loadSObjects(): Promise<void> {
  /**
   * Populate the "Target Object" dropdown from `describeGlobal`.
   *
   * Complexity: O(S) where S is number of returned sObjects.
   */
  if (!currentTabId) return;
  try {
    const response = await messageBus.send<{ tabId: number }, DescribeGlobalResult>('SF_DESCRIBE_GLOBAL', { tabId: currentTabId });
    if (response.success && response.data?.sobjects) {
      const select = elements.objectSelect;
      select.innerHTML = '<option value="">Select an object...</option>';
      const createables = response.data.sobjects.filter(s => s.createable);
      for (const obj of createables) {
        const option = document.createElement('option');
        option.value = obj.name;
        option.textContent = `${obj.label} (${obj.name})`;
        select.appendChild(option);
      }
    }
  } catch {
    // Silent fail, user can retry
  }
}

// ── File Handling ────────────────────────────────────────────────────

function handleFileSelect(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    try {
      if (file.name.endsWith('.json')) {
        loadedRecords = JSON.parse(content);
        if (!Array.isArray(loadedRecords)) {
          loadedRecords = [loadedRecords];
        }
      } else if (file.name.endsWith('.csv')) {
        loadedRecords = parseCsvToRecords(content);
      }
      showDataPreview();
    } catch (error) {
      alert(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  reader.readAsText(file);
}

function parseCsvToRecords(csv: string): Record<string, unknown>[] {
  /**
   * Very small CSV parser for popup usage.
   *
   * Tradeoff:
   * - This is not RFC-compliant CSV (quoted commas, newlines-in-fields, etc). For complex inputs, use the full app.
   *
   * Complexity: O(L) where L is the number of lines/values.
   */
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const record: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] ?? '';
    });
    records.push(record);
  }

  return records;
}

function showDataPreview(): void {
  if (loadedRecords.length === 0) {
    elements.dataPreview.classList.add('hidden');
    elements.btnPush.classList.add('hidden');
    return;
  }

  elements.dataPreview.classList.remove('hidden');
  elements.btnPush.classList.remove('hidden');
  elements.btnPush.removeAttribute('disabled');

  elements.previewStats.textContent = `${loadedRecords.length} records, ${Object.keys(loadedRecords[0]).length} fields`;

  // Build preview table (first 5 rows)
  const previewRows = loadedRecords.slice(0, 5);
  const headers = Object.keys(previewRows[0]);

  let tableHtml = '<table><thead><tr>';
  for (const h of headers) {
    tableHtml += `<th>${escapeHtml(h)}</th>`;
  }
  tableHtml += '</tr></thead><tbody>';

  for (const row of previewRows) {
    tableHtml += '<tr>';
    for (const h of headers) {
      tableHtml += `<td>${escapeHtml(String(row[h] ?? ''))}</td>`;
    }
    tableHtml += '</tr>';
  }

  if (loadedRecords.length > 5) {
    tableHtml += `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--color-text-secondary)">... and ${loadedRecords.length - 5} more rows</td></tr>`;
  }

  tableHtml += '</tbody></table>';
  elements.previewTableContainer.innerHTML = tableHtml;
}

// ── Data Push ────────────────────────────────────────────────────────

async function handleDataPush(): Promise<void> {
  /**
   * Start a push job via background and show progress overlay.
   *
   * Complexity: O(1) here; actual work is in background and is O(N) over records.
   */
  if (!currentTabId || loadedRecords.length === 0) return;

  const objectName = elements.objectSelect.value;
  const operation = elements.operationSelect.value as 'insert' | 'update' | 'upsert' | 'delete';

  if (!objectName) {
    alert('Please select a target object');
    return;
  }

  elements.progressOverlay.classList.remove('hidden');
  elements.btnCancelPush.removeAttribute('disabled');
  currentPushId = null;

  try {
    const response = await messageBus.send<
      { tabId: number; objectName: string; records: Record<string, unknown>[]; operation: 'insert' | 'update' | 'upsert' | 'delete' },
      { pushId: string; strategy: 'bulk' | 'rest' }
    >('DATA_PUSH_START', {
      tabId: currentTabId,
      objectName,
      records: loadedRecords,
      operation,
    });

    if (!response.success) {
      alert(`Push failed: ${response.error?.message ?? 'Unknown error'}`);
      elements.progressOverlay.classList.add('hidden');
      elements.btnCancelPush.setAttribute('disabled', 'true');
      currentPushId = null;
      return;
    }
    currentPushId = response.data?.pushId ?? null;
  } catch (error) {
    alert(`Push failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    elements.progressOverlay.classList.add('hidden');
    elements.btnCancelPush.setAttribute('disabled', 'true');
    currentPushId = null;
  }
}

// ── Progress Listener ────────────────────────────────────────────────

messageBus.on('DATA_PUSH_PROGRESS', async (message) => {
  const data = message.payload as {
    pushId?: string;
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    status: string;
  };

  if (currentPushId && data.pushId && data.pushId !== currentPushId) {
    return { success: true, requestId: message.requestId };
  }

  const pct = Math.round((data.processedRecords / data.totalRecords) * 100);
  elements.progressFill.style.width = `${pct}%`;
  elements.progressStats.textContent = `${data.processedRecords} / ${data.totalRecords} records (${data.failedRecords} failed)`;

  return { success: true, requestId: message.requestId };
});

messageBus.on('DATA_PUSH_COMPLETE', async (message) => {
  const data = message.payload as {
    pushId?: string;
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    status?: string;
  };

  if (currentPushId && data.pushId && data.pushId !== currentPushId) {
    return { success: true, requestId: message.requestId };
  }

  elements.progressOverlay.classList.add('hidden');
  elements.progressFill.style.width = '0%';
  elements.btnCancelPush.setAttribute('disabled', 'true');

  const successCount = data.processedRecords - data.failedRecords;
  if (data.status === 'cancelled') {
    alert(`Push cancelled.\n${successCount} succeeded, ${data.failedRecords} failed out of ${data.totalRecords} total.`);
  } else {
    alert(`Push complete!\n${successCount} succeeded, ${data.failedRecords} failed out of ${data.totalRecords} total.`);
  }
  currentPushId = null;

  return { success: true, requestId: message.requestId };
});

// ── Event Listeners ──────────────────────────────────────────────────

function setupEventListeners(): void {
  /**
   * Wire all popup DOM event listeners.
   *
   * Complexity: O(1) (listener registration).
   */
  elements.btnOpenApp.addEventListener('click', () => {
    openWaveLinkAppForActiveTab().catch(() => {
      // Ignore
    });
  });
  elements.btnTogglePanel.addEventListener('click', async () => {
    try {
      await messageBus.send('PANEL_TOGGLE', {});
    } catch {
      // Ignore
    }
  });

  elements.btnLoginProd.addEventListener('click', refreshActiveTabContext);
  elements.btnDisconnect.addEventListener('click', handleDisconnect);
  elements.btnPush.addEventListener('click', handleDataPush);
  elements.btnCancelPush.addEventListener('click', async () => {
    if (!currentPushId) return;
    try {
      await messageBus.send('DATA_PUSH_CANCEL', { pushId: currentPushId });
    } catch {
      // Ignore
    }
  });

  // Tab switching
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab!;
      elements.tabs.forEach(t => t.classList.remove('active'));
      elements.tabContents.forEach(tc => {
        tc.classList.remove('active');
        tc.classList.add('hidden');
      });
      tab.classList.add('active');
      const content = document.getElementById(`tab-${tabName}`);
      if (content) {
        content.classList.remove('hidden');
        content.classList.add('active');
      }
    });
  });

  // File drop zone
  elements.fileDropZone.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', () => {
    const file = elements.fileInput.files?.[0];
    if (file) handleFileSelect(file);
  });

  elements.fileDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.fileDropZone.classList.add('dragover');
  });

  elements.fileDropZone.addEventListener('dragleave', () => {
    elements.fileDropZone.classList.remove('dragover');
  });

  elements.fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.fileDropZone.classList.remove('dragover');
    const file = (e as DragEvent).dataTransfer?.files[0];
    if (file) handleFileSelect(file);
  });
}

// ── Utilities ────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function openWaveLinkAppForActiveTab(): Promise<void> {
  /**
   * Open (or focus) a WaveLink App tab pinned to the active Salesforce tab.
   *
   * Why:
   * - Users often work with multiple orgs/tabs simultaneously; `tabId` makes the app per-tab.
   *
   * Complexity: O(T) where T is the number of open tabs (we scan to find an existing app tab).
   */
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url || !isSalesforceUrl(tab.url)) {
    alert('Open a logged-in Salesforce tab first.');
    return;
  }

  const appBase = chrome.runtime.getURL('app/app.html');
  const targetUrl = `${appBase}?tabId=${tab.id}`;

  const allTabs = await chrome.tabs.query({});
  const existing = allTabs.find(t =>
    typeof t.url === 'string'
    && t.url.startsWith(appBase)
    && extractTabIdFromUrl(t.url) === tab.id
    && typeof t.id === 'number'
  );

  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    try {
      await chrome.windows.update(existing.windowId, { focused: true });
    } catch {
      // Not critical; focusing window may not be available in some contexts.
    }
    return;
  }

  await chrome.tabs.create({ url: targetUrl });
}

function setButtonLoading(btn: HTMLElement, loading: boolean, loadingText: string = 'Connecting...'): void {
  if (loading) {
    btn.setAttribute('disabled', 'true');
    btn.dataset.originalText = btn.textContent ?? '';
    btn.textContent = loadingText;
  } else {
    btn.removeAttribute('disabled');
    btn.textContent = btn.dataset.originalText ?? btn.textContent;
  }
}

// ── Initialize ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initialize);
