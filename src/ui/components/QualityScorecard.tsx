/**
 * Quality scorecard display component.
 *
 * What this file does:
 * - Displays an overall quality score (0-100) with color-coded badge.
 * - Shows summary stats: total records, total checks, passed, failed, warnings.
 * - Renders a per-field breakdown table with pass rate meter bars.
 *
 * Complexity: O(F) where F = number of fields in the breakdown.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { ScorecardResult } from '../utils/dataQuality';

export interface QualityScorecardProps {
  result: ScorecardResult;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--wl-success, #34c759)';
  if (score >= 60) return 'var(--wl-warning, #ff9f0a)';
  return 'var(--wl-danger, #ff3b5c)';
}

export function QualityScorecard(props: QualityScorecardProps): VNode {
  const { result } = props;
  const color = scoreColor(result.score);

  // Convert the Map to an array for rendering
  const breakdowns = Array.from(result.fieldBreakdown.entries()).map(
    ([field, stats]) => {
      const total = stats.passed + stats.failed + stats.warnings;
      const passRate = total > 0 ? Math.round((stats.passed / total) * 1000) / 10 : 100;
      return { field, ...stats, total, passRate };
    },
  );

  // Sort by pass rate ascending (worst fields first)
  breakdowns.sort((a, b) => a.passRate - b.passRate);

  return (
    <div class="wl-card" style="display:flex;flex-direction:column;gap:16px">
      <div class="wl-cardHeader">
        <h2>Quality Scorecard</h2>
      </div>

      {/* Score badge */}
      <div style="display:flex;align-items:center;justify-content:center;padding:16px 0">
        <div
          style={`
            width:100px;height:100px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;flex-direction:column;
            border:4px solid ${color};
            background:${color}12;
          `}
        >
          <div style={`font-size:28px;font-weight:900;color:${color};line-height:1`}>
            {result.score}
          </div>
          <div style="font-size:11px;color:var(--wl-ink-dim);margin-top:2px">/ 100</div>
        </div>
      </div>

      {/* Summary stats row */}
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        <div class="wl-card" style="flex:1;min-width:80px;padding:10px;text-align:center;border:1px solid var(--wl-line-2);border-radius:8px">
          <div style="font-size:20px;font-weight:900">{result.totalRecords}</div>
          <div class="wl-muted" style="font-size:11px">Records</div>
        </div>
        <div class="wl-card" style="flex:1;min-width:80px;padding:10px;text-align:center;border:1px solid var(--wl-line-2);border-radius:8px">
          <div style="font-size:20px;font-weight:900">{result.totalChecks}</div>
          <div class="wl-muted" style="font-size:11px">Checks</div>
        </div>
        <div class="wl-card" style="flex:1;min-width:80px;padding:10px;text-align:center;border:1px solid var(--wl-line-2);border-radius:8px">
          <div style="font-size:20px;font-weight:900;color:var(--wl-success, #34c759)">{result.passedChecks}</div>
          <div class="wl-muted" style="font-size:11px">Passed</div>
        </div>
        <div class="wl-card" style="flex:1;min-width:80px;padding:10px;text-align:center;border:1px solid var(--wl-line-2);border-radius:8px">
          <div style="font-size:20px;font-weight:900;color:var(--wl-danger, #ff3b5c)">{result.failedChecks}</div>
          <div class="wl-muted" style="font-size:11px">Failed</div>
        </div>
        <div class="wl-card" style="flex:1;min-width:80px;padding:10px;text-align:center;border:1px solid var(--wl-line-2);border-radius:8px">
          <div style="font-size:20px;font-weight:900;color:var(--wl-warning, #ff9f0a)">{result.warningChecks}</div>
          <div class="wl-muted" style="font-size:11px">Warnings</div>
        </div>
      </div>

      {/* Field breakdown table */}
      {breakdowns.length > 0 ? (
        <div>
          <div style="font-weight:900;margin-bottom:8px">Field Breakdown</div>
          <div class="wl-tableWrap">
            <table class="wl-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Pass Rate</th>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {breakdowns.map((b) => {
                  const barColor = scoreColor(b.passRate);
                  return (
                    <tr key={b.field}>
                      <td class="wl-mono">{b.field}</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px">
                          <div class="wl-meter" style="flex:1" title={`${b.passRate}% passed`}>
                            <div
                              class="wl-meterFill"
                              style={`width:${Math.max(0, Math.min(100, b.passRate))}%;background:${barColor}`}
                            />
                          </div>
                          <span style="font-size:12px;min-width:42px;text-align:right">{b.passRate}%</span>
                        </div>
                      </td>
                      <td style="color:var(--wl-success, #34c759)">{b.passed}</td>
                      <td style="color:var(--wl-danger, #ff3b5c)">{b.failed}</td>
                      <td style="color:var(--wl-warning, #ff9f0a)">{b.warnings}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
