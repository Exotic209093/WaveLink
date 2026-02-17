import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi, SfContext } from '../api/sf';
import { Toast } from '../components/Toast';
import { Skeleton } from '../components/Skeleton';
import { recordsToCsv } from '../utils/csv';
import { downloadTextFile } from '../utils/download';

type Limits = Record<string, { Max: number; Remaining: number }>;

function sortLimits(limits: Limits): Array<{ name: string; max: number; remaining: number; used: number; usedPct: number }> {
  const rows = Object.entries(limits).map(([name, v]) => {
    const max = v.Max ?? 0;
    const remaining = v.Remaining ?? 0;
    const used = Math.max(0, max - remaining);
    const usedPct = max > 0 ? Math.round((used / max) * 1000) / 10 : 0;
    return { name, max, remaining, used, usedPct };
  });
  rows.sort((a, b) => {
    // Prioritize low remaining, then high used%.
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return b.usedPct - a.usedPct;
  });
  return rows;
}

export function OrgHealthScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [context, setContext] = useState<SfContext | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);

  const AT_RISK_REMAINING_PCT = 10;

  async function refresh(): Promise<void> {
    setBusy(true);
    try {
      const [ctx, lim] = await Promise.all([sf.getContext(tabId), sf.getLimits(tabId)]);
      setContext(ctx);
      setLimits(lim);
      setRefreshedAt(Date.now());
    } catch (e) {
      setToast({ title: 'Failed to Load Org Health', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  const limitRows = useMemo(() => (limits ? sortLimits(limits) : []), [limits]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base0 = !q ? limitRows : limitRows.filter(r => r.name.toLowerCase().includes(q));
    return onlyAtRisk
      ? base0.filter(r => r.max > 0 && (r.remaining / r.max) * 100 < AT_RISK_REMAINING_PCT)
      : base0;
  }, [limitRows, search, onlyAtRisk]);

  const atRiskCount = useMemo(() => {
    return limitRows.filter(r => r.max > 0 && (r.remaining / r.max) * 100 < AT_RISK_REMAINING_PCT).length;
  }, [limitRows]);

  function exportCsv(): void {
    const flat = filteredRows.map(r => ({
      Limit: r.name,
      Remaining: r.remaining,
      Max: r.max,
      Used: r.used,
      UsedPercent: r.usedPct,
    }));
    const csv = recordsToCsv(flat, ['Limit', 'Remaining', 'Max', 'Used', 'UsedPercent']);
    downloadTextFile(`wavelink-org-limits-${Date.now()}.csv`, csv, 'text/csv');
  }

  async function copyDiagnostics(): Promise<void> {
    if (!context) {
      setToast({ title: 'Nothing to Copy', body: 'Context has not loaded yet.' });
      return;
    }
    const lines = [
      `orgId=${context.orgId}`,
      `instance=${context.instanceUrl}`,
      `user=${context.username}`,
      `environment=${context.environment}`,
      `apiVersion=${context.apiVersion}`,
      `refreshedAt=${refreshedAt ? new Date(refreshedAt).toISOString() : ''}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setToast({ title: 'Copied', body: 'Org diagnostics copied to clipboard.' });
    } catch {
      // Clipboard can be blocked depending on environment; fall back to download.
      downloadTextFile(`wavelink-org-diagnostics-${Date.now()}.txt`, lines.join('\n'), 'text/plain');
      setToast({ title: 'Downloaded', body: 'Clipboard blocked; saved diagnostics as a .txt file.' });
    }
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Org Health</h2>
          <div class="wl-actions">
            <button class="wl-btn" onClick={refresh} disabled={busy}>{busy ? 'Refreshing...' : 'Refresh'}</button>
            <button class="wl-btn" onClick={copyDiagnostics} disabled={!context}>Copy Diagnostics</button>
          </div>
        </div>
        <div class="wl-row">
          {context ? (
            <div class="wl-chipRow">
              <span class="wl-chip" title={context.orgId}><span style="font-weight:900">Org:</span> {context.orgId}</span>
              <span class="wl-chip"><span style="font-weight:900">Host:</span> {new URL(context.instanceUrl).hostname}</span>
              <span class="wl-chip"><span style="font-weight:900">User:</span> {context.username}</span>
              <span class="wl-chip"><span style="font-weight:900">Env:</span> {context.environment}</span>
              <span class="wl-chip"><span style="font-weight:900">API:</span> {context.apiVersion}</span>
            </div>
          ) : (
            <Skeleton variant="card" />
          )}

          <div class="wl-muted">
            {refreshedAt ? `Last refreshed: ${new Date(refreshedAt).toLocaleString()}` : ''}
          </div>
        </div>
      </div>

      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Salesforce Limits</h2>
          <div class="wl-actions">
            <button class="wl-btn" onClick={exportCsv} disabled={filteredRows.length === 0}>CSV</button>
          </div>
        </div>

        {limits ? (
          <>
            <div class="wl-row">
              <div class="wl-row2">
                <input
                  class="wl-input"
                  value={search}
                  onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
                  placeholder="Search limits..."
                />
                <label class="wl-chip" style="width:fit-content;cursor:pointer">
                  <input
                    type="checkbox"
                    checked={onlyAtRisk}
                    onChange={(e) => setOnlyAtRisk((e.currentTarget as HTMLInputElement).checked)}
                  />
                  <span>Only &lt; {AT_RISK_REMAINING_PCT}% remaining</span>
                </label>
              </div>
              <div class="wl-chipRow">
                <span class="wl-chip"><span style="font-weight:900">Shown:</span> {filteredRows.length}</span>
                <span class="wl-chip"><span style="font-weight:900">At risk:</span> {atRiskCount}</span>
                <span class="wl-muted">Sorted by lowest remaining</span>
              </div>
            </div>

            <div class="wl-tableWrap">
              <table class="wl-table">
                <thead>
                  <tr>
                    <th>Limit</th>
                    <th>Remaining</th>
                    <th>Max</th>
                    <th>Used</th>
                    <th>Used %</th>
                    <th>Meter</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => {
                    const remainingPct = r.max > 0 ? (r.remaining / r.max) * 100 : 0;
                    const danger = r.max > 0 && remainingPct < AT_RISK_REMAINING_PCT;
                    return (
                      <tr key={r.name}>
                        <td class="wl-mono">{r.name}</td>
                        <td>{r.remaining}</td>
                        <td>{r.max}</td>
                        <td>{r.used}</td>
                        <td>{r.usedPct}%</td>
                        <td>
                          <div class="wl-meter" title={`${r.usedPct}% used`}>
                            <div
                              class={danger ? 'wl-meterFill wl-meterFillDanger' : 'wl-meterFill'}
                              style={`width:${Math.max(0, Math.min(100, r.usedPct))}%`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div class="wl-row">
            <Skeleton variant="table" rows={5} columns={4} />
          </div>
        )}
      </div>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
