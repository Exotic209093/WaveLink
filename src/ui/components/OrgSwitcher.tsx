/**
 * Org switcher flyout for the topbar.
 * Lists connected orgs, allows switching, connecting new ones, and managing existing.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { SfApi, SfTabInfo } from '../api/sf';
import { useOrgList } from '../hooks/useOrgList';
import type { UiSettings } from '../../core/types/storage';

const PRESET_COLORS = ['#0284a8', '#e74c3c', '#27ae60', '#f39c12', '#8e44ad', '#e67e22', '#1abc9c', '#7f8c8d'];

export function OrgSwitcher(props: {
  sf: SfApi;
  context?: { orgId?: string; username?: string; instanceUrl?: string; environment?: 'production' | 'sandbox' };
  onOrgSwitch?: (orgId: string) => void;
}): VNode {
  const { sf, context, onOrgSwitch } = props;
  const { orgs, activeOrgId, switchOrg, connectFromTab, disconnectOrg, updateOrgNickname, refreshOrgToken } = useOrgList(sf);

  const [open, setOpen] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [availableTabs, setAvailableTabs] = useState<SfTabInfo[]>([]);
  const [menuOrgId, setMenuOrgId] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');
  const [colorPickerOrgId, setColorPickerOrgId] = useState<string | null>(null);
  const [orgColorMap, setOrgColorMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const flyoutRef = useRef<HTMLDivElement>(null);

  const activeOrg = orgs.find(o => o.orgId === activeOrgId);

  useEffect(() => {
    sf.getUiSettings().then(s => {
      if (s.orgColorMap) setOrgColorMap(s.orgColorMap);
    }).catch(() => {});
  }, [sf]);

  useEffect(() => {
    if (!open) {
      setConnectMode(false);
      setMenuOrgId(null);
      setEditingNickname(null);
      setColorPickerOrgId(null);
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function loadAvailableTabs(): Promise<void> {
    const tabs = await sf.listTabs();
    const connectedUrls = new Set(orgs.map(o => new URL(o.instanceUrl).hostname));
    setAvailableTabs(tabs.filter(t => !connectedUrls.has(t.hostname)));
  }

  async function handleConnect(tabId: number): Promise<void> {
    setBusy(true);
    try {
      await connectFromTab(tabId);
      setConnectMode(false);
    } catch { /* handled by toast in parent */ }
    setBusy(false);
  }

  async function handleSwitch(orgId: string): Promise<void> {
    if (orgId === activeOrgId) return;
    await switchOrg(orgId);
    onOrgSwitch?.(orgId);
    setOpen(false);
  }

  async function handleDisconnect(orgId: string): Promise<void> {
    setBusy(true);
    try {
      await disconnectOrg(orgId);
      setMenuOrgId(null);
    } catch { /* handled by hook */ }
    setBusy(false);
  }

  async function handleSaveNickname(orgId: string): Promise<void> {
    await updateOrgNickname(orgId, nicknameValue);
    setEditingNickname(null);
  }

  async function handleSetColor(orgId: string, color: string): Promise<void> {
    const next = { ...orgColorMap, [orgId]: color };
    setOrgColorMap(next);
    setColorPickerOrgId(null);
    await sf.setUiSettings({ orgColorMap: next } as Partial<UiSettings>).catch(() => {});
  }

  function getOrgLabel(org: { instanceUrl: string; nickname?: string; username: string }): string {
    return org.nickname || new URL(org.instanceUrl).hostname;
  }

  function getOrgColor(orgId: string): string {
    return orgColorMap[orgId] || '#7f8c8d';
  }

  const contextualLabel = context?.instanceUrl ? new URL(context.instanceUrl).hostname : null;
  const triggerLabel = activeOrg ? getOrgLabel(activeOrg) : contextualLabel ?? 'No org connected';
  const triggerEnv = activeOrg?.environment === 'sandbox'
    ? 'SBX'
    : activeOrg
      ? 'PROD'
      : context?.environment === 'sandbox'
        ? 'SBX'
        : context?.environment === 'production'
          ? 'PROD'
          : '';

  return (
    <div class="wl-orgSwitcher" ref={flyoutRef}>
      <button class="wl-orgSwitcherTrigger" onClick={() => setOpen(v => !v)}>
        {activeOrg || context?.orgId ? <span class="wl-orgColorDot" style={{ background: getOrgColor(activeOrgId ?? context?.orgId ?? '') }} /> : null}
        <span style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{triggerLabel}</span>
        {triggerEnv ? (
          <span class="wl-orgBadge" data-env={(activeOrg?.environment ?? context?.environment) === 'sandbox' ? 'sandbox' : 'production'}>{triggerEnv}</span>
        ) : null}
        <span style="font-size:10px;opacity:0.6">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open ? (
        <div class="wl-orgFlyout">
          {!connectMode ? (
            <>
              <div style="padding:4px 8px;font-size:11px;color:var(--wl-ink-dim);font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Connected Orgs</div>
              {orgs.length === 0 ? (
                <div style="padding:12px;color:var(--wl-ink-dim);font-size:13px">
                  {context?.orgId
                    ? 'The current Salesforce tab is connected for this session. Use Connect from Tab to save it to the org switcher.'
                    : 'No orgs connected. Open a Salesforce tab and connect.'}
                </div>
              ) : null}
              {orgs.map(org => (
                <div key={org.orgId}>
                  <div
                    class="wl-orgItem"
                    data-active={org.orgId === activeOrgId}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button,input,.wl-orgMenu,.wl-orgColorPicker')) return;
                      handleSwitch(org.orgId);
                    }}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSwitch(org.orgId);
                      }
                    }}
                  >
                    <span class="wl-orgColorDot" style={{ background: getOrgColor(org.orgId) }} />
                    <div style="flex:1;min-width:0">
                      {editingNickname === org.orgId ? (
                        <div class="wl-row" style="gap:4px">
                          <input
                            class="wl-input"
                            style="font-size:12px;padding:2px 6px;flex:1"
                            value={nicknameValue}
                            onInput={(e) => setNicknameValue((e.currentTarget as HTMLInputElement).value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNickname(org.orgId); if (e.key === 'Escape') setEditingNickname(null); }}
                            placeholder="Nickname"
                          />
                          <button class="wl-btn" style="font-size:11px;padding:2px 8px" onClick={() => handleSaveNickname(org.orgId)}>Save</button>
                        </div>
                      ) : (
                        <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                          {getOrgLabel(org)}
                        </div>
                      )}
                      <div style="font-size:11px;color:var(--wl-ink-dim)">{org.username}</div>
                    </div>
                    <span class="wl-orgBadge" data-env={org.environment === 'sandbox' ? 'sandbox' : 'production'}>
                      {org.environment === 'sandbox' ? 'SBX' : 'PROD'}
                    </span>
                    <button
                      class="wl-btn"
                      style="font-size:11px;padding:2px 6px;min-width:auto"
                      onClick={(e: Event) => { e.stopPropagation(); setMenuOrgId(menuOrgId === org.orgId ? null : org.orgId); }}
                    >
                      ...
                    </button>
                  </div>

                  {menuOrgId === org.orgId ? (
                    <div class="wl-orgMenu">
                      <button class="wl-orgMenuBtn" onClick={() => { setEditingNickname(org.orgId); setNicknameValue(org.nickname || ''); setMenuOrgId(null); }}>
                        Set Nickname
                      </button>
                      <button class="wl-orgMenuBtn" onClick={() => { setColorPickerOrgId(org.orgId); setMenuOrgId(null); }}>
                        Set Color
                      </button>
                      <button class="wl-orgMenuBtn" onClick={() => { refreshOrgToken(org.orgId); setMenuOrgId(null); }}>
                        Refresh Token
                      </button>
                      <button class="wl-orgMenuBtn wl-orgMenuBtnDanger" onClick={() => handleDisconnect(org.orgId)}>
                        Disconnect
                      </button>
                    </div>
                  ) : null}

                  {colorPickerOrgId === org.orgId ? (
                    <div class="wl-orgColorPicker">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          class="wl-orgColorSwatch"
                          style={{ background: c }}
                          data-selected={orgColorMap[org.orgId] === c}
                          onClick={() => handleSetColor(org.orgId, c)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              <div style="border-top:1px solid var(--wl-line);margin-top:4px;padding-top:4px">
                <button
                  class="wl-btn wl-btnPrimary"
                  style="width:100%;font-size:12px"
                  onClick={() => { setConnectMode(true); loadAvailableTabs(); }}
                >
                  Connect from Tab...
                </button>
              </div>
            </>
          ) : (
            <>
              <div style="padding:4px 8px;font-size:11px;color:var(--wl-ink-dim);font-weight:700;text-transform:uppercase;letter-spacing:0.5px">
                Open Salesforce Tabs
              </div>
              {availableTabs.length === 0 ? (
                <div style="padding:12px;color:var(--wl-ink-dim);font-size:13px">
                  No unconnected Salesforce tabs found. Open a Salesforce org in a new tab.
                </div>
              ) : null}
              {availableTabs.map(tab => (
                <div key={tab.tabId} class="wl-orgItem" style="cursor:default">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{tab.hostname}</div>
                    {tab.title ? <div style="font-size:11px;color:var(--wl-ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{tab.title}</div> : null}
                  </div>
                  <button
                    class="wl-btn wl-btnPrimary"
                    style="font-size:11px;padding:4px 10px"
                    disabled={busy}
                    onClick={() => handleConnect(tab.tabId)}
                  >
                    Connect
                  </button>
                </div>
              ))}
              <div style="border-top:1px solid var(--wl-line);margin-top:4px;padding-top:4px">
                <button class="wl-btn" style="width:100%;font-size:12px" onClick={() => setConnectMode(false)}>Back</button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
