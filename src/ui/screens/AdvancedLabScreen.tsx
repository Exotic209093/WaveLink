/**
 * Advanced Lab hub (v0.2 pivot).
 *
 * Single entry point to all legacy power-user screens that aren't part of the
 * primary export/import flow. No screens are deleted — this just provides an
 * organized way to find them.
 */

import { h } from 'preact';
import type { VNode } from 'preact';

interface Entry {
  route: string;
  label: string;
  description: string;
  icon: string;
}

interface Group {
  title: string;
  entries: Entry[];
}

const GROUPS: Group[] = [
  {
    title: 'Migration',
    entries: [
      { route: 'advanced/migrationProjects', label: 'Migration Projects', description: 'Multi-object org-to-org migration with dependency ordering and ID remapping.', icon: '🌊' },
      { route: 'advanced/migrationValidation', label: 'Validation', description: 'Pre-flight validation against target org schema and constraints.', icon: '✓' },
      { route: 'advanced/migrationReports', label: 'Reports', description: 'Per-project success/failure summaries and stats.', icon: '📊' },
      { route: 'advanced/migrationTemplates', label: 'Migration Templates', description: 'Reusable migration blueprints for common org pairs.', icon: '📋' },
      { route: 'advanced/idMaps', label: 'ID Maps', description: 'Inspect source → target ID mappings persisted between runs.', icon: '🔗' },
    ],
  },
  {
    title: 'Schema & analysis',
    entries: [
      { route: 'advanced/objects', label: 'Objects', description: 'Browse SObjects, fields, and metadata in your org.', icon: '🗂' },
      { route: 'advanced/relationships', label: 'Relationship Explorer', description: 'Visualize lookups and master-detail relationships.', icon: '🕸' },
      { route: 'advanced/schemaCompare', label: 'Schema Gap Analysis', description: 'Compare two orgs to surface schema differences.', icon: '🆚' },
      { route: 'advanced/fieldAnalytics', label: 'Field Analytics', description: 'Field-level fill rate, distinct values, and recommendations.', icon: '📈' },
    ],
  },
  {
    title: 'Quality & cleanup',
    entries: [
      { route: 'advanced/cleanse', label: 'Cleanser', description: 'Trim, dedupe, standardize, and validate data before pushing.', icon: '🧼' },
      { route: 'advanced/duplicates', label: 'Duplicate Detection', description: 'Fuzzy-match record sets to find probable duplicates.', icon: '👯' },
      { route: 'advanced/quality', label: 'Quality Scorecards', description: 'Score data quality against configurable rule sets.', icon: '🎯' },
    ],
  },
  {
    title: 'Operations',
    entries: [
      { route: 'advanced/pipeline', label: 'Pipeline Builder', description: 'Chain filter / transform / lookup steps into reusable pipelines.', icon: '⚙' },
      { route: 'advanced/testData', label: 'Test Data Generator', description: 'Generate realistic test records against your schema.', icon: '🧪' },
      { route: 'advanced/clone', label: 'Clone Wizard', description: 'Deep-clone records and their related children.', icon: '👥' },
      { route: 'advanced/bulkOps', label: 'Bulk Object Ops', description: 'Cross-object bulk delete and update.', icon: '⚡' },
      { route: 'advanced/compare', label: 'Data Comparison', description: 'Side-by-side data diff across two orgs.', icon: '⇔' },
      { route: 'advanced/apiUsage', label: 'API Usage', description: 'Daily API request limits and trend tracking.', icon: '📡' },
      { route: 'advanced/history', label: 'Audit Trail', description: 'Full history of every push/upsert operation.', icon: '📜' },
      { route: 'advanced/legacyTemplates', label: 'Legacy Data Templates', description: 'Original (pre-v0.2) data templates browser.', icon: '📁' },
    ],
  },
];

export function AdvancedLabScreen(props: { onNavigate: (route: string) => void }): VNode {
  const { onNavigate } = props;

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Advanced Lab</span>
          <h1 class="wl-pageHeader__title">Power-user tools</h1>
          <p class="wl-pageHeader__sub">
            Migrations, schema analysis, data quality, pipelines, and more. These tools complement the
            export/import flow — start there for everyday work.
          </p>
        </div>
      </div>

      {GROUPS.map(group => (
        <div key={group.title} class="wl-card" style="margin-bottom:16px">
          <div class="wl-cardHeader">
            <h2>{group.title}</h2>
          </div>
          <div class="wl-cardSection">
            <div class="wl-hubGrid">
              {group.entries.map(entry => (
                <button
                  key={entry.route}
                  class="wl-hubCard"
                  onClick={() => onNavigate(entry.route)}
                  style="padding:16px"
                >
                  <div class="wl-hubCard__icon" style="width:36px;height:36px;font-size:18px">{entry.icon}</div>
                  <h3 class="wl-hubCard__title" style="font-size:14px">{entry.label}</h3>
                  <p class="wl-hubCard__desc" style="font-size:12px">{entry.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
