import type { ComponentChildren, VNode } from 'preact';
import { h } from 'preact';

export interface NavItem {
  key: string;
  label: string;
}

export interface AppShellContext {
  orgId?: string;
  username?: string;
  instanceUrl?: string;
  environment?: 'production' | 'sandbox';
}

export function AppShell(props: {
  mode: 'app' | 'panel';
  context?: AppShellContext;
  titleRight?: ComponentChildren;
  navItems: NavItem[];
  route: string;
  onRouteChange: (route: string) => void;
  children: ComponentChildren;
}): VNode {
  const { mode, context, titleRight, navItems, route, onRouteChange, children } = props;

  const chipText = context?.instanceUrl
    ? `${new URL(context.instanceUrl).hostname}${context.environment === 'sandbox' ? ' (Sandbox)' : ''}`
    : 'No org selected';

  return (
    <div class="wl-app" data-mode={mode}>
      <div class="wl-topbar">
        <div class="wl-brand">
          <h1>WaveLink</h1>
          <span class="wl-chip" title={context?.orgId ?? ''}>
            <span>{chipText}</span>
            {context?.username ? <span> - {context.username}</span> : null}
          </span>
        </div>
        <div class="wl-actions">
          {titleRight}
        </div>
      </div>

      <div class="wl-layout">
        <aside class="wl-nav">
          <div class="wl-navCard">
            {navItems.map(item => (
              <button
                key={item.key}
                class="wl-navBtn"
                data-active={route === item.key}
                onClick={() => onRouteChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <main class="wl-main">
          {children}
        </main>
      </div>
    </div>
  );
}
