/**
 * Popup entry point.
 * Initializes the popup UI and wires up event handlers
 * to communicate with the background service worker.
 */

import { MessageBus } from '../services/messaging';
import type { AuthStatusResponse } from '../core/types/messaging';

const messageBus = new MessageBus('popup');

// ── DOM References ───────────────────────────────────────────────────

const elements = {
  connectionStatus: document.getElementById('connection-status')!,
  authSection: document.getElementById('auth-section')!,
  connectedSection: document.getElementById('connected-section')!,
  btnLoginProd: document.getElementById('btn-login-prod')!,
  btnLoginSandbox: document.getElementById('btn-login-sandbox')!,
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

let currentOrgId: string | null = null;
let loadedRecords: Record<string, unknown>[] = [];

// ── Initialization ───────────────────────────────────────────────────

async function initialize(): Promise<void> {
  setupEventListeners();
  await checkAuthStatus();
}

// ── Auth ─────────────────────────────────────────────────────────────

async function checkAuthStatus(): Promise<void> {
  try {
    const response = await messageBus.send<object, AuthStatusResponse>('AUTH_STATUS', {});
    if (response.success && response.data?.authenticated && response.data.org) {
      showConnectedState(response.data.org);
    } else {
      showDisconnectedState();
    }
  } catch {
    showDisconnectedState();
  }
}

async function handleLogin(environment: 'production' | 'sandbox'): Promise<void> {
  try {
    setButtonLoading(environment === 'production' ? elements.btnLoginProd : elements.btnLoginSandbox, true);
    const response = await messageBus.send('AUTH_INITIATE', { environment });
    if (response.success) {
      await checkAuthStatus();
    } else {
      alert(`Login failed: ${response.error?.message ?? 'Unknown error'}`);
    }
  } catch (error) {
    alert(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setButtonLoading(elements.btnLoginProd, false);
    setButtonLoading(elements.btnLoginSandbox, false);
  }
}

async function handleDisconnect(): Promise<void> {
  if (!currentOrgId) return;
  try {
    await messageBus.send('AUTH_LOGOUT', { orgId: currentOrgId });
    showDisconnectedState();
  } catch (error) {
    alert(`Disconnect failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ── UI State ─────────────────────────────────────────────────────────

function showConnectedState(org: { orgId: string; username: string; instanceUrl: string }): void {
  currentOrgId = org.orgId;
  elements.authSection.classList.add('hidden');
  elements.connectedSection.classList.remove('hidden');
  elements.connectionStatus.textContent = 'Connected';
  elements.connectionStatus.className = 'status-badge connected';
  elements.orgName.textContent = org.orgId;
  elements.orgUsername.textContent = org.username;
  elements.orgInstance.textContent = new URL(org.instanceUrl).hostname;

  loadSObjects();
}

function showDisconnectedState(): void {
  currentOrgId = null;
  loadedRecords = [];
  elements.authSection.classList.remove('hidden');
  elements.connectedSection.classList.add('hidden');
  elements.connectionStatus.textContent = 'Disconnected';
  elements.connectionStatus.className = 'status-badge disconnected';
}

// ── SObject Loading ──────────────────────────────────────────────────

async function loadSObjects(): Promise<void> {
  if (!currentOrgId) return;
  try {
    const response = await messageBus.send('SCHEMA_DESCRIBE', { orgId: currentOrgId });
    if (response.success && Array.isArray(response.data)) {
      const select = elements.objectSelect;
      select.innerHTML = '<option value="">Select an object...</option>';
      for (const obj of response.data as Array<{ name: string; label: string }>) {
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
  if (!currentOrgId || loadedRecords.length === 0) return;

  const objectName = elements.objectSelect.value;
  const operation = elements.operationSelect.value as 'insert' | 'update' | 'upsert' | 'delete';

  if (!objectName) {
    alert('Please select a target object');
    return;
  }

  elements.progressOverlay.classList.remove('hidden');

  try {
    const response = await messageBus.send('DATA_PUSH_START', {
      orgId: currentOrgId,
      objectName,
      records: loadedRecords,
      operation,
    });

    if (!response.success) {
      alert(`Push failed: ${response.error?.message ?? 'Unknown error'}`);
      elements.progressOverlay.classList.add('hidden');
    }
  } catch (error) {
    alert(`Push failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    elements.progressOverlay.classList.add('hidden');
  }
}

// ── Progress Listener ────────────────────────────────────────────────

messageBus.on('DATA_PUSH_PROGRESS', async (message) => {
  const data = message.payload as {
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    status: string;
  };

  const pct = Math.round((data.processedRecords / data.totalRecords) * 100);
  elements.progressFill.style.width = `${pct}%`;
  elements.progressStats.textContent = `${data.processedRecords} / ${data.totalRecords} records (${data.failedRecords} failed)`;

  return { success: true, requestId: message.requestId };
});

messageBus.on('DATA_PUSH_COMPLETE', async (message) => {
  const data = message.payload as {
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
  };

  elements.progressOverlay.classList.add('hidden');
  elements.progressFill.style.width = '0%';

  const successCount = data.processedRecords - data.failedRecords;
  alert(`Push complete!\n${successCount} succeeded, ${data.failedRecords} failed out of ${data.totalRecords} total.`);

  return { success: true, requestId: message.requestId };
});

// ── Event Listeners ──────────────────────────────────────────────────

function setupEventListeners(): void {
  elements.btnLoginProd.addEventListener('click', () => handleLogin('production'));
  elements.btnLoginSandbox.addEventListener('click', () => handleLogin('sandbox'));
  elements.btnDisconnect.addEventListener('click', handleDisconnect);
  elements.btnPush.addEventListener('click', handleDataPush);

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

function setButtonLoading(btn: HTMLElement, loading: boolean): void {
  if (loading) {
    btn.setAttribute('disabled', 'true');
    btn.dataset.originalText = btn.textContent ?? '';
    btn.textContent = 'Connecting...';
  } else {
    btn.removeAttribute('disabled');
    btn.textContent = btn.dataset.originalText ?? btn.textContent;
  }
}

// ── Initialize ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initialize);
