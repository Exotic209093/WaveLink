/**
 * Scheduled exports manager (v0.2 pivot).
 *
 * Lets the user create recurring SOQL exports backed by chrome.alarms.
 * Snapshot capture happens in the background service worker.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { ScheduledExport, ExportSnapshot, ScheduleInterval, SavedExportFormat } from '../../core/types/storage';
import type { SalesforceOrg } from '../../core/types/salesforce';

interface FormState {
  id?: string;
  name: string;
  soql: string;
  orgId: string;
  format: SavedExportFormat;
  intervalKind: 'minutes' | 'hours' | 'days';
  intervalValue: number;
  retention: number;
}

const EMPTY_FORM: FormState = {
  name: '',
  soql: 'SELECT Id, Name FROM Account LIMIT 100',
  orgId: '',
  format: 'csv',
  intervalKind: 'hours',
  intervalValue: 6,
  retention: 10,
};

function intervalToMinutes(i: ScheduleInterval): number {
  switch (i.kind) {
    case 'minutes': return i.minutes;
    case 'hours': return i.hours * 60;
    case 'days': return i.days * 60 * 24;
  }
}

function formatInterval(i: ScheduleInterval): string {
  switch (i.kind) {
    case 'minutes': return `every ${i.minutes}m`;
    case 'hours': return `every ${i.hours}h`;
    case 'days': return `every ${i.days}d`;
  }
}

function formatRelative(ms?: number): string {
  if (!ms) return '—';
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  let txt: string;
  if (abs < 60_000) txt = 'just now';
  else if (abs < 3_600_000) txt = `${Math.round(abs / 60_000)}m`;
  else if (abs < 86_400_000) txt = `${Math.round(abs / 3_600_000)}h`;
  else txt = `${Math.round(abs / 86_400_000)}d`;
  return past ? `${txt} ago` : `in ${txt}`;
}

function uid(): string { return `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function SchedulesScreen(props: { sf: SfApi }): VNode {
  const [schedules, setSchedules] = useState<ScheduledExport[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, ExportSnapshot>>({});
  const [orgs, setOrgs] = useState<SalesforceOrg[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload(): Promise<void> {
    chrome.storage.local.get(['scheduledExports', 'exportSnapshots'], (r) => {
      setSchedules((r.scheduledExports as ScheduledExport[]) ?? []);
      setSnapshots((r.exportSnapshots as Record<string, ExportSnapshot>) ?? {});
    });
    try {
      const list = await props.sf.listOrgs();
      setOrgs(list.orgs);
    } catch {
      // Orgs may not yet be loaded; that's fine.
    }
  }

  useEffect(() => { reload(); }, []);

  async function persist(next: ScheduledExport[]): Promise<void> {
    await new Promise<void>((res) => chrome.storage.local.set({ scheduledExports: next }, () => res()));
    setSchedules(next);
  }

  async function saveForm(): Promise<void> {
    if (!editing) return;
    setError(null);

    if (!editing.name.trim()) { setError('Name is required'); return; }
    if (!editing.soql.trim()) { setError('SOQL query is required'); return; }
    if (!editing.orgId) { setError('Pick an org to run the query against'); return; }
    if (editing.intervalValue < 1) { setError('Interval must be at least 1'); return; }

    const interval: ScheduleInterval =
      editing.intervalKind === 'minutes' ? { kind: 'minutes', minutes: editing.intervalValue } :
      editing.intervalKind === 'hours' ? { kind: 'hours', hours: editing.intervalValue } :
      { kind: 'days', days: editing.intervalValue };

    const now = Date.now();
    const isNew = !editing.id;
    const id = editing.id ?? uid();
    const existing = schedules.find(s => s.id === id);
    const sched: ScheduledExport = {
      id,
      name: editing.name.trim(),
      soql: editing.soql,
      orgId: editing.orgId,
      format: editing.format,
      interval,
      enabled: existing?.enabled ?? true,
      retention: Math.max(1, editing.retention),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastRunAt: existing?.lastRunAt,
      lastRunStatus: existing?.lastRunStatus,
      lastRunError: existing?.lastRunError,
      nextRunAt: now + intervalToMinutes(interval) * 60 * 1000,
    };

    const next = isNew ? [...schedules, sched] : schedules.map(s => s.id === id ? sched : s);
    await persist(next);

    // Set the alarm via background. We just write to storage and ask the worker to (re)schedule.
    try {
      await chrome.runtime.sendMessage({ type: 'SCHEDULE_ALARM_SET', payload: { id: sched.id } });
    } catch (e) {
      console.warn('Could not message background to set alarm:', e);
    }

    setEditing(null);
  }

  async function toggleEnabled(s: ScheduledExport): Promise<void> {
    const next = schedules.map(x => x.id === s.id ? { ...x, enabled: !x.enabled, updatedAt: Date.now() } : x);
    await persist(next);
    try {
      await chrome.runtime.sendMessage({
        type: s.enabled ? 'SCHEDULE_ALARM_CLEAR' : 'SCHEDULE_ALARM_SET',
        payload: { id: s.id },
      });
    } catch { /* ignore */ }
  }

  async function remove(s: ScheduledExport): Promise<void> {
    if (!confirm(`Delete schedule "${s.name}"? Snapshots will be removed too.`)) return;
    const nextSnapshots = { ...snapshots };
    for (const [snapId, snap] of Object.entries(nextSnapshots)) {
      if (snap.scheduleId === s.id) delete nextSnapshots[snapId];
    }
    await new Promise<void>((res) => chrome.storage.local.set({ exportSnapshots: nextSnapshots }, () => res()));
    setSnapshots(nextSnapshots);
    await persist(schedules.filter(x => x.id !== s.id));
    try { await chrome.runtime.sendMessage({ type: 'SCHEDULE_ALARM_CLEAR', payload: { id: s.id } }); } catch { /* ignore */ }
  }

  async function runNow(s: ScheduledExport): Promise<void> {
    setBusyId(s.id);
    try {
      await chrome.runtime.sendMessage({ type: 'SCHEDULE_RUN_NOW', payload: { id: s.id } });
      // give the worker a beat to write the snapshot
      setTimeout(() => { reload(); setBusyId(null); }, 800);
    } catch (e) {
      setError(`Run failed: ${e instanceof Error ? e.message : String(e)}`);
      setBusyId(null);
    }
  }

  const snapshotsByScheduleId = useMemo(() => {
    const map: Record<string, ExportSnapshot[]> = {};
    for (const snap of Object.values(snapshots)) {
      if (!map[snap.scheduleId]) map[snap.scheduleId] = [];
      map[snap.scheduleId].push(snap);
    }
    for (const arr of Object.values(map)) arr.sort((a, b) => b.capturedAt - a.capturedAt);
    return map;
  }, [snapshots]);

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Schedules</span>
          <h1 class="wl-pageHeader__title">Scheduled exports</h1>
          <p class="wl-pageHeader__sub">
            Run SOQL exports on a cadence. Snapshots are stored locally and can be downloaded or diffed.
          </p>
        </div>
        <div class="wl-pageHeader__actions">
          {!editing ? (
            <button class="wl-buttonBrand" onClick={() => setEditing({ ...EMPTY_FORM, orgId: orgs[0]?.orgId ?? '' })}>
              + New schedule
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>{editing.id ? 'Edit schedule' : 'New schedule'}</h2>
            <button class="wl-buttonText" onClick={() => { setEditing(null); setError(null); }}>Cancel</button>
          </div>
          <div class="wl-cardSection">
            <div class="wl-formRow">
              <label class="wl-formRow__label wl-formRow__label--required">Name</label>
              <input
                class="wl-input"
                value={editing.name}
                onInput={(e) => setEditing({ ...editing, name: (e.currentTarget as HTMLInputElement).value })}
                placeholder="Nightly account snapshot"
              />
            </div>

            <div class="wl-twoCol">
              <div class="wl-formRow">
                <label class="wl-formRow__label wl-formRow__label--required">Target org</label>
                <select
                  class="wl-select"
                  value={editing.orgId}
                  onChange={(e) => setEditing({ ...editing, orgId: (e.currentTarget as HTMLSelectElement).value })}
                >
                  <option value="">— Select an org —</option>
                  {orgs.map(o => (
                    <option key={o.orgId} value={o.orgId}>
                      {new URL(o.instanceUrl).hostname} {o.username ? `(${o.username})` : ''}
                    </option>
                  ))}
                </select>
                <span class="wl-formRow__hint">The query runs against this org. The org must remain connected for runs to succeed.</span>
              </div>

              <div class="wl-formRow">
                <label class="wl-formRow__label">Output format</label>
                <div class="wl-flowTabs" style="margin-bottom:0">
                  {(['csv', 'json', 'excel', 'xml'] as SavedExportFormat[]).map(f => (
                    <button
                      key={f}
                      class="wl-flowTab"
                      data-active={editing.format === f}
                      onClick={() => setEditing({ ...editing, format: f })}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div class="wl-formRow">
              <label class="wl-formRow__label wl-formRow__label--required">SOQL query</label>
              <textarea
                class="wl-textarea"
                value={editing.soql}
                onInput={(e) => setEditing({ ...editing, soql: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </div>

            <div class="wl-twoCol">
              <div class="wl-formRow">
                <label class="wl-formRow__label wl-formRow__label--required">Interval</label>
                <div style="display:flex;gap:8px">
                  <input
                    class="wl-input"
                    type="number"
                    min={1}
                    value={editing.intervalValue}
                    onInput={(e) => setEditing({ ...editing, intervalValue: parseInt((e.currentTarget as HTMLInputElement).value, 10) || 1 })}
                    style="max-width:120px"
                  />
                  <select
                    class="wl-select"
                    value={editing.intervalKind}
                    onChange={(e) => setEditing({ ...editing, intervalKind: (e.currentTarget as HTMLSelectElement).value as FormState['intervalKind'] })}
                  >
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
                <span class="wl-formRow__hint">Chrome enforces a minimum of 1 minute for alarms.</span>
              </div>

              <div class="wl-formRow">
                <label class="wl-formRow__label">Retention</label>
                <input
                  class="wl-input"
                  type="number"
                  min={1}
                  value={editing.retention}
                  onInput={(e) => setEditing({ ...editing, retention: parseInt((e.currentTarget as HTMLInputElement).value, 10) || 1 })}
                  style="max-width:120px"
                />
                <span class="wl-formRow__hint">Keep this many recent snapshots; older snapshots are deleted.</span>
              </div>
            </div>

            {error ? <div class="wl-bannerDanger">{error}</div> : null}

            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="wl-buttonBrand" onClick={saveForm}>Save schedule</button>
              <button class="wl-buttonNeutral" onClick={() => { setEditing(null); setError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {schedules.length === 0 && !editing ? (
        <div class="wl-card">
          <div class="wl-emptyState">
            <div class="wl-emptyState__icon">⏱</div>
            <p class="wl-emptyState__title">No schedules yet</p>
            <p class="wl-emptyState__desc">
              Schedule a SOQL query to run on a cadence. Each run stores a snapshot locally that you can download or diff.
            </p>
          </div>
        </div>
      ) : null}

      {schedules.map(s => {
        const snaps = snapshotsByScheduleId[s.id] ?? [];
        return (
          <div class="wl-card" key={s.id} style="margin-bottom:12px">
            <div class="wl-cardHeader">
              <div>
                <h2 style="margin-bottom:2px">{s.name}</h2>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <span class={`wl-pill ${s.enabled ? 'wl-pill--success' : ''}`}>
                    {s.enabled ? 'Enabled' : 'Paused'}
                  </span>
                  <span class="wl-pill">{formatInterval(s.interval)}</span>
                  <span class="wl-pill">{s.format.toUpperCase()}</span>
                  {s.lastRunStatus === 'error' ? <span class="wl-pill wl-pill--error">Last run failed</span> : null}
                </div>
              </div>
              <div class="wl-actions">
                <button class="wl-buttonNeutral" onClick={() => runNow(s)} disabled={busyId === s.id}>
                  {busyId === s.id ? 'Running…' : '▶ Run now'}
                </button>
                <button class="wl-buttonNeutral" onClick={() => toggleEnabled(s)}>
                  {s.enabled ? '⏸ Pause' : '▶ Resume'}
                </button>
                <button class="wl-buttonNeutral" onClick={() => setEditing({
                  id: s.id,
                  name: s.name,
                  soql: s.soql,
                  orgId: s.orgId,
                  format: s.format,
                  intervalKind: s.interval.kind,
                  intervalValue: s.interval.kind === 'minutes' ? s.interval.minutes :
                                 s.interval.kind === 'hours' ? s.interval.hours : s.interval.days,
                  retention: s.retention,
                })}>Edit</button>
                <button class="wl-buttonDestructive" onClick={() => remove(s)}>Delete</button>
              </div>
            </div>
            <div class="wl-cardSection">
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px,1fr));gap:16px">
                <div>
                  <div class="wl-cardSection__title">Last run</div>
                  <div style="font-size:13px">{s.lastRunAt ? formatRelative(s.lastRunAt) : 'Never'}</div>
                </div>
                <div>
                  <div class="wl-cardSection__title">Next run</div>
                  <div style="font-size:13px">{s.enabled ? formatRelative(s.nextRunAt) : 'Paused'}</div>
                </div>
                <div>
                  <div class="wl-cardSection__title">Snapshots</div>
                  <div style="font-size:13px">{snaps.length} / {s.retention}</div>
                </div>
              </div>
              {s.lastRunError ? (
                <div class="wl-bannerDanger" style="margin-top:12px">
                  {s.lastRunError}
                </div>
              ) : null}
            </div>
            <div class="wl-cardSection">
              <div class="wl-cardSection__title">Query</div>
              <pre class="wl-qb-preview" style="margin:0">{s.soql}</pre>
            </div>
            {snaps.length > 0 ? (
              <div class="wl-cardSection">
                <div class="wl-cardSection__title">Recent snapshots</div>
                <div class="wl-activityList">
                  {snaps.slice(0, 5).map(snap => (
                    <div class="wl-activityItem" key={snap.id}>
                      <div class="wl-activityItem__icon">📦</div>
                      <div class="wl-activityItem__body">
                        <div class="wl-activityItem__title">
                          {new Date(snap.capturedAt).toLocaleString()}
                        </div>
                        <div class="wl-activityItem__sub">
                          {snap.error ? `Error: ${snap.error}` : `${snap.recordCount.toLocaleString()} records · ${snap.columns.length} columns`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
