/**
 * Home hub for the export/import-focused WaveLink (v0.2 pivot).
 *
 * Landing experience: three primary entry cards (Export / Import / Convert),
 * plus a Recent Activity feed sourced from push history + scheduled exports.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { PushHistoryEntry, ScheduledExport, ExportSnapshot } from '../../core/types/storage';
import { Icon } from '../components/Icon';

interface HomeScreenProps {
  sf: SfApi;
  hasOrg: boolean;
  onNavigate: (route: string) => void;
}

interface ActivityEntry {
  id: string;
  kind: 'push' | 'schedule' | 'snapshot';
  title: string;
  sub: string;
  time: number;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
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

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    for (const h of history.slice(-20)) {
      const successRate = h.totalRecords > 0 ? Math.round((h.successCount / h.totalRecords) * 100) : 0;
      entries.push({
        id: `push-${h.id}`,
        kind: 'push',
        title: `${h.operation.toUpperCase()} ${h.objectName}`,
        sub: `${h.successCount}/${h.totalRecords} succeeded (${successRate}%)`,
        time: h.completedAt,
      });
    }

    for (const s of schedules) {
      if (s.lastRunAt) {
        entries.push({
          id: `sched-${s.id}-${s.lastRunAt}`,
          kind: 'schedule',
          title: `Scheduled: ${s.name}`,
          sub: s.lastRunStatus === 'error' ? `Failed: ${s.lastRunError ?? 'unknown error'}` : 'Snapshot captured',
          time: s.lastRunAt,
        });
      }
    }

    return entries.sort((a, b) => b.time - a.time).slice(0, 8);
  }, [history, schedules, snapshots]);

  const enabledSchedules = schedules.filter(s => s.enabled);
  const totalSnapshots = Object.keys(snapshots).length;

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">WaveLink</span>
          <h1 class="wl-pageHeader__title">Data Export & Import for Salesforce</h1>
          <p class="wl-pageHeader__sub">
            Move records in and out of your org with confidence. Schedule snapshots, save reusable templates, and diff between exports.
          </p>
        </div>
        <div class="wl-pageHeader__actions">
          {hasOrg ? (
            <span class="wl-pill wl-pill--success">
              <span style="width:6px;height:6px;border-radius:999px;background:currentColor;display:inline-block" />
              Org connected
            </span>
          ) : (
            <span class="wl-pill wl-pill--warning">No org selected</span>
          )}
        </div>
      </div>

      <div class="wl-hubGrid" style="margin-bottom:24px">
        <button class="wl-hubCard" onClick={() => onNavigate('export')}>
          <div class="wl-hubCard__icon"><Icon name="export" /></div>
          <h2 class="wl-hubCard__title">Export</h2>
          <p class="wl-hubCard__desc">
            Pull records out of Salesforce via SOQL. Download as CSV, JSON, Excel, or XML — or pipe directly to another org.
          </p>
          <span class="wl-hubCard__cta">Start an export</span>
        </button>

        <button class="wl-hubCard" onClick={() => onNavigate('import')}>
          <div class="wl-hubCard__icon"><Icon name="import" /></div>
          <h2 class="wl-hubCard__title">Import</h2>
          <p class="wl-hubCard__desc">
            Drop a CSV, Excel, or JSON file in. Auto-map fields, validate, and upsert into your org with one-click undo.
          </p>
          <span class="wl-hubCard__cta">Start an import</span>
        </button>

        <button class="wl-hubCard" onClick={() => onNavigate('convert')}>
          <div class="wl-hubCard__icon"><Icon name="convert" /></div>
          <h2 class="wl-hubCard__title">Convert</h2>
          <p class="wl-hubCard__desc">
            Pure offline format conversion — CSV ↔ JSON ↔ Excel ↔ XML. No Salesforce connection required.
          </p>
          <span class="wl-hubCard__cta">Open converter</span>
        </button>
      </div>

      <div class="wl-twoCol">
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Recent activity</h2>
            <div class="wl-actions">
              <button class="wl-buttonText" onClick={() => onNavigate('jobs')}>View all activity</button>
            </div>
          </div>
          <div class="wl-cardSection">
            {activity.length === 0 ? (
              <div class="wl-emptyState">
                <div class="wl-emptyState__icon"><Icon name="activity" size={28} /></div>
                <p class="wl-emptyState__title">No activity yet</p>
                <p class="wl-emptyState__desc">
                  Run your first export or import — recent runs and scheduled snapshots will appear here.
                </p>
              </div>
            ) : (
              <div class="wl-activityList">
                {activity.map(a => (
                  <div class="wl-activityItem" key={a.id}>
                    <div class="wl-activityItem__icon"><Icon name={a.kind === 'push' ? 'import' : a.kind === 'schedule' ? 'calendar' : 'database'} size={16} /></div>
                    <div class="wl-activityItem__body">
                      <div class="wl-activityItem__title">{a.title}</div>
                      <div class="wl-activityItem__sub">{a.sub}</div>
                    </div>
                    <div class="wl-activityItem__time">{formatRelative(a.time)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Schedules & snapshots</h2>
            <div class="wl-actions">
              <button class="wl-buttonText" onClick={() => onNavigate('schedules')}>Manage schedules</button>
            </div>
          </div>
          <div class="wl-cardSection">
            <div style="display:flex;gap:24px;align-items:baseline">
              <div>
                <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px">{enabledSchedules.length}</div>
                <div class="wl-muted">active schedules</div>
              </div>
              <div>
                <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px">{totalSnapshots}</div>
                <div class="wl-muted">stored snapshots</div>
              </div>
            </div>
          </div>
          {enabledSchedules.length > 0 ? (
            <div class="wl-cardSection">
              <p class="wl-cardSection__title">Next runs</p>
              {enabledSchedules.slice(0, 3).map(s => (
                <div class="wl-activityItem" key={s.id} style="margin-bottom:6px">
                  <div class="wl-activityItem__icon"><Icon name="calendar" size={16} /></div>
                  <div class="wl-activityItem__body">
                    <div class="wl-activityItem__title">{s.name}</div>
                    <div class="wl-activityItem__sub">
                      {s.interval.kind === 'minutes' ? `every ${s.interval.minutes}m` :
                       s.interval.kind === 'hours' ? `every ${s.interval.hours}h` :
                       `every ${s.interval.days}d`}
                    </div>
                  </div>
                  <div class="wl-activityItem__time">
                    {s.nextRunAt ? formatRelative(s.nextRunAt) : '—'}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div class="wl-cardSection">
            <button class="wl-buttonBrand" onClick={() => onNavigate('schedules')}>
              + New scheduled export
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
