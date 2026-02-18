/**
 * Dual-org picker for selecting source and target orgs in data comparison.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useOrgList } from '../hooks/useOrgList';
import type { SfApi } from '../api/sf';

export function OrgPicker(props: {
  sf: SfApi;
  sourceOrgId: string | null;
  targetOrgId: string | null;
  onSourceChange: (orgId: string) => void;
  onTargetChange: (orgId: string) => void;
}): VNode {
  const { sf, sourceOrgId, targetOrgId, onSourceChange, onTargetChange } = props;
  const { orgs } = useOrgList(sf);

  function envBadge(env: string): string {
    return env === 'sandbox' ? ' (SBX)' : ' (PROD)';
  }

  return (
    <div class="wl-orgPicker">
      <div style="flex:1">
        <label class="wl-muted" style="font-size:11px;font-weight:700;text-transform:uppercase;display:block;margin-bottom:4px">Source Org</label>
        <select
          class="wl-select"
          style="width:100%"
          value={sourceOrgId ?? ''}
          onChange={(e) => onSourceChange((e.currentTarget as HTMLSelectElement).value)}
        >
          <option value="">Select source org...</option>
          {orgs.map(o => (
            <option key={o.orgId} value={o.orgId} disabled={o.orgId === targetOrgId}>
              {o.nickname || new URL(o.instanceUrl).hostname}{envBadge(o.environment)} - {o.username}
            </option>
          ))}
        </select>
      </div>
      <div style="display:flex;align-items:flex-end;padding-bottom:4px;font-size:18px;color:var(--wl-ink-dim)">{'\u2194'}</div>
      <div style="flex:1">
        <label class="wl-muted" style="font-size:11px;font-weight:700;text-transform:uppercase;display:block;margin-bottom:4px">Target Org</label>
        <select
          class="wl-select"
          style="width:100%"
          value={targetOrgId ?? ''}
          onChange={(e) => onTargetChange((e.currentTarget as HTMLSelectElement).value)}
        >
          <option value="">Select target org...</option>
          {orgs.map(o => (
            <option key={o.orgId} value={o.orgId} disabled={o.orgId === sourceOrgId}>
              {o.nickname || new URL(o.instanceUrl).hostname}{envBadge(o.environment)} - {o.username}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
