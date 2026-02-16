import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Toast } from '../components/Toast';
import type { SfApi } from '../api/sf';
import { recordsToCsv } from '../utils/csv';
import { downloadTextFile } from '../utils/download';

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function CoverageScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [orgWidePct, setOrgWidePct] = useState<number | null>(null);
  const [rows, setRows] = useState<Array<{
    id: string;
    name: string;
    type: string | null;
    pct: number | null;
    covered: number | null;
    uncovered: number | null;
  }>>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyBelowTarget, setOnlyBelowTarget] = useState(false);
  const [showClasses, setShowClasses] = useState(true);
  const [showTriggers, setShowTriggers] = useState(true);
  const [sortMode, setSortMode] = useState<'lowest' | 'highest' | 'uncovered' | 'name'>('lowest');

  const TARGET_PCT = 75;

  async function load(firstPage: boolean): Promise<void> {
    setBusy(true);
    setBusyLabel(firstPage ? 'Loading...' : 'Loading more...');
    try {
      const soqlOrg = 'SELECT PercentCovered FROM ApexOrgWideCoverage';
      const soqlAgg = [
        'SELECT ApexClassOrTrigger.Name, ApexClassOrTrigger.Type, ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered',
        'FROM ApexCodeCoverageAggregate',
        'LIMIT 2000',
      ].join(' ');

      const [orgRes, aggRes] = firstPage
        ? await Promise.all([sf.runToolingQuery(soqlOrg, tabId), sf.runToolingQuery(soqlAgg, tabId)])
        : await Promise.all([sf.runToolingQuery(soqlOrg, tabId), sf.toolingQueryMore(nextUrl ?? '', tabId)]);

      const orgRec = (orgRes.records ?? [])[0] as Record<string, unknown> | undefined;
      const pct = toNum(orgRec?.PercentCovered);
      setOrgWidePct(pct);

      const aggRecords = (aggRes.records ?? []) as Array<Record<string, unknown>>;
      const parsed = aggRecords.map(r => {
        const rel = r.ApexClassOrTrigger as Record<string, unknown> | undefined;
        const id = (r.ApexClassOrTriggerId as string | undefined) ?? '';
        const name = (rel?.Name as string | undefined) ?? id ?? '(unknown)';
        const type = (rel?.Type as string | undefined) ?? null;
        const covered = toNum(r.NumLinesCovered);
        const uncovered = toNum(r.NumLinesUncovered);
        const denom = (covered ?? 0) + (uncovered ?? 0);
        const pctLocal = denom > 0 ? Math.round(((covered ?? 0) / denom) * 1000) / 10 : null;
        return {
          id,
          name,
          type,
          pct: pctLocal,
          covered,
          uncovered,
        };
      });

      setRows(prev => firstPage ? parsed : [...prev, ...parsed]);
      setNextUrl((aggRes.nextRecordsUrl as string | undefined) ?? null);
    } catch (e) {
      setToast({ title: 'Apex Coverage Unavailable', body: e instanceof Error ? e.message : 'Unknown error' });
      setOrgWidePct(null);
      setRows([]);
      setNextUrl(null);
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }

  async function loadAll(): Promise<void> {
    if (!nextUrl) return;
    setBusy(true);
    try {
      // Sequential paging keeps pressure low and avoids UI lockups.
      // Hard cap is defensive; Tooling API can return large orgs.
      const HARD_CAP = 12000;
      let loaded = rows.length;
      let currentNext: string | null = nextUrl;
      while (currentNext && loaded < HARD_CAP) {
        setBusyLabel(`Loading... (${loaded} loaded)`);
        // toolingQueryMore requires the nextRecordsUrl from the previous response.
        const soqlOrg = 'SELECT PercentCovered FROM ApexOrgWideCoverage';
        const orgRes = await sf.runToolingQuery(soqlOrg, tabId);
        const aggRes = await sf.toolingQueryMore(currentNext, tabId);

        const orgRec = (orgRes.records ?? [])[0] as Record<string, unknown> | undefined;
        const pct = toNum(orgRec?.PercentCovered);
        setOrgWidePct(pct);

        const aggRecords = (aggRes.records ?? []) as Array<Record<string, unknown>>;
        const parsed = aggRecords.map(r => {
          const rel = r.ApexClassOrTrigger as Record<string, unknown> | undefined;
          const id = (r.ApexClassOrTriggerId as string | undefined) ?? '';
          const name = (rel?.Name as string | undefined) ?? id ?? '(unknown)';
          const type = (rel?.Type as string | undefined) ?? null;
          const covered = toNum(r.NumLinesCovered);
          const uncovered = toNum(r.NumLinesUncovered);
          const denom = (covered ?? 0) + (uncovered ?? 0);
          const pctLocal = denom > 0 ? Math.round(((covered ?? 0) / denom) * 1000) / 10 : null;
          return { id, name, type, pct: pctLocal, covered, uncovered };
        });

        setRows(prev => [...prev, ...parsed]);
        loaded += parsed.length;
        currentNext = (aggRes.nextRecordsUrl as string | undefined) ?? null;
        setNextUrl(currentNext);
      }

      if (loaded >= HARD_CAP) {
        setToast({ title: 'Load Capped', body: 'Loaded 12,000 rows max (safety cap). Use search/filter to narrow results.' });
      }
    } catch (e) {
      setToast({ title: 'Apex Coverage Unavailable', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base0 = !q ? rows : rows.filter(r => r.name.toLowerCase().includes(q));

    const base1 = base0.filter(r => {
      const t = (r.type ?? '').toLowerCase();
      const isClass = t === 'apexclass' || t === 'class';
      const isTrigger = t === 'apextrigger' || t === 'trigger';
      if (isClass) return showClasses;
      if (isTrigger) return showTriggers;
      // Unknown type: show if either toggle is on.
      return showClasses || showTriggers;
    });

    const base2 = onlyBelowTarget
      ? base1.filter(r => r.pct !== null && r.pct < TARGET_PCT)
      : base1;

    const sorted = [...base2].sort((a, b) => {
      const ap = a.pct;
      const bp = b.pct;

      if (sortMode === 'name') return a.name.localeCompare(b.name);

      if (sortMode === 'uncovered') {
        const au = a.uncovered ?? -1;
        const bu = b.uncovered ?? -1;
        if (au !== bu) return bu - au;
        return a.name.localeCompare(b.name);
      }

      // lowest/highest: nulls last
      if (ap === null && bp === null) return a.name.localeCompare(b.name);
      if (ap === null) return 1;
      if (bp === null) return -1;
      if (ap !== bp) return sortMode === 'highest' ? (bp - ap) : (ap - bp);
      return a.name.localeCompare(b.name);
    });

    return sorted;
  }, [rows, search, onlyBelowTarget, showClasses, showTriggers, sortMode]);

  function exportCsv(): void {
    const flat = filtered.map(r => ({
      Id: r.id,
      Name: r.name,
      Type: r.type ?? '',
      PercentCovered: r.pct ?? '',
      NumLinesCovered: r.covered ?? '',
      NumLinesUncovered: r.uncovered ?? '',
    }));
    const csv = recordsToCsv(flat, ['Id', 'Name', 'Type', 'PercentCovered', 'NumLinesCovered', 'NumLinesUncovered']);
    downloadTextFile(`wavelink-apex-coverage-${Date.now()}.csv`, csv, 'text/csv');
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Apex Code Coverage</h2>
          <div class="wl-actions">
            <button class="wl-btn" onClick={() => load(true)} disabled={busy}>{busy ? (busyLabel ?? 'Loading...') : 'Refresh'}</button>
            <button class="wl-btn" onClick={exportCsv} disabled={filtered.length === 0}>CSV</button>
          </div>
        </div>
        <div class="wl-row">
          <div class="wl-muted">Source: Salesforce Tooling API objects `ApexOrgWideCoverage` and `ApexCodeCoverageAggregate`.</div>
          {orgWidePct !== null ? (
            <div class="wl-chipRow">
              <span class="wl-chip"><span style="font-weight:900">Org-wide:</span> {orgWidePct}%</span>
              <span class="wl-chip"><span style="font-weight:900">Target:</span> 75%</span>
            </div>
          ) : (
            <div class="wl-muted">Org-wide: (loading...)</div>
          )}
          <div class="wl-row2">
            <input
              class="wl-input"
              value={search}
              onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
              placeholder="Search class/trigger..."
            />
            <select
              class="wl-select"
              value={sortMode}
              onChange={(e) => setSortMode((e.currentTarget as HTMLSelectElement).value as typeof sortMode)}
              title="Sort"
            >
              <option value="lowest">Sort: Lowest %</option>
              <option value="highest">Sort: Highest %</option>
              <option value="uncovered">Sort: Most Uncovered</option>
              <option value="name">Sort: Name A-Z</option>
            </select>
          </div>
          <div class="wl-chipRow">
            <label class="wl-chip" style="width:fit-content;cursor:pointer">
              <input
                type="checkbox"
                checked={onlyBelowTarget}
                onChange={(e) => setOnlyBelowTarget((e.currentTarget as HTMLInputElement).checked)}
              />
              <span>Only &lt; {TARGET_PCT}%</span>
            </label>
            <label class="wl-chip" style="width:fit-content;cursor:pointer">
              <input
                type="checkbox"
                checked={showClasses}
                onChange={(e) => setShowClasses((e.currentTarget as HTMLInputElement).checked)}
              />
              <span>Classes</span>
            </label>
            <label class="wl-chip" style="width:fit-content;cursor:pointer">
              <input
                type="checkbox"
                checked={showTriggers}
                onChange={(e) => setShowTriggers((e.currentTarget as HTMLInputElement).checked)}
              />
              <span>Triggers</span>
            </label>
            <span class="wl-chip"><span style="font-weight:900">Loaded:</span> {rows.length}</span>
            <span class="wl-chip"><span style="font-weight:900">Shown:</span> {filtered.length}</span>
            {nextUrl ? <span class="wl-chip"><span style="font-weight:900">More:</span> yes</span> : <span class="wl-chip"><span style="font-weight:900">More:</span> no</span>}
          </div>
        </div>
      </div>

      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>By Class/Trigger</h2>
          <div class="wl-actions">
            <button class="wl-btn" onClick={() => nextUrl && load(false)} disabled={busy || !nextUrl}>Load More</button>
            <button class="wl-btn" onClick={loadAll} disabled={busy || !nextUrl}>Load All</button>
          </div>
        </div>

        {filtered.length ? (
          <div class="wl-tableWrap">
            <table class="wl-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>%</th>
                  <th>Covered</th>
                  <th>Uncovered</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id || r.name}>
                    <td>{r.type ?? ''}</td>
                    <td class="wl-mono">{r.name}</td>
                    <td>{r.pct === null ? '' : `${r.pct}%`}</td>
                    <td>{r.covered ?? ''}</td>
                    <td>{r.uncovered ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="wl-row">
            <div class="wl-muted">No coverage rows loaded (or you do not have permission to access Tooling API coverage objects).</div>
          </div>
        )}
      </div>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
