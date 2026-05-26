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

export function ImportScreen(props: {
  sf: SfApi;
  tabId: number;
  dataset: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json';
    headers: string[];
    bytes?: number;
  } | null;
  cleanedRecords: Record<string, unknown>[] | null;
  cleanedHeaders: string[] | null;
  onDataset: (d: {
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json';
    headers: string[];
    bytes?: number;
  } | null) => void;
  onRequestCleanser: () => void;
  onNavigate: (route: string) => void;
}): VNode {
  const { sf, tabId, dataset, cleanedRecords, cleanedHeaders, onDataset, onRequestCleanser, onNavigate } = props;

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
        <div class="wl-pageHeader__actions">
          <button class="wl-buttonNeutral" onClick={() => onNavigate('templates')}>📁 Templates</button>
          <button class="wl-buttonNeutral" onClick={() => onNavigate('advanced/history')}>📜 Audit trail</button>
        </div>
      </div>

      <DataPushScreen
        sf={sf}
        tabId={tabId}
        dataset={dataset}
        cleanedRecords={cleanedRecords}
        cleanedHeaders={cleanedHeaders}
        onDataset={onDataset}
        onRequestCleanser={onRequestCleanser}
      />
    </div>
  );
}
