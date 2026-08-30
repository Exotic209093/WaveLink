/**
 * Full-page WaveLink App root (v0.2 — Export/Import pivot).
 *
 * The app's front door is now the Home hub, with Export / Import / Convert /
 * Templates / Schedules / Diff as primary flows. The 20+ legacy power-user
 * screens are kept but accessed via the Advanced Lab.
 *
 * Tab pinning, theme, command palette, undo panel, and shortcuts behave the
 * same as before.
 */

import type { VNode } from 'preact';
import { h } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { SfApi } from '../api/sf';
import type { SfContext } from '../api/sf';
import { AppShell } from '../components/AppShell';
import type { NavItem } from '../components/AppShell';
import { Toast } from '../components/Toast';
import { parseTabIdFromSearch } from '../../core/utils';
import type { Theme } from '../utils/theme';
import { resolveTheme, applyTheme, watchSystemTheme, applyAccentColor } from '../utils/theme';
import { CommandPalette } from '../components/CommandPalette';
import { UndoHistoryPanel } from '../components/UndoHistoryPanel';
import { shortcutRegistry } from '../utils/shortcuts';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { resolveAppRoute } from './routes';
import type { ScheduleDraft } from '../utils/scheduleDraft';
import type { SavedJob } from '../../core/types/storage';
import { Icon } from '../components/Icon';

// ── Primary flows (new in v0.2) ───────────────────────────────────────
import { HomeScreen } from '../screens/HomeScreen';

// ── Eager screens reachable from primary flows ────────────────────────
// SettingsScreen is small and frequently opened, so it stays eager.
import { SettingsScreen } from '../screens/SettingsScreen';

// ── Lazily-loaded Advanced + Migration screens ────────────────────────
// These are demoted, rarely-opened screens. Code-splitting them out of the
// main app chunk keeps the initial load small; each loads on first navigation.
// Named exports are mapped to the { default } shape lazy() expects, and the
// webpackChunkName comments give the emitted chunks readable filenames.
const ExportScreen = lazy(() => import(/* webpackChunkName: "workflow-export" */ '../screens/ExportScreen').then(m => ({ default: m.ExportScreen })));
const ImportScreen = lazy(() => import(/* webpackChunkName: "workflow-import" */ '../screens/ImportScreen').then(m => ({ default: m.ImportScreen })));
const ConvertScreen = lazy(() => import(/* webpackChunkName: "workflow-convert" */ '../screens/ConvertScreen').then(m => ({ default: m.ConvertScreen })));
const SavedJobsScreen = lazy(() => import(/* webpackChunkName: "workflow-templates" */ '../screens/SavedJobsScreen').then(m => ({ default: m.SavedJobsScreen })));
const SchedulesScreen = lazy(() => import(/* webpackChunkName: "workflow-schedules" */ '../screens/SchedulesScreen').then(m => ({ default: m.SchedulesScreen })));
const SnapshotCenterScreen = lazy(() => import(/* webpackChunkName: "workflow-snapshots" */ '../screens/SnapshotCenterScreen').then(m => ({ default: m.SnapshotCenterScreen })));
const CompareScreen = lazy(() => import(/* webpackChunkName: "workflow-compare" */ '../screens/CompareScreen').then(m => ({ default: m.CompareScreen })));
const JobsActivityScreen = lazy(() => import(/* webpackChunkName: "jobs-activity" */ '../screens/JobsActivityScreen').then(m => ({ default: m.JobsActivityScreen })));
const AdvancedLabScreen = lazy(() => import(/* webpackChunkName: "advanced-index" */ '../screens/AdvancedLabScreen').then(m => ({ default: m.AdvancedLabScreen })));
const QueryScreen = lazy(() => import(/* webpackChunkName: "adv-query" */ '../screens/QueryScreen').then(m => ({ default: m.QueryScreen })));
const DataPushScreen = lazy(() => import(/* webpackChunkName: "adv-push" */ '../screens/DataPushScreen').then(m => ({ default: m.DataPushScreen })));
const ObjectsScreen = lazy(() => import(/* webpackChunkName: "adv-objects" */ '../screens/ObjectsScreen').then(m => ({ default: m.ObjectsScreen })));
const RecordInspectorScreen = lazy(() => import(/* webpackChunkName: "adv-inspector" */ '../screens/RecordInspectorScreen').then(m => ({ default: m.RecordInspectorScreen })));
const ApexRunnerScreen = lazy(() => import(/* webpackChunkName: "adv-apex" */ '../screens/ApexRunnerScreen').then(m => ({ default: m.ApexRunnerScreen })));
const ApiExplorerScreen = lazy(() => import(/* webpackChunkName: "adv-api" */ '../screens/ApiExplorerScreen').then(m => ({ default: m.ApiExplorerScreen })));
const PushHistoryScreen = lazy(() => import(/* webpackChunkName: "adv-history" */ '../screens/PushHistoryScreen').then(m => ({ default: m.PushHistoryScreen })));
const DataCleanserScreen = lazy(() => import(/* webpackChunkName: "adv-cleanser" */ '../screens/DataCleanserScreen').then(m => ({ default: m.DataCleanserScreen })));
const TestDataGeneratorScreen = lazy(() => import(/* webpackChunkName: "adv-test-data" */ '../screens/TestDataGeneratorScreen').then(m => ({ default: m.TestDataGeneratorScreen })));
const SchemaComparisonScreen = lazy(() => import(/* webpackChunkName: "adv-schema-compare" */ '../screens/SchemaComparisonScreen').then(m => ({ default: m.SchemaComparisonScreen })));
const FieldAnalyticsScreen = lazy(() => import(/* webpackChunkName: "adv-field-analytics" */ '../screens/FieldAnalyticsScreen').then(m => ({ default: m.FieldAnalyticsScreen })));
const DuplicateDetectionScreen = lazy(() => import(/* webpackChunkName: "adv-duplicates" */ '../screens/DuplicateDetectionScreen').then(m => ({ default: m.DuplicateDetectionScreen })));
const PipelineBuilderScreen = lazy(() => import(/* webpackChunkName: "adv-pipeline" */ '../screens/PipelineBuilderScreen').then(m => ({ default: m.PipelineBuilderScreen })));
const CloneWizardScreen = lazy(() => import(/* webpackChunkName: "adv-clone" */ '../screens/CloneWizardScreen').then(m => ({ default: m.CloneWizardScreen })));
const DataQualityScorecardScreen = lazy(() => import(/* webpackChunkName: "adv-quality" */ '../screens/DataQualityScorecardScreen').then(m => ({ default: m.DataQualityScorecardScreen })));
const OrgHealthScreen = lazy(() => import(/* webpackChunkName: "adv-org-health" */ '../screens/OrgHealthScreen').then(m => ({ default: m.OrgHealthScreen })));
const ApiUsageDashboardScreen = lazy(() => import(/* webpackChunkName: "adv-api-usage" */ '../screens/ApiUsageDashboardScreen').then(m => ({ default: m.ApiUsageDashboardScreen })));
const BulkObjectOpsScreen = lazy(() => import(/* webpackChunkName: "adv-bulk-ops" */ '../screens/BulkObjectOpsScreen').then(m => ({ default: m.BulkObjectOpsScreen })));
const RelationshipExplorerScreen = lazy(() => import(/* webpackChunkName: "adv-relationships" */ '../screens/RelationshipExplorerScreen').then(m => ({ default: m.RelationshipExplorerScreen })));
const HelpScreen = lazy(() => import(/* webpackChunkName: "help" */ '../screens/HelpScreen').then(m => ({ default: m.HelpScreen })));

export function AppRoot(): VNode {
  const sf = useMemo(() => new SfApi('app'), []);
  const [route, setRouteState] = useState<string>(() => window.location.hash.replace(/^#\/?/, '') || 'home');
  const setRoute = useCallback((next: string): void => {
    setRouteState(next);
    if (window.location.hash !== `#${next}`) {
      history.pushState({}, '', `${window.location.pathname}${window.location.search}#${next}`);
    }
  }, []);

  useEffect(() => {
    const restoreRoute = () => setRouteState(window.location.hash.replace(/^#\/?/, '') || 'home');
    window.addEventListener('popstate', restoreRoute);
    window.addEventListener('hashchange', restoreRoute);
    return () => {
      window.removeEventListener('popstate', restoreRoute);
      window.removeEventListener('hashchange', restoreRoute);
    };
  }, []);

  const [tabs, setTabs] = useState<Array<{ tabId: number; title?: string; hostname: string }>>([]);
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
  const [context, setContext] = useState<SfContext | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);
  // Proactive low-storage awareness: warn app-wide before users hit the quota.
  const [storagePct, setStoragePct] = useState<number | null>(null);
  const [storageDismissed, setStorageDismissed] = useState(false);
  // Record ID to preload into the Record Inspector (set when opened from a results grid).
  const [inspectId, setInspectId] = useState<string | undefined>(undefined);

  const openInspector = (id: string): void => {
    setInspectId(id);
    setRoute('advanced/inspector');
  };
  const [soql, setSoql] = useState<string>('SELECT Id, Name FROM Account LIMIT 10');

  const [dataset, setDataset] = useState<{
    sourceRecords: Record<string, unknown>[];
    filename: string;
    format: 'csv' | 'json' | 'excel' | 'xml';
    headers: string[];
    bytes?: number;
  } | null>(null);
  const [cleaned, setCleaned] = useState<{ records: Record<string, unknown>[]; headers: string[] } | null>(null);

  const [theme, setTheme] = useState<Theme>('light');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [undoPanelOpen, setUndoPanelOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | undefined>(undefined);
  const [importJobDraft, setImportJobDraft] = useState<SavedJob | undefined>(undefined);
  const [exportJobDraft, setExportJobDraft] = useState<SavedJob | undefined>(undefined);

  async function refreshTabs(): Promise<void> {
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
    refreshTabs();

    sf.getUiSettings().then(settings => {
      const savedTheme = settings.theme ?? 'light';
      setTheme(savedTheme);
      const resolved = resolveTheme(savedTheme);
      applyTheme(resolved);
      applyAccentColor(settings.accentColor);
    }).catch(e => {
      console.error('Failed to load theme:', e);
      applyTheme('light');
    });

    sf.getOnboarding().then(progress => {
      if (!progress.dismissedAt && progress.completedSteps.length === 0) {
        setShowOnboarding(true);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTabId) {
      setContext(null);
      return;
    }
    sf.getContext(selectedTabId)
      .then(c => setContext(c))
      .catch(e => setToast({ title: 'Failed to Resolve Context', body: e instanceof Error ? e.message : 'Unknown error' }));
  }, [sf, selectedTabId]);

  useEffect(() => {
    if (!context) {
      document.title = 'WaveLink';
      return;
    }
    const hostname = tabs.find(t => t.tabId === selectedTabId)?.hostname ?? new URL(context.instanceUrl).hostname;
    document.title = `WaveLink - ${hostname} (${context.orgId})`;
  }, [context, selectedTabId, tabs]);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    if (theme === 'auto') {
      return watchSystemTheme((systemTheme) => applyTheme(systemTheme));
    }
  }, [theme]);

  useEffect(() => {
    const cleanups = [
      shortcutRegistry.register(
        { id: 'command-palette', defaultKeys: 'ctrl+k', description: 'Open command palette', scope: 'global' },
        () => setCommandPaletteOpen(v => !v),
      ),
      shortcutRegistry.register(
        { id: 'goto-home', defaultKeys: 'ctrl+shift+h', description: 'Go to Home', scope: 'global' },
        () => setRoute('home'),
      ),
      shortcutRegistry.register(
        { id: 'goto-export', defaultKeys: 'ctrl+shift+e', description: 'Go to Export', scope: 'global' },
        () => setRoute('export'),
      ),
      shortcutRegistry.register(
        { id: 'goto-import', defaultKeys: 'ctrl+shift+i', description: 'Go to Import', scope: 'global' },
        () => setRoute('import'),
      ),
      shortcutRegistry.register(
        { id: 'toggle-undo', defaultKeys: 'ctrl+z', description: 'Toggle undo panel', scope: 'global' },
        () => setUndoPanelOpen(v => !v),
      ),
    ];

    sf.getUiSettings().then(settings => {
      if (settings.shortcuts) shortcutRegistry.loadBindings(settings.shortcuts);
    }).catch(() => {});

    const handler = (e: KeyboardEvent) => shortcutRegistry.handleKeydown(e);
    document.addEventListener('keydown', handler);

    return () => {
      cleanups.forEach(fn => fn());
      document.removeEventListener('keydown', handler);
    };
  }, []);

  // Sample storage usage on load (and when returning to Home) so the warning
  // reflects recent pushes/snapshots without polling constantly.
  useEffect(() => {
    sf.getStorageUsage()
      .then(u => setStoragePct(u.quota > 0 ? Math.round((u.bytesInUse / u.quota) * 100) : null))
      .catch(() => undefined);
  }, [sf, route === 'home']);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    sf.setUiSettings({ theme: newTheme }).catch(e => console.error('Failed to save theme:', e));
  };

  const titleRight = (
    <>
      <select
        class="wl-select"
        aria-label="Salesforce tab"
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

  // ── Navigation: primary flows + Advanced Lab group ──────────────────
  const navItems: NavItem[] = [
    { key: 'home', label: 'Home' },
    { key: 'export', label: 'Export' },
    { key: 'import', label: 'Import' },
    { key: 'convert', label: 'Convert' },
    { key: 'jobs', label: 'Jobs & Activity', activeRoutes: ['templates', 'schedules', 'snapshots', 'diff', 'copy', 'advanced/history'] },
    { key: 'advanced/index', label: 'Advanced', activeRoutes: ['advanced'] },
  ];

  const pinnedItems: NavItem[] = [
    { key: 'help', label: 'Help' },
    { key: 'settings', label: 'Settings' },
  ];

  // Advanced tools live behind the hub (not in the sidebar) but stay reachable
  // from the command palette so power users can jump straight to them.
  const advancedToolItems: NavItem[] = [
    { key: 'advanced/objects', label: 'Objects' },
    { key: 'advanced/inspector', label: 'Record Inspector' },
    { key: 'advanced/apex', label: 'Anonymous Apex' },
    { key: 'advanced/api', label: 'REST / Tooling Explorer' },
    { key: 'advanced/relationships', label: 'Relationship Explorer' },
    { key: 'advanced/schemaCompare', label: 'Schema Gap Analysis' },
    { key: 'advanced/fieldAnalytics', label: 'Field Analytics' },
    { key: 'advanced/cleanse', label: 'Cleanser' },
    { key: 'advanced/duplicates', label: 'Duplicate Detection' },
    { key: 'advanced/quality', label: 'Quality Scorecards' },
    { key: 'advanced/bulkOps', label: 'Bulk Object Ops' },
    { key: 'advanced/apiUsage', label: 'API Usage' },
    { key: 'advanced/history', label: 'Audit Trail' },
    { key: 'advanced/pipeline', label: 'Pipeline Builder' },
    { key: 'advanced/testData', label: 'Test Data Generator' },
    { key: 'advanced/clone', label: 'Clone Wizard' },
  ];

  // Routes that need a Salesforce tab.
  const requiresTab: Record<string, true> = {
    export: true,
    import: true,
    schedules: true,
    'advanced/objects': true,
    'advanced/inspector': true,
    'advanced/apex': true,
    'advanced/api': true,
    'advanced/cleanse': true,
    'advanced/testData': true,
    'advanced/schemaCompare': true,
    'advanced/fieldAnalytics': true,
    'advanced/duplicates': true,
    'advanced/pipeline': true,
    'advanced/clone': true,
    'advanced/quality': true,
    'advanced/orgHealth': true,
    'advanced/apiUsage': true,
    'advanced/bulkOps': true,
    'advanced/relationships': true,
  };

  const effectiveRoute = resolveAppRoute(route);
  const needsTab = Boolean(effectiveRoute && !selectedTabId && requiresTab[effectiveRoute]);

  function renderScreen(): VNode {
    const route = effectiveRoute; // shadow outer route inside this fn

    if (!route) {
      return (
        <div class="wl-card">
          <div class="wl-cardSection">
            <div class="wl-emptyState">
              <p class="wl-emptyState__title">Page not found</p>
              <p class="wl-emptyState__desc">WaveLink does not recognize the requested destination.</p>
              <button class="wl-buttonBrand" onClick={() => setRoute('home')}>Return home</button>
            </div>
          </div>
        </div>
      );
    }

    if (needsTab) {
      return (
        <div class="wl-card">
          <div class="wl-cardSection">
            <div class="wl-emptyState">
              <div class="wl-emptyState__icon"><Icon name="database" size={36} /></div>
              <p class="wl-emptyState__title">No Salesforce tab detected</p>
              <p class="wl-emptyState__desc">
                Open a logged-in Salesforce Lightning tab, then click <strong>Refresh</strong> in the top-right.
                The Home, Convert, Templates, and Diff screens work without a connected tab.
              </p>
              <div style="margin-top:12px">
                <button class="wl-buttonBrand" onClick={refreshTabs}>Refresh tabs</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ── Core flows ──
    if (route === 'home') return <HomeScreen sf={sf} hasOrg={Boolean(selectedTabId && context)} onNavigate={setRoute} />;
    if (route === 'export') return (
      <ExportScreen
        sf={sf}
        tabId={selectedTabId!}
        context={context ?? undefined}
        soql={soql}
        onSoqlChange={setSoql}
        onNavigate={setRoute}
        onSchedule={() => {
          setScheduleDraft({ soql, orgId: context?.orgId });
          setRoute('schedules');
        }}
        savedJobDraft={exportJobDraft}
        onSavedJobDraftConsumed={() => setExportJobDraft(undefined)}
      />
    );
    if (route === 'import') return (
      <ImportScreen
        sf={sf}
        tabId={selectedTabId!}
        context={context ?? undefined}
        dataset={dataset}
        cleanedRecords={cleaned?.records ?? null}
        cleanedHeaders={cleaned?.headers ?? null}
        onDataset={setDataset}
        onRequestCleanser={() => setRoute('advanced/cleanse')}
        savedJobDraft={importJobDraft}
        onSavedJobDraftConsumed={() => setImportJobDraft(undefined)}
      />
    );
    if (route === 'convert') return <ConvertScreen />;
    if (route === 'jobs') return <JobsActivityScreen sf={sf} onNavigate={setRoute} />;
    if (route === 'templates') return (
      <SavedJobsScreen
        sf={sf}
        onRunExport={(job) => {
          setSoql(job.definition.query ?? 'SELECT Id, Name FROM Account LIMIT 100');
          setExportJobDraft(job);
          setRoute('export');
        }}
        onRunImport={(job) => {
          setImportJobDraft(job);
          setRoute('import');
        }}
        onOpenSchedules={() => setRoute('schedules')}
      />
    );
    if (route === 'schedules') return (
      <SchedulesScreen
        sf={sf}
        draft={scheduleDraft}
        onDraftConsumed={() => setScheduleDraft(undefined)}
      />
    );
    if (route === 'snapshots') return (
      <SnapshotCenterScreen
        sf={sf}
        tabId={selectedTabId ?? undefined}
        onOpenSchedules={() => setRoute('schedules')}
        onCreateImport={(records, headers, filename) => {
          setDataset({ sourceRecords: records, headers, filename, format: 'json' });
          setRoute('import');
        }}
      />
    );
    if (route === 'diff') return <CompareScreen sf={sf} />;
    if (route === 'copy') return <CompareScreen sf={sf} initialMode="orgs" />;

    // ── Migration suite (top-level) ──

    // ── Advanced hub + tools ──
    if (route === 'advanced/index') return <AdvancedLabScreen onNavigate={setRoute} />;
    if (route === 'advanced/query') return <QueryScreen sf={sf} tabId={selectedTabId!} context={context ?? undefined} soql={soql} onSoqlChange={setSoql} onInspectId={openInspector} />;
    if (route === 'advanced/objects') return (
      <ObjectsScreen sf={sf} tabId={selectedTabId!} onInsertToken={(token) => setSoql(prev => `${prev}${prev.endsWith(' ') ? '' : ' '}${token}`)} />
    );
    if (route === 'advanced/inspector') return <RecordInspectorScreen sf={sf} tabId={selectedTabId!} initialId={inspectId} />;
    if (route === 'advanced/apex') return <ApexRunnerScreen sf={sf} tabId={selectedTabId!} context={context ?? undefined} />;
    if (route === 'advanced/api') return <ApiExplorerScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/cleanse') return (
      <DataCleanserScreen
        sf={sf}
        tabId={selectedTabId!}
        dataset={dataset}
        onDataset={(next) => { setDataset(next); setCleaned(null); }}
        onCleaned={(result) => setCleaned(result)}
        onGoToPush={() => setRoute('import')}
        onClearDataset={() => { setDataset(null); setCleaned(null); }}
      />
    );
    if (route === 'advanced/push') return (
      <DataPushScreen
        sf={sf}
        tabId={selectedTabId!}
        dataset={dataset}
        cleanedRecords={cleaned?.records ?? null}
        cleanedHeaders={cleaned?.headers ?? null}
        onDataset={setDataset}
        onRequestCleanser={() => setRoute('advanced/cleanse')}
      />
    );
    if (route === 'advanced/history') return <PushHistoryScreen sf={sf} />;
    if (route === 'advanced/testData') return <TestDataGeneratorScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/schemaCompare') return <SchemaComparisonScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/fieldAnalytics') return <FieldAnalyticsScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/duplicates') return <DuplicateDetectionScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/pipeline') return <PipelineBuilderScreen sf={sf} tabId={selectedTabId!} dataset={cleaned ? { records: cleaned.records, headers: cleaned.headers } : null} />;
    if (route === 'advanced/clone') return <CloneWizardScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/quality') return <DataQualityScorecardScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/orgHealth') return <OrgHealthScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/apiUsage') return <ApiUsageDashboardScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/bulkOps') return <BulkObjectOpsScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/relationships') return <RelationshipExplorerScreen sf={sf} tabId={selectedTabId!} />;

    // Pinned
    if (route === 'help') return <HelpScreen sf={sf} onNavigate={setRoute} />;
    if (route === 'settings') return <SettingsScreen sf={sf} mode="app" />;

    // The route resolver and this renderer should remain exhaustive.
    return <div class="wl-bannerDanger">This WaveLink page is not available.</div>;
  }

  return (
    <>
      <AppShell
        mode="app"
        context={context ?? undefined}
        sf={sf}
        onOrgSwitch={() => refreshTabs()}
        titleRight={titleRight}
        navItems={navItems}
        pinnedItems={pinnedItems}
        route={effectiveRoute ?? route}
        onRouteChange={setRoute}
        theme={theme}
        onThemeChange={handleThemeChange}
      >
        {storagePct !== null && storagePct >= 80 && !storageDismissed && route !== 'settings' ? (
          <div class="wl-bannerWarning" style="margin-bottom:12px;display:flex;align-items:center;gap:10px">
            <span style="flex:1">
              <strong>Local storage is {storagePct}% full.</strong> WaveLink may fail to save history, snapshots, or undo data soon.
            </span>
            <button class="wl-btn" style="padding:4px 10px;font-size:12px" onClick={() => setRoute('settings')}>Manage storage</button>
            <button class="wl-btn" style="padding:4px 8px;font-size:12px" aria-label="Dismiss storage warning" onClick={() => setStorageDismissed(true)}>✕</button>
          </div>
        ) : null}
        {effectiveRoute?.startsWith('advanced/') && effectiveRoute !== 'advanced/index' ? (
          <button
            class="wl-btn"
            style="margin-bottom:12px"
            onClick={() => setRoute('advanced/index')}
          >
            ← Back to Advanced
          </button>
        ) : null}
        <Suspense
          key={effectiveRoute ?? route}
          fallback={
            <div class="wl-card">
              <div class="wl-cardSection">
                <div class="wl-muted">Loading…</div>
              </div>
            </div>
          }
        >
          {renderScreen()}
        </Suspense>
      </AppShell>

      <CommandPalette
        open={commandPaletteOpen}
        commands={[...navItems, ...pinnedItems, ...advancedToolItems].map(n => ({
          id: n.key,
          label: n.label,
          description: `Navigate to ${n.label}`,
          action: () => { setRoute(n.key); setCommandPaletteOpen(false); },
        }))}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <UndoHistoryPanel sf={sf} open={undoPanelOpen} onClose={() => setUndoPanelOpen(false)} />

      {showOnboarding ? (
        <OnboardingWizard
          sf={sf}
          onDismiss={() => {
            setShowOnboarding(false);
            sf.setOnboarding({ dismissedAt: Date.now() }).catch(() => {});
          }}
          onNavigate={(r) => { setRoute(r); setShowOnboarding(false); }}
          onOpenExample={(example) => {
            if (example === 'export') {
              setSoql('SELECT Id, Name, Type FROM Account ORDER BY Name LIMIT 10');
            } else {
              const records = [
                { Name: 'WaveLink Example Alpha', Type: 'Prospect' },
                { Name: 'WaveLink Example Beta', Type: 'Customer - Direct' },
              ];
              setDataset({ sourceRecords: records, headers: ['Name', 'Type'], filename: 'wavelink-safe-example.json', format: 'json' });
              setCleaned(null);
            }
          }}
        />
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </>
  );
}
