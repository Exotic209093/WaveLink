/**
 * Object/field explorer screen.
 *
 * What this file does:
 * - Uses `describeGlobal` to list objects and `describeSObject` to list fields.
 * - Provides copy-to-clipboard for object/field API names and optional token insertion into a query editor.
 *
 * Complexity:
 * - Filtering is O(O) where O is number of objects.
 * - Field table render is O(F) where F is number of fields in the described object.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { SObjectDescribe } from '../../core/types/salesforce';
import { Toast } from '../components/Toast';

async function copyText(text: string): Promise<void> {
  /**
   * Copy helper with a fallback for browsers/environments where Clipboard API is unavailable.
   *
   * Complexity: O(N) in text length for the fallback DOM path.
   */
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

export function ObjectsScreen(props: {
  sf: SfApi;
  tabId?: number;
  onInsertToken?: (token: string) => void;
}): VNode {
  const { sf, tabId } = props;
  const [search, setSearch] = useState('');
  const [objects, setObjects] = useState<Array<{ name: string; label: string; queryable: boolean }>>([]);
  const [selected, setSelected] = useState<string>('');
  const [describe, setDescribe] = useState<SObjectDescribe | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function loadObjects(): void {
    sf.describeGlobal(tabId)
      .then(res => {
        setObjects(res.sobjects.map(s => ({ name: s.name, label: s.label, queryable: s.queryable })));
      })
      .catch(e => setToast({ title: 'Describe Failed', body: e instanceof Error ? e.message : 'Unknown error' }));
  }

  useEffect(() => { loadObjects(); }, [sf, tabId]);

  useEffect(() => {
    if (!selected) {
      setDescribe(null);
      return;
    }
    sf.describeSObject(selected, tabId)
      .then(d => setDescribe(d))
      .catch(e => setToast({ title: 'Describe SObject Failed', body: e instanceof Error ? e.message : 'Unknown error' }));
  }, [sf, tabId, selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter(o => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  }, [objects, search]);

  return (
    <div style="display:grid;grid-template-columns:320px 1fr;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Objects</h2>
          <div class="wl-actions">
            <div class="wl-muted">{objects.length}</div>
            <button
              class="wl-btn"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await sf.clearSchemaCache();
                  loadObjects();
                  setSelected('');
                  setDescribe(null);
                  setToast({ title: 'Schema Refreshed', body: 'Cache cleared. Object metadata will be re-fetched.' });
                } catch (e) {
                  setToast({ title: 'Refresh Failed', body: e instanceof Error ? e.message : 'Unknown error' });
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              {refreshing ? 'Refreshing...' : 'Refresh Schema'}
            </button>
          </div>
        </div>
        <div class="wl-row">
          <input
            class="wl-input"
            value={search}
            placeholder="Search objects..."
            onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div class="wl-tableWrap" style="max-height:520px">
          <table class="wl-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.name} onClick={() => setSelected(o.name)} style={o.name === selected ? 'background:rgba(11, 102, 255, 0.08);cursor:pointer' : 'cursor:pointer'}>
                  <td>{o.label}</td>
                  <td class="wl-mono">{o.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>{selected ? `Fields: ${selected}` : 'Select an object'}</h2>
          <div class="wl-actions">
            {selected ? (
              <button
                class="wl-btn"
                onClick={async () => {
                  const token = selected;
                  await copyText(token);
                  props.onInsertToken?.(token);
                  setToast({ title: 'Copied', body: token });
                }}
              >
                Copy Object Name
              </button>
            ) : null}
          </div>
        </div>

        {describe ? (
          <div class="wl-tableWrap">
            <table class="wl-table">
              <thead>
                <tr>
                  <th>API Name</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {describe.fields.map(f => (
                  <tr
                    key={f.name}
                    style="cursor:pointer"
                    onClick={async () => {
                      await copyText(f.name);
                      props.onInsertToken?.(f.name);
                      setToast({ title: 'Copied', body: f.name });
                    }}
                  >
                    <td class="wl-mono">{f.name}</td>
                    <td>{f.label}</td>
                    <td>{f.type}</td>
                    <td>{f.required ? 'Yes' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="wl-row">
            <div class="wl-muted">
              {selected ? 'Loading fields...' : 'Pick an object on the left.'}
            </div>
          </div>
        )}
      </div>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
