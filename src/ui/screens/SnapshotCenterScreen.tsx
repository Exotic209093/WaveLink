import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ExportSnapshot, SavedExportFormat, ScheduledExport } from '../../core/types/storage';
import type { SfApi } from '../api/sf';
import { Icon } from '../components/Icon';
import { exportRecords, ensureCorrectExtension } from '../utils/export';
import { forecastSnapshotStorage, formatStorageSize } from '../utils/scheduleForecast';
import { diffBaselineRecords, selectComparisonKey } from '../utils/localDataDiff';

export function SnapshotCenterScreen(props: {
  sf: SfApi;
  tabId?: number;
  onCreateImport: (records: Record<string, unknown>[], headers: string[], filename: string) => void;
  onOpenSchedules: () => void;
}): VNode {
  const [snapshots, setSnapshots] = useState<Record<string, ExportSnapshot>>({});
  const [schedules, setSchedules] = useState<ScheduledExport[]>([]);
  const [jobFilter, setJobFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [objectFilter, setObjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'pinned'>('all');
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [formats, setFormats] = useState<Record<string, SavedExportFormat>>({});
  const [liveRecords, setLiveRecords] = useState<Record<string, unknown>[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function reload(): void {
    chrome.storage.local.get(['exportSnapshots', 'scheduledExports'], result => {
      setSnapshots((result.exportSnapshots as Record<string, ExportSnapshot>) ?? {});
      setSchedules((result.scheduledExports as ScheduledExport[]) ?? []);
    });
  }
  useEffect(reload, []);

  const scheduleById = useMemo(() => new Map(schedules.map(schedule => [schedule.id, schedule])), [schedules]);
  const availableOrgs = useMemo(() => Array.from(new Set(Object.values(snapshots).map(snapshot => snapshot.orgId ?? scheduleById.get(snapshot.scheduleId)?.orgId).filter((value): value is string => Boolean(value)))).sort(), [snapshots, scheduleById]);
  const availableObjects = useMemo(() => Array.from(new Set(Object.values(snapshots).map(snapshot => snapshot.objectName).filter((value): value is string => Boolean(value)))).sort(), [snapshots]);
  const ordered = useMemo(() => Object.values(snapshots).filter(snapshot => {
    if (jobFilter && snapshot.scheduleId !== jobFilter) return false;
    if (orgFilter && (snapshot.orgId ?? scheduleById.get(snapshot.scheduleId)?.orgId) !== orgFilter) return false;
    if (objectFilter && snapshot.objectName !== objectFilter) return false;
    if (statusFilter === 'success' && snapshot.error) return false;
    if (statusFilter === 'error' && !snapshot.error) return false;
    if (statusFilter === 'pinned' && !snapshot.pinned) return false;
    return true;
  }).sort((a, b) => b.capturedAt - a.capturedAt), [snapshots, jobFilter, orgFilter, objectFilter, statusFilter, scheduleById]);
  const storageBytes = useMemo(() => new Blob([JSON.stringify(snapshots)]).size, [snapshots]);
  const pinnedBytes = useMemo(() => Object.values(snapshots).filter(snapshot => snapshot.pinned).reduce((sum, snapshot) => sum + new Blob([JSON.stringify(snapshot)]).size, 0), [snapshots]);
  const selectedSchedule = jobFilter ? scheduleById.get(jobFilter) : undefined;
  const retentionForecast = selectedSchedule
    ? forecastSnapshotStorage(snapshots, selectedSchedule.id, selectedSchedule.retention, storageBytes)
    : null;

  const left = snapshots[leftId];
  const right = liveRecords ? {
    id: 'live', scheduleId: left?.scheduleId ?? '', capturedAt: Date.now(),
    recordCount: liveRecords.length, columns: left?.columns ?? [], records: liveRecords,
  } satisfies ExportSnapshot : snapshots[rightId];
  const comparison = useMemo(() => {
    if (!left || !right) return null;
    const shared = left.columns.filter(column => right.columns.includes(column));
    const key = selectComparisonKey(shared, 'Id');
    return key ? diffBaselineRecords(left.records, right.records, key, shared.filter(column => column !== key)) : null;
  }, [left, right]);

  async function persistSnapshots(next: Record<string, ExportSnapshot>): Promise<void> {
    await chrome.storage.local.set({ exportSnapshots: next });
    setSnapshots(next);
  }

  async function compareWithLive(): Promise<void> {
    if (!left || !props.tabId) return;
    const schedule = scheduleById.get(left.scheduleId);
    if (!schedule) return;
    setMessage('Loading live org records…');
    try {
      const records: Record<string, unknown>[] = [];
      let page = await props.sf.runQuery(schedule.soql, props.tabId);
      records.push(...(page.records ?? []));
      while (page.nextRecordsUrl && records.length < 100_000) {
        page = await props.sf.queryMore(page.nextRecordsUrl, props.tabId);
        records.push(...(page.records ?? []));
      }
      setLiveRecords(records);
      setRightId('');
      setMessage(`Loaded ${records.length.toLocaleString()} live records.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Live comparison failed.');
    }
  }

  function createReviewedImport(): void {
    if (!comparison || !right) return;
    const records = [
      ...comparison.added.map(diff => diff.targetRecord).filter((record): record is Record<string, unknown> => Boolean(record)),
      ...comparison.changed.map(diff => diff.targetRecord).filter((record): record is Record<string, unknown> => Boolean(record)),
    ];
    props.onCreateImport(records, right.columns, `snapshot-differences-${Date.now()}.json`);
  }

  return (
    <div>
      <header class="wl-pageHeader">
        <div class="wl-pageHeader__main"><span class="wl-pageHeader__eyebrow">Snapshot Center</span><h1 class="wl-pageHeader__title">Browse, download, and compare snapshots</h1><p class="wl-pageHeader__sub">A local timeline by job, org, object, and status. Pin important baselines and turn reviewed differences into an Import job.</p></div>
        <div class="wl-pageHeader__actions"><button class="wl-buttonBrand" onClick={props.onOpenSchedules}>Manage schedules</button></div>
      </header>

      <div class="wl-card" style="margin-bottom:14px"><div class="wl-cardSection" style="display:flex;gap:10px;flex-wrap:wrap">
        <select class="wl-select" aria-label="Filter by scheduled job" value={jobFilter} onChange={event => setJobFilter((event.currentTarget as HTMLSelectElement).value)}><option value="">All jobs</option>{schedules.map(schedule => <option value={schedule.id} key={schedule.id}>{schedule.name}</option>)}</select>
        <select class="wl-select" aria-label="Filter by snapshot org" value={orgFilter} onChange={event => setOrgFilter((event.currentTarget as HTMLSelectElement).value)}><option value="">All orgs</option>{availableOrgs.map(orgId => <option value={orgId} key={orgId}>{orgId}</option>)}</select>
        <select class="wl-select" aria-label="Filter by snapshot object" value={objectFilter} onChange={event => setObjectFilter((event.currentTarget as HTMLSelectElement).value)}><option value="">All objects</option>{availableObjects.map(objectName => <option value={objectName} key={objectName}>{objectName}</option>)}</select>
        <select class="wl-select" aria-label="Filter by snapshot status" value={statusFilter} onChange={event => setStatusFilter((event.currentTarget as HTMLSelectElement).value as typeof statusFilter)}><option value="all">All statuses</option><option value="success">Successful</option><option value="error">Failed</option><option value="pinned">Pinned</option></select>
        <span class="wl-pill">{ordered.length} snapshots</span>
        <span class="wl-pill">{formatStorageSize(storageBytes)} stored</span>
        <span class="wl-pill">{formatStorageSize(pinnedBytes)} pinned</span>
        {retentionForecast ? <span class="wl-pill wl-pill--brand">Projected at retention {selectedSchedule?.retention}: {formatStorageSize(retentionForecast.projectedScheduleBytes)}</span> : null}
      </div></div>

      {message ? <div class="wl-bannerInfo" role="status" style="margin-bottom:14px">{message}</div> : null}

      {left ? <section class="wl-card" style="margin-bottom:14px" aria-labelledby="snapshot-compare-heading"><div class="wl-cardHeader"><h2 id="snapshot-compare-heading">Compare baseline</h2><div class="wl-actions"><button class="wl-buttonNeutral" disabled={!props.tabId} onClick={compareWithLive}>Compare with live org</button><button class="wl-buttonText" onClick={() => { setLeftId(''); setRightId(''); setLiveRecords(null); }}>Clear</button></div></div><div class="wl-cardSection">
        <div class="wl-twoCol"><label>Baseline<input class="wl-input" disabled value={`${scheduleById.get(left.scheduleId)?.name ?? left.scheduleId} · ${new Date(left.capturedAt).toLocaleString()}`} /></label><label>Compare against<select class="wl-select" value={rightId} onChange={event => { setRightId((event.currentTarget as HTMLSelectElement).value); setLiveRecords(null); }}><option value="">Select snapshot</option>{ordered.filter(snapshot => snapshot.id !== left.id).map(snapshot => <option value={snapshot.id} key={snapshot.id}>{scheduleById.get(snapshot.scheduleId)?.name ?? snapshot.scheduleId} · {new Date(snapshot.capturedAt).toLocaleString()}</option>)}</select></label></div>
        {comparison ? <div class="wl-bannerInfo" style="margin-top:12px"><strong>{comparison.summary.added} added · {comparison.summary.removed} removed · {comparison.summary.changed} changed</strong><button class="wl-buttonBrand" style="margin-left:12px" disabled={comparison.summary.added + comparison.summary.changed === 0} onClick={createReviewedImport}>Create reviewed Import</button></div> : null}
      </div></section> : null}

      {ordered.length === 0 ? <div class="wl-card"><div class="wl-emptyState"><Icon name="database" size={30} /><p class="wl-emptyState__title">No snapshots match</p><p class="wl-emptyState__desc">Run a scheduled export to create the first local snapshot.</p></div></div> : (
        <div class="wl-activityList">{ordered.map(snapshot => {
          const schedule = scheduleById.get(snapshot.scheduleId);
          const format = formats[snapshot.id] ?? 'csv';
          return <article class="wl-card" key={snapshot.id}><div class="wl-cardHeader"><div><h2>{schedule?.name ?? snapshot.scheduleId}</h2><div class="wl-chipRow"><span class={`wl-pill ${snapshot.error ? 'wl-pill--error' : 'wl-pill--success'}`}>{snapshot.error ? 'Failed' : 'Success'}</span>{snapshot.pinned ? <span class="wl-pill wl-pill--brand">Pinned</span> : null}<span class="wl-pill">{snapshot.objectName ?? 'Records'}</span><span class="wl-pill">{snapshot.recordCount.toLocaleString()} rows</span></div></div><div class="wl-actions">
            <button class="wl-buttonText" onClick={() => persistSnapshots({ ...snapshots, [snapshot.id]: { ...snapshot, pinned: !snapshot.pinned } })}>{snapshot.pinned ? 'Unpin' : 'Pin'}</button>
            <button class="wl-buttonNeutral" onClick={() => { setLeftId(snapshot.id); setRightId(''); setLiveRecords(null); }}>Compare</button>
            <select class="wl-select" aria-label={`Download format for ${schedule?.name ?? snapshot.id}`} value={format} onChange={event => setFormats(current => ({ ...current, [snapshot.id]: (event.currentTarget as HTMLSelectElement).value as SavedExportFormat }))}><option value="csv">CSV</option><option value="json">JSON</option><option value="excel">Excel</option><option value="xml">XML</option></select>
            <button class="wl-buttonBrand" disabled={Boolean(snapshot.error)} onClick={() => exportRecords(snapshot.records, snapshot.columns, { format, filename: ensureCorrectExtension(`${schedule?.name ?? 'snapshot'}-${snapshot.capturedAt}`, format) })}>Download</button>
          </div></div><div class="wl-cardSection"><div class="wl-muted">{new Date(snapshot.capturedAt).toLocaleString()} · org {snapshot.orgId ?? schedule?.orgId ?? 'unknown'}{snapshot.error ? ` · ${snapshot.error}` : ''}</div></div></article>;
        })}</div>
      )}
    </div>
  );
}
