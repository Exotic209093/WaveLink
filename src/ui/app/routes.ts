export const APP_ROUTES = {
  home: 'home',
  export: 'export',
  import: 'import',
  convert: 'convert',
  jobs: 'jobs',
  templates: 'templates',
  schedules: 'schedules',
  snapshots: 'snapshots',
  diff: 'diff',
  copy: 'copy',
  advancedIndex: 'advanced/index',
  advancedQuery: 'advanced/query',
  advancedObjects: 'advanced/objects',
  advancedInspector: 'advanced/inspector',
  advancedApex: 'advanced/apex',
  advancedApi: 'advanced/api',
  advancedCleanse: 'advanced/cleanse',
  advancedPush: 'advanced/push',
  advancedHistory: 'advanced/history',
  advancedTestData: 'advanced/testData',
  advancedSchemaCompare: 'advanced/schemaCompare',
  advancedFieldAnalytics: 'advanced/fieldAnalytics',
  advancedDuplicates: 'advanced/duplicates',
  advancedPipeline: 'advanced/pipeline',
  advancedClone: 'advanced/clone',
  advancedQuality: 'advanced/quality',
  advancedOrgHealth: 'advanced/orgHealth',
  advancedApiUsage: 'advanced/apiUsage',
  advancedBulkOps: 'advanced/bulkOps',
  advancedRelationships: 'advanced/relationships',
  help: 'help',
  settings: 'settings',
} as const;

export type AppRoute = typeof APP_ROUTES[keyof typeof APP_ROUTES];

const KNOWN_ROUTES = new Set<string>(Object.values(APP_ROUTES));

/** Compatibility for saved links and older callers. New UI should use APP_ROUTES. */
export const LEGACY_ROUTE_ALIASES: Readonly<Record<string, AppRoute>> = {
  connect: APP_ROUTES.home,
  push: APP_ROUTES.import,
  query: APP_ROUTES.export,
  cleanse: APP_ROUTES.advancedCleanse,
  objects: APP_ROUTES.advancedObjects,
  history: APP_ROUTES.advancedHistory,
  clone: APP_ROUTES.advancedClone,
  duplicates: APP_ROUTES.advancedDuplicates,
  pipeline: APP_ROUTES.advancedPipeline,
  pipelines: APP_ROUTES.advancedPipeline,
  quality: APP_ROUTES.advancedQuality,
  apiUsage: APP_ROUTES.advancedApiUsage,
  bulkOps: APP_ROUTES.advancedBulkOps,
  relationships: APP_ROUTES.advancedRelationships,
  schemaCompare: APP_ROUTES.advancedSchemaCompare,
  'schema-compare': APP_ROUTES.advancedSchemaCompare,
  'schema-diff': APP_ROUTES.advancedSchemaCompare,
  fieldAnalytics: APP_ROUTES.advancedFieldAnalytics,
  'org-health': APP_ROUTES.advancedOrgHealth,
  testData: APP_ROUTES.advancedTestData,
  generate: APP_ROUTES.advancedTestData,
  compare: APP_ROUTES.diff,
  activity: APP_ROUTES.jobs,
  snapshotCenter: APP_ROUTES.snapshots,
  migrationProjects: APP_ROUTES.copy,
  migrationValidation: APP_ROUTES.copy,
  migrationReports: APP_ROUTES.copy,
  migrationTemplates: APP_ROUTES.copy,
  idMaps: APP_ROUTES.copy,
  'migration/projects': APP_ROUTES.copy,
  'migration/validation': APP_ROUTES.copy,
  'migration/reports': APP_ROUTES.copy,
  'migration/templates': APP_ROUTES.copy,
  'migration/idMaps': APP_ROUTES.copy,
};

/** Normalize old URL-style values and reject unknown destinations explicitly. */
export function resolveAppRoute(candidate: string): AppRoute | null {
  const normalized = candidate.trim().replace(/^\/+/, '');
  if (KNOWN_ROUTES.has(normalized)) return normalized as AppRoute;
  return LEGACY_ROUTE_ALIASES[normalized] ?? null;
}
