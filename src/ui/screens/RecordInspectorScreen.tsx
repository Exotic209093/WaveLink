/**
 * Record Inspector — "Show all data" for a single record (Salesforce-Inspector style).
 *
 * Paste any 15- or 18-character Salesforce ID (or open one from a results grid)
 * and see every field with its value, API name, and label in one searchable
 * table. Updateable fields can be edited inline and saved back to the org;
 * reference fields drill into their parent, child relationships expand into
 * related records, and records can be created or deleted.
 *
 * The object type is resolved from the ID's 3-character key prefix, and the row
 * is fetched with `SELECT FIELDS(ALL) ... LIMIT 1`.
 */

import type { VNode } from 'preact';
import { h, Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { SObjectField, SObjectDescribe, ChildRelationship } from '../../core/types/salesforce';
import { Toast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { SearchableSelect } from '../components/SearchableSelect';
import { fuzzyFilter } from '../utils/fuzzyMatch';

interface FieldRow {
  name: string;
  label: string;
  type: string;
  value: unknown;
  updateable: boolean;
}

interface RelatedState {
  loading: boolean;
  ids?: string[];
  error?: string;
}

interface ObjectOption {
  value: string;
  label: string;
  sublabel?: string;
  createable: boolean;
}

const ID_RE = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;
// System/audit fields that are never editable even if the describe says otherwise.
const NON_EDITABLE = new Set(['Id', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById', 'SystemModstamp', 'IsDeleted']);

function looksLikeId(v: unknown): v is string {
  return typeof v === 'string' && ID_RE.test(v);
}

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

/** Coerce an edited string into the type Salesforce expects for the field. */
function coerceValue(type: string, raw: string): unknown {
  if (raw === '') return null;
  switch (type) {
    case 'boolean': return raw === 'true' || raw === '1';
    case 'int': return parseInt(raw, 10);
    case 'double': case 'currency': case 'percent': return Number(raw);
    default: return raw;
  }
}

export function RecordInspectorScreen(props: { sf: SfApi; tabId: number; initialId?: string }): VNode {
  const { sf, tabId } = props;
  const [mode, setMode] = useState<'inspect' | 'create'>('inspect');
  const [recordId, setRecordId] = useState(props.initialId ?? '');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<FieldRow[] | null>(null);
  const [describe, setDescribe] = useState<SObjectDescribe | null>(null);
  const [resolved, setResolved] = useState<{ objectName: string; objectLabel: string } | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [prefixMap, setPrefixMap] = useState<Map<string, { name: string; label: string }>>(new Map());
  const [objects, setObjects] = useState<ObjectOption[]>([]);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [related, setRelated] = useState<Record<string, RelatedState>>({});

  // Create-mode state
  const [createObject, setCreateObject] = useState('');
  const [createDescribe, setCreateDescribe] = useState<SObjectDescribe | null>(null);
  const [createFields, setCreateFields] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // Build the key-prefix → object map and the createable-object list once.
  useEffect(() => {
    sf.describeGlobal(tabId)
      .then(res => {
        const map = new Map<string, { name: string; label: string }>();
        const opts: ObjectOption[] = [];
        for (const s of res.sobjects) {
          if (s.keyPrefix) map.set(s.keyPrefix, { name: s.name, label: s.label });
          opts.push({ value: s.name, label: s.label, sublabel: s.name, createable: s.createable });
        }
        opts.sort((a, b) => a.label.localeCompare(b.label));
        setPrefixMap(map);
        setObjects(opts);
      })
      .catch(() => { /* resolution will fall back to an error on inspect */ });
  }, [sf, tabId]);

  const idValid = ID_RE.test(recordId.trim());

  async function inspect(idArg?: string): Promise<void> {
    const id = (idArg ?? recordId).trim();
    if (!ID_RE.test(id)) {
      setToast({ title: 'Invalid ID', body: 'Enter a 15- or 18-character Salesforce record ID.' });
      return;
    }
    const target = prefixMap.get(id.slice(0, 3));
    if (!target) {
      setToast({ title: 'Unknown object', body: `No object matches the ID prefix "${id.slice(0, 3)}". Is the schema loaded for this org?` });
      return;
    }

    setMode('inspect');
    setBusy(true);
    setRows(null);
    setResolved(null);
    setEdits({});
    setRelated({});
    try {
      const [desc, result] = await Promise.all([
        sf.describeSObject(target.name, tabId),
        sf.runQuery(`SELECT FIELDS(ALL) FROM ${target.name} WHERE Id = '${id}' LIMIT 1`, tabId),
      ]);

      const record = result.records[0];
      if (!record) {
        setToast({ title: 'Not found', body: `No ${target.label} record with ID ${id}.` });
        return;
      }

      const meta = new Map<string, SObjectField>(desc.fields.map(f => [f.name, f]));
      const next: FieldRow[] = Object.keys(record)
        .filter(k => k !== 'attributes')
        .map(name => {
          const m = meta.get(name);
          return {
            name,
            label: m?.label ?? name,
            type: m?.type ?? '',
            value: record[name],
            updateable: Boolean(m?.updateable) && !NON_EDITABLE.has(name),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      setRows(next);
      setDescribe(desc);
      setResolved({ objectName: target.name, objectLabel: target.label });
    } catch (e) {
      setToast({ title: 'Inspect Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  // Auto-inspect when opened with a preset ID (e.g. from a results grid).
  useEffect(() => {
    if (props.initialId && ID_RE.test(props.initialId) && prefixMap.size > 0) {
      setRecordId(props.initialId);
      inspect(props.initialId);
    }
  }, [props.initialId, prefixMap.size]);

  async function save(): Promise<void> {
    if (!resolved) return;
    const payload: Record<string, unknown> = {};
    for (const [name, raw] of Object.entries(edits)) {
      const row = rows?.find(r => r.name === name);
      payload[name] = coerceValue(row?.type ?? '', raw);
    }
    setSaving(true);
    try {
      await sf.updateRecord(resolved.objectName, recordId.trim(), payload, tabId);
      setToast({ title: 'Saved', body: `Updated ${Object.keys(payload).length} field(s) on ${recordId.trim()}.` });
      await inspect(recordId.trim());
    } catch (e) {
      setToast({ title: 'Save Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setSaving(false);
      setConfirmSave(false);
    }
  }

  async function doDelete(): Promise<void> {
    if (!resolved) return;
    setDeleting(true);
    try {
      await sf.deleteRecord(resolved.objectName, recordId.trim(), tabId);
      setToast({ title: 'Deleted', body: `${resolved.objectLabel} ${recordId.trim()} was deleted.` });
      setRows(null);
      setResolved(null);
      setDescribe(null);
    } catch (e) {
      setToast({ title: 'Delete Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function loadRelated(rel: ChildRelationship): Promise<void> {
    const key = rel.relationshipName ?? rel.childSObject;
    setRelated(prev => ({ ...prev, [key]: { loading: true } }));
    try {
      const res = await sf.runQuery(
        `SELECT Id FROM ${rel.childSObject} WHERE ${rel.field} = '${recordId.trim()}' LIMIT 50`,
        tabId,
      );
      const ids = res.records.map(r => String(r.Id)).filter(Boolean);
      setRelated(prev => ({ ...prev, [key]: { loading: false, ids } }));
    } catch (e) {
      setRelated(prev => ({ ...prev, [key]: { loading: false, error: e instanceof Error ? e.message : 'Query failed' } }));
    }
  }

  async function pickCreateObject(name: string): Promise<void> {
    setCreateObject(name);
    setCreateDescribe(null);
    setCreateFields({});
    if (!name) return;
    try {
      const desc = await sf.describeSObject(name, tabId);
      setCreateDescribe(desc);
    } catch (e) {
      setToast({ title: 'Describe Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  async function doCreate(): Promise<void> {
    if (!createDescribe) return;
    const meta = new Map(createDescribe.fields.map(f => [f.name, f]));
    const payload: Record<string, unknown> = {};
    for (const [name, raw] of Object.entries(createFields)) {
      if (raw === '') continue;
      payload[name] = coerceValue(meta.get(name)?.type ?? '', raw);
    }
    setCreating(true);
    try {
      const newId = await sf.createRecord(createObject, payload, tabId);
      setToast({ title: 'Created', body: `New ${createDescribe.label}: ${newId}` });
      setRecordId(newId);
      await inspect(newId);
    } catch (e) {
      setToast({ title: 'Create Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setCreating(false);
    }
  }

  const filtered = useMemo(
    () => (rows ? fuzzyFilter(rows, search, r => `${r.label} ${r.name}`) : []),
    [rows, search],
  );
  const editCount = Object.keys(edits).length;

  const childRels = useMemo(
    () => (describe?.childRelationships ?? []).filter(r => r.relationshipName && !r.deprecatedAndHidden),
    [describe],
  );

  const createableFields = useMemo(
    () => (createDescribe?.fields ?? [])
      .filter(f => f.createable)
      .sort((a, b) => (Number(b.required) - Number(a.required)) || a.label.localeCompare(b.label)),
    [createDescribe],
  );

  function fieldInput(f: SObjectField, value: string, onChange: (v: string) => void): VNode {
    if (f.type === 'boolean') {
      return (
        <select class="wl-input" style="width:100%;font-size:12px" value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}>
          <option value="">—</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    if (f.type === 'picklist' && f.picklistValues && f.picklistValues.length > 0) {
      return (
        <select class="wl-input" style="width:100%;font-size:12px" value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}>
          <option value="">—</option>
          {f.picklistValues.map(p => <option key={p.value} value={p.value}>{p.label ?? p.value}</option>)}
        </select>
      );
    }
    return (
      <input class="wl-input" style="width:100%;font-size:12px" value={value} onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)} />
    );
  }

  function renderValueCell(r: FieldRow): VNode {
    const parentBtn = r.type === 'reference' && looksLikeId(r.value) ? (
      <button class="wl-btn" style="margin-left:6px;padding:0 5px;font-size:10px" title="Inspect parent record" onClick={() => { setRecordId(r.value as string); inspect(r.value as string); }}>🔍</button>
    ) : null;

    if (r.updateable) {
      const current = r.name in edits ? edits[r.name] : (r.value === null || r.value === undefined ? '' : String(r.value));
      const dirty = r.name in edits;
      return (
        <Fragment>
          <input
            class="wl-input"
            style={`width:100%;font-size:12px${dirty ? ';border-color:var(--wl-accent)' : ''}`}
            value={current}
            onInput={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value;
              setEdits(prev => {
                const original = r.value === null || r.value === undefined ? '' : String(r.value);
                const next = { ...prev };
                if (v === original) delete next[r.name];
                else next[r.name] = v;
                return next;
              });
            }}
          />
          {parentBtn}
        </Fragment>
      );
    }
    if (r.value === null || r.value === undefined || r.value === '') {
      return <span class="wl-muted" style="font-style:italic">null</span>;
    }
    if (typeof r.value === 'object') {
      return <span class="wl-mono" style="font-size:11px">{JSON.stringify(r.value)}</span>;
    }
    return <Fragment><span>{String(r.value)}</span>{parentBtn}</Fragment>;
  }

  return (
    <div class="wl-card">
      <div class="wl-cardHeader" style="display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <h2>Record Inspector</h2>
          <div class="wl-muted">Show all data for any record by ID</div>
        </div>
        <div class="wl-row" style="gap:6px">
          <button class={mode === 'inspect' ? 'wl-buttonBrand' : 'wl-btn'} style="padding:4px 12px" onClick={() => setMode('inspect')}>Inspect</button>
          <button class={mode === 'create' ? 'wl-buttonBrand' : 'wl-btn'} style="padding:4px 12px" onClick={() => setMode('create')}>New record</button>
        </div>
      </div>

      {mode === 'create' ? (
        <div style="margin-top:6px">
          <div class="wl-muted" style="margin-bottom:6px">Object</div>
          <SearchableSelect
            options={objects.filter(o => o.createable)}
            value={createObject}
            onChange={pickCreateObject}
            placeholder="Choose an object to create…"
            ariaLabel="Object to create"
          />
          {createDescribe ? (
            <div style="margin-top:12px">
              <div class="wl-tableWrap" style="max-height:420px">
                <table class="wl-table">
                  <thead><tr><th>Field</th><th>API Name</th><th>Type</th><th>Value</th></tr></thead>
                  <tbody>
                    {createableFields.map(f => (
                      <tr key={f.name}>
                        <td>{f.label}{f.required ? <span style="color:var(--wl-danger)"> *</span> : null}</td>
                        <td class="wl-mono" style="font-size:12px">{f.name}</td>
                        <td class="wl-muted" style="font-size:11px">{f.type}</td>
                        <td style="max-width:340px">{fieldInput(f, createFields[f.name] ?? '', (v) => setCreateFields(prev => ({ ...prev, [f.name]: v })))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div class="wl-row" style="margin-top:10px;justify-content:flex-end">
                <button class="wl-buttonBrand" disabled={creating} onClick={doCreate}>{creating ? 'Creating…' : `Create ${createDescribe.label}`}</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <Fragment>
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
            <button class="wl-buttonBrand" onClick={() => inspect()} disabled={busy || !idValid}>
              {busy ? 'Loading…' : 'Inspect'}
            </button>
          </div>

          {resolved ? (
            <div class="wl-row" style="margin-top:10px;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="wl-pill wl-pill--brand">{resolved.objectLabel}</span>
              <span class="wl-muted wl-mono">{resolved.objectName}</span>
              <span class="wl-muted">· {rows?.length ?? 0} fields</span>
              <span style="margin-left:auto;display:flex;gap:8px">
                {editCount > 0 ? (
                  <button class="wl-buttonBrand" style="padding:4px 12px" disabled={saving} onClick={() => setConfirmSave(true)}>
                    Save {editCount} change{editCount === 1 ? '' : 's'}
                  </button>
                ) : null}
                <button class="wl-buttonDestructive" style="padding:4px 12px" disabled={deleting} onClick={() => setConfirmDelete(true)}>Delete</button>
              </span>
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
                        <td style="max-width:380px;overflow:hidden;text-overflow:ellipsis">{renderValueCell(r)}</td>
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

              {childRels.length > 0 ? (
                <div style="margin-top:14px">
                  <div style="font-weight:900;margin-bottom:8px">Related ({childRels.length})</div>
                  <div style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto">
                    {childRels.map(rel => {
                      const key = rel.relationshipName ?? rel.childSObject;
                      const st = related[key];
                      return (
                        <div key={key} class="wl-row" style="gap:8px;align-items:center;flex-wrap:wrap">
                          <button class="wl-btn" style="padding:2px 10px;font-size:12px" disabled={st?.loading} onClick={() => loadRelated(rel)}>
                            {st?.loading ? 'Loading…' : 'Load'}
                          </button>
                          <span class="wl-mono" style="font-size:12px">{rel.relationshipName}</span>
                          <span class="wl-muted" style="font-size:11px">{rel.childSObject}.{rel.field}</span>
                          {st?.error ? <span class="wl-muted" style="color:var(--wl-danger);font-size:11px">{st.error}</span> : null}
                          {st?.ids ? (
                            st.ids.length === 0 ? (
                              <span class="wl-muted" style="font-size:11px">no records</span>
                            ) : (
                              <span style="display:flex;gap:4px;flex-wrap:wrap">
                                {st.ids.map(cid => (
                                  <button
                                    key={cid}
                                    class="wl-pill"
                                    style="padding:1px 8px;font-size:11px;cursor:pointer;border:none"
                                    title="Inspect this related record"
                                    onClick={() => { setRecordId(cid); inspect(cid); }}
                                  >{cid}</button>
                                ))}
                              </span>
                            )
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Fragment>
      )}

      <ConfirmModal
        open={confirmSave}
        title="Save changes to Salesforce?"
        confirmText={saving ? 'Saving…' : 'Save'}
        busy={saving}
        onConfirm={save}
        onCancel={() => setConfirmSave(false)}
      >
        This writes {editCount} field change{editCount === 1 ? '' : 's'} to <strong>{recordId.trim()}</strong> in <strong>{resolved?.objectLabel}</strong>. This cannot be undone here.
      </ConfirmModal>

      <ConfirmModal
        open={confirmDelete}
        title="Delete this record?"
        confirmText={deleting ? 'Deleting…' : 'Delete'}
        confirmTone="danger"
        busy={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      >
        This permanently deletes <strong>{resolved?.objectLabel}</strong> record <strong>{recordId.trim()}</strong> from the org. This cannot be undone.
      </ConfirmModal>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
