/**
 * Schema Comparison screen.
 *
 * Allows users to select two Salesforce objects (left and right), compare
 * their field schemas, and view or export the differences as CSV, JSON, or HTML.
 *
 * Complexity: O(F_left + F_right) for the comparison; O(O) for object list filtering.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { SchemaDiff } from '../utils/schemaDiff';
import { diffSchemas, diffToCsv, diffToHtml } from '../utils/schemaDiff';
import { SchemaDiffView } from '../components/SchemaDiffView';
import { Toast } from '../components/Toast';
import { downloadTextFile } from '../utils/download';

export function SchemaComparisonScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;

  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Object list
  const [objects, setObjects] = useState<Array<{ name: string; label: string }>>([]);

  // Left/right selectors
  const [leftObject, setLeftObject] = useState('');
  const [rightObject, setRightObject] = useState('');
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');

  // Comparison result
  const [diff, setDiff] = useState<SchemaDiff | null>(null);

  /** Fetch global object list. O(1) network call. */
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    sf.describeGlobal(tabId)
      .then((result) => {
        if (cancelled) return;
        const sobjects = (result.sobjects ?? []) as Array<{ name: string; label: string }>;
        setObjects(sobjects.map((o) => ({ name: o.name, label: o.label })));
      })
      .catch((e) => {
        if (!cancelled) setToast({ title: 'Failed to Load Objects', body: e instanceof Error ? e.message : 'Unknown error' });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  /** Filter objects for left selector. O(O). */
  const filteredLeft = useMemo(() => {
    const q = leftSearch.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter((o) => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  }, [objects, leftSearch]);

  /** Filter objects for right selector. O(O). */
  const filteredRight = useMemo(() => {
    const q = rightSearch.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter((o) => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  }, [objects, rightSearch]);

  /** Run the comparison. O(F_left + F_right). */
  async function compare(): Promise<void> {
    if (!leftObject || !rightObject) {
      setToast({ title: 'Select Both Objects', body: 'Choose a left and right object to compare.' });
      return;
    }

    setBusy(true);
    try {
      const [leftDescribe, rightDescribe] = await Promise.all([
        sf.describeSObject(leftObject, tabId),
        sf.describeSObject(rightObject, tabId),
      ]);

      const result = diffSchemas(
        (leftDescribe.fields ?? []).map(f => ({ ...f })),
        (rightDescribe.fields ?? []).map(f => ({ ...f })),
        leftObject,
        rightObject,
      );
      setDiff(result);
    } catch (e) {
      setToast({ title: 'Comparison Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  /** Export diff as CSV. O(D). */
  function exportCsv(): void {
    if (!diff) return;
    const csv = diffToCsv(diff);
    downloadTextFile(`wavelink-schema-diff-${diff.leftLabel}-vs-${diff.rightLabel}-${Date.now()}.csv`, csv, 'text/csv');
  }

  /** Export diff as JSON. O(D). */
  function exportJson(): void {
    if (!diff) return;
    const json = JSON.stringify(diff, null, 2);
    downloadTextFile(`wavelink-schema-diff-${diff.leftLabel}-vs-${diff.rightLabel}-${Date.now()}.json`, json, 'application/json');
  }

  /** Export diff as HTML. O(D). */
  function exportHtml(): void {
    if (!diff) return;
    const html = diffToHtml(diff);
    downloadTextFile(`wavelink-schema-diff-${diff.leftLabel}-vs-${diff.rightLabel}-${Date.now()}.html`, html, 'text/html');
  }

  /** Render an object selector dropdown. O(O). */
  function renderObjectSelector(
    label: string,
    selected: string,
    setSelected: (v: string) => void,
    searchValue: string,
    setSearchValue: (v: string) => void,
    filteredList: Array<{ name: string; label: string }>,
  ): VNode {
    return (
      <div style="display:flex;flex-direction:column;gap:6px;flex:1">
        <label style="font-weight:900;font-size:12px">{label}</label>
        <input
          class="wl-input"
          type="text"
          value={selected || searchValue}
          onInput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            setSearchValue(v);
            setSelected('');
          }}
          placeholder="Search objects..."
        />
        {searchValue && !selected ? (
          <div style="max-height:180px;overflow:auto;border:1px solid var(--wl-line-2);border-radius:var(--wl-radius-sm)">
            {filteredList.slice(0, 40).map((o) => (
              <div
                key={o.name}
                class="wl-qb-objItem"
                onClick={() => {
                  setSelected(o.name);
                  setSearchValue('');
                }}
              >
                <span class="wl-mono" style="font-size:12px">{o.name}</span>
                <span class="wl-muted">{o.label}</span>
              </div>
            ))}
            {filteredList.length === 0 ? (
              <div class="wl-muted" style="padding:8px 12px">No matching objects</div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Schema Comparison</h2>
          <div class="wl-actions">
            <button class="wl-btn wl-btnPrimary" onClick={compare} disabled={busy || !leftObject || !rightObject}>
              {busy ? 'Comparing...' : 'Compare'}
            </button>
          </div>
        </div>

        <div class="wl-row">
          <div class="wl-row2">
            {renderObjectSelector('Left Object', leftObject, setLeftObject, leftSearch, setLeftSearch, filteredLeft)}
            {renderObjectSelector('Right Object', rightObject, setRightObject, rightSearch, setRightSearch, filteredRight)}
          </div>

          {leftObject && rightObject ? (
            <div class="wl-chipRow">
              <span class="wl-chip"><span style="font-weight:900">Left:</span> {leftObject}</span>
              <span class="wl-chip"><span style="font-weight:900">Right:</span> {rightObject}</span>
            </div>
          ) : null}
        </div>
      </div>

      {diff ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Differences</h2>
            <div class="wl-actions">
              <button class="wl-btn" onClick={exportCsv}>CSV</button>
              <button class="wl-btn" onClick={exportJson}>JSON</button>
              <button class="wl-btn" onClick={exportHtml}>HTML</button>
            </div>
          </div>
          <div class="wl-row">
            <SchemaDiffView diff={diff} />
          </div>
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
