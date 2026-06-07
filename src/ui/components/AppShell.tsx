/**
 * Shared layout shell for the full app and the in-page panel.
 *
 * What this file does:
 * - Provides consistent topbar, nav, and content layout.
 * - Displays current Salesforce context (hostname, sandbox flag, username).
 * - In app mode, renders a two-tier grouped nav: group row + sub-screen row.
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

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
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
  navGroups?: NavGroup[];
  pinnedItems?: NavItem[];
  route: string;
  onRouteChange: (route: string) => void;
  children: ComponentChildren;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}): VNode {
  const { mode, context, sf, onOrgSwitch, titleRight, navItems, navGroups, pinnedItems, route, onRouteChange, children, theme, onThemeChange } = props;

  const chipText = context?.instanceUrl
    ? `${new URL(context.instanceUrl).hostname}${context.environment === 'sandbox' ? ' (Sandbox)' : ''}`
    : 'No org selected';

  // Short org label for the cramped panel header (drops the my.salesforce.com /
  // lightning.force.com suffix and the username; full detail stays in the tooltip).
  const orgShort = context?.instanceUrl
    ? new URL(context.instanceUrl).hostname
        .replace(/\.my\.salesforce-setup\.com$/i, '')
        .replace(/\.my\.salesforce\.com$/i, '')
        .replace(/\.lightning\.force\.com$/i, '')
    : '';

  // Derive which group contains the current route
  const activeGroup = navGroups?.find(g => g.items.some(item => item.key === route)) ?? null;

  return (
    <div class="wl-app" data-mode={mode}>
      <div class="wl-topbar">
        <div class="wl-brand">
          <span class="wl-brandMark" aria-hidden="true">〜</span>
          <h1>WaveLink</h1>
          {mode !== 'popup' && sf ? (
            <OrgSwitcher sf={sf} onOrgSwitch={onOrgSwitch} />
          ) : mode === 'panel' ? (
            context?.instanceUrl ? (
              <span class="wl-chip" title={`${chipText}${context?.username ? ' · ' + context.username : ''}`}>
                {orgShort}{context.environment === 'sandbox' ? ' · SB' : ''}
              </span>
            ) : null
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
      ) : mode === 'app' && navGroups ? (
        /* Single sticky wrapper so both rows stick together */
        <div class="wl-navBar">
          {/* Tier 1: group buttons */}
          <div class="wl-topNav">
            {navGroups.map(group => (
              <button
                key={group.key}
                class="wl-navGroupBtn"
                data-active={activeGroup?.key === group.key}
                onClick={() => onRouteChange(group.items[0].key)}
              >
                {group.label}
              </button>
            ))}
            {pinnedItems && pinnedItems.length > 0 ? (
              <div class="wl-navPinned">
                {pinnedItems.map(item => (
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
          </div>

          {/* Tier 2: sub-screen tabs for the active group */}
          {activeGroup ? (
            <div class="wl-subNav">
              {activeGroup.items.map(item => (
                <button
                  key={item.key}
                  class="wl-subNavBtn"
                  data-active={route === item.key}
                  onClick={() => onRouteChange(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : mode === 'app' ? (
        <div class="wl-topNav wl-topNav--sticky">
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

      {mode === 'panel' ? (
        <>
          <div class="wl-panelTabBar" role="tablist">
            {navItems.map(item => (
              <button
                key={item.key}
                class="wl-panelTab"
                role="tab"
                data-active={route === item.key}
                onClick={() => onRouteChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <main class="wl-main wl-panelMain">
            {children}
          </main>
        </>
      ) : (
        <div class="wl-layout">
          <main class="wl-main">
            {children}
          </main>
        </div>
      )}
    </div>
  );
}
