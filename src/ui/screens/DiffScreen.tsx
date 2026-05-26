/**
 * Diff between two record sets (v0.2 pivot).
 *
 * Sources can be a local file (drag-drop) or a scheduled-export snapshot.
 * Reuses the existing `diffRecords` utility.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { DropZone } from '../components/DropZone';
import { parseAnyFile } from '../utils/fileParse';
import { diffRecords } from '../utils/dataDiff';
import type { RecordDiff } from '../utils/dataDiff';
import type { ExportSnapshot, ScheduledExport } from '../../core/types/storage';

const ACCEPT = ['.csv', '.tsv', '.json', '.xlsx', '.xls', '.xml'];

interface Source {
  origin: 'file' | 'snapshot';
  label: string;
  records: Record<string, unknown>[];
  headers: string[];
}

function PickerCard(props: {
  title: string;
  source: Source | null;
  schedules: ScheduledExport[];
  snapshotsBySchedule: Record<string, ExportSnapshot[]>;
  onFile: (file: File) => void;
  onSnapshot: (snap: ExportSnapshot, scheduleName: string) => void;
  onClear: () => void;
}): VNode {
  const { title, source, schedules, snapshotsBySchedule, onFile, onSnapshot, onClear } = props;

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>{title}</h2>
        {source ? <button class="wl-buttonText" onClick={onClear}>Clear</button> : null}
      </div>
      <div class="wl-cardSection">
        {source ? (
          <div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
              <span class="wl-pill wl-pill--brand">{source.origin === 'file' ? 'File' : 'Snapshot'}</span>
              <span class="wl-pill">{source.records.length.toLocaleString()} records</span>
              <span class="wl-pill">{source.headers.length} columns</span>
            </div>
            <div class="wl-mono" style="font-size:12px">{source.label}</div>
          </div>
        ) : (
          <>
            <DropZone accept={ACCEPT} onDrop={onFile} className="wl-dropZone--lg">
              <div class="wl-dropZone__icon">📁</div>
              <p class="wl-dropZone__title">Drop a file</p>
              <p class="wl-dropZone__hint">CSV · JSON · Excel · XML</p>
            </DropZone>
            {Object.entries(snapshotsBySchedule).length > 0 ? (
              <div style="margin-top:14px">
                <div class="wl-cardSection__title">…or pick a snapshot</div>
                <div class="wl-activityList">
                  {schedules.flatMap(s => (snapshotsBySchedule[s.id] ?? []).slice(0, 5).map(snap => (
                    <button
                      key={snap.id}
                      class="wl-activityItem"
                      style="cursor:pointer;width:100%;text-align:left;font-family:inherit;color:inherit"
                      onClick={() => onSnapshot(snap, s.name)}
                    >
                      <div class="wl-activityItem__icon">📦</div>
                      <div class="wl-activityItem__body">
                        <div class="wl-activityItem__title">{s.name}</div>
                        <div class="wl-activityItem__sub">
                          {new Date(snap.capturedAt).toLocaleString()} · {snap.recordCount.toLocaleString()} records
                        </div>
                      </div>
                    </button>
                  )))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function DiffScreen(): VNode {
  const [left, setLeft] = useState<Source | null>(null);
  const [right, setRight] = useState<Source | null>(null);
  const [keyField, setKeyField] = useState<string>('Id');
  const [schedules, setSchedules] = useState<ScheduledExport[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, ExportSnapshot>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get(['scheduledExports', 'exportSnapshots'], (r) => {
      setSchedules((r.scheduledExports as ScheduledExport[]) ?? []);
      setSnapshots((r.exportSnapshots as Record<string, ExportSnapshot>) ?? {});
    });
  }, []);

  const snapshotsBySchedule = useMemo(() => {
    const map: Record<string, ExportSnapshot[]> = {};
    for (const snap of Object.values(snapshots)) {
      if (!map[snap.scheduleId]) map[snap.scheduleId] = [];
      map[snap.scheduleId].push(snap);
    }
    for (const arr of Object.values(map)) arr.sort((a, b) => b.capturedAt - a.capturedAt);
    return map;
  }, [snapshots]);

  async function handleFile(setter: (s: Source) => void, file: File): Promise<void> {
    setError(null);
    try {
      const parsed = await parseAnyFile(file);
      setter({ origin: 'file', label: file.name, records: parsed.records, headers: parsed.headers });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file');
    }
  }

  function handleSnapshot(setter: (s: Source) => void, snap: ExportSnapshot, scheduleName: string): void {
    setter({
      origin: 'snapshot',
      label: `${scheduleName} · ${new Date(snap.capturedAt).toLocaleString()}`,
      records: snap.records,
      headers: snap.columns,
    });
  }

  const commonHeaders = useMemo(() => {
    if (!left || !right) return [];
    const rightSet = new Set(right.headers);
    return left.headers.filter(h => rightSet.has(h));
  }, [left, right]);

  const result = useMemo(() => {
    if (!left || !right || !keyField) return null;
    if (!commonHeaders.includes(keyField)) return null;
    const compareFields = commonHeaders.filter(f => f !== keyField);
    return diffRecords(left.records, right.records, keyField, compareFields, 'A', 'B', 'records');
  }, [left, right, keyField, commonHeaders]);

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Diff</span>
          <h1 class="wl-pageHeader__title">Compare two exports</h1>
          <p class="wl-pageHeader__sub">
            Pick two snapshots or files, choose a key field, and see what's been added, removed, or changed.
          </p>
        </div>
      </div>

      <div class="wl-twoCol" style="margin-bottom:16px">
        <PickerCard
          title="Left (baseline)"
          source={left}
          schedules={schedules}
          snapshotsBySchedule={snapshotsBySchedule}
          onFile={(f) => handleFile(setLeft, f)}
          onSnapshot={(s, n) => handleSnapshot(setLeft, s, n)}
          onClear={() => setLeft(null)}
        />
        <PickerCard
          title="Right (compare against)"
          source={right}
          schedules={schedules}
          snapshotsBySchedule={snapshotsBySchedule}
          onFile={(f) => handleFile(setRight, f)}
          onSnapshot={(s, n) => handleSnapshot(setRight, s, n)}
          onClear={() => setRight(null)}
        />
      </div>

      {error ? <div class="wl-bannerDanger">{error}</div> : null}

      {left && right ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Comparison settings</h2>
          </div>
          <div class="wl-cardSection">
            <div class="wl-formRow">
              <label class="wl-formRow__label wl-formRow__label--required">Match records on</label>
              <select
                class="wl-select"
                value={keyField}
                onChange={(e) => setKeyField((e.currentTarget as HTMLSelectElement).value)}
                style="max-width:280px"
              >
                {commonHeaders.length === 0 ? (
                  <option value="">— no common columns —</option>
                ) : null}
                {commonHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span class="wl-formRow__hint">
                Only columns present in both sources can be used as the key. We diff the remaining {Math.max(0, commonHeaders.length - 1)} shared columns.
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {result ? (
        <>
          <div class="wl-card" style="margin-top:16px">
            <div class="wl-cardHeader"><h2>Summary</h2></div>
            <div class="wl-cardSection">
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:16px">
                <div>
                  <div class="wl-cardSection__title">Total keys</div>
                  <div style="font-size:24px;font-weight:800">{result.summary.total.toLocaleString()}</div>
                </div>
                <div>
                  <div class="wl-cardSection__title">Added</div>
                  <div style="font-size:24px;font-weight:800;color:var(--wl-success-2)">{result.summary.added.toLocaleString()}</div>
                </div>
                <div>
                  <div class="wl-cardSection__title">Removed</div>
                  <div style="font-size:24px;font-weight:800;color:var(--wl-danger)">{result.summary.removed.toLocaleString()}</div>
                </div>
                <div>
                  <div class="wl-cardSection__title">Changed</div>
                  <div style="font-size:24px;font-weight:800;color:var(--wl-brand)">{result.summary.changed.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>

          <DiffSection title="Added records" records={result.added} fields={result.fields} side="right" />
          <DiffSection title="Removed records" records={result.removed} fields={result.fields} side="left" />
          <ChangedSection records={result.changed} keyField={result.matchField} />
        </>
      ) : null}
    </div>
  );
}

function DiffSection(props: { title: string; records: RecordDiff[]; fields: string[]; side: 'left' | 'right' }): VNode | null {
  const { title, records, fields, side } = props;
  if (records.length === 0) return null;
  return (
    <div class="wl-card" style="margin-top:16px">
      <div class="wl-cardHeader">
        <h2>{title} <span class="wl-pill">{records.length.toLocaleString()}</span></h2>
      </div>
      <div class="wl-tableWrap">
        <table class="wl-dataTable">
          <thead>
            <tr>
              <th>Key</th>
              {fields.slice(0, 6).map(f => <th key={f}>{f}</th>)}
              {fields.length > 6 ? <th>…</th> : null}
            </tr>
          </thead>
          <tbody>
            {records.slice(0, 50).map(r => {
              const rec = side === 'right' ? r.sourceRecord : r.targetRecord;
              return (
                <tr key={r.keyValue}>
                  <td class="wl-mono">{r.keyValue}</td>
                  {fields.slice(0, 6).map(f => <td key={f}>{rec?.[f] != null ? String(rec[f]) : ''}</td>)}
                  {fields.length > 6 ? <td class="wl-muted">+{fields.length - 6} more</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {records.length > 50 ? (
        <div class="wl-cardSection wl-muted">Showing first 50 of {records.length.toLocaleString()}.</div>
      ) : null}
    </div>
  );
}

function ChangedSection(props: { records: RecordDiff[]; keyField: string }): VNode | null {
  const { records, keyField } = props;
  if (records.length === 0) return null;
  return (
    <div class="wl-card" style="margin-top:16px">
      <div class="wl-cardHeader">
        <h2>Changed records <span class="wl-pill">{records.length.toLocaleString()}</span></h2>
      </div>
      <div class="wl-tableWrap">
        <table class="wl-dataTable">
          <thead>
            <tr>
              <th>{keyField}</th>
              <th>Field</th>
              <th>Left</th>
              <th>Right</th>
            </tr>
          </thead>
          <tbody>
            {records.slice(0, 50).flatMap(r =>
              r.changedFields.map(f => (
                <tr key={`${r.keyValue}-${f}`}>
                  <td class="wl-mono">{r.keyValue}</td>
                  <td>{f}</td>
                  <td>{r.fieldDiffs[f]?.source != null ? String(r.fieldDiffs[f].source) : ''}</td>
                  <td>{r.fieldDiffs[f]?.target != null ? String(r.fieldDiffs[f].target) : ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {records.length > 50 ? (
        <div class="wl-cardSection wl-muted">Showing first 50 of {records.length.toLocaleString()} changed keys.</div>
      ) : null}
    </div>
  );
}
