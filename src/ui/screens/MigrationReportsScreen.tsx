/**
 * Migration Reports screen — view and export migration summary reports.
 *
 * Phase 2, Feature 2.4: Migration Summary Report.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import type { MigrationSummaryReport } from '../../core/types/migration';
import type { SalesforceOrg } from '../../core/types/salesforce';

interface Props {
  sf: SfApi;
}

export function MigrationReportsScreen({ sf }: Props): VNode<any> {
  const [reports, setReports] = useState<MigrationSummaryReport[]>([]);
  const [orgs, setOrgs] = useState<SalesforceOrg[]>([]);
  const [selectedReport, setSelectedReport] = useState<MigrationSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports(): Promise<void> {
    setLoading(true);
    try {
      const [reportList, orgData] = await Promise.all([
        sf.listMigrationReports(),
        sf.listOrgs(),
      ]);
      setReports(reportList);
      setOrgs(orgData.orgs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function orgLabel(orgId: string): string {
    const org = orgs.find(o => o.orgId === orgId);
    return org ? (org.nickname || org.username) : orgId.slice(0, 12);
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  function exportReportCsv(report: MigrationSummaryReport): void {
    const rows = [
      'Object,Operation,Total Records,Success,Failures,Duration',
      ...report.objectResults.map(r =>
        `${r.objectName},${r.operation},${r.totalRecords},${r.successCount},${r.failureCount},${formatDuration(r.durationMs)}`,
      ),
      '',
      `Total,,${report.totalRecords},${report.totalSuccess},${report.totalFailures},${formatDuration(report.durationMs)}`,
    ];
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.projectName.replace(/\s+/g, '_')}_report_${new Date(report.completedAt).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteReport(runId: string): Promise<void> {
    try {
      await sf.deleteMigrationReport(runId);
      setReports(prev => prev.filter(r => r.runId !== runId));
      if (selectedReport?.runId === runId) setSelectedReport(null);
    } catch {
      // silent
    }
  }

  if (loading) {
    return h('div', { class: 'wl-card' }, h('div', { class: 'wl-muted' }, 'Loading reports...'));
  }

  // Detail view
  if (selectedReport) {
    const r = selectedReport;
    const successRate = r.totalRecords > 0 ? Math.round((r.totalSuccess / r.totalRecords) * 100) : 100;

    return h('div', { class: 'wl-stack' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
        h('div', { style: 'display:flex;align-items:center;gap:8px' },
          h('button', { class: 'wl-btn wl-btn--sm', onClick: () => setSelectedReport(null) }, '\u2190'),
          h('h2', { style: 'margin:0;font-size:16px' }, r.projectName),
        ),
        h('div', { style: 'display:flex;gap:8px' },
          h('button', { class: 'wl-btn wl-btn--sm', onClick: () => exportReportCsv(r) }, 'Export CSV'),
          h('button', { class: 'wl-btn wl-btn--sm wl-btn--danger', onClick: () => deleteReport(r.runId) }, 'Delete'),
        ),
      ),

      // Summary stats
      h('div', { class: 'wl-card', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px' },
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'Success Rate'),
          h('div', { style: `font-size:24px;font-weight:700;color:${successRate >= 95 ? '#10b981' : successRate >= 80 ? '#f59e0b' : '#ef4444'}` }, `${successRate}%`),
        ),
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'Total Records'),
          h('div', { style: 'font-size:18px;font-weight:700' }, r.totalRecords.toLocaleString()),
        ),
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'Success'),
          h('div', { style: 'font-size:18px;font-weight:700;color:#10b981' }, r.totalSuccess.toLocaleString()),
        ),
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'Failures'),
          h('div', { style: 'font-size:18px;font-weight:700;color:#ef4444' }, r.totalFailures.toLocaleString()),
        ),
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'Duration'),
          h('div', { style: 'font-size:18px;font-weight:700' }, formatDuration(r.durationMs)),
        ),
        h('div', null,
          h('div', { class: 'wl-muted', style: 'font-size:11px' }, 'ID Mappings'),
          h('div', { style: 'font-size:18px;font-weight:700' }, r.idMapEntryCount.toLocaleString()),
        ),
      ),

      // Info
      h('div', { class: 'wl-card', style: 'font-size:12px' },
        h('div', null, h('strong', null, 'Source: '), orgLabel(r.sourceOrgId), ' \u2192 ', h('strong', null, 'Target: '), orgLabel(r.targetOrgId)),
        h('div', null, h('strong', null, 'Started: '), new Date(r.startedAt).toLocaleString()),
        h('div', null, h('strong', null, 'Completed: '), new Date(r.completedAt).toLocaleString()),
      ),

      // Per-object table
      h('div', { class: 'wl-card' },
        h('h3', { style: 'margin:0 0 8px 0;font-size:14px' }, 'Per-Object Results'),
        h('table', { class: 'wl-table', style: 'width:100%;font-size:12px' },
          h('thead', null,
            h('tr', null,
              h('th', null, 'Object'),
              h('th', null, 'Operation'),
              h('th', { style: 'text-align:right' }, 'Total'),
              h('th', { style: 'text-align:right' }, 'Success'),
              h('th', { style: 'text-align:right' }, 'Failed'),
              h('th', { style: 'text-align:right' }, 'Duration'),
            ),
          ),
          h('tbody', null,
            ...r.objectResults.map(o =>
              h('tr', { key: o.objectName },
                h('td', null, o.objectName),
                h('td', null, o.operation),
                h('td', { style: 'text-align:right' }, o.totalRecords.toLocaleString()),
                h('td', { style: 'text-align:right;color:#10b981' }, o.successCount.toLocaleString()),
                h('td', { style: 'text-align:right;color:#ef4444' }, o.failureCount.toLocaleString()),
                h('td', { style: 'text-align:right' }, formatDuration(o.durationMs)),
              ),
            ),
          ),
        ),
      ),

      // Error summary
      r.errorSummary.length > 0
        ? h('div', { class: 'wl-card' },
            h('h3', { style: 'margin:0 0 8px 0;font-size:14px;color:#ef4444' }, 'Error Summary'),
            h('table', { class: 'wl-table', style: 'width:100%;font-size:12px' },
              h('thead', null,
                h('tr', null,
                  h('th', null, 'Error'),
                  h('th', { style: 'text-align:right' }, 'Count'),
                  h('th', null, 'Objects'),
                ),
              ),
              h('tbody', null,
                ...r.errorSummary.map((e, i) =>
                  h('tr', { key: i },
                    h('td', { style: 'max-width:300px;overflow:hidden;text-overflow:ellipsis' }, e.message),
                    h('td', { style: 'text-align:right' }, e.count.toLocaleString()),
                    h('td', null, e.objects.join(', ')),
                  ),
                ),
              ),
            ),
          )
        : null,
    );
  }

  // List view
  return h('div', { class: 'wl-stack' },
    h('h2', { style: 'margin:0;font-size:16px' }, 'Migration Reports'),

    reports.length === 0
      ? h('div', { class: 'wl-card', style: 'text-align:center;padding:32px' },
          h('div', { style: 'font-size:24px;margin-bottom:8px' }, '\u{1F4CA}'),
          h('div', { style: 'font-weight:600;margin-bottom:4px' }, 'No reports yet'),
          h('div', { class: 'wl-muted', style: 'font-size:12px' }, 'Reports are generated automatically after each migration run.'),
        )
      : null,

    ...reports.map(r => {
      const successRate = r.totalRecords > 0 ? Math.round((r.totalSuccess / r.totalRecords) * 100) : 100;
      return h('div', {
        class: 'wl-card wl-card--hoverable',
        key: r.runId,
        style: 'cursor:pointer',
        onClick: () => setSelectedReport(r),
      },
        h('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
          h('div', null,
            h('div', { style: 'font-weight:600;font-size:14px' }, r.projectName),
            h('div', { style: 'display:flex;gap:12px;margin-top:4px;font-size:11px' },
              h('span', null, new Date(r.completedAt).toLocaleDateString()),
              h('span', null, `${r.totalRecords.toLocaleString()} records`),
              h('span', null, formatDuration(r.durationMs)),
            ),
          ),
          h('span', {
            style: `font-size:16px;font-weight:700;color:${successRate >= 95 ? '#10b981' : successRate >= 80 ? '#f59e0b' : '#ef4444'}`,
          }, `${successRate}%`),
        ),
      );
    }),
  );
}
