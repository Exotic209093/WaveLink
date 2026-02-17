/**
 * API usage dashboard screen.
 *
 * What this file does:
 * - Fetches Salesforce org limits via sf.getLimits(tabId).
 * - Displays each limit as a row with name, usage bar, percentage, and remaining count.
 * - Color codes usage: green < 50%, yellow 50-80%, red > 80%.
 * - Provides search/filter input and refresh button.
 *
 * Complexity: O(L) where L = number of limits, O(L log L) for sorting.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import { Toast } from '../components/Toast';

type Limits = Record<string, { Max: number; Remaining: number }>;

interface LimitRow {
  name: string;
  max: number;
  remaining: number;
  used: number;
  usedPct: number;
}

function parseLimits(limits: Limits): LimitRow[] {
  return Object.entries(limits).map(([name, v]) => {
    const max = v.Max ?? 0;
    const remaining = v.Remaining ?? 0;
    const used = Math.max(0, max - remaining);
    const usedPct = max > 0 ? Math.round((used / max) * 1000) / 10 : 0;
    return { name, max, remaining, used, usedPct };
  });
}

function usageColor(usedPct: number): string {
  if (usedPct > 80) return 'danger';
  if (usedPct >= 50) return 'warning';
  return 'ok';
}

export function ApiUsageDashboardScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;

  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  async function fetchLimits(): Promise<void> {
    setLoading(true);
    try {
      const data = await sf.getLimits(tabId);
      setLimits(data);
      setRefreshedAt(Date.now());
    } catch (e) {
      setToast({ title: 'Failed to Fetch Limits', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLimits();
  }, [tabId]);

  const allRows = useMemo(() => {
    if (!limits) return [];
    const rows = parseLimits(limits);
    // Sort by usage percentage descending (most used first)
    rows.sort((a, b) => b.usedPct - a.usedPct);
    return rows;
  }, [limits]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) => r.name.toLowerCase().includes(q));
  }, [allRows, search]);

  const dangerCount = useMemo(
    () => allRows.filter((r) => r.usedPct > 80).length,
    [allRows],
  );

  const warningCount = useMemo(
    () => allRows.filter((r) => r.usedPct >= 50 && r.usedPct <= 80).length,
    [allRows],
  );

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>API Usage Dashboard</h2>
          <div class="wl-actions">
            <button class="wl-btn" onClick={fetchLimits} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div class="wl-row">
          {refreshedAt ? (
            <div class="wl-muted">Last refreshed: {new Date(refreshedAt).toLocaleString()}</div>
          ) : null}
          {allRows.length > 0 ? (
            <div class="wl-chipRow">
              <span class="wl-chip"><span style="font-weight:900">Total:</span> {allRows.length}</span>
              {dangerCount > 0 ? (
                <span class="wl-chip" style="color:var(--wl-danger)">
                  <span style="font-weight:900">Critical ({'>'}80%):</span> {dangerCount}
                </span>
              ) : null}
              {warningCount > 0 ? (
                <span class="wl-chip" style="color:var(--wl-warning, #ff9f0a)">
                  <span style="font-weight:900">Warning (50-80%):</span> {warningCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div class="wl-card">
        <div class="wl-row">
          <input
            class="wl-input"
            type="text"
            value={search}
            onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
            placeholder="Search limits by name..."
          />
        </div>

        {!limits && !loading ? (
          <div class="wl-row">
            <div class="wl-muted">Click Refresh to load API limits.</div>
          </div>
        ) : loading && !limits ? (
          <div class="wl-row">
            <div class="wl-muted">Loading limits...</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div class="wl-row">
            <div class="wl-muted">
              {search ? 'No limits match your search.' : 'No limits data available.'}
            </div>
          </div>
        ) : (
          <div class="wl-tableWrap">
            <table class="wl-table">
              <thead>
                <tr>
                  <th>Limit</th>
                  <th>Usage</th>
                  <th>Used %</th>
                  <th>Used</th>
                  <th>Max</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const colorClass = usageColor(r.usedPct);
                  const meterClass =
                    colorClass === 'danger'
                      ? 'wl-meterFill wl-meterFillDanger'
                      : 'wl-meterFill';
                  const meterStyle =
                    colorClass === 'warning'
                      ? `width:${Math.max(0, Math.min(100, r.usedPct))}%;background:var(--wl-warning, #ff9f0a)`
                      : `width:${Math.max(0, Math.min(100, r.usedPct))}%`;

                  return (
                    <tr key={r.name}>
                      <td class="wl-mono">{r.name}</td>
                      <td>
                        <div class="wl-meter" title={`${r.usedPct}% used`}>
                          <div class={meterClass} style={meterStyle} />
                        </div>
                      </td>
                      <td
                        style={
                          colorClass === 'danger'
                            ? 'color:var(--wl-danger);font-weight:700'
                            : colorClass === 'warning'
                              ? 'color:var(--wl-warning, #ff9f0a);font-weight:700'
                              : ''
                        }
                      >
                        {r.usedPct}%
                      </td>
                      <td>{r.used.toLocaleString()}</td>
                      <td>{r.max.toLocaleString()}</td>
                      <td>{r.remaining.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {search && filteredRows.length > 0 ? (
          <div class="wl-row">
            <div class="wl-muted">Showing {filteredRows.length} of {allRows.length} limits</div>
          </div>
        ) : null}
      </div>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
