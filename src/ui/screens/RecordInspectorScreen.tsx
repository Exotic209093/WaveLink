/**
 * Record Inspector — "Show all data" for a single record.
 *
 * Paste any 15- or 18-character Salesforce ID and see every field on that
 * record with its value, API name, and label, in one searchable table. The
 * object type is resolved from the ID's 3-character key prefix, and the row is
 * fetched with `SELECT FIELDS(ALL) ... LIMIT 1` so no field enumeration is
 * needed up front.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { SObjectField } from '../../core/types/salesforce';
import { Toast } from '../components/Toast';
import { fuzzyFilter } from '../utils/fuzzyMatch';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  }
}

interface FieldRow {
  name: string;
  label: string;
  type: string;
  value: unknown;
}

const ID_RE = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

export function RecordInspectorScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;
  const [recordId, setRecordId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<FieldRow[] | null>(null);
  const [resolved, setResolved] = useState<{ objectName: string; objectLabel: string } | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [prefixMap, setPrefixMap] = useState<Map<string, { name: string; label: string }>>(new Map());

  // Build the key-prefix → object map once so we can resolve an ID's type.
  useEffect(() => {
    sf.describeGlobal(tabId)
      .then(res => {
        const map = new Map<string, { name: string; label: string }>();
        for (const s of res.sobjects) {
          if (s.keyPrefix) map.set(s.keyPrefix, { name: s.name, label: s.label });
        }
        setPrefixMap(map);
      })
      .catch(() => { /* resolution will fall back to an error on inspect */ });
  }, [sf, tabId]);

  const idValid = ID_RE.test(recordId.trim());

  async function inspect(): Promise<void> {
    const id = recordId.trim();
    if (!ID_RE.test(id)) {
      setToast({ title: 'Invalid ID', body: 'Enter a 15- or 18-character Salesforce record ID.' });
      return;
    }
    const target = prefixMap.get(id.slice(0, 3));
    if (!target) {
      setToast({ title: 'Unknown object', body: `No object matches the ID prefix "${id.slice(0, 3)}". Is the schema loaded for this org?` });
      return;
    }

    setBusy(true);
    setRows(null);
    setResolved(null);
    try {
      // Describe for labels/types, and fetch every field value in one go.
      const [describe, result] = await Promise.all([
        sf.describeSObject(target.name, tabId),
        sf.runQuery(`SELECT FIELDS(ALL) FROM ${target.name} WHERE Id = '${id}' LIMIT 1`, tabId),
      ]);

      const record = result.records[0];
      if (!record) {
        setToast({ title: 'Not found', body: `No ${target.label} record with ID ${id}.` });
        return;
      }

      const meta = new Map<string, SObjectField>(describe.fields.map(f => [f.name, f]));
      const next: FieldRow[] = Object.keys(record)
        .filter(k => k !== 'attributes')
        .map(name => {
          const m = meta.get(name);
          return { name, label: m?.label ?? name, type: m?.type ?? '', value: record[name] };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      setRows(next);
      setResolved({ objectName: target.name, objectLabel: target.label });
    } catch (e) {
      setToast({ title: 'Inspect Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(
    () => (rows ? fuzzyFilter(rows, search, r => `${r.label} ${r.name}`) : []),
    [rows, search],
  );

  function renderValue(value: unknown): VNode {
    if (value === null || value === undefined || value === '') {
      return <span class="wl-muted" style="font-style:italic">null</span>;
    }
    if (typeof value === 'object') {
      return <span class="wl-mono" style="font-size:11px">{JSON.stringify(value)}</span>;
    }
    return <span>{String(value)}</span>;
  }

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Record Inspector</h2>
        <div class="wl-muted">Show all data for any record by ID</div>
      </div>

      <div class="wl-row2" style="align-items:flex-end">
        <div style="flex:1">
          <div class="wl-muted" style="margin-bottom:6px">Record ID</div>
          <input
            class="wl-input"
            style="width:100%;font-family:var(--wl-mono,monospace)"
            placeholder="e.g. 001XXXXXXXXXXXXXXX"
            value={recordId}
            onInput={(e) => setRecordId((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && idValid) inspect(); }}
          />
        </div>
        <button class="wl-buttonBrand" onClick={inspect} disabled={busy || !idValid}>
          {busy ? 'Loading…' : 'Inspect'}
        </button>
      </div>

      {resolved ? (
        <div class="wl-row" style="margin-top:10px;gap:8px;align-items:center">
          <span class="wl-pill wl-pill--brand">{resolved.objectLabel}</span>
          <span class="wl-muted wl-mono">{resolved.objectName}</span>
          <span class="wl-muted">· {rows?.length ?? 0} fields</span>
        </div>
      ) : null}

      {rows ? (
        <div style="margin-top:10px">
          <div class="wl-row">
            <input
              class="wl-input"
              value={search}
              placeholder="Search fields…"
              onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
          <div class="wl-tableWrap" style="max-height:480px;margin-top:8px">
            <table class="wl-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>API Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.name}>
                    <td>{r.label}</td>
                    <td class="wl-mono" style="font-size:12px">{r.name}</td>
                    <td class="wl-muted" style="font-size:11px">{r.type}</td>
                    <td style="max-width:380px;overflow:hidden;text-overflow:ellipsis">{renderValue(r.value)}</td>
                    <td style="text-align:right">
                      {r.value !== null && r.value !== undefined && r.value !== '' ? (
                        <button
                          class="wl-btn"
                          style="padding:2px 8px;font-size:11px"
                          title="Copy value"
                          onClick={async () => {
                            await copyText(typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value));
                            setToast({ title: 'Copied', body: r.name });
                          }}
                        >Copy</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
