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

export function SettingsScreen(props: { sf: SfApi; mode: 'app' | 'panel' }): VNode {
  const { sf, mode } = props;
  const [settings, setSettings] = useState<UiSettings | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [clearQueriesModalOpen, setClearQueriesModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sf.getUiSettings()
      .then(setSettings)
      .catch(e => setToast({ title: 'Failed to Load Settings', body: e instanceof Error ? e.message : 'Unknown error' }));
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
                onClick={() => setToast({ title: 'Keyboard', body: 'Toggle panel: Ctrl+Shift+L (Windows/Linux) or Command+Shift+L (macOS).' })}
              >
                Keyboard Shortcut
              </button>
            </div>
          </>
        ) : (
          <div class="wl-muted">Loading...</div>
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
