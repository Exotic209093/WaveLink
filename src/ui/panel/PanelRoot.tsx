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

export function PanelRoot(props: { shadowRoot: ShadowRoot }): VNode {
  const sf = useMemo(() => new SfApi('content'), []);
  const [route, setRoute] = useState<string>('query');
  const [context, setContext] = useState<SfContext | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  const [soql, setSoql] = useState<string>('SELECT Id, Name FROM Account LIMIT 10');

  useEffect(() => {
    sf.getContext()
      .then(setContext)
      .catch(e => setToast({ title: 'Not Connected', body: e instanceof Error ? e.message : 'Open a logged-in Salesforce tab.' }));
  }, [sf]);

  async function openFullApp(): Promise<void> {
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
