/**
 * Shared layout shell for the full app and the in-page panel.
 *
 * What this file does:
 * - Provides consistent topbar, nav, and content layout.
 * - Displays current Salesforce context (hostname, sandbox flag, username).
 *
 * Why:
 * - Keeps screens focused on content/behavior rather than repeated chrome/layout code.
 *
 * Complexity:
 * - Rendering nav buttons is O(N) where N is `navItems.length`.
 */

import type { ComponentChildren, VNode } from 'preact';
import { h } from 'preact';
import { ThemeToggle } from './ThemeToggle';
import { OrgSwitcher } from './OrgSwitcher';
import type { Theme } from '../utils/theme';
import type { SfApi } from '../api/sf';

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
  mode: 'app' | 'panel' | 'popup';
  context?: AppShellContext;
  sf?: SfApi;
  onOrgSwitch?: (orgId: string) => void;
  titleRight?: ComponentChildren;
  navItems: NavItem[];
  route: string;
  onRouteChange: (route: string) => void;
  children: ComponentChildren;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}): VNode {
  const { mode, context, sf, onOrgSwitch, titleRight, navItems, route, onRouteChange, children, theme, onThemeChange } = props;

  const chipText = context?.instanceUrl
    ? `${new URL(context.instanceUrl).hostname}${context.environment === 'sandbox' ? ' (Sandbox)' : ''}`
    : 'No org selected';

  return (
    <div class="wl-app" data-mode={mode}>
      <div class="wl-topbar">
        <div class="wl-brand">
          <h1>WaveLink</h1>
          {mode !== 'popup' && sf ? (
            <OrgSwitcher sf={sf} onOrgSwitch={onOrgSwitch} />
          ) : mode !== 'popup' ? (
            <span class="wl-chip" title={context?.orgId ?? ''}>
              <span>{chipText}</span>
              {context?.username ? <span> - {context.username}</span> : null}
            </span>
          ) : null}
        </div>
        <div class="wl-actions">
          {theme && onThemeChange ? <ThemeToggle initialTheme={theme} onThemeChange={onThemeChange} compact /> : null}
          {titleRight}
        </div>
      </div>

      {mode === 'popup' ? (
        <div class="wl-popupNav">
          {navItems.map(item => (
            <button
              key={item.key}
              class="wl-popupNavBtn"
              data-active={route === item.key}
              onClick={() => onRouteChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : mode === 'app' ? (
        <div class="wl-topNav">
          {navItems.map(item => (
            <button
              key={item.key}
              class="wl-topNavBtn"
              data-active={route === item.key}
              onClick={() => onRouteChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div class="wl-layout">
        {mode === 'panel' ? (
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
        ) : null}

        <main class="wl-main">
          {children}
        </main>
      </div>
    </div>
  );
}
