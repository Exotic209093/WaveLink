/**
 * Hook for loading and managing the list of connected Salesforce orgs.
 * Used by OrgSwitcher, OrgPicker, and DataComparisonScreen.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import type { SalesforceOrg } from '../../core/types/salesforce';
import type { SfApi } from '../api/sf';

export interface OrgListResult {
  orgs: SalesforceOrg[];
  activeOrgId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  switchOrg: (orgId: string) => Promise<void>;
  connectFromTab: (tabId: number) => Promise<{ orgId: string }>;
  disconnectOrg: (orgId: string) => Promise<void>;
  updateOrgNickname: (orgId: string, nickname: string) => Promise<void>;
  refreshOrgToken: (orgId: string) => Promise<void>;
}

export function useOrgList(sf: SfApi): OrgListResult {
  const [orgs, setOrgs] = useState<SalesforceOrg[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    sf.listOrgs()
      .then(res => {
        setOrgs(res.orgs);
        setActiveOrgId(res.activeOrgId);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load orgs'))
      .finally(() => setLoading(false));
  }, [sf]);

  useEffect(() => { load(); }, [load]);

  const switchOrg = useCallback(async (orgId: string) => {
    await sf.switchOrg(orgId);
    setActiveOrgId(orgId);
  }, [sf]);

  const connectFromTab = useCallback(async (tabId: number) => {
    const result = await sf.connectOrgFromTab(tabId);
    load();
    return result;
  }, [sf, load]);

  const disconnectOrg = useCallback(async (orgId: string) => {
    await sf.disconnectOrg(orgId);
    load();
  }, [sf, load]);

  const updateOrgNickname = useCallback(async (orgId: string, nickname: string) => {
    await sf.updateOrg(orgId, { nickname });
    load();
  }, [sf, load]);

  const refreshOrgToken = useCallback(async (orgId: string) => {
    await sf.refreshOrg(orgId);
    load();
  }, [sf, load]);

  return {
    orgs,
    activeOrgId,
    loading,
    error,
    refresh: load,
    switchOrg,
    connectFromTab,
    disconnectOrg,
    updateOrgNickname,
    refreshOrgToken,
  };
}
