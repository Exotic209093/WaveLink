/**
 * Chrome extension storage service.
 * Provides typed, safe access to chrome.storage.local and chrome.storage.session.
 *
 * Why a wrapper:
 * - Centralizes key names and default shapes.
 * - Converts chrome.storage errors into typed `StorageError`s with context.
 *
 * Data types:
 * - local: persistent data such as org metadata, schema cache, history, UI settings.
 * - session: ephemeral data such as active tokens (`activeTokens`).
 *
 * Complexity:
 * - Most methods are O(1) in JS work, with I/O dominated by chrome.storage.
 * - History operations are O(H) where H is the number of stored history entries (capped).
 */

import { StorageError } from '../../core/errors';
import { STORAGE_KEYS, MAX_PUSH_HISTORY, MAX_UNDO_ENTRIES } from '../../core/constants';
import type { LocalStorageSchema, SessionStorageSchema, PushHistoryEntry, PushResult, ActivePush, SavedQuery, QueryFolder, UiSettings, DataTemplate, PushTransaction, Pipeline, QualityRuleSet, OnboardingProgress } from '../../core/types/storage';
import type { MigrationProject, IdMap, IdMapEntry, MigrationTemplate, MigrationSummaryReport } from '../../core/types/migration';
import type { SalesforceOrg } from '../../core/types/salesforce';

/**
 * StorageService abstracts chrome.storage operations with type safety.
 */
export class StorageService {
  // ── Org Management ───────────────────────────────────────────────

  /** Get all connected orgs */
  async getOrgs(): Promise<Record<string, SalesforceOrg>> {
    // Time: O(1) JS work (storage I/O). Data: orgs keyed by `orgId`.
    const data = await this.getLocal<Record<string, SalesforceOrg>>(STORAGE_KEYS.ORGS);
    return data ?? {};
  }

  /** Get a specific org by ID */
  async getOrg(orgId: string): Promise<SalesforceOrg | null> {
    const orgs = await this.getOrgs();
    return orgs[orgId] ?? null;
  }

  /** Save or update an org */
  async saveOrg(org: SalesforceOrg): Promise<void> {
    const orgs = await this.getOrgs();
    orgs[org.orgId] = org;
    await this.setLocal(STORAGE_KEYS.ORGS, orgs);
  }

  /** Remove an org */
  async removeOrg(orgId: string): Promise<void> {
    const orgs = await this.getOrgs();
    delete orgs[orgId];
    await this.setLocal(STORAGE_KEYS.ORGS, orgs);

    // If this was the active org, clear it
    const activeOrgId = await this.getActiveOrgId();
    if (activeOrgId === orgId) {
      await this.setActiveOrgId(null);
    }
  }

  /** Get the active org ID */
  async getActiveOrgId(): Promise<string | null> {
    return this.getLocal<string | null>(STORAGE_KEYS.ACTIVE_ORG_ID) ?? null;
  }

  /** Set the active org ID */
  async setActiveOrgId(orgId: string | null): Promise<void> {
    await this.setLocal(STORAGE_KEYS.ACTIVE_ORG_ID, orgId);
  }

  /** Get the active org (convenience) */
  async getActiveOrg(): Promise<SalesforceOrg | null> {
    const orgId = await this.getActiveOrgId();
    if (!orgId) return null;
    return this.getOrg(orgId);
  }

  // ── Push History ─────────────────────────────────────────────────

  /** Get push history */
  async getPushHistory(): Promise<PushHistoryEntry[]> {
    return (await this.getLocal<PushHistoryEntry[]>(STORAGE_KEYS.PUSH_HISTORY)) ?? [];
  }

  /** Add a push history entry (maintains max size, respects user-configured limit) */
  async addPushHistory(entry: PushHistoryEntry): Promise<void> {
    // Time: O(H) worst-case due to `unshift` + truncation; H is capped by limit.
    const history = await this.getPushHistory();
    const settings = await this.getUiSettings();
    const limit = settings.pushHistoryLimit ?? MAX_PUSH_HISTORY;
    history.unshift(entry);
    if (history.length > limit) {
      history.length = limit;
    }
    await this.setLocal(STORAGE_KEYS.PUSH_HISTORY, history);
  }

  // ── Saved Queries ─────────────────────────────────────────────────

  async getSavedQueries(): Promise<SavedQuery[]> {
    return (await this.getLocal<SavedQuery[]>(STORAGE_KEYS.SAVED_QUERIES)) ?? [];
  }

  async upsertSavedQuery(query: Omit<SavedQuery, 'createdAt' | 'updatedAt'> & Partial<Pick<SavedQuery, 'createdAt' | 'updatedAt'>>): Promise<SavedQuery> {
    const now = Date.now();
    const queries = await this.getSavedQueries();
    const idx = queries.findIndex(q => q.id === query.id);
    const existing = idx >= 0 ? queries[idx] : null;
    const next: SavedQuery = {
      id: query.id,
      name: query.name,
      soql: query.soql,
      createdAt: query.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
      folderId: query.folderId ?? existing?.folderId,
      favorite: query.favorite ?? existing?.favorite,
      tags: query.tags ?? existing?.tags,
      executionCount: query.executionCount ?? existing?.executionCount,
      lastExecutedAt: query.lastExecutedAt ?? existing?.lastExecutedAt,
    };
    if (idx >= 0) {
      queries[idx] = next;
    } else {
      queries.unshift(next);
    }
    await this.setLocal(STORAGE_KEYS.SAVED_QUERIES, queries);
    return next;
  }

  async deleteSavedQuery(id: string): Promise<void> {
    const queries = await this.getSavedQueries();
    await this.setLocal(STORAGE_KEYS.SAVED_QUERIES, queries.filter(q => q.id !== id));
  }

  async incrementQueryExecution(id: string): Promise<void> {
    const queries = await this.getSavedQueries();
    const idx = queries.findIndex(q => q.id === id);
    if (idx >= 0) {
      queries[idx].executionCount = (queries[idx].executionCount ?? 0) + 1;
      queries[idx].lastExecutedAt = Date.now();
      await this.setLocal(STORAGE_KEYS.SAVED_QUERIES, queries);
    }
  }

  // ── Query Folders ─────────────────────────────────────────────────

  async getQueryFolders(): Promise<QueryFolder[]> {
    return (await this.getLocal<QueryFolder[]>(STORAGE_KEYS.QUERY_FOLDERS)) ?? [];
  }

  async upsertQueryFolder(folder: Omit<QueryFolder, 'createdAt'> & Partial<Pick<QueryFolder, 'createdAt'>>): Promise<QueryFolder> {
    const now = Date.now();
    const folders = await this.getQueryFolders();
    const idx = folders.findIndex(f => f.id === folder.id);
    const next: QueryFolder = {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt ?? (idx >= 0 ? folders[idx].createdAt : now),
    };
    if (idx >= 0) {
      folders[idx] = next;
    } else {
      folders.push(next);
    }
    await this.setLocal(STORAGE_KEYS.QUERY_FOLDERS, folders);
    return next;
  }

  async deleteQueryFolder(id: string): Promise<void> {
    const folders = await this.getQueryFolders();
    const queries = await this.getSavedQueries();

    // Remove folder
    await this.setLocal(STORAGE_KEYS.QUERY_FOLDERS, folders.filter(f => f.id !== id));

    // Remove folderId from queries in this folder
    const updated = queries.map(q => {
      if (q.folderId === id) {
        const { folderId, ...rest } = q;
        return rest;
      }
      return q;
    });
    await this.setLocal(STORAGE_KEYS.SAVED_QUERIES, updated);
  }

  // ── UI Settings ───────────────────────────────────────────────────

  async getUiSettings(): Promise<UiSettings> {
    const existing = await this.getLocal<UiSettings>(STORAGE_KEYS.UI_SETTINGS);
    return existing ?? {
      panelWidth: 420,
      panelDock: 'right',
      panelPinned: true,
    };
  }

  async setUiSettings(patch: Partial<UiSettings>): Promise<UiSettings> {
    const current = await this.getUiSettings();
    const next: UiSettings = { ...current, ...patch };
    await this.setLocal(STORAGE_KEYS.UI_SETTINGS, next);
    return next;
  }

  // ── Data Templates ──────────────────────────────────────────────

  /** Get all saved data templates */
  async getDataTemplates(): Promise<LocalStorageSchema['dataTemplates']> {
    return (await this.getLocal<LocalStorageSchema['dataTemplates']>(STORAGE_KEYS.DATA_TEMPLATES)) ?? [];
  }

  /** Save a data template */
  async saveDataTemplate(template: LocalStorageSchema['dataTemplates'][number]): Promise<void> {
    const templates = await this.getDataTemplates();
    const existingIndex = templates.findIndex(t => t.id === template.id);
    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }
    await this.setLocal(STORAGE_KEYS.DATA_TEMPLATES, templates);
  }

  /** Delete a data template */
  async deleteDataTemplate(templateId: string): Promise<void> {
    const templates = await this.getDataTemplates();
    const filtered = templates.filter(t => t.id !== templateId);
    await this.setLocal(STORAGE_KEYS.DATA_TEMPLATES, filtered);
  }

  /** Upsert a data template with timestamps */
  async upsertDataTemplate(template: Omit<DataTemplate, 'createdAt' | 'updatedAt'> & Partial<Pick<DataTemplate, 'createdAt' | 'updatedAt'>>): Promise<DataTemplate> {
    const now = Date.now();
    const templates = await this.getDataTemplates();
    const idx = templates.findIndex(t => t.id === template.id);
    const existing = idx >= 0 ? templates[idx] : null;
    const next: DataTemplate = {
      ...template,
      createdAt: template.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (idx >= 0) {
      templates[idx] = next;
    } else {
      templates.push(next);
    }
    await this.setLocal(STORAGE_KEYS.DATA_TEMPLATES, templates);
    return next;
  }

  /** Increment template usage count */
  async incrementTemplateUsage(id: string): Promise<void> {
    const templates = await this.getDataTemplates();
    const idx = templates.findIndex(t => t.id === id);
    if (idx >= 0) {
      templates[idx].usageCount = (templates[idx].usageCount ?? 0) + 1;
      templates[idx].lastUsedAt = Date.now();
      await this.setLocal(STORAGE_KEYS.DATA_TEMPLATES, templates);
    }
  }

  // ── Push Transactions (Undo) ──────────────────────────────────────

  async getPushTransactions(): Promise<PushTransaction[]> {
    return (await this.getLocal<PushTransaction[]>(STORAGE_KEYS.PUSH_TRANSACTIONS)) ?? [];
  }

  async addPushTransaction(t: PushTransaction): Promise<void> {
    const now = Date.now();
    const list = (await this.getPushTransactions())
      .filter(tx => tx.expiresAt > now);
    list.unshift(t);
    if (list.length > MAX_UNDO_ENTRIES) {
      list.length = MAX_UNDO_ENTRIES;
    }
    await this.setLocal(STORAGE_KEYS.PUSH_TRANSACTIONS, list);
  }

  async removePushTransaction(id: string): Promise<void> {
    const list = await this.getPushTransactions();
    await this.setLocal(STORAGE_KEYS.PUSH_TRANSACTIONS, list.filter(t => t.id !== id));
  }

  // ── Pipelines ─────────────────────────────────────────────────────

  async getPipelines(): Promise<Pipeline[]> {
    return (await this.getLocal<Pipeline[]>(STORAGE_KEYS.PIPELINES)) ?? [];
  }

  async upsertPipeline(pipeline: Omit<Pipeline, 'createdAt' | 'updatedAt'> & Partial<Pick<Pipeline, 'createdAt' | 'updatedAt'>>): Promise<Pipeline> {
    const now = Date.now();
    const list = await this.getPipelines();
    const idx = list.findIndex(p => p.id === pipeline.id);
    const existing = idx >= 0 ? list[idx] : null;
    const next: Pipeline = {
      ...pipeline,
      createdAt: pipeline.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (idx >= 0) {
      list[idx] = next;
    } else {
      list.push(next);
    }
    await this.setLocal(STORAGE_KEYS.PIPELINES, list);
    return next;
  }

  async deletePipeline(id: string): Promise<void> {
    const list = await this.getPipelines();
    await this.setLocal(STORAGE_KEYS.PIPELINES, list.filter(p => p.id !== id));
  }

  // ── Quality Rule Sets ──────────────────────────────────────────

  async getQualityRuleSets(): Promise<QualityRuleSet[]> {
    return (await this.getLocal<QualityRuleSet[]>(STORAGE_KEYS.QUALITY_RULE_SETS)) ?? [];
  }

  async upsertQualityRuleSet(ruleSet: Omit<QualityRuleSet, 'createdAt' | 'updatedAt'> & Partial<Pick<QualityRuleSet, 'createdAt' | 'updatedAt'>>): Promise<QualityRuleSet> {
    const now = Date.now();
    const list = await this.getQualityRuleSets();
    const idx = list.findIndex(r => r.id === ruleSet.id);
    const existing = idx >= 0 ? list[idx] : null;
    const next: QualityRuleSet = {
      ...ruleSet,
      createdAt: ruleSet.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (idx >= 0) {
      list[idx] = next;
    } else {
      list.push(next);
    }
    await this.setLocal(STORAGE_KEYS.QUALITY_RULE_SETS, list);
    return next;
  }

  async deleteQualityRuleSet(id: string): Promise<void> {
    const list = await this.getQualityRuleSets();
    await this.setLocal(STORAGE_KEYS.QUALITY_RULE_SETS, list.filter(r => r.id !== id));
  }

  // ── Onboarding ─────────────────────────────────────────────────

  async getOnboarding(): Promise<OnboardingProgress> {
    return (await this.getLocal<OnboardingProgress>(STORAGE_KEYS.ONBOARDING)) ?? { completedSteps: [] };
  }

  async setOnboarding(progress: OnboardingProgress): Promise<void> {
    await this.setLocal(STORAGE_KEYS.ONBOARDING, progress);
  }

  // ── Migration Projects ──────────────────────────────────────────

  async getMigrationProjects(): Promise<MigrationProject[]> {
    return (await this.getLocal<MigrationProject[]>(STORAGE_KEYS.MIGRATION_PROJECTS)) ?? [];
  }

  async getMigrationProject(id: string): Promise<MigrationProject | null> {
    const projects = await this.getMigrationProjects();
    return projects.find(p => p.id === id) ?? null;
  }

  async upsertMigrationProject(
    project: Omit<MigrationProject, 'createdAt' | 'updatedAt'> & Partial<Pick<MigrationProject, 'createdAt' | 'updatedAt'>>,
  ): Promise<MigrationProject> {
    const now = Date.now();
    const list = await this.getMigrationProjects();
    const idx = list.findIndex(p => p.id === project.id);
    const existing = idx >= 0 ? list[idx] : null;
    const next: MigrationProject = {
      ...project,
      createdAt: project.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (idx >= 0) {
      list[idx] = next;
    } else {
      list.push(next);
    }
    await this.setLocal(STORAGE_KEYS.MIGRATION_PROJECTS, list);
    return next;
  }

  async deleteMigrationProject(id: string): Promise<void> {
    const list = await this.getMigrationProjects();
    await this.setLocal(STORAGE_KEYS.MIGRATION_PROJECTS, list.filter(p => p.id !== id));
  }

  // ── ID Maps ────────────────────────────────────────────────────

  async getIdMaps(): Promise<IdMap[]> {
    const all = (await this.getLocal<Record<string, IdMap>>(STORAGE_KEYS.ID_MAPS)) ?? {};
    return Object.values(all);
  }

  async getIdMap(id: string): Promise<IdMap | null> {
    const all = (await this.getLocal<Record<string, IdMap>>(STORAGE_KEYS.ID_MAPS)) ?? {};
    return all[id] ?? null;
  }

  async createIdMap(map: IdMap): Promise<IdMap> {
    const all = (await this.getLocal<Record<string, IdMap>>(STORAGE_KEYS.ID_MAPS)) ?? {};
    all[map.id] = map;
    await this.setLocal(STORAGE_KEYS.ID_MAPS, all);
    return map;
  }

  /** Add entries to an existing ID map. O(E) where E = entries to add. */
  async addIdMapEntries(mapId: string, entries: IdMapEntry[]): Promise<IdMap> {
    const all = (await this.getLocal<Record<string, IdMap>>(STORAGE_KEYS.ID_MAPS)) ?? {};
    const map = all[mapId];
    if (!map) throw new StorageError(`ID map not found: ${mapId}`, null);
    for (const entry of entries) {
      map.entries[entry.sourceId] = entry;
      map.objectCounts[entry.objectName] = (map.objectCounts[entry.objectName] ?? 0) + 1;
    }
    map.updatedAt = Date.now();
    all[mapId] = map;
    await this.setLocal(STORAGE_KEYS.ID_MAPS, all);
    return map;
  }

  async deleteIdMap(id: string): Promise<void> {
    const all = (await this.getLocal<Record<string, IdMap>>(STORAGE_KEYS.ID_MAPS)) ?? {};
    delete all[id];
    await this.setLocal(STORAGE_KEYS.ID_MAPS, all);
  }

  // ── Migration Templates (Phase 3) ───────────────────────────────

  async getMigrationTemplates(): Promise<MigrationTemplate[]> {
    return (await this.getLocal<MigrationTemplate[]>(STORAGE_KEYS.MIGRATION_TEMPLATES)) ?? [];
  }

  async upsertMigrationTemplate(
    template: Omit<MigrationTemplate, 'createdAt' | 'updatedAt'> & Partial<Pick<MigrationTemplate, 'createdAt' | 'updatedAt'>>,
  ): Promise<MigrationTemplate> {
    const now = Date.now();
    const list = await this.getMigrationTemplates();
    const idx = list.findIndex(t => t.id === template.id);
    const existing = idx >= 0 ? list[idx] : null;
    const next: MigrationTemplate = {
      ...template,
      createdAt: template.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (idx >= 0) {
      list[idx] = next;
    } else {
      list.push(next);
    }
    await this.setLocal(STORAGE_KEYS.MIGRATION_TEMPLATES, list);
    return next;
  }

  async deleteMigrationTemplate(id: string): Promise<void> {
    const list = await this.getMigrationTemplates();
    await this.setLocal(STORAGE_KEYS.MIGRATION_TEMPLATES, list.filter(t => t.id !== id));
  }

  // ── Migration Reports (Phase 2) ───────────────────────────────

  async getMigrationReports(): Promise<MigrationSummaryReport[]> {
    return (await this.getLocal<MigrationSummaryReport[]>(STORAGE_KEYS.MIGRATION_REPORTS)) ?? [];
  }

  async getMigrationReport(runId: string): Promise<MigrationSummaryReport | null> {
    const reports = await this.getMigrationReports();
    return reports.find(r => r.runId === runId) ?? null;
  }

  async saveMigrationReport(report: MigrationSummaryReport): Promise<void> {
    const reports = await this.getMigrationReports();
    const idx = reports.findIndex(r => r.runId === report.runId);
    if (idx >= 0) {
      reports[idx] = report;
    } else {
      reports.unshift(report);
    }
    // Keep at most 50 reports
    if (reports.length > 50) reports.length = 50;
    await this.setLocal(STORAGE_KEYS.MIGRATION_REPORTS, reports);
  }

  async deleteMigrationReport(runId: string): Promise<void> {
    const reports = await this.getMigrationReports();
    await this.setLocal(STORAGE_KEYS.MIGRATION_REPORTS, reports.filter(r => r.runId !== runId));
  }

  // ── Schema Cache ────────────────────────────────────────────────

  /** Get cached schema for an object */
  async getCachedSchema(orgId: string, objectName: string): Promise<unknown | null> {
    const cache = await this.getLocal<LocalStorageSchema['schemaCache']>(STORAGE_KEYS.SCHEMA_CACHE) ?? {};
    const key = `${orgId}:${objectName}`;
    const entry = cache[key];

    if (!entry) return null;

    // Check TTL
    if (Date.now() > entry.cachedAt + entry.ttl) {
      delete cache[key];
      await this.setLocal(STORAGE_KEYS.SCHEMA_CACHE, cache);
      return null;
    }

    return entry.data;
  }

  /** Clear cached schema. If orgId is provided, clears only that org's cache. */
  async clearSchemaCache(orgId?: string): Promise<number> {
    const cache = await this.getLocal<LocalStorageSchema['schemaCache']>(STORAGE_KEYS.SCHEMA_CACHE) ?? {};
    let cleared = 0;
    if (orgId) {
      for (const key of Object.keys(cache)) {
        if (key.startsWith(`${orgId}:`)) {
          delete cache[key];
          cleared++;
        }
      }
      await this.setLocal(STORAGE_KEYS.SCHEMA_CACHE, cache);
    } else {
      cleared = Object.keys(cache).length;
      await this.setLocal(STORAGE_KEYS.SCHEMA_CACHE, {});
    }
    return cleared;
  }

  /** Get storage usage in bytes */
  async getStorageUsage(): Promise<{ bytesInUse: number; quota: number }> {
    const bytesInUse = await chrome.storage.local.getBytesInUse(null);
    return { bytesInUse, quota: 10 * 1024 * 1024 };
  }

  /** Purge push history older than given age in ms and expired undo transactions */
  async purgeOldData(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<{ historyPurged: number; transactionsPurged: number }> {
    const cutoff = Date.now() - maxAgeMs;

    const history = await this.getPushHistory();
    const freshHistory = history.filter(h => h.completedAt > cutoff);
    const historyPurged = history.length - freshHistory.length;
    await this.setLocal(STORAGE_KEYS.PUSH_HISTORY, freshHistory);

    const transactions = await this.getPushTransactions();
    const now = Date.now();
    const liveTransactions = transactions.filter(t => t.expiresAt > now);
    const transactionsPurged = transactions.length - liveTransactions.length;
    await this.setLocal(STORAGE_KEYS.PUSH_TRANSACTIONS, liveTransactions);

    return { historyPurged, transactionsPurged };
  }

  /** Export user data as a JSON-serializable backup object */
  async exportUserData(): Promise<Record<string, unknown>> {
    const [savedQueries, queryFolders, dataTemplates, uiSettings, pipelines, qualityRuleSets] = await Promise.all([
      this.getSavedQueries(),
      this.getQueryFolders(),
      this.getDataTemplates(),
      this.getUiSettings(),
      this.getPipelines(),
      this.getQualityRuleSets(),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      savedQueries,
      queryFolders,
      dataTemplates,
      uiSettings,
      pipelines,
      qualityRuleSets,
    };
  }

  /** Import user data from a backup object. Replaces all matching storage keys. */
  async importUserData(data: Record<string, unknown>): Promise<{ imported: string[] }> {
    const imported: string[] = [];
    if (Array.isArray(data.savedQueries)) {
      await this.setLocal(STORAGE_KEYS.SAVED_QUERIES, data.savedQueries);
      imported.push('savedQueries');
    }
    if (Array.isArray(data.queryFolders)) {
      await this.setLocal(STORAGE_KEYS.QUERY_FOLDERS, data.queryFolders);
      imported.push('queryFolders');
    }
    if (Array.isArray(data.dataTemplates)) {
      await this.setLocal(STORAGE_KEYS.DATA_TEMPLATES, data.dataTemplates);
      imported.push('dataTemplates');
    }
    if (data.uiSettings && typeof data.uiSettings === 'object') {
      await this.setLocal(STORAGE_KEYS.UI_SETTINGS, data.uiSettings);
      imported.push('uiSettings');
    }
    if (Array.isArray(data.pipelines)) {
      await this.setLocal(STORAGE_KEYS.PIPELINES, data.pipelines);
      imported.push('pipelines');
    }
    if (Array.isArray(data.qualityRuleSets)) {
      await this.setLocal(STORAGE_KEYS.QUALITY_RULE_SETS, data.qualityRuleSets);
      imported.push('qualityRuleSets');
    }
    return { imported };
  }

  /** Cache schema data */
  async setCachedSchema(orgId: string, objectName: string, data: unknown, ttl: number): Promise<void> {
    const cache = await this.getLocal<LocalStorageSchema['schemaCache']>(STORAGE_KEYS.SCHEMA_CACHE) ?? {};
    cache[`${orgId}:${objectName}`] = {
      objectName,
      orgId,
      data,
      cachedAt: Date.now(),
      ttl,
    };
    await this.setLocal(STORAGE_KEYS.SCHEMA_CACHE, cache);
  }

  // ── Session Storage (ephemeral) ─────────────────────────────────

  /** Store an active token in session storage */
  async setSessionToken(orgId: string, token: string): Promise<void> {
    const tokens = await this.getSession<SessionStorageSchema['activeTokens']>(STORAGE_KEYS.ACTIVE_TOKENS) ?? {};
    tokens[orgId] = token;
    await this.setSession(STORAGE_KEYS.ACTIVE_TOKENS, tokens);
  }

  /** Clear session data */
  async clearSession(): Promise<void> {
    await chrome.storage.session.clear();
  }

  // -- Active Pushes (Durable checkpoints) -----------------------------------

  /**
   * Read durable checkpoint metadata, migrating the pre-v0.4 session shape once.
   * Checkpoints contain job IDs and counters only; credentials and source rows
   * remain session/file scoped.
   */
  private async getActivePushMap(): Promise<Record<string, ActivePush>> {
    const durable = (await this.getLocal<Record<string, ActivePush>>(STORAGE_KEYS.ACTIVE_PUSHES)) ?? {};
    if (Object.keys(durable).length > 0) return durable;
    const legacy = (await this.getSession<Record<string, ActivePush>>(STORAGE_KEYS.ACTIVE_PUSHES)) ?? {};
    if (Object.keys(legacy).length > 0) await this.setLocal(STORAGE_KEYS.ACTIVE_PUSHES, legacy);
    return legacy;
  }

  /** Store non-sensitive active-job metadata across browser restarts. */
  async setActivePush(push: ActivePush): Promise<void> {
    const all = await this.getActivePushMap();
    all[push.id] = push;
    await this.setLocal(STORAGE_KEYS.ACTIVE_PUSHES, all);
  }

  /** Update the status of a durable active-job checkpoint. */
  async updateActivePushStatus(pushId: string, status: ActivePush['status']): Promise<void> {
    const all = await this.getActivePushMap();
    if (all[pushId]) {
      all[pushId].status = status;
      all[pushId].updatedAt = Date.now();
      await this.setLocal(STORAGE_KEYS.ACTIVE_PUSHES, all);
    }
  }

  /** Merge a durable progress checkpoint into an active push entry. */
  async updateActivePush(pushId: string, patch: Partial<ActivePush>): Promise<void> {
    const all = await this.getActivePushMap();
    if (!all[pushId]) return;
    all[pushId] = { ...all[pushId], ...patch, id: pushId, updatedAt: Date.now() };
    await this.setLocal(STORAGE_KEYS.ACTIVE_PUSHES, all);
  }

  async getActivePush(pushId: string): Promise<ActivePush | null> {
    const all = await this.getActivePushMap();
    return all[pushId] ?? null;
  }

  /** Get all durable active-job checkpoints. */
  async getActivePushes(): Promise<ActivePush[]> {
    const all = await this.getActivePushMap();
    return Object.values(all);
  }

  /** Mark any "processing" pushes as interrupted (called on service worker startup) */
  async markInterruptedPushes(): Promise<number> {
    const all = await this.getActivePushMap();
    let count = 0;
    for (const push of Object.values(all)) {
      if (push.status === 'processing' || push.status === 'queued') {
        push.status = 'interrupted';
        push.lastError = push.resumeSupported
          ? 'The extension worker restarted. This Salesforce job can be resumed.'
          : 'The extension worker restarted. Re-run this local REST job from its source file.';
        push.updatedAt = Date.now();
        count++;
      }
    }
    if (count > 0) {
      await this.setLocal(STORAGE_KEYS.ACTIVE_PUSHES, all);
    }
    return count;
  }

  // -- Push Results (Session) -------------------------------------------------

  /**
   * Get a stored push result (session scoped).
   * Returns null if not found (or if the session was cleared).
   */
  async getPushResult(pushId: string): Promise<PushResult | null> {
    const all = (await this.getSession<Record<string, PushResult>>(STORAGE_KEYS.PUSH_RESULTS)) ?? {};
    return all[pushId] ?? null;
  }

  /**
   * Store a push result (session scoped) and evict older entries.
   * We cap this to avoid excessive session storage growth.
   */
  async setPushResult(result: PushResult, maxEntries: number = 20): Promise<void> {
    const all = (await this.getSession<Record<string, PushResult>>(STORAGE_KEYS.PUSH_RESULTS)) ?? {};
    all[result.pushId] = result;

    const entries = Object.values(all).sort((a, b) => b.capturedAt - a.capturedAt);
    const kept = entries.slice(0, maxEntries);
    const next: Record<string, PushResult> = {};
    for (const e of kept) next[e.pushId] = e;

    await this.setSession(STORAGE_KEYS.PUSH_RESULTS, next);
  }

  /** Remove a stored push result (session scoped). */
  async removePushResult(pushId: string): Promise<void> {
    const all = (await this.getSession<Record<string, PushResult>>(STORAGE_KEYS.PUSH_RESULTS)) ?? {};
    if (!(pushId in all)) return;
    delete all[pushId];
    await this.setSession(STORAGE_KEYS.PUSH_RESULTS, all);
  }

  // ── Low-Level Helpers ───────────────────────────────────────────

  private async getLocal<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return (result[key] as T) ?? null;
    } catch (error) {
      throw new StorageError(
        `Failed to read from local storage: ${key}`,
        error,
      );
    }
  }

  private async setLocal(key: string, value: unknown): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      throw new StorageError(
        `Failed to write to local storage: ${key}`,
        error,
      );
    }
  }

  private async getSession<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.session.get(key);
      return (result[key] as T) ?? null;
    } catch (error) {
      throw new StorageError(
        `Failed to read from session storage: ${key}`,
        error,
      );
    }
  }

  private async setSession(key: string, value: unknown): Promise<void> {
    try {
      await chrome.storage.session.set({ [key]: value });
    } catch (error) {
      throw new StorageError(
        `Failed to write to session storage: ${key}`,
        error,
      );
    }
  }
}
