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
import { STORAGE_KEYS, MAX_PUSH_HISTORY } from '../../core/constants';
import type { LocalStorageSchema, SessionStorageSchema, PushHistoryEntry, PushResult, SavedQuery, UiSettings } from '../../core/types/storage';
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

  /** Add a push history entry (maintains max size) */
  async addPushHistory(entry: PushHistoryEntry): Promise<void> {
    // Time: O(H) worst-case due to `unshift` + truncation; H is capped by MAX_PUSH_HISTORY.
    const history = await this.getPushHistory();
    history.unshift(entry);
    if (history.length > MAX_PUSH_HISTORY) {
      history.length = MAX_PUSH_HISTORY;
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
    const next: SavedQuery = {
      id: query.id,
      name: query.name,
      soql: query.soql,
      createdAt: query.createdAt ?? (idx >= 0 ? queries[idx].createdAt : now),
      updatedAt: now,
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
