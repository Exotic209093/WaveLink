/**
 * Query Explain Plan panel.
 *
 * Shows the Salesforce query optimizer's plan for a SOQL query,
 * including selectivity, cost, and leading operation type.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { QueryExplainResult, QueryExplainPlan } from '../../services/salesforce/api-client';

export function QueryExplainPanel(props: {
  sf: SfApi;
  soql: string;
  tabId?: number;
}): VNode {
  const { sf, soql, tabId } = props;
  const [result, setResult] = useState<QueryExplainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runExplain(): Promise<void> {
    if (!soql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await sf.queryExplain(soql, tabId);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Explain failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function costColor(cost: number): string {
    if (cost < 0.5) return 'var(--wl-accent)';
    if (cost < 1.5) return '#f0a030';
    return 'var(--wl-danger)';
  }

  function costLabel(cost: number): string {
    if (cost < 0.5) return 'Low';
    if (cost < 1.5) return 'Medium';
    return 'High';
  }

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Explain Plan</h2>
        <div class="wl-actions">
          <button class="wl-btn wl-btnPrimary" style="font-size:11px;padding:5px 14px" onClick={runExplain} disabled={loading || !soql.trim()}>
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {error && (
        <div class="wl-row">
          <div style="color:var(--wl-danger);font-size:12px">{error}</div>
        </div>
      )}

      {result && result.plans.length > 0 && (
        <div class="wl-row" style="gap:8px">
          {result.plans.map((plan: QueryExplainPlan, i: number) => (
            <div
              key={i}
              style="padding:10px 14px;border:1px solid var(--wl-line);border-radius:var(--wl-radius-sm);display:flex;flex-direction:column;gap:6px"
            >
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span style="font-weight:700;font-size:13px">{plan.leadingOperationType}</span>
                <span style={`font-weight:600;font-size:12px;color:${costColor(plan.relativeCost)}`}>
                  Cost: {plan.relativeCost.toFixed(2)} ({costLabel(plan.relativeCost)})
                </span>
                <span class="wl-badge" style="font-size:10px;padding:1px 6px">
                  {plan.sobjectType}
                </span>
              </div>

              <div style="display:flex;gap:16px;font-size:12px;flex-wrap:wrap">
                <span>
                  <span class="wl-muted">Cardinality:</span>{' '}
                  <span style="font-weight:600">{plan.cardinality.toLocaleString()}</span>
                </span>
                <span>
                  <span class="wl-muted">SObject Cardinality:</span>{' '}
                  <span style="font-weight:600">{plan.sobjectCardinality.toLocaleString()}</span>
                </span>
                <span>
                  <span class="wl-muted">Selectivity:</span>{' '}
                  <span style="font-weight:600">
                    {plan.sobjectCardinality > 0
                      ? `${((plan.cardinality / plan.sobjectCardinality) * 100).toFixed(2)}%`
                      : 'N/A'}
                  </span>
                </span>
              </div>

              {plan.fields.length > 0 && (
                <div style="font-size:11px">
                  <span class="wl-muted">Index Fields:</span>{' '}
                  <span class="wl-mono">{plan.fields.join(', ')}</span>
                </div>
              )}

              {plan.notes && plan.notes.length > 0 && (
                <div style="font-size:11px;margin-top:4px">
                  {plan.notes.map((note, ni) => (
                    <div key={ni} style="color:var(--wl-ink-dim)">
                      {note.description}
                      {note.fields.length > 0 && (
                        <span class="wl-mono" style="margin-left:6px">
                          ({note.fields.join(', ')})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {result && result.plans.length === 0 && (
        <div class="wl-row">
          <div class="wl-muted" style="font-size:12px">No plans returned by the optimizer.</div>
        </div>
      )}

      {!result && !error && (
        <div class="wl-row">
          <div class="wl-muted" style="font-size:12px">
            Click "Analyze" to see the query optimizer's plan. Shows selectivity, cost, and index usage.
          </div>
        </div>
      )}
    </div>
  );
}
