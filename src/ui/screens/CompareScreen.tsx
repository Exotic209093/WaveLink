/**
 * Compare — unified data-diff entry point.
 *
 * One screen, two sources (selected with a toggle):
 * - "Local files / snapshots": diff two exported files or scheduled-export
 *   snapshots, fully offline (read-only).
 * - "Live orgs": query two connected orgs for an object and diff the records
 *   field-by-field, with the option to sync the differences to the target.
 *
 * Both modes share the `diffRecords` engine; this screen just unifies the
 * entry point and hosts the existing source-specific bodies.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import { DiffScreen } from './DiffScreen';
import { DataComparisonScreen } from './DataComparisonScreen';

type CompareMode = 'local' | 'orgs';

export function CompareScreen(props: { sf: SfApi; initialMode?: CompareMode }): VNode {
  const [mode, setMode] = useState<CompareMode>(props.initialMode ?? 'local');

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Compare</span>
          <h1 class="wl-pageHeader__title">Compare data</h1>
          <p class="wl-pageHeader__sub">
            See what's been added, removed, or changed — between two local files / snapshots, or
            directly between two connected orgs.
          </p>
        </div>
      </div>

      <div class="wl-card" style="margin-bottom:16px">
        <div class="wl-cardSection">
          <div class="wl-actions" role="tablist" aria-label="Comparison source">
            <button
              class="wl-btn"
              role="tab"
              aria-selected={mode === 'local'}
              data-active={mode === 'local'}
              onClick={() => setMode('local')}
            >
              Local files / snapshots
            </button>
            <button
              class="wl-btn"
              role="tab"
              aria-selected={mode === 'orgs'}
              data-active={mode === 'orgs'}
              onClick={() => setMode('orgs')}
            >
              Live orgs
            </button>
          </div>
        </div>
      </div>

      {mode === 'local'
        ? <DiffScreen hideHeader />
        : <DataComparisonScreen sf={props.sf} hideHeader />}
    </div>
  );
}
