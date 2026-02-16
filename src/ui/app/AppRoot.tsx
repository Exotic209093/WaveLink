/**
 * Full-page WaveLink App root (runs in `app/app.html`).
 *
 * What this file does:
 * - Lists open Salesforce tabs and lets the user select which tab/org to operate against.
 * - Resolves Salesforce context for the selected tab (orgId, instanceUrl, username).
 * - Hosts the main navigation and screen routing (query/objects/push/cleanser/settings).
 *
 * Per-tab pinning:
 * - If `?tabId=<salesforceTabId>` is present, this app tab is "pinned" to that Salesforce tab.
 * - Changing the dropdown updates the URL via `history.replaceState` so reload preserves selection.
 *
 * Complexity:
 * - Tab listing is O(T) where T is number of open browser tabs (performed in background).
 * - Most UI state updates here are O(1).
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { SfApi } from '../api/sf';
import type { SfContext } from '../api/sf';
import { AppShell } from '../components/AppShell';
import type { NavItem } from '../components/AppShell';
import { QueryScreen } from '../screens/QueryScreen';
import { ObjectsScreen } from '../screens/ObjectsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { Toast } from '../components/Toast';
import { DataCleanserScreen } from '../screens/DataCleanserScreen';
import { DataPushScreen } from '../screens/DataPushScreen';
import { parseTabIdFromSearch } from '../../core/utils';

export function AppRoot(): VNode {
  const sf = useMemo(() => new SfApi('app'), []);
  const [route, setRoute] = useState<string>('query');

  const [tabs, setTabs] = useState<Array<{ tabId: number; title?: string; hostname: string }>>([]);
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
  const [context, setContext] = useState<SfContext | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [soql, setSoql] = useState<string>('SELECT Id, Name FROM Account LIMIT 10');

  const [dataset, setDataset] = useState<{
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json';
    headers: string[];
    bytes?: number;
  } | null>(null);
  const [cleaned, setCleaned] = useState<{ records: Record<string, unknown>[]; headers: string[] } | null>(null);

  async function refreshTabs(): Promise<void> {
    /**
     * Fetch UI settings + open Salesforce tabs, then choose the initial/updated selection.
     *
     * Why this approach:
     * - `?tabId=` pins the app tab to a specific Salesforce tab (per-tab isolation).
     * - Without `?tabId=`, we fall back to the last tab selected in the app (`ui.lastTabId`),
     *   and then to the first Salesforce tab found.
     *
     * Complexity: O(S) where S is the number of Salesforce tabs returned (mapping + searching).
     */
    try {
      const [ui, list] = await Promise.all([sf.getUiSettings(), sf.listTabs()]);
      setTabs(list.map(t => ({ tabId: t.tabId, title: t.title, hostname: t.hostname })));
      const urlTabId = parseTabIdFromSearch(window.location.search);
      if (urlTabId) {
        const exists = list.some(t => t.tabId === urlTabId);
        if (!exists) {
          setSelectedTabId(null);
          setToast({ title: 'Pinned Tab Not Found', body: `Salesforce tab ${urlTabId} is not available. Re-open it and click Refresh.` });
          return;
        }
        setSelectedTabId(urlTabId);
        return;
      }

      const preferred = ui.lastTabId && list.some(t => t.tabId === ui.lastTabId)
        ? ui.lastTabId
        : (list[0]?.tabId ?? null);
      setSelectedTabId(preferred);
    } catch (e) {
      setToast({ title: 'Failed to List Tabs', body: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  useEffect(() => {
    // Initial load: populate the tab selector.
    refreshTabs();
  }, []);

  useEffect(() => {
    /**
     * Resolve Salesforce context for the selected tab.
     *
     * Complexity: O(1) JS work (auth may validate session via network).
     */
    if (!selectedTabId) {
      setContext(null);
      return;
    }
    sf.getContext(selectedTabId)
      .then(c => setContext(c))
      .catch(e => setToast({ title: 'Failed to Resolve Context', body: e instanceof Error ? e.message : 'Unknown error' }));
  }, [sf, selectedTabId]);

  useEffect(() => {
    /**
     * Make each app tab distinguishable in the browser tab strip when working across orgs.
     *
     * Complexity: O(1).
     */
    if (!context) {
      document.title = 'WaveLink App';
      return;
    }
    const hostname = tabs.find(t => t.tabId === selectedTabId)?.hostname ?? new URL(context.instanceUrl).hostname;
    document.title = `WaveLink - ${hostname} (${context.orgId})`;
  }, [context, selectedTabId, tabs]);

  const titleRight = (
    <>
      <select
        class="wl-select"
        style="max-width:340px"
        value={selectedTabId ?? ''}
        onChange={(e) => {
          const next = parseInt((e.currentTarget as HTMLSelectElement).value, 10);
          if (Number.isFinite(next)) {
            history.replaceState({}, '', `?tabId=${next}`);
            setSelectedTabId(next);
          }
        }}
      >
        {tabs.length === 0 ? <option value="">No Salesforce tabs</option> : null}
        {tabs.map(t => (
          <option value={t.tabId} key={t.tabId}>
            {t.hostname}{t.title ? ` - ${t.title}` : ''}
          </option>
        ))}
      </select>
      <button class="wl-btn" onClick={refreshTabs}>Refresh</button>
    </>
  );

  const navItems: NavItem[] = [
    { key: 'query', label: 'Query' },
    { key: 'objects', label: 'Objects' },
    { key: 'push', label: 'Data Push' },
    { key: 'cleanse', label: 'Cleanser' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <>
      <AppShell
        mode="app"
        context={context ?? undefined}
        titleRight={titleRight}
        navItems={navItems}
        route={route}
        onRouteChange={setRoute}
      >
        {!selectedTabId ? (
          <div class="wl-card">
            <div class="wl-row">
              <div style="font-weight:900;font-size:14px">No Salesforce tabs detected</div>
              <div class="wl-muted">Open a logged-in Salesforce Lightning tab, then click Refresh.</div>
              <button class="wl-btn wl-btnPrimary" onClick={refreshTabs}>Refresh Tabs</button>
            </div>
          </div>
        ) : route === 'query' ? (
          <QueryScreen sf={sf} tabId={selectedTabId} context={context ?? undefined} soql={soql} onSoqlChange={setSoql} />
        ) : route === 'objects' ? (
          <ObjectsScreen
            sf={sf}
            tabId={selectedTabId}
            onInsertToken={(token) => setSoql(prev => `${prev}${prev.endsWith(' ') ? '' : ' '}${token}`)}
          />
        ) : route === 'cleanse' ? (
          <DataCleanserScreen
            sf={sf}
            tabId={selectedTabId}
            dataset={dataset}
            onDataset={(next) => {
              setDataset(next);
              setCleaned(null);
            }}
            onCleaned={(result) => setCleaned(result)}
            onGoToPush={() => setRoute('push')}
            onClearDataset={() => {
              setDataset(null);
              setCleaned(null);
            }}
          />
        ) : route === 'push' ? (
          <DataPushScreen
            sf={sf}
            tabId={selectedTabId}
            dataset={dataset}
            cleanedRecords={cleaned?.records ?? null}
            cleanedHeaders={cleaned?.headers ?? null}
            onDataset={setDataset}
            onRequestCleanser={() => setRoute('cleanse')}
          />
        ) : (
          <SettingsScreen sf={sf} mode="app" />
        )}
      </AppShell>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </>
  );
}
