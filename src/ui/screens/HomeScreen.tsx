/**
 * Home: a work surface rather than a landing page.
 *
 * Left: the three jobs people start here (export, import, convert).
 * Right: recent runs with a proportional result bar, then the backup schedule.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { PushHistoryEntry, ScheduledExport, ExportSnapshot, ScheduleInterval } from '../../core/types/storage';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { Wavey } from '../components/Wavey';
import { formatRelative } from './SchedulesScreen';

interface HomeScreenProps {
  sf: SfApi;
  hasOrg: boolean;
  onNavigate: (route: string) => void;
}

interface RunRow {
  id: string;
  title: string;
  /** Present for record writes; drives the result bar. */
  counts?: { ok: number; failed: number; total: number };
  /** Present for scheduled exports. */
  outcome?: { ok: boolean; text: string };
  time: number;
}

const START_ACTIONS: Array<{ route: string; icon: IconName; title: string; desc: string; needsOrg: boolean }> = [
  { route: 'export', icon: 'export', title: 'Export records', desc: 'Run a SOQL query, check the rows, then download CSV, JSON, Excel or XML.', needsOrg: true },
  { route: 'import', icon: 'import', title: 'Import a file', desc: 'Map a CSV, Excel or JSON file to fields and check every row before anything is written.', needsOrg: true },
  { route: 'convert', icon: 'convert', title: 'Convert a file', desc: 'Switch a file between CSV, JSON, Excel and XML. No org needed.', needsOrg: false },
];

function sentenceOperation(op: PushHistoryEntry['operation']): string {
  return op.charAt(0).toUpperCase() + op.slice(1);
}

export function describeInterval(interval: ScheduleInterval | undefined): string {
  if (!interval) return '';
  if (interval.kind === 'minutes') return interval.minutes === 1 ? 'Every minute' : `Every ${interval.minutes} minutes`;
  if (interval.kind === 'hours') return interval.hours === 1 ? 'Every hour' : `Every ${interval.hours} hours`;
  if (interval.kind === 'days') {
    if (interval.days === 1) return 'Daily';
    if (interval.days === 7) return 'Weekly';
    return `Every ${interval.days} days`;
  }
  return '';
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function HomeScreen(props: HomeScreenProps): VNode {
  const { sf, hasOrg, onNavigate } = props;

  const [history, setHistory] = useState<PushHistoryEntry[]>([]);
  const [schedules, setSchedules] = useState<ScheduledExport[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, ExportSnapshot>>({});

  useEffect(() => {
    chrome.storage.local.get(['pushHistory', 'scheduledExports', 'exportSnapshots'], (result) => {
      setHistory((result.pushHistory as PushHistoryEntry[]) ?? []);
      setSchedules((result.scheduledExports as ScheduledExport[]) ?? []);
      setSnapshots((result.exportSnapshots as Record<string, ExportSnapshot>) ?? {});
    });
  }, [sf]);

  const runs = useMemo<RunRow[]>(() => {
    const rows: RunRow[] = [];
    for (const entry of history.slice(-20)) {
      const failed = entry.failureCount ?? Math.max(0, entry.totalRecords - entry.successCount);
      rows.push({
        id: `push-${entry.id}`,
        title: `${sentenceOperation(entry.operation)} ${entry.objectName}`,
        counts: { ok: entry.successCount, failed, total: entry.totalRecords },
        time: entry.completedAt,
      });
    }
    for (const s of schedules) {
      if (!s.lastRunAt) continue;
      const failed = s.lastRunStatus === 'error';
      rows.push({
        id: `sched-${s.id}-${s.lastRunAt}`,
        title: s.name,
        outcome: failed
          ? { ok: false, text: `Backup failed: ${s.lastRunError ?? 'unknown error'}` }
          : { ok: true, text: 'Backup saved' },
        time: s.lastRunAt,
      });
    }
    return rows.sort((a, b) => b.time - a.time).slice(0, 8);
  }, [history, schedules]);

  const enabledSchedules = schedules.filter(s => s.enabled);
  const totalSnapshots = Object.keys(snapshots).length;

  return (
    <div class="wl-home">
      <h1 class="wl-srOnly">Home</h1>

      <section class="wl-home__start" aria-labelledby="home-start">
        <div class="wl-startList">
          <div class="wl-cardHeader"><h2 id="home-start">Start a job</h2></div>
          {START_ACTIONS.map(action => (
            <button
              key={action.route}
              class="wl-startItem"
              onClick={() => onNavigate(action.route)}
            >
              <span class="wl-startItem__icon" aria-hidden="true"><Icon name={action.icon} size={18} /></span>
              <span class="wl-startItem__body">
                <span class="wl-startItem__title">{action.title}</span>
                <span class="wl-startItem__desc">{action.desc}</span>
                {action.needsOrg && !hasOrg ? (
                  <span class="wl-startItem__note">Needs a connected org</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
        <div class="wl-home__more">
          <button class="wl-buttonText" onClick={() => onNavigate('diff')}>Compare two exports</button>
          <button class="wl-buttonText" onClick={() => onNavigate('templates')}>Saved jobs</button>
        </div>
      </section>

      <div class="wl-home__side">
        <section class="wl-card" aria-labelledby="home-runs">
          <div class="wl-cardHeader">
            <h2 id="home-runs">Recent runs</h2>
            <button class="wl-buttonText" onClick={() => onNavigate('jobs')}>All activity</button>
          </div>
          {runs.length === 0 ? (
            <div class="wl-emptyState">
              <div class="wl-emptyState__mascot"><Wavey mood="wave" size={72} /></div>
              <p class="wl-emptyState__title">No runs yet</p>
              <p class="wl-emptyState__desc">
                Exports, imports and scheduled backups show up here once they finish.
              </p>
            </div>
          ) : (
            <table class="wl-runTable">
              <thead>
                <tr>
                  <th scope="col">Run</th>
                  <th scope="col">Result</th>
                  <th scope="col" class="wl-runTable__when">When</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id}>
                    <th scope="row" class="wl-runTable__title">{run.title}</th>
                    <td>
                      {run.counts ? (
                        <div class="wl-runResult" data-state={run.counts.failed > 0 ? 'failed' : 'ok'}>
                          <span class="wl-runBar" aria-hidden="true">
                            <span class="wl-runBar__ok" style={{ width: `${run.counts.total ? (run.counts.ok / run.counts.total) * 100 : 0}%` }} />
                            <span class="wl-runBar__failed" style={{ width: `${run.counts.total ? (run.counts.failed / run.counts.total) * 100 : 0}%` }} />
                          </span>
                          <span class="wl-runResult__text">
                            {run.counts.ok} of {run.counts.total} written
                            {run.counts.failed > 0 ? <strong>, {run.counts.failed} failed</strong> : null}
                          </span>
                        </div>
                      ) : run.outcome ? (
                        <div class="wl-runResult" data-state={run.outcome.ok ? 'ok' : 'failed'}>
                          <span class="wl-runResult__text">{run.outcome.ok ? run.outcome.text : <strong>{run.outcome.text}</strong>}</span>
                        </div>
                      ) : null}
                    </td>
                    <td class="wl-runTable__when">{formatRelative(run.time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section class="wl-card" aria-labelledby="home-backups">
          <div class="wl-cardHeader">
            <h2 id="home-backups">Scheduled backups</h2>
            <button class="wl-buttonText" onClick={() => onNavigate('schedules')}>Manage</button>
          </div>
          <div class="wl-cardSection">
            <p class="wl-home__summary">
              {enabledSchedules.length === 0
                ? 'No backups are scheduled. A scheduled export saves a snapshot you can compare or restore from later.'
                : `${plural(enabledSchedules.length, 'schedule', 'schedules')} on, ${plural(totalSnapshots, 'snapshot', 'snapshots')} stored on this computer.`}
            </p>
            {enabledSchedules.length > 0 ? (
              <ul class="wl-backupList">
                {enabledSchedules.slice(0, 3).map(s => (
                  <li key={s.id} class="wl-backupList__item">
                    <span class="wl-backupList__name">{s.name}</span>
                    <span class="wl-backupList__cadence">{describeInterval(s.interval)}</span>
                    <span class="wl-backupList__next">{s.nextRunAt ? formatRelative(s.nextRunAt) : '—'}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <button class="wl-buttonNeutral" onClick={() => onNavigate('schedules')}>
              Schedule an export
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
