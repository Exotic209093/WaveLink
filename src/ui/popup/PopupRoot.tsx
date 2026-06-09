/**
 * Preact popup root (replaces the old vanilla JS popup).
 *
 * What this file does:
 * - Derives Salesforce context from the currently active Salesforce tab.
 * - Provides a compact version of the app with Data Push, Templates, History, and Settings screens.
 * - Offers quick actions: Open Full App, Toggle Panel.
 *
 * Per-tab scoping:
 * - The popup always operates on the active browser tab's Salesforce session.
 * - When the user opens the full app, it passes the tabId for per-tab pinning.
 *
 * Complexity: O(1) boot; individual screens determine their own complexity.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { SfApi } from '../api/sf';
import type { SfContext } from '../api/sf';
import { AppShell } from '../components/AppShell';
import type { NavItem } from '../components/AppShell';
// DataPushScreen is the popup's default view, so it stays eager. The other
// three tabs are code-split into their own chunks (loaded on first open).
import { DataPushScreen } from '../screens/DataPushScreen';
const TemplatesScreen = lazy(() => import(/* webpackChunkName: "popup-templates" */ '../screens/TemplatesScreen').then(m => ({ default: m.TemplatesScreen })));
const PushHistoryScreen = lazy(() => import(/* webpackChunkName: "popup-history" */ '../screens/PushHistoryScreen').then(m => ({ default: m.PushHistoryScreen })));
const SettingsScreen = lazy(() => import(/* webpackChunkName: "popup-settings" */ '../screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
import { Toast } from '../components/Toast';
import type { Theme } from '../utils/theme';
import { resolveTheme, applyTheme, watchSystemTheme, applyAccentColor } from '../utils/theme';
import { isSalesforceUrl, extractTabIdFromUrl } from '../../core/utils';
import { MessageBus } from '../../services/messaging';

export function PopupRoot(): VNode {
  const sf = useMemo(() => new SfApi('popup'), []);
  const [route, setRoute] = useState<string>('push');

  const [tabId, setTabId] = useState<number | null>(null);
  const [context, setContext] = useState<SfContext | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

  const [dataset, setDataset] = useState<{
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json';
    headers: string[];
    bytes?: number;
  } | null>(null);

  const [theme, setTheme] = useState<Theme>('light');

  /** Resolve SF context from the active browser tab. */
  async function refreshContext(): Promise<void> {
    setConnecting(true);
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!activeTab?.id || !activeTab.url || !isSalesforceUrl(activeTab.url)) {
        setTabId(null);
        setContext(null);
        return;
      }
      setTabId(activeTab.id);
      const ctx = await sf.getContext(activeTab.id);
      setContext(ctx);
    } catch {
      setTabId(null);
      setContext(null);
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    refreshContext();

    // Load theme and accent color
    sf.getUiSettings().then(settings => {
      const savedTheme = settings.theme ?? 'light';
      setTheme(savedTheme);
      applyTheme(resolveTheme(savedTheme));
      applyAccentColor(settings.accentColor);
    }).catch(() => {
      applyTheme('light');
    });
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    if (theme === 'auto') {
      return watchSystemTheme((systemTheme) => applyTheme(systemTheme));
    }
  }, [theme]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    sf.setUiSettings({ theme: newTheme }).catch(() => {});
  };

  async function openFullApp(): Promise<void> {
    if (!tabId) {
      const url = chrome.runtime.getURL('app/app.html');
      await chrome.tabs.create({ url });
      return;
    }
    const appBase = chrome.runtime.getURL('app/app.html');
    const targetUrl = `${appBase}?tabId=${tabId}`;

    // Try to find an existing app tab pinned to this SF tab
    const allTabs = await chrome.tabs.query({});
    const existing = allTabs.find(t =>
      typeof t.url === 'string'
      && t.url.startsWith(appBase)
      && extractTabIdFromUrl(t.url) === tabId
      && typeof t.id === 'number'
    );

    if (existing?.id) {
      await chrome.tabs.update(existing.id, { active: true });
      try { await chrome.windows.update(existing.windowId, { focused: true }); } catch { /* ignore */ }
      return;
    }
    await chrome.tabs.create({ url: targetUrl });
  }

  async function togglePanel(): Promise<void> {
    try {
      const bus = new MessageBus('popup');
      await bus.send('PANEL_TOGGLE', {});
    } catch { /* ignore */ }
  }

  const titleRight = (
    <div class="wl-popupQuickActions">
      <button class="wl-btn" style="font-size:11px;padding:5px 8px" onClick={openFullApp}>Full App</button>
      <button class="wl-btn" style="font-size:11px;padding:5px 8px" onClick={togglePanel}>Panel</button>
    </div>
  );

  const navItems: NavItem[] = [
    { key: 'push', label: 'Import' },
    { key: 'templates', label: 'Templates' },
    { key: 'history', label: 'History' },
    { key: 'settings', label: 'Settings' },
  ];

  const orgInfoBar = context ? (
    <div class="wl-popupOrgInfo">
      <div class="wl-popupOrgRow">
        <span class="wl-popupOrgLabel">Org</span>
        <span class="wl-popupOrgValue">{context.orgId}</span>
      </div>
      <div class="wl-popupOrgRow">
        <span class="wl-popupOrgLabel">User</span>
        <span class="wl-popupOrgValue">{context.username}</span>
      </div>
      <div class="wl-popupOrgRow">
        <span class="wl-popupOrgLabel">Instance</span>
        <span class="wl-popupOrgValue">{new URL(context.instanceUrl).hostname}</span>
      </div>
    </div>
  ) : null;

  return (
    <>
      <AppShell
        mode="popup"
        context={context ?? undefined}
        sf={sf}
        titleRight={titleRight}
        navItems={navItems}
        route={route}
        onRouteChange={setRoute}
        theme={theme}
        onThemeChange={handleThemeChange}
      >
        {connecting ? (
          <div class="wl-popupDisconnected">
            <p>Connecting to Salesforce...</p>
          </div>
        ) : !tabId || !context ? (
          <div class="wl-popupDisconnected">
            <p>Open a logged-in Salesforce tab, then click Refresh.</p>
            <button class="wl-btn wl-btnPrimary" onClick={refreshContext}>Refresh</button>
            <button class="wl-btn" onClick={openFullApp}>Open Full App</button>
          </div>
        ) : (
          <>
            {orgInfoBar}
            <Suspense fallback={<div class="wl-popupDisconnected"><p>Loading…</p></div>}>
              {route === 'push' ? (
                <DataPushScreen
                  sf={sf}
                  tabId={tabId}
                  dataset={dataset}
                  cleanedRecords={null}
                  cleanedHeaders={null}
                  onDataset={setDataset}
                  onRequestCleanser={() => {
                    // In popup, redirect to full app for cleanser
                    openFullApp();
                  }}
                />
              ) : route === 'templates' ? (
                <TemplatesScreen sf={sf} />
              ) : route === 'history' ? (
                <PushHistoryScreen sf={sf} />
              ) : (
                <SettingsScreen sf={sf} mode="popup" />
              )}
            </Suspense>
          </>
        )}
      </AppShell>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </>
  );
}
