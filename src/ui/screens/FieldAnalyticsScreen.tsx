/**
 * Field Analytics screen.
 *
 * Allows users to select a Salesforce object, sample live records, and
 * compute per-field population and uniqueness metrics. Displays results
 * as a bar chart with actionable recommendations.
 *
 * Complexity: O(N*F) where N is sample size and F is the number of fields.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { FieldMetrics } from '../utils/fieldAnalytics';
import { buildAnalyticsQuery, computeFieldMetrics, generateRecommendations } from '../utils/fieldAnalytics';
import { FieldAnalyticsChart } from '../components/FieldAnalyticsChart';
import { FieldRecommendations } from '../components/FieldRecommendations';
import { Toast } from '../components/Toast';
import { recordsToCsv } from '../utils/csv';
import { downloadTextFile } from '../utils/download';

export function FieldAnalyticsScreen(props: { sf: SfApi; tabId: number }): VNode {
  const { sf, tabId } = props;

  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Object selector
  const [objects, setObjects] = useState<Array<{ name: string; label: string }>>([]);
  const [selectedObject, setSelectedObject] = useState('');
  const [objectSearch, setObjectSearch] = useState('');

  // Config
  const [sampleSize, setSampleSize] = useState(200);

  // Results
  const [metrics, setMetrics] = useState<FieldMetrics[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [analyzedAt, setAnalyzedAt] = useState<number | null>(null);

  /** Fetch global object list on mount. O(1) network call. */
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    sf.describeGlobal(tabId)
      .then((result) => {
        if (cancelled) return;
        const sobjects = (result.sobjects ?? []) as Array<{ name: string; label: string; queryable?: boolean }>;
        setObjects(sobjects.filter((o) => o.queryable !== false).map((o) => ({ name: o.name, label: o.label })));
      })
      .catch((e) => {
        if (!cancelled) setToast({ title: 'Failed to Load Objects', body: e instanceof Error ? e.message : 'Unknown error' });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  /** Filter objects by search. O(O). */
  const filteredObjects = useMemo(() => {
    const q = objectSearch.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter((o) => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  }, [objects, objectSearch]);

  /** Run the analysis pipeline. O(N*F). */
  async function analyze(): Promise<void> {
    if (!selectedObject) {
      setToast({ title: 'Select an Object', body: 'Choose a Salesforce object to analyze.' });
      return;
    }

    setBusy(true);
    setMetrics([]);
    setRecommendations([]);

    try {
      // Step 1: Describe the object to get field metadata
      const describe = await sf.describeSObject(selectedObject, tabId);
      const fields = (describe.fields ?? []).map((f) => ({ name: f.name, type: f.type }));

      if (fields.length === 0) {
        setToast({ title: 'No Fields', body: 'The selected object has no fields.' });
        setBusy(false);
        return;
      }

      // Step 2: Build and run the analytics query
      const soql = buildAnalyticsQuery(selectedObject, fields, sampleSize);
      if (!soql) {
        setToast({ title: 'No Queryable Fields', body: 'All fields were excluded from analysis.' });
        setBusy(false);
        return;
      }

      const queryResult = await sf.runQuery(soql, tabId);
      const records = (queryResult.records ?? []) as Record<string, unknown>[];
      setTotalRecords(records.length);

      // Step 3: Compute metrics for each field
      const fieldMetrics: FieldMetrics[] = [];
      for (const field of fields) {
        // Only compute for fields that were in the query
        const skip = new Set(['id', 'createddate', 'lastmodifieddate', 'systemmodstamp', 'isdeleted']);
        if (skip.has(field.name.toLowerCase())) continue;
        fieldMetrics.push(computeFieldMetrics(records, field));
      }

      // Sort by population rate ascending (worst first)
      fieldMetrics.sort((a, b) => a.populationRate - b.populationRate);

      setMetrics(fieldMetrics);
      setRecommendations(generateRecommendations(fieldMetrics));
      setAnalyzedAt(Date.now());
    } catch (e) {
      setToast({ title: 'Analysis Failed', body: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  /** Export metrics as CSV. O(M). */
  function exportCsv(): void {
    if (metrics.length === 0) return;
    const columns = ['fieldName', 'fieldType', 'populationRate', 'uniqueRate', 'distinctCount', 'sampleValues'];
    const flat = metrics.map((m) => ({
      fieldName: m.fieldName,
      fieldType: m.fieldType,
      populationRate: `${Math.round(m.populationRate * 100)}%`,
      uniqueRate: `${Math.round(m.uniqueRate * 100)}%`,
      distinctCount: m.distinctCount,
      sampleValues: m.sampleValues.join('; '),
    }));
    const csv = recordsToCsv(flat, columns);
    downloadTextFile(`wavelink-field-analytics-${selectedObject}-${Date.now()}.csv`, csv, 'text/csv');
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      {/* ── Config Card ──────────────────────────────────────── */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Field Analytics</h2>
          <div class="wl-actions">
            <button class="wl-btn wl-btnPrimary" onClick={analyze} disabled={busy || !selectedObject}>
              {busy ? 'Analyzing...' : 'Analyze'}
            </button>
            <button class="wl-btn" onClick={exportCsv} disabled={metrics.length === 0}>
              CSV
            </button>
          </div>
        </div>

        <div class="wl-row">
          <div class="wl-row2">
            <div style="display:flex;flex-direction:column;gap:6px">
              <label style="font-weight:900;font-size:12px">Object</label>
              <input
                class="wl-input"
                type="text"
                value={selectedObject || objectSearch}
                onInput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value;
                  setObjectSearch(v);
                  setSelectedObject('');
                }}
                placeholder="Search objects..."
              />
              {objectSearch && !selectedObject ? (
                <div style="max-height:200px;overflow:auto;border:1px solid var(--wl-line-2);border-radius:var(--wl-radius-sm)">
                  {filteredObjects.slice(0, 50).map((o) => (
                    <div
                      key={o.name}
                      class="wl-qb-objItem"
                      onClick={() => {
                        setSelectedObject(o.name);
                        setObjectSearch('');
                      }}
                    >
                      <span class="wl-mono" style="font-size:12px">{o.name}</span>
                      <span class="wl-muted">{o.label}</span>
                    </div>
                  ))}
                  {filteredObjects.length === 0 ? (
                    <div class="wl-muted" style="padding:8px 12px">No matching objects</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div style="display:flex;flex-direction:column;gap:6px">
              <label style="font-weight:900;font-size:12px">Sample Size</label>
              <input
                class="wl-input wl-countInput"
                type="number"
                min="10"
                max="2000"
                value={sampleSize}
                onInput={(e) => setSampleSize(Math.max(10, Number((e.currentTarget as HTMLInputElement).value) || 200))}
              />
              <span class="wl-muted" style="font-size:11px">
                Number of records to query (max 2000 via SOQL LIMIT)
              </span>
            </div>
          </div>

          {analyzedAt !== null ? (
            <div class="wl-chipRow">
              <span class="wl-chip"><span style="font-weight:900">Object:</span> {selectedObject}</span>
              <span class="wl-chip"><span style="font-weight:900">Sampled:</span> {totalRecords} records</span>
              <span class="wl-chip"><span style="font-weight:900">Fields:</span> {metrics.length}</span>
              <span class="wl-muted">Analyzed: {new Date(analyzedAt).toLocaleTimeString()}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Chart Card ───────────────────────────────────────── */}
      {metrics.length > 0 ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Population &amp; Uniqueness</h2>
            <span class="wl-muted">{metrics.length} fields</span>
          </div>
          <div class="wl-row">
            <FieldAnalyticsChart metrics={metrics} />
          </div>
        </div>
      ) : null}

      {/* ── Recommendations Card ─────────────────────────────── */}
      {analyzedAt !== null ? (
        <div class="wl-card">
          <div class="wl-cardHeader">
            <h2>Recommendations</h2>
            <span class="wl-muted">{recommendations.length} item{recommendations.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="wl-row">
            <FieldRecommendations recommendations={recommendations} />
          </div>
        </div>
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </div>
  );
}
