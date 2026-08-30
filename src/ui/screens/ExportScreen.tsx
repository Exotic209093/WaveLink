/**
 * Export landing screen (v0.2 pivot).
 *
 * Thin wrapper that gives the existing SOQL+download workflow an SLDS-shaped
 * page header and an entry-point chooser. The heavy lifting lives in QueryScreen.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { SfApi, SfContext } from '../api/sf';
import { QueryScreen } from './QueryScreen';
import type { ExportPreferences } from '../components/ExportModal';
import type { SavedJob } from '../../core/types/storage';

interface QueryWorkspaceTab {
  id: string;
  name: string;
  soql: string;
  selectedColumns: string[];
  exportPreferences: ExportPreferences;
  queryMode: 'rest' | 'bulk';
}

const DEFAULT_EXPORT_PREFERENCES: ExportPreferences = {
  format: 'csv',
  sheetName: 'Sheet1',
  includeMetadata: false,
};

function normalizeTab(tab: Partial<QueryWorkspaceTab> & Pick<QueryWorkspaceTab, 'id' | 'name' | 'soql'>): QueryWorkspaceTab {
  return {
    ...tab,
    selectedColumns: Array.isArray(tab.selectedColumns) ? tab.selectedColumns : [],
    exportPreferences: { ...DEFAULT_EXPORT_PREFERENCES, ...tab.exportPreferences },
    queryMode: tab.queryMode === 'bulk' ? 'bulk' : 'rest',
  };
}

export function ExportScreen(props: {
  sf: SfApi;
  tabId?: number;
  context?: SfContext;
  soql: string;
  onSoqlChange: (s: string) => void;
  onNavigate: (route: string) => void;
  onSchedule: () => void;
  savedJobDraft?: SavedJob;
  onSavedJobDraftConsumed?: () => void;
}): VNode {
  const { sf, tabId, context, soql, onSoqlChange, onNavigate, onSchedule } = props;
  const nextTabNumber = useRef(2);
  const [tabs, setTabs] = useState<QueryWorkspaceTab[]>([
    normalizeTab({ id: 'query-1', name: 'Query 1', soql }),
  ]);
  const [activeTabId, setActiveTabId] = useState('query-1');
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [tabNameDraft, setTabNameDraft] = useState('');
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const workspaceKey = `exportWorkspace:${context?.orgId ?? 'local'}`;

  useEffect(() => {
    setWorkspaceLoaded(false);
    chrome.storage.local.get([workspaceKey], result => {
      const saved = result[workspaceKey] as { tabs?: QueryWorkspaceTab[]; activeTabId?: string } | undefined;
      if (saved?.tabs?.length) {
        const restoredTabs = saved.tabs.map(normalizeTab);
        setTabs(restoredTabs);
        const nextActive = restoredTabs.some(tab => tab.id === saved.activeTabId) ? saved.activeTabId! : restoredTabs[0].id;
        setActiveTabId(nextActive);
        onSoqlChange(restoredTabs.find(tab => tab.id === nextActive)?.soql ?? soql);
        nextTabNumber.current = restoredTabs.length + 1;
      }
      setWorkspaceLoaded(true);
    });
  }, [workspaceKey]);

  useEffect(() => {
    if (!workspaceLoaded) return;
    chrome.storage.local.set({ [workspaceKey]: { tabs, activeTabId } });
  }, [workspaceLoaded, workspaceKey, tabs, activeTabId]);

  useEffect(() => {
    const draft = props.savedJobDraft;
    if (!workspaceLoaded || !draft || draft.definition.kind !== 'export') return;
    const id = `query-${Date.now()}`;
    const tab = normalizeTab({
      id,
      name: draft.name,
      soql: draft.definition.query ?? 'SELECT Id, Name FROM Account LIMIT 100',
      selectedColumns: draft.definition.columns ?? [],
      queryMode: draft.definition.api.strategy === 'bulk' ? 'bulk' : 'rest',
      exportPreferences: {
        ...DEFAULT_EXPORT_PREFERENCES,
        format: draft.definition.output?.format ?? 'csv',
      },
    });
    setTabs(current => [...current, tab]);
    setActiveTabId(id);
    onSoqlChange(tab.soql);
    props.onSavedJobDraftConsumed?.();
  }, [workspaceLoaded, props.savedJobDraft]);

  function updateActiveQuery(value: string): void {
    setTabs(current => current.map(tab => tab.id === activeTabId ? { ...tab, soql: value } : tab));
    onSoqlChange(value);
  }

  function updateActiveTab(patch: Partial<QueryWorkspaceTab>): void {
    setTabs(current => current.map(tab => tab.id === activeTabId ? { ...tab, ...patch } : tab));
  }

  function activateTab(id: string): void {
    const tab = tabs.find(candidate => candidate.id === id);
    if (!tab) return;
    setActiveTabId(id);
    onSoqlChange(tab.soql);
  }

  function addTab(): void {
    const number = nextTabNumber.current++;
    const tab = normalizeTab({ id: `query-${Date.now()}`, name: `Query ${number}`, soql: 'SELECT Id, Name FROM Account LIMIT 10' });
    setTabs(current => [...current, tab]);
    setActiveTabId(tab.id);
    onSoqlChange(tab.soql);
  }

  function closeTab(id: string): void {
    if (tabs.length === 1) return;
    const index = tabs.findIndex(tab => tab.id === id);
    const nextTabs = tabs.filter(tab => tab.id !== id);
    setTabs(nextTabs);
    if (id === activeTabId) {
      const next = nextTabs[Math.min(index, nextTabs.length - 1)];
      setActiveTabId(next.id);
      onSoqlChange(next.soql);
    }
  }

  function dropBefore(targetId: string): void {
    if (!draggedTabId || draggedTabId === targetId) return;
    setTabs(current => {
      const moving = current.find(tab => tab.id === draggedTabId);
      if (!moving) return current;
      const without = current.filter(tab => tab.id !== draggedTabId);
      const targetIndex = without.findIndex(tab => tab.id === targetId);
      without.splice(targetIndex, 0, moving);
      return without;
    });
    setDraggedTabId(null);
  }

  function finishRename(): void {
    const name = tabNameDraft.trim();
    if (renamingTabId && name) {
      setTabs(current => current.map(tab => tab.id === renamingTabId ? { ...tab, name } : tab));
    }
    setRenamingTabId(null);
  }

  return (
    <div>
      <div class="wl-pageHeader">
        <div class="wl-pageHeader__main">
          <span class="wl-pageHeader__eyebrow">Export</span>
          <h1 class="wl-pageHeader__title">Export records out of Salesforce</h1>
          <p class="wl-pageHeader__sub">
            Run a SOQL query, preview results, then download as CSV, JSON, Excel, or XML.
            Save the config as a template or schedule it to run on a cadence.
          </p>
        </div>
        <div class="wl-pageHeader__actions">
          <button class="wl-buttonNeutral" onClick={() => onNavigate('templates')}>Saved jobs</button>
          <button class="wl-buttonNeutral" onClick={onSchedule}>Schedule this query</button>
        </div>
      </div>

      <div class="wl-queryTabs" role="tablist" aria-label="Open queries">
        {tabs.map(tab => (
          <div
            class="wl-queryTabWrap"
            key={tab.id}
            role="presentation"
            draggable
            onDragStart={() => setDraggedTabId(tab.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropBefore(tab.id)}
          >
            {renamingTabId === tab.id ? (
              <input
                class="wl-queryTabRename"
                aria-label={`Rename ${tab.name}`}
                value={tabNameDraft}
                autoFocus
                onInput={(event) => setTabNameDraft((event.currentTarget as HTMLInputElement).value)}
                onBlur={finishRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') finishRename();
                  if (event.key === 'Escape') setRenamingTabId(null);
                }}
              />
            ) : (
              <button
                type="button"
                class="wl-queryTab"
                role="tab"
                aria-selected={tab.id === activeTabId}
                aria-controls="export-query-panel"
                tabIndex={tab.id === activeTabId ? 0 : -1}
                title="Double-click to rename"
                onClick={() => activateTab(tab.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  const index = tabs.findIndex(candidate => candidate.id === tab.id);
                  const offset = event.key === 'ArrowRight' ? 1 : -1;
                  activateTab(tabs[(index + offset + tabs.length) % tabs.length].id);
                }}
                onDblClick={() => { setRenamingTabId(tab.id); setTabNameDraft(tab.name); }}
              >
                {tab.name}
              </button>
            )}
            <button type="button" class="wl-queryTabClose" aria-label={`Close ${tab.name}`} disabled={tabs.length === 1} onClick={() => closeTab(tab.id)}>×</button>
          </div>
        ))}
        <button type="button" class="wl-queryTabAdd" onClick={addTab}>New query</button>
      </div>

      <div id="export-query-panel" role="tabpanel">
        <QueryScreen
          key={activeTabId}
          sf={sf}
          tabId={tabId}
          context={context}
          soql={tabs.find(tab => tab.id === activeTabId)?.soql ?? soql}
          selectedColumns={tabs.find(tab => tab.id === activeTabId)?.selectedColumns}
          exportPreferences={tabs.find(tab => tab.id === activeTabId)?.exportPreferences}
          queryMode={tabs.find(tab => tab.id === activeTabId)?.queryMode}
          onSoqlChange={updateActiveQuery}
          onSelectedColumnsChange={(selectedColumns) => updateActiveTab({ selectedColumns })}
          onExportPreferencesChange={(exportPreferences) => updateActiveTab({ exportPreferences })}
          onQueryModeChange={(queryMode) => updateActiveTab({ queryMode })}
        />
      </div>
    </div>
  );
}
