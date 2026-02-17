/**
 * Keyboard shortcut editor component.
 *
 * Displays a table of all registered shortcuts with their default and current
 * bindings. Allows inline rebinding with conflict detection and persists
 * changes via SfApi.setUiSettings().
 *
 * Complexity: O(S) per render where S is the number of registered shortcuts.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import {
  shortcutRegistry,
  normalizeKeys,
  ShortcutConflictError,
} from '../utils/shortcuts';
import type { ShortcutDefinition, ShortcutBinding } from '../utils/shortcuts';

export function ShortcutEditor(props: { sf: SfApi }): VNode {
  const { sf } = props;
  const [definitions, setDefinitions] = useState<ShortcutDefinition[]>([]);
  const [bindings, setBindings] = useState<ShortcutBinding[]>([]);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Load definitions and bindings from the registry. O(S). */
  useEffect(() => {
    setDefinitions(shortcutRegistry.getDefinitions());
    setBindings(shortcutRegistry.getBindings());
  }, []);

  /** Get the current keys for a shortcut by id. O(S). */
  const currentKeys = useCallback(
    (id: string): string => {
      const binding = bindings.find((b) => b.id === id);
      return binding?.keys ?? '';
    },
    [bindings],
  );

  /** Start capturing a new key binding. O(1). */
  const startCapture = (id: string): void => {
    setCapturingId(id);
    setError(null);
  };

  /** Cancel an in-progress capture. O(1). */
  const cancelCapture = (): void => {
    setCapturingId(null);
    setError(null);
  };

  /** Handle keydown during capture mode. O(1). */
  const handleCaptureKeydown = async (e: KeyboardEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore bare modifier presses
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;

    if (e.key === 'Escape') {
      cancelCapture();
      return;
    }

    const keys = normalizeKeys(e);
    if (!capturingId) return;

    try {
      shortcutRegistry.setBinding(capturingId, keys);
      const updated = shortcutRegistry.getBindings();
      setBindings(updated);
      setCapturingId(null);
      setError(null);

      // Persist the new bindings via SfApi
      const shortcutMap: Record<string, string> = {};
      for (const b of updated) {
        shortcutMap[b.id] = b.keys;
      }
      await sf.setUiSettings({ shortcuts: shortcutMap });
    } catch (err: unknown) {
      if (err instanceof ShortcutConflictError) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    }
  };

  return (
    <div class="wl-shortcutEditor">
      <h3>Keyboard Shortcuts</h3>
      {error && <div class="wl-shortcutError">{error}</div>}
      <table class="wl-shortcutTable">
        <thead>
          <tr>
            <th>Description</th>
            <th>Scope</th>
            <th>Default</th>
            <th>Current</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {definitions.map((def) => {
            const isCapturing = capturingId === def.id;
            return (
              <tr key={def.id}>
                <td>{def.description}</td>
                <td>{def.scope}</td>
                <td>
                  <kbd>{def.defaultKeys}</kbd>
                </td>
                <td>
                  {isCapturing ? (
                    <input
                      class="wl-input wl-shortcutCapture"
                      placeholder="Press keys..."
                      readOnly
                      autoFocus
                      onKeyDown={handleCaptureKeydown}
                      onBlur={cancelCapture}
                    />
                  ) : (
                    <kbd>{currentKeys(def.id)}</kbd>
                  )}
                </td>
                <td>
                  {isCapturing ? (
                    <button class="wl-btn" onClick={cancelCapture}>
                      Cancel
                    </button>
                  ) : (
                    <button class="wl-btn" onClick={() => startCapture(def.id)}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
