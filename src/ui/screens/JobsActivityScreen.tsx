import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { ActivePush, BulkQueryCheckpoint, ExportSnapshot, PushHistoryEntry, PushTransaction, ScheduledExport, ScheduleRunHistoryEntry } from '../../core/types/storage';
import { Icon } from '../components/Icon';
import { PushHistoryDetail } from '../components/PushHistoryDetail';
import { Toast } from '../components/Toast';
import { isTransactionExpired, pruneTransactions } from '../utils/undo';

type ActivityStatus = 'success' | 'warning' | 'danger';
type ActivitySource = 'Import' | 'Schedule';
interface ActivityRow {
  id: string; source: ActivitySource; title: string; operation: string; orgId: string; objectName: string;
  status: ActivityStatus; statusLabel: string; startedAt: number; completedAt: number;
  total: number; success: number; failed: number; push?: PushHistoryEntry; snapshotId?: string;
}

function formatDuration(startedAt: number, completedAt: number): string {
  const ms = Math.max(0, completedAt - startedAt);
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1_000)}s`;
}
function relativeTime(time: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export function JobsActivityScreen(props: { sf: SfApi; onNavigate: (route: string) => void }): VNode {
  const [history, setHistory] = useState<PushHistoryEntry[]>([]);
  const [schedules, setSchedules] = useState<ScheduledExport[]>([]);
  const [scheduleRuns, setScheduleRuns] = useState<ScheduleRunHistoryEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, ExportSnapshot>>({});
  const [transactions, setTransactions] = useState<PushTransaction[]>([]);
  const [activePushes, setActivePushes] = useState<ActivePush[]>([]);
  const [bulkQueries, setBulkQueries] = useState<Record<string, BulkQueryCheckpoint>>({});
  const [selectedPush, setSelectedPush] = useState<PushHistoryEntry | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('');
  const [objectFilter, setObjectFilter] = useState('');
  const [operationFilter, setOperationFilter] = useState('all');
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    chrome.storage.local.get(['pushHistory', 'scheduledExports', 'exportSnapshots', 'scheduleRunHistory', 'bulkQueryCheckpoints'], result => {
      setHistory((result.pushHistory as PushHistoryEntry[]) ?? []);
      setSchedules((result.scheduledExports as ScheduledExport[]) ?? []);
      setSnapshots((result.exportSnapshots as Record<string, ExportSnapshot>) ?? {});
      setScheduleRuns((result.scheduleRunHistory as ScheduleRunHistoryEntry[]) ?? []);
      setBulkQueries((result.bulkQueryCheckpoints as Record<string, BulkQueryCheckpoint>) ?? {});
    });
    try { setTransactions(pruneTransactions(await props.sf.getPushTransactions())); } catch { setTransactions([]); }
    try { setActivePushes(await props.sf.listActivePushes()); } catch { setActivePushes([]); }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [props.sf]);

  const scheduleById = useMemo(() => new Map(schedules.map(schedule => [schedule.id, schedule])), [schedules]);
  const snapshotByRun = useMemo(() => {
    const values = Object.values(snapshots);
    return new Map(scheduleRuns.map(run => [run.id, values.find(snapshot => snapshot.scheduleId === run.scheduleId && Math.abs(snapshot.capturedAt - run.completedAt) < 60_000)?.id]));
  }, [snapshots, scheduleRuns]);

  const activity = useMemo<ActivityRow[]>(() => {
    const pushes = history.map((entry): ActivityRow => ({
      id: `push:${entry.id}`, source: 'Import', title: `${entry.operation.toUpperCase()} ${entry.objectName}`,
      operation: entry.operation, orgId: entry.orgId, objectName: entry.objectName,
      status: entry.failureCount === 0 ? 'success' : entry.successCount > 0 ? 'warning' : 'danger',
      statusLabel: entry.failureCount === 0 ? 'Succeeded' : entry.successCount > 0 ? 'Partial' : 'Failed',
      startedAt: entry.startedAt, completedAt: entry.completedAt, total: entry.totalRecords,
      success: entry.successCount, failed: entry.failureCount, push: entry,
    }));
    const runs = scheduleRuns.map((run): ActivityRow => {
      const schedule = scheduleById.get(run.scheduleId);
      return {
        id: `schedule:${run.id}`, source: 'Schedule', title: schedule?.name ?? 'Scheduled export', operation: 'query',
        orgId: schedule?.orgId ?? 'unknown', objectName: Object.values(snapshots).find(snapshot => snapshot.scheduleId === run.scheduleId)?.objectName ?? 'Records',
        status: run.status === 'success' ? 'success' : 'danger', statusLabel: run.status === 'success' ? 'Succeeded' : 'Failed',
        startedAt: run.startedAt, completedAt: run.completedAt, total: run.recordCount,
        success: run.status === 'success' ? run.recordCount : 0, failed: run.status === 'error' ? 1 : 0,
        snapshotId: snapshotByRun.get(run.id),
      };
    });
    return [...pushes, ...runs].filter(row => {
      if (statusFilter !== 'all' && row.statusLabel.toLowerCase() !== statusFilter) return false;
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      if (orgFilter && row.orgId !== orgFilter) return false;
      if (objectFilter && row.objectName !== objectFilter) return false;
      if (operationFilter !== 'all' && row.operation !== operationFilter) return false;
      return true;
    }).sort((a, b) => b.completedAt - a.completedAt);
  }, [history, scheduleRuns, scheduleById, snapshots, snapshotByRun, statusFilter, sourceFilter, orgFilter, objectFilter, operationFilter]);

  const allRows = useMemo(() => [
    ...history.map(entry => ({ orgId: entry.orgId, objectName: entry.objectName })),
    ...scheduleRuns.map(run => ({ orgId: scheduleById.get(run.scheduleId)?.orgId ?? 'unknown', objectName: Object.values(snapshots).find(snapshot => snapshot.scheduleId === run.scheduleId)?.objectName ?? 'Records' })),
  ], [history, scheduleRuns, scheduleById, snapshots]);
  const availableOrgs = Array.from(new Set(allRows.map(row => row.orgId))).sort();
  const availableObjects = Array.from(new Set(allRows.map(row => row.objectName))).sort();
  const recoverable = activePushes.filter(push => ['processing', 'interrupted', 'error'].includes(push.status));

  async function resumePush(push: ActivePush): Promise<void> {
    setBusyId(push.id); setMessage(null);
    try { const result = await props.sf.resumePush(push.id); setMessage(result.alreadyRunning ? 'That job is already being monitored.' : 'Resume started. Progress will update here.'); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Resume failed.'); }
    finally { setBusyId(null); }
  }
  async function cancelPush(push: ActivePush): Promise<void> {
    setBusyId(push.id); setMessage(null);
    try { await props.sf.cancelDataPush(push.id); setMessage('Cancellation requested.'); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Cancellation failed.'); }
    finally { setBusyId(null); }
  }
  async function cancelBulkQuery(checkpoint: BulkQueryCheckpoint): Promise<void> {
    setBusyId(checkpoint.jobId); setMessage(null);
    try {
      await props.sf.cancelBulkQuery(checkpoint.jobId);
      const next = { ...bulkQueries }; delete next[checkpoint.orgId];
      await chrome.storage.local.set({ bulkQueryCheckpoints: next });
      await chrome.storage.local.remove(`bulkQueryCheckpoint:${checkpoint.orgId}`);
      setBulkQueries(next); setMessage('Bulk export cancelled.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Bulk export cancellation failed.'); }
    finally { setBusyId(null); }
  }
  async function undo(transaction: PushTransaction): Promise<void> {
    if (isTransactionExpired(transaction) || transaction.rollbackIds.length === 0) return;
    setBusyId(transaction.id);
    try {
      await props.sf.startDataPush({ objectName: transaction.objectName, operation: 'delete', records: transaction.rollbackIds.map(Id => ({ Id })) });
      await props.sf.removePushTransaction(transaction.id);
      setToast({ title: 'Undo started', body: `${transaction.rollbackIds.length} ${transaction.objectName} records queued for rollback.` });
      await refresh();
    } catch (error) { setToast({ title: 'Undo failed', body: error instanceof Error ? error.message : 'Unknown error' }); }
    finally { setBusyId(null); }
  }
  async function retry(entry: PushHistoryEntry): Promise<void> {
    try { const result = await props.sf.retryFailedRecords(entry.id); setToast({ title: 'Retry started', body: `${result.recordCount} failed rows queued via ${result.strategy.toUpperCase()}.` }); setSelectedPush(null); }
    catch (error) { setToast({ title: 'Retry failed', body: error instanceof Error ? error.message : 'Unknown error' }); }
  }

  return <div>
    <header class="wl-pageHeader"><div class="wl-pageHeader__main"><span class="wl-pageHeader__eyebrow">Jobs & Activity</span><h1 class="wl-pageHeader__title">Repeat, monitor, and recover work</h1><p class="wl-pageHeader__sub">One auditable center for writes, scheduled runs, results, undo windows, and durable recovery checkpoints.</p></div><div class="wl-pageHeader__actions"><button class="wl-buttonNeutral" onClick={refresh}>Refresh</button></div></header>

    <div class="wl-hubGrid" style="margin-bottom:20px">
      <button class="wl-hubCard" onClick={() => props.onNavigate('templates')}><div class="wl-hubCard__icon"><Icon name="folder" /></div><h2 class="wl-hubCard__title">Saved jobs</h2><p class="wl-hubCard__desc">Reuse versioned export and import configurations.</p><span class="wl-hubCard__cta">Open saved jobs</span></button>
      <button class="wl-hubCard" onClick={() => props.onNavigate('schedules')}><div class="wl-hubCard__icon"><Icon name="calendar" /></div><h2 class="wl-hubCard__title">Schedules</h2><p class="wl-hubCard__desc">Manage {schedules.length} schedules and their run history.</p><span class="wl-hubCard__cta">Manage schedules</span></button>
      <button class="wl-hubCard" onClick={() => props.onNavigate('diff')}><div class="wl-hubCard__icon"><Icon name="compare" /></div><h2 class="wl-hubCard__title">Compare</h2><p class="wl-hubCard__desc">Compare files, snapshots, or live org records.</p><span class="wl-hubCard__cta">Start a comparison</span></button>
      <button class="wl-hubCard" onClick={() => props.onNavigate('snapshots')}><div class="wl-hubCard__icon"><Icon name="database" /></div><h2 class="wl-hubCard__title">Snapshot center</h2><p class="wl-hubCard__desc">Browse, pin, download, and compare {Object.keys(snapshots).length} snapshots.</p><span class="wl-hubCard__cta">Open snapshot center</span></button>
    </div>

    {recoverable.length > 0 || Object.keys(bulkQueries).length > 0 ? <section class="wl-card" aria-labelledby="recovery-heading" style="margin-bottom:20px"><div class="wl-cardHeader"><div><h2 id="recovery-heading">In-progress & interrupted jobs</h2><div class="wl-muted">Durable export and import checkpoints survive service-worker restarts.</div></div></div><div class="wl-cardSection">{message ? <div class="wl-bannerInfo" role="status">{message}</div> : null}<div class="wl-activityList">{Object.values(bulkQueries).map(checkpoint => <div class="wl-activityItem" key={checkpoint.jobId}><span class="wl-statusDot" data-status="warning" aria-hidden="true" /><div class="wl-activityItem__body"><div class="wl-activityItem__title">BULK QUERY · {checkpoint.state}</div><div class="wl-activityItem__sub">org {checkpoint.orgId} · Salesforce job {checkpoint.jobId} · {checkpoint.soql}</div></div><div class="wl-actions"><button class="wl-buttonNeutral" onClick={() => props.onNavigate('export')}>Resume in Export</button><button class="wl-buttonDestructive" disabled={busyId === checkpoint.jobId} onClick={() => cancelBulkQuery(checkpoint)}>Cancel</button></div></div>)}{recoverable.map(push => <div class="wl-activityItem" key={push.id}><span class="wl-statusDot" data-status={push.status === 'processing' ? 'warning' : 'danger'} aria-hidden="true" /><div class="wl-activityItem__body"><div class="wl-activityItem__title">{push.operation.toUpperCase()} {push.objectName} · {push.status}</div><div class="wl-activityItem__sub">{push.processedRecords.toLocaleString()} of {push.totalRecords.toLocaleString()} processed{push.bulkJobId ? ` · Salesforce job ${push.bulkJobId}` : ''}{push.lastError ? ` · ${push.lastError}` : ''}</div></div><div class="wl-actions">{push.status === 'processing' ? <button class="wl-buttonDestructive" disabled={busyId === push.id} onClick={() => cancelPush(push)}>Cancel</button> : push.resumeSupported ? <button class="wl-buttonNeutral" disabled={busyId === push.id} onClick={() => resumePush(push)}>Resume</button> : <button class="wl-buttonNeutral" onClick={() => props.onNavigate('import')}>Re-open source</button>}</div></div>)}</div></div></section> : null}

    {transactions.length > 0 ? <section class="wl-card" aria-labelledby="undo-heading" style="margin-bottom:20px"><div class="wl-cardHeader"><div><h2 id="undo-heading">Undo history</h2><div class="wl-muted">Rollback windows are local and time-limited.</div></div></div><div class="wl-cardSection"><div class="wl-activityList">{transactions.map(transaction => <div class="wl-activityItem" key={transaction.id}><span class="wl-statusDot" data-status="warning" aria-hidden="true" /><div class="wl-activityItem__body"><div class="wl-activityItem__title">Undo {transaction.operation.toUpperCase()} {transaction.objectName}</div><div class="wl-activityItem__sub">{transaction.rollbackIds.length.toLocaleString()} IDs · org {transaction.orgId} · expires {new Date(transaction.expiresAt).toLocaleString()}</div></div><button class="wl-buttonNeutral" disabled={busyId === transaction.id || isTransactionExpired(transaction)} onClick={() => undo(transaction)}>Undo</button></div>)}</div></div></section> : null}

    <section class="wl-card" aria-labelledby="activity-heading"><div class="wl-cardHeader"><div><h2 id="activity-heading">Activity trail</h2><div class="wl-muted">{activity.length} matching events · migration reports retired with the v0.6 bounded Copy decision</div></div></div><div class="wl-cardSection">
      <div class="wl-actions" style="margin-bottom:14px;flex-wrap:wrap"><select class="wl-select" aria-label="Filter activity status" value={statusFilter} onChange={event => setStatusFilter((event.currentTarget as HTMLSelectElement).value)}><option value="all">All statuses</option><option value="succeeded">Succeeded</option><option value="partial">Partial</option><option value="failed">Failed</option></select><select class="wl-select" aria-label="Filter activity source" value={sourceFilter} onChange={event => setSourceFilter((event.currentTarget as HTMLSelectElement).value)}><option value="all">All sources</option><option value="Import">Import</option><option value="Schedule">Schedule</option></select><select class="wl-select" aria-label="Filter activity org" value={orgFilter} onChange={event => setOrgFilter((event.currentTarget as HTMLSelectElement).value)}><option value="">All orgs</option>{availableOrgs.map(org => <option key={org} value={org}>{org}</option>)}</select><select class="wl-select" aria-label="Filter activity object" value={objectFilter} onChange={event => setObjectFilter((event.currentTarget as HTMLSelectElement).value)}><option value="">All objects</option>{availableObjects.map(objectName => <option key={objectName} value={objectName}>{objectName}</option>)}</select><select class="wl-select" aria-label="Filter activity operation" value={operationFilter} onChange={event => setOperationFilter((event.currentTarget as HTMLSelectElement).value)}><option value="all">All operations</option><option value="query">Query</option><option value="insert">Insert</option><option value="update">Update</option><option value="upsert">Upsert</option><option value="delete">Delete</option></select></div>
      {activity.length === 0 ? <div class="wl-emptyState"><Icon name="activity" size={28} /><p class="wl-emptyState__title">No activity matches</p><p class="wl-emptyState__desc">Completed writes and scheduled exports appear here with result and recovery actions.</p></div> : <div class="wl-activityList">{activity.map(row => <div class="wl-activityItem" key={row.id}><span class="wl-statusDot" data-status={row.status} aria-hidden="true" /><div class="wl-activityItem__body"><div class="wl-activityItem__title">{row.title} <span class={`wl-pill ${row.status === 'success' ? 'wl-pill--success' : row.status === 'danger' ? 'wl-pill--error' : ''}`}>{row.statusLabel}</span></div><div class="wl-activityItem__sub">{row.source} · org {row.orgId} · {row.objectName} · {row.operation.toUpperCase()} · {formatDuration(row.startedAt, row.completedAt)} · {row.success.toLocaleString()} succeeded / {row.failed.toLocaleString()} failed / {row.total.toLocaleString()} total</div></div><div class="wl-actions"><span class="wl-activityItem__time">{relativeTime(row.completedAt)}</span>{row.push ? <button class="wl-buttonNeutral" onClick={() => setSelectedPush(row.push ?? null)}>Details & downloads</button> : <button class="wl-buttonNeutral" onClick={() => props.onNavigate(row.snapshotId ? 'snapshots' : 'schedules')}>{row.snapshotId ? 'Open result' : 'View run'}</button>}</div></div>)}</div>}
    </div></section>
    {selectedPush ? <PushHistoryDetail entry={selectedPush} onClose={() => setSelectedPush(null)} onRetryFailed={async () => retry(selectedPush)} /> : null}
    {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
  </div>;
}
