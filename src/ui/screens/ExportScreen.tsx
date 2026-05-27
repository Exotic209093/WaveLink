/**
 * Export landing screen (v0.2 pivot).
 *
 * Thin wrapper that gives the existing SOQL+download workflow an SLDS-shaped
 * page header and an entry-point chooser. The heavy lifting lives in QueryScreen.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import type { SfApi, SfContext } from '../api/sf';
import { QueryScreen } from './QueryScreen';

export function ExportScreen(props: {
  sf: SfApi;
  tabId?: number;
  context?: SfContext;
  soql: string;
  onSoqlChange: (s: string) => void;
  onNavigate: (route: string) => void;
}): VNode {
  const { sf, tabId, context, soql, onSoqlChange, onNavigate } = props;

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Export</span>
          <h1 class="wl-pageHeader__title">Export records out of Salesforce</h1>
          <p class="wl-pageHeader__sub">
            Run a SOQL query, preview results, then download as CSV, JSON, Excel, or XML.
            Save the config as a template or schedule it to run on a cadence.
          </p>
        </div>
        <div class="wl-pageHeader__actions">
          <button class="wl-buttonNeutral" onClick={() => onNavigate('templates')}>📁 Templates</button>
          <button class="wl-buttonNeutral" onClick={() => onNavigate('schedules')}>⏱ Schedule this</button>
        </div>
      </div>

      <QueryScreen sf={sf} tabId={tabId} context={context} soql={soql} onSoqlChange={onSoqlChange} />
    </div>
  );
}
