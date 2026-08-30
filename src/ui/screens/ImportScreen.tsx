/**
 * Import landing screen (v0.2 pivot).
 *
 * Thin wrapper that gives the existing DataPushScreen an SLDS-shaped
 * page header. The heavy mapping/transform/push logic lives in DataPushScreen.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { SfApi } from '../api/sf';
import { DataPushScreen } from './DataPushScreen';
import type { SavedJob } from '../../core/types/storage';

export function ImportScreen(props: {
  sf: SfApi;
  tabId: number;
  context?: { orgId?: string; instanceUrl?: string; environment?: 'production' | 'sandbox' };
  dataset: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json' | 'excel' | 'xml';
    headers: string[];
    bytes?: number;
  } | null;
  cleanedRecords: Record<string, unknown>[] | null;
  cleanedHeaders: string[] | null;
  onDataset: (d: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json' | 'excel' | 'xml';
    headers: string[];
    bytes?: number;
  } | null) => void;
  onRequestCleanser: () => void;
  savedJobDraft?: SavedJob;
  onSavedJobDraftConsumed?: () => void;
}): VNode {
  const { sf, tabId, dataset, cleanedRecords, cleanedHeaders, onDataset, onRequestCleanser } = props;

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Import</span>
          <h1 class="wl-pageHeader__title">Import records into Salesforce</h1>
          <p class="wl-pageHeader__sub">
            Drop a CSV, Excel, or JSON file in. Auto-map headers to fields, transform and validate, then insert / update / upsert.
            One-click undo on every push.
          </p>
        </div>
      </div>

      <DataPushScreen
        sf={sf}
        tabId={tabId}
        context={props.context}
        dataset={dataset}
        cleanedRecords={cleanedRecords}
        cleanedHeaders={cleanedHeaders}
        onDataset={onDataset}
        onRequestCleanser={onRequestCleanser}
        savedJobDraft={props.savedJobDraft}
        onSavedJobDraftConsumed={props.onSavedJobDraftConsumed}
      />
    </div>
  );
}
