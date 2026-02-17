/**
 * In-page panel root (rendered into a shadow DOM by the content script).
 *
 * What this file does:
 * - Provides a lightweight subset of the full app (query/objects/settings).
 * - Resolves context without a tab selector because it always operates on the current page's Salesforce tab.
 *
 * Why:
 * - "Inspector-style" panel lets users work without leaving Salesforce.
 *
 * Complexity: O(1) boot; individual screens determine their own complexity.
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
import type { Theme } from '../utils/theme';
import { resolveTheme, applyTheme, watchSystemTheme, applyAccentColor } from '../utils/theme';

export function PanelRoot(props: { shadowRoot: ShadowRoot }): VNode {
  const sf = useMemo(() => new SfApi('content'), []);
  const [route, setRoute] = useState<string>('query');
  const [context, setContext] = useState<SfContext | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [soql, setSoql] = useState<string>('SELECT Id, Name FROM Account LIMIT 10');
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Resolve Salesforce context for the current tab (no explicit tabId needed from content script).
    sf.getContext()
      .then(setContext)
      .catch(e => setToast({ title: 'Not Connected', body: e instanceof Error ? e.message : 'Open a logged-in Salesforce tab.' }));

    // Load theme and accent color from storage
    sf.getUiSettings().then(settings => {
      const savedTheme = settings.theme ?? 'light';
      setTheme(savedTheme);
      const resolved = resolveTheme(savedTheme);
      // Apply theme to shadow root host element
      if (props.shadowRoot.host) {
        (props.shadowRoot.host as HTMLElement).setAttribute('data-theme', resolved);
      }
      applyAccentColor(settings.accentColor);
    }).catch(e => {
      console.error('Failed to load theme:', e);
    });
  }, [sf, props.shadowRoot]);

  useEffect(() => {
    /**
     * Apply theme to shadow root whenever it changes.
     */
    const resolved = resolveTheme(theme);
    if (props.shadowRoot.host) {
      (props.shadowRoot.host as HTMLElement).setAttribute('data-theme', resolved);
    }

    // If theme is auto, watch for system changes
    if (theme === 'auto') {
      return watchSystemTheme((systemTheme) => {
        if (props.shadowRoot.host) {
          (props.shadowRoot.host as HTMLElement).setAttribute('data-theme', systemTheme);
        }
      });
    }
  }, [theme, props.shadowRoot]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    // Save to storage
    sf.setUiSettings({ theme: newTheme }).catch(e => {
      console.error('Failed to save theme:', e);
    });
  };

  async function openFullApp(): Promise<void> {
    // Open the full app in a new tab. (Per-tab pinning is handled by the popup launcher.)
    const url = chrome.runtime.getURL('app/app.html');
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const titleRight = (
    <>
      <button class="wl-btn" onClick={openFullApp}>Open Full App</button>
    </>
  );

  const navItems: NavItem[] = [
    { key: 'query', label: 'Query' },
    { key: 'objects', label: 'Objects' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <>
      <AppShell
        mode="panel"
        context={context ?? undefined}
        titleRight={titleRight}
        navItems={navItems}
        route={route}
        onRouteChange={setRoute}
        theme={theme}
        onThemeChange={handleThemeChange}
      >
        {route === 'query' ? (
          <QueryScreen sf={sf} context={context ?? undefined} soql={soql} onSoqlChange={setSoql} />
        ) : route === 'objects' ? (
          <ObjectsScreen
            sf={sf}
            onInsertToken={(token) => setSoql(prev => `${prev}${prev.endsWith(' ') ? '' : ' '}${token}`)}
          />
        ) : (
          <SettingsScreen sf={sf} mode="panel" />
        )}
      </AppShell>

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </>
  );
}
