/**
 * Settings screen for both app and panel.
 *
 * What this file does:
 * - Reads/writes `UiSettings` via background (`UI_SETTINGS_GET/SET`).
 * - Exposes panel layout options and some maintenance actions (clear saved queries).
 *
 * Complexity: O(1) per interaction (storage I/O dominates).
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { UiSettings } from '../../core/types/storage';
import { Toast } from '../components/Toast';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { ShortcutEditor } from '../components/ShortcutEditor';
import { Skeleton } from '../components/Skeleton';
import { ACCENT_PRESETS, applyAccentColor } from '../utils/theme';
import { downloadTextFile } from '../utils/download';

export function SettingsScreen(props: { sf: SfApi; mode: 'app' | 'panel' | 'popup' }): VNode {
  const { sf, mode } = props;
  const [settings, setSettings] = useState<UiSettings | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [clearQueriesModalOpen, setClearQueriesModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storageUsage, setStorageUsage] = useState<{ bytesInUse: number; quota: number } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    sf.getUiSettings()
      .then(setSettings)
      .catch(e => setToast({ title: 'Failed to Load Settings', body: e instanceof Error ? e.message : 'Unknown error' }));
    sf.getStorageUsage()
      .then(setStorageUsage)
      .catch(() => undefined);
  }, [sf]);

  async function update(patch: Partial<UiSettings>): Promise<void> {
    try {
      const next = await sf.setUiSettings(patch);
      setSettings(next);
    } catch (e) {
      setToast({ title: 'Failed to Save', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Settings</h2>
        <div class="wl-muted">{mode === 'panel' ? 'In-page panel' : 'Full app'}</div>
      </div>
      <div class="wl-row">
        {settings ? (
          <>
            <div class="wl-row2">
              <label>
                <div class="wl-muted" style="margin-bottom:6px">Panel width ({settings.panelWidth}px)</div>
                <input
                  class="wl-input"
                  type="range"
                  min={320}
                  max={760}
                  value={settings.panelWidth}
                  onInput={(e) => update({ panelWidth: parseInt((e.currentTarget as HTMLInputElement).value, 10) })}
                />
              </label>
              <label>
                <div class="wl-muted" style="margin-bottom:6px">Dock</div>
                <select
                  class="wl-select"
                  value={settings.panelDock}
                  onChange={(e) => update({ panelDock: (e.currentTarget as HTMLSelectElement).value as UiSettings['panelDock'] })}
                >
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </select>
              </label>
            </div>

            <label class="wl-chip" style="width:fit-content;cursor:pointer">
              <input
                type="checkbox"
                checked={settings.panelPinned}
                onChange={(e) => update({ panelPinned: (e.currentTarget as HTMLInputElement).checked })}
              />
              <span>Panel pinned</span>
            </label>

            <label class="wl-chip" style="width:fit-content;cursor:pointer" title="Surfaces the cross-org Migration suite, which is still being hardened.">
              <input
                type="checkbox"
                checked={settings.experimentalMigration ?? false}
                onChange={(e) => update({ experimentalMigration: (e.currentTarget as HTMLInputElement).checked })}
              />
              <span>Experimental: cross-org Migration tools</span>
            </label>

            <div style="margin-top:12px">
              <div style="font-weight:900;margin-bottom:8px">Theme</div>
              <div class="wl-muted" style="margin-bottom:8px">Accent Color</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    title={preset.name}
                    style={`width:32px;height:32px;border-radius:50%;border:3px solid ${
                      (settings.accentColor ?? '#0284a8') === preset.hex ? 'var(--wl-ink)' : 'transparent'
                    };background:${preset.hex};cursor:pointer;transition:border-color 0.15s`}
                    onClick={() => {
                      update({ accentColor: preset.hex });
                      applyAccentColor(preset.hex);
                    }}
                  />
                ))}
              </div>
            </div>

            <div class="wl-row2">
              <button
                class="wl-btn wl-btnDanger"
                onClick={() => setClearQueriesModalOpen(true)}
                disabled={busy}
              >
                Clear Saved Queries
              </button>
              <button
                class="wl-btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await sf.clearSchemaCache();
                    setToast({ title: 'Schema Cache Cleared', body: `${result.cleared} cached entries removed. Metadata will be re-fetched on next use.` });
                  } catch (e) {
                    setToast({ title: 'Clear Failed', body: e instanceof Error ? e.message : 'Unknown error' });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Clear Schema Cache
              </button>
            </div>

            {storageUsage ? (() => {
              const usedMb = storageUsage.bytesInUse / (1024 * 1024);
              const quotaMb = storageUsage.quota / (1024 * 1024);
              const pct = Math.round((storageUsage.bytesInUse / storageUsage.quota) * 100);
              const color = pct >= 80 ? 'var(--wl-danger)' : pct >= 50 ? '#e09100' : 'var(--wl-accent)';
              return (
                <div style="margin-top:12px">
                  <div style="font-weight:900;margin-bottom:8px">Storage</div>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="wl-meter" style="flex:1;height:10px">
                      <div class="wl-meterFill" style={`width:${Math.min(pct, 100)}%;background:${color}`} />
                    </div>
                    <div class="wl-muted">{usedMb.toFixed(1)} / {quotaMb.toFixed(0)} MB ({pct}%)</div>
                  </div>
                  {pct >= 80 ? (
                    <div class="wl-bannerDanger" style="margin-top:8px;font-size:12px;font-weight:600">
                      Storage is running low. Purge old data to free space.
                    </div>
                  ) : null}
                  <button
                    class="wl-btn"
                    style="margin-top:8px"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const result = await sf.purgeOldData();
                        const refreshed = await sf.getStorageUsage();
                        setStorageUsage(refreshed);
                        setToast({
                          title: 'Old Data Purged',
                          body: `Removed ${result.historyPurged} old history entries and ${result.transactionsPurged} expired transactions.`,
                        });
                      } catch (e) {
                        setToast({ title: 'Purge Failed', body: e instanceof Error ? e.message : 'Unknown error' });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Purge Old Data
                  </button>
                </div>
              );
            })() : null}

            <div style="margin-top:16px">
              <div style="font-weight:900;margin-bottom:8px">Backup & Restore</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button
                  class="wl-btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const data = await sf.exportUserData();
                      const json = JSON.stringify(data, null, 2);
                      downloadTextFile(
                        `wavelink-backup-${new Date().toISOString().slice(0, 10)}.json`,
                        json,
                        'application/json',
                      );
                      setToast({ title: 'Exported', body: 'Backup file downloaded.' });
                    } catch (e) {
                      setToast({ title: 'Export Failed', body: e instanceof Error ? e.message : 'Unknown error' });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Export Data
                </button>
                <button
                  class="wl-btn"
                  disabled={busy}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        if (!data.version) {
                          setToast({ title: 'Invalid Backup', body: 'File does not appear to be a WaveLink backup.' });
                          return;
                        }
                        const result = await sf.importUserData(data);
                        setToast({ title: 'Imported', body: `Restored: ${result.imported.join(', ')}.` });
                        // Reload settings to reflect imported values
                        const refreshed = await sf.getUiSettings();
                        setSettings(refreshed);
                      } catch (e) {
                        setToast({ title: 'Import Failed', body: e instanceof Error ? e.message : 'Unknown error' });
                      } finally {
                        setBusy(false);
                      }
                    };
                    input.click();
                  }}
                >
                  Import Data
                </button>
              </div>
              <div class="wl-muted" style="margin-top:6px;font-size:12px">
                Exports saved queries, templates, pipelines, rule sets, and settings.
              </div>
            </div>

            <div style="margin-top:16px">
              <div style="font-weight:900;margin-bottom:8px">Keyboard Shortcuts</div>
              <ShortcutEditor sf={sf} />
            </div>

            <div style="margin-top:16px">
              <button
                class="wl-btn"
                style="font-weight:900;width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center"
                onClick={() => setAdvancedOpen(!advancedOpen)}
              >
                <span>Advanced</span>
                <span style={`transition:transform 0.2s;display:inline-block;${advancedOpen ? 'transform:rotate(180deg)' : ''}`}>&#9660;</span>
              </button>

              {advancedOpen && (
                <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px">
                  <div class="wl-row2">
                    <label style="flex:1">
                      <div class="wl-muted" style="margin-bottom:6px">Default Batch Size ({settings.defaultBatchSize ?? 200})</div>
                      <input
                        class="wl-input"
                        type="range"
                        min={1}
                        max={200}
                        value={settings.defaultBatchSize ?? 200}
                        onInput={(e) => update({ defaultBatchSize: parseInt((e.currentTarget as HTMLInputElement).value, 10) })}
                      />
                    </label>
                    <label style="flex:1">
                      <div class="wl-muted" style="margin-bottom:6px">Default Threads ({settings.defaultThreads ?? 1})</div>
                      <input
                        class="wl-input"
                        type="range"
                        min={1}
                        max={4}
                        value={settings.defaultThreads ?? 1}
                        onInput={(e) => update({ defaultThreads: parseInt((e.currentTarget as HTMLInputElement).value, 10) })}
                      />
                    </label>
                  </div>

                  <div class="wl-row2">
                    <label style="flex:1">
                      <div class="wl-muted" style="margin-bottom:6px">API Timeout ({((settings.apiTimeoutMs ?? 30000) / 1000).toFixed(0)}s)</div>
                      <input
                        class="wl-input"
                        type="range"
                        min={5000}
                        max={120000}
                        step={5000}
                        value={settings.apiTimeoutMs ?? 30000}
                        onInput={(e) => update({ apiTimeoutMs: parseInt((e.currentTarget as HTMLInputElement).value, 10) })}
                      />
                    </label>
                    <label style="flex:1">
                      <div class="wl-muted" style="margin-bottom:6px">Max Retries ({settings.maxRetries ?? 3})</div>
                      <input
                        class="wl-input"
                        type="range"
                        min={0}
                        max={5}
                        value={settings.maxRetries ?? 3}
                        onInput={(e) => update({ maxRetries: parseInt((e.currentTarget as HTMLInputElement).value, 10) })}
                      />
                    </label>
                  </div>

                  <div class="wl-row2">
                    <label style="flex:1">
                      <div class="wl-muted" style="margin-bottom:6px">Push History Limit ({settings.pushHistoryLimit ?? 100})</div>
                      <input
                        class="wl-input"
                        type="range"
                        min={10}
                        max={500}
                        step={10}
                        value={settings.pushHistoryLimit ?? 100}
                        onInput={(e) => update({ pushHistoryLimit: parseInt((e.currentTarget as HTMLInputElement).value, 10) })}
                      />
                    </label>
                    <label style="flex:1">
                      <div class="wl-muted" style="margin-bottom:6px">Schema Cache TTL ({settings.schemaCacheTtlMinutes ?? 30} min)</div>
                      <input
                        class="wl-input"
                        type="range"
                        min={5}
                        max={120}
                        step={5}
                        value={settings.schemaCacheTtlMinutes ?? 30}
                        onInput={(e) => update({ schemaCacheTtlMinutes: parseInt((e.currentTarget as HTMLInputElement).value, 10) })}
                      />
                    </label>
                  </div>

                  <button
                    class="wl-btn"
                    style="width:fit-content"
                    onClick={() => update({
                      defaultBatchSize: undefined,
                      defaultThreads: undefined,
                      apiTimeoutMs: undefined,
                      maxRetries: undefined,
                      pushHistoryLimit: undefined,
                      schemaCacheTtlMinutes: undefined,
                    })}
                  >
                    Reset to Defaults
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <Skeleton variant="card" />
        )}
      </div>

      <TypedConfirmModal
        open={clearQueriesModalOpen}
        title="Clear All Saved Queries"
        confirmationPhrase="CLEAR QUERIES"
        busy={busy}
        onCancel={() => setClearQueriesModalOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            const queries = await sf.listSavedQueries();
            await Promise.all(queries.map(q => sf.deleteSavedQuery(q.id).catch(() => undefined)));
            setToast({ title: 'Cleared', body: `${queries.length} saved queries cleared.` });
            setClearQueriesModalOpen(false);
          } catch (e) {
            setToast({ title: 'Clear Failed', body: e instanceof Error ? e.message : 'Unknown error' });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div class="wl-muted">
          This will permanently delete all of your saved queries. This action cannot be undone.
        </div>
      </TypedConfirmModal>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
