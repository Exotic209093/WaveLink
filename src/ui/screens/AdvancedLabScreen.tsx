/**
 * Advanced hub.
 *
 * Single entry point to the power-user tools that aren't part of the primary
 * export/import flow or the top-level Migration suite. Tools are grouped by
 * purpose, with the most experimental ones on a dedicated "Lab" shelf.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';

interface Entry {
  route: string;
  label: string;
  description: string;
  icon: IconName;
}

interface Group {
  title: string;
  entries: Entry[];
}

const GROUPS: Group[] = [
  {
    title: 'Schema & analysis',
    entries: [
      { route: 'advanced/objects', label: 'Objects', description: 'Browse SObjects, fields, and metadata in your org.', icon: 'database' },
      { route: 'advanced/inspector', label: 'Record Inspector', description: 'Show all data for any record by ID — every field, value, and API name.', icon: 'search' },
      { route: 'advanced/relationships', label: 'Relationship Explorer', description: 'Visualize lookups and master-detail relationships.', icon: 'database' },
      { route: 'advanced/schemaCompare', label: 'Schema Gap Analysis', description: 'Compare two orgs to surface schema differences.', icon: 'compare' },
      { route: 'advanced/fieldAnalytics', label: 'Field Analytics', description: 'Field-level fill rate, distinct values, and recommendations.', icon: 'activity' },
    ],
  },
  {
    title: 'Quality & cleanup',
    entries: [
      { route: 'advanced/cleanse', label: 'Cleanser', description: 'Trim, dedupe, standardize, and validate data before pushing.', icon: 'sparkles' },
      { route: 'advanced/duplicates', label: 'Duplicate Detection', description: 'Fuzzy-match record sets to find probable duplicates.', icon: 'compare' },
      { route: 'advanced/quality', label: 'Quality Scorecards', description: 'Score data quality against configurable rule sets.', icon: 'shield' },
    ],
  },
  {
    title: 'Operations',
    entries: [
      { route: 'advanced/bulkOps', label: 'Bulk Object Ops', description: 'Cross-object bulk delete and update.', icon: 'database' },
      { route: 'advanced/apiUsage', label: 'API Usage', description: 'Daily API request limits and trend tracking.', icon: 'activity' },
      { route: 'advanced/history', label: 'Audit Trail', description: 'Full history of every push/upsert operation.', icon: 'file' },
      { route: 'copy', label: 'Copy between orgs', description: 'Dry-run and copy a controlled, single-object record set between connected orgs.', icon: 'convert' },
    ],
  },
  {
    title: 'Experimental',
    entries: [
      { route: 'advanced/pipeline', label: 'Pipeline Builder', description: 'Chain filter, transform, and lookup steps into reusable pipelines.', icon: 'settings' },
      { route: 'advanced/testData', label: 'Test Data Generator', description: 'Generate realistic test records against your schema.', icon: 'sparkles' },
      { route: 'advanced/clone', label: 'Clone Wizard', description: 'Deep-clone records and their related children.', icon: 'database' },
    ],
  },
];

export function AdvancedLabScreen(props: { onNavigate: (route: string) => void }): VNode {
  const { onNavigate } = props;

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Advanced</span>
          <h1 class="wl-pageHeader__title">Advanced tools</h1>
          <p class="wl-pageHeader__sub">
            Schema analysis, data quality, and bulk operations that complement the export/import flow.
            Experimental tools and migration workflows are clearly separated below.
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
                  <div class="wl-hubCard__icon" style="width:36px;height:36px"><Icon name={entry.icon} size={18} /></div>
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
