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
import { useEffect, useMemo, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { SfApi } from '../api/sf';
import type { SfContext } from '../api/sf';
import { AppShell } from '../components/AppShell';
import type { NavItem, NavGroup } from '../components/AppShell';
import { Toast } from '../components/Toast';
import { parseTabIdFromSearch } from '../../core/utils';
import type { Theme } from '../utils/theme';
import { resolveTheme, applyTheme, watchSystemTheme, applyAccentColor } from '../utils/theme';
import { CommandPalette } from '../components/CommandPalette';
import { UndoHistoryPanel } from '../components/UndoHistoryPanel';
import { shortcutRegistry } from '../utils/shortcuts';
import { OnboardingWizard } from '../components/OnboardingWizard';

// ── Primary flows (new in v0.2) ───────────────────────────────────────
import { HomeScreen } from '../screens/HomeScreen';
import { ExportScreen } from '../screens/ExportScreen';
import { ImportScreen } from '../screens/ImportScreen';
import { ConvertScreen } from '../screens/ConvertScreen';
import { ExportImportTemplatesScreen } from '../screens/ExportImportTemplatesScreen';
import { SchedulesScreen } from '../screens/SchedulesScreen';
import { CompareScreen } from '../screens/CompareScreen';
import { AdvancedLabScreen } from '../screens/AdvancedLabScreen';

// ── Eager screens reachable from primary flows ────────────────────────
// QueryScreen and DataPushScreen are already pulled into the main chunk by
// ExportScreen / ImportScreen, so importing them statically here is free.
// SettingsScreen is small and frequently opened, so it stays eager too.
import { QueryScreen } from '../screens/QueryScreen';
import { DataPushScreen } from '../screens/DataPushScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

// ── Lazily-loaded Advanced + Migration screens ────────────────────────
// These are demoted, rarely-opened screens. Code-splitting them out of the
// main app chunk keeps the initial load small; each loads on first navigation.
// Named exports are mapped to the { default } shape lazy() expects, and the
// webpackChunkName comments give the emitted chunks readable filenames.
const ObjectsScreen = lazy(() => import(/* webpackChunkName: "adv-objects" */ '../screens/ObjectsScreen').then(m => ({ default: m.ObjectsScreen })));
const RecordInspectorScreen = lazy(() => import(/* webpackChunkName: "adv-inspector" */ '../screens/RecordInspectorScreen').then(m => ({ default: m.RecordInspectorScreen })));
const ApexRunnerScreen = lazy(() => import(/* webpackChunkName: "adv-apex" */ '../screens/ApexRunnerScreen').then(m => ({ default: m.ApexRunnerScreen })));
const PushHistoryScreen = lazy(() => import(/* webpackChunkName: "adv-history" */ '../screens/PushHistoryScreen').then(m => ({ default: m.PushHistoryScreen })));
const DataCleanserScreen = lazy(() => import(/* webpackChunkName: "adv-cleanser" */ '../screens/DataCleanserScreen').then(m => ({ default: m.DataCleanserScreen })));
const TestDataGeneratorScreen = lazy(() => import(/* webpackChunkName: "adv-test-data" */ '../screens/TestDataGeneratorScreen').then(m => ({ default: m.TestDataGeneratorScreen })));
const SchemaComparisonScreen = lazy(() => import(/* webpackChunkName: "adv-schema-compare" */ '../screens/SchemaComparisonScreen').then(m => ({ default: m.SchemaComparisonScreen })));
const FieldAnalyticsScreen = lazy(() => import(/* webpackChunkName: "adv-field-analytics" */ '../screens/FieldAnalyticsScreen').then(m => ({ default: m.FieldAnalyticsScreen })));
const DuplicateDetectionScreen = lazy(() => import(/* webpackChunkName: "adv-duplicates" */ '../screens/DuplicateDetectionScreen').then(m => ({ default: m.DuplicateDetectionScreen })));
const PipelineBuilderScreen = lazy(() => import(/* webpackChunkName: "adv-pipeline" */ '../screens/PipelineBuilderScreen').then(m => ({ default: m.PipelineBuilderScreen })));
const CloneWizardScreen = lazy(() => import(/* webpackChunkName: "adv-clone" */ '../screens/CloneWizardScreen').then(m => ({ default: m.CloneWizardScreen })));
const DataQualityScorecardScreen = lazy(() => import(/* webpackChunkName: "adv-quality" */ '../screens/DataQualityScorecardScreen').then(m => ({ default: m.DataQualityScorecardScreen })));
const ApiUsageDashboardScreen = lazy(() => import(/* webpackChunkName: "adv-api-usage" */ '../screens/ApiUsageDashboardScreen').then(m => ({ default: m.ApiUsageDashboardScreen })));
const BulkObjectOpsScreen = lazy(() => import(/* webpackChunkName: "adv-bulk-ops" */ '../screens/BulkObjectOpsScreen').then(m => ({ default: m.BulkObjectOpsScreen })));
const RelationshipExplorerScreen = lazy(() => import(/* webpackChunkName: "adv-relationships" */ '../screens/RelationshipExplorerScreen').then(m => ({ default: m.RelationshipExplorerScreen })));
const HelpScreen = lazy(() => import(/* webpackChunkName: "help" */ '../screens/HelpScreen').then(m => ({ default: m.HelpScreen })));
const MigrationProjectsScreen = lazy(() => import(/* webpackChunkName: "migration-projects" */ '../screens/MigrationProjectsScreen').then(m => ({ default: m.MigrationProjectsScreen })));
const MigrationWorkspaceScreen = lazy(() => import(/* webpackChunkName: "migration-workspace" */ '../screens/MigrationWorkspaceScreen').then(m => ({ default: m.MigrationWorkspaceScreen })));
const MigrationValidationScreen = lazy(() => import(/* webpackChunkName: "migration-validation" */ '../screens/MigrationValidationScreen').then(m => ({ default: m.MigrationValidationScreen })));
const MigrationReportsScreen = lazy(() => import(/* webpackChunkName: "migration-reports" */ '../screens/MigrationReportsScreen').then(m => ({ default: m.MigrationReportsScreen })));
const MigrationTemplatesScreen = lazy(() => import(/* webpackChunkName: "migration-templates" */ '../screens/MigrationTemplatesScreen').then(m => ({ default: m.MigrationTemplatesScreen })));
const IdMapViewerScreen = lazy(() => import(/* webpackChunkName: "migration-idmaps" */ '../screens/IdMapViewerScreen').then(m => ({ default: m.IdMapViewerScreen })));

export function AppRoot(): VNode {
  const sf = useMemo(() => new SfApi('app'), []);
  const [route, setRoute] = useState<string>('home');

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
    format: 'csv' | 'json';
    headers: string[];
    bytes?: number;
  } | null>(null);
  const [cleaned, setCleaned] = useState<{ records: Record<string, unknown>[]; headers: string[] } | null>(null);

  const [theme, setTheme] = useState<Theme>('light');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [undoPanelOpen, setUndoPanelOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

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
  const navGroups: NavGroup[] = [
    {
      key: 'core', label: 'Workflow', items: [
        { key: 'home', label: 'Home' },
        { key: 'export', label: 'Export' },
        { key: 'import', label: 'Import' },
        { key: 'convert', label: 'Convert' },
      ],
    },
    {
      key: 'migration', label: 'Migration', items: [
        { key: 'migration/projects', label: 'Migration Projects' },
        { key: 'migration/validation', label: 'Migration Validation' },
        { key: 'migration/reports', label: 'Migration Reports' },
        { key: 'migration/templates', label: 'Migration Templates' },
        { key: 'migration/idMaps', label: 'ID Maps' },
      ],
    },
    {
      key: 'extras', label: 'Library', items: [
        { key: 'templates', label: 'Templates' },
        { key: 'schedules', label: 'Schedules' },
        { key: 'diff', label: 'Compare' },
      ],
    },
    {
      key: 'advanced', label: 'Advanced', items: [
        { key: 'advanced/index', label: 'Advanced Tools' },
      ],
    },
  ];

  const pinnedItems: NavItem[] = [
    { key: 'help', label: 'Help' },
    { key: 'settings', label: 'Settings' },
  ];

  const navItems: NavItem[] = [
    ...navGroups.flatMap(g => g.items),
    ...pinnedItems,
  ];

  // Advanced tools live behind the hub (not in the sidebar) but stay reachable
  // from the command palette so power users can jump straight to them.
  const advancedToolItems: NavItem[] = [
    { key: 'advanced/objects', label: 'Objects' },
    { key: 'advanced/inspector', label: 'Record Inspector' },
    { key: 'advanced/apex', label: 'Anonymous Apex' },
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
    'migration/projects': true,
    'migration/validation': true,
    'advanced/objects': true,
    'advanced/inspector': true,
    'advanced/apex': true,
    'advanced/cleanse': true,
    'advanced/testData': true,
    'advanced/schemaCompare': true,
    'advanced/fieldAnalytics': true,
    'advanced/duplicates': true,
    'advanced/pipeline': true,
    'advanced/clone': true,
    'advanced/quality': true,
    'advanced/apiUsage': true,
    'advanced/bulkOps': true,
    'advanced/relationships': true,
  };

  // Aliases for legacy routes used by HelpScreen / OnboardingWizard / older code paths.
  const LEGACY_ROUTE_ALIASES: Record<string, string> = {
    push: 'import',
    query: 'export',
    cleanse: 'advanced/cleanse',
    objects: 'advanced/objects',
    history: 'advanced/history',
    clone: 'advanced/clone',
    duplicates: 'advanced/duplicates',
    pipeline: 'advanced/pipeline',
    pipelines: 'advanced/pipeline',
    quality: 'advanced/quality',
    apiUsage: 'advanced/apiUsage',
    bulkOps: 'advanced/bulkOps',
    relationships: 'advanced/relationships',
    schemaCompare: 'advanced/schemaCompare',
    'schema-compare': 'advanced/schemaCompare',
    fieldAnalytics: 'advanced/fieldAnalytics',
    'org-health': 'advanced/quality',
    testData: 'advanced/testData',
    compare: 'diff',
    migrationProjects: 'migration/projects',
    migrationValidation: 'migration/validation',
    migrationReports: 'migration/reports',
    migrationTemplates: 'migration/templates',
    idMaps: 'migration/idMaps',
  };

  const effectiveRoute = LEGACY_ROUTE_ALIASES[route] ?? route;
  const needsTab = !selectedTabId && requiresTab[effectiveRoute];

  function renderScreen(): VNode {
    const route = effectiveRoute; // shadow outer route inside this fn

    if (needsTab) {
      return (
        <div class="wl-card">
          <div class="wl-cardSection">
            <div class="wl-emptyState">
              <div class="wl-emptyState__icon">🌊</div>
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
    if (route === 'export') return <ExportScreen sf={sf} tabId={selectedTabId!} context={context ?? undefined} soql={soql} onSoqlChange={setSoql} onNavigate={setRoute} />;
    if (route === 'import') return (
      <ImportScreen
        sf={sf}
        tabId={selectedTabId!}
        dataset={dataset}
        cleanedRecords={cleaned?.records ?? null}
        cleanedHeaders={cleaned?.headers ?? null}
        onDataset={setDataset}
        onRequestCleanser={() => setRoute('advanced/cleanse')}
        onNavigate={setRoute}
      />
    );
    if (route === 'convert') return <ConvertScreen />;
    if (route === 'templates') return <ExportImportTemplatesScreen sf={sf} />;
    if (route === 'schedules') return <SchedulesScreen sf={sf} />;
    if (route === 'diff') return <CompareScreen sf={sf} />;

    // ── Migration suite (top-level) ──
    if (route === 'migration/projects' && activeProjectId) return <MigrationWorkspaceScreen sf={sf} tabId={selectedTabId!} projectId={activeProjectId} onBack={() => setActiveProjectId(null)} />;
    if (route === 'migration/projects') return <MigrationProjectsScreen sf={sf} onOpenProject={(id) => setActiveProjectId(id)} />;
    if (route === 'migration/validation' && activeProjectId) return <MigrationValidationScreen sf={sf} tabId={selectedTabId!} projectId={activeProjectId} onBack={() => setActiveProjectId(null)} />;
    if (route === 'migration/validation') return <MigrationProjectsScreen sf={sf} onOpenProject={(id) => { setActiveProjectId(id); setRoute('migration/validation'); }} />;
    if (route === 'migration/reports') return <MigrationReportsScreen sf={sf} />;
    if (route === 'migration/templates') return <MigrationTemplatesScreen sf={sf} />;
    if (route === 'migration/idMaps') return <IdMapViewerScreen sf={sf} />;

    // ── Advanced hub + tools ──
    if (route === 'advanced/index') return <AdvancedLabScreen onNavigate={setRoute} />;
    if (route === 'advanced/query') return <QueryScreen sf={sf} tabId={selectedTabId!} context={context ?? undefined} soql={soql} onSoqlChange={setSoql} onInspectId={openInspector} />;
    if (route === 'advanced/objects') return (
      <ObjectsScreen sf={sf} tabId={selectedTabId!} onInsertToken={(token) => setSoql(prev => `${prev}${prev.endsWith(' ') ? '' : ' '}${token}`)} />
    );
    if (route === 'advanced/inspector') return <RecordInspectorScreen sf={sf} tabId={selectedTabId!} initialId={inspectId} />;
    if (route === 'advanced/apex') return <ApexRunnerScreen sf={sf} tabId={selectedTabId!} />;
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
    if (route === 'advanced/apiUsage') return <ApiUsageDashboardScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/bulkOps') return <BulkObjectOpsScreen sf={sf} tabId={selectedTabId!} />;
    if (route === 'advanced/relationships') return <RelationshipExplorerScreen sf={sf} tabId={selectedTabId!} />;

    // Pinned
    if (route === 'help') return <HelpScreen sf={sf} onNavigate={setRoute} />;
    if (route === 'settings') return <SettingsScreen sf={sf} mode="app" />;

    // Fallback
    return <HomeScreen sf={sf} hasOrg={Boolean(selectedTabId && context)} onNavigate={setRoute} />;
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
        navGroups={navGroups}
        pinnedItems={pinnedItems}
        route={route}
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
        {effectiveRoute.startsWith('advanced/') && effectiveRoute !== 'advanced/index' ? (
          <button
            class="wl-btn"
            style="margin-bottom:12px"
            onClick={() => setRoute('advanced/index')}
          >
            ← Back to Advanced
          </button>
        ) : null}
        <Suspense
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
        commands={[...navItems, ...advancedToolItems].map(n => ({
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
        />
      ) : null}

      {toast ? <Toast title={toast.title} onClose={() => setToast(null)}>{toast.body}</Toast> : null}
    </>
  );
}
