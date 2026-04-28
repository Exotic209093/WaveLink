/**
 * Storage round-trip tests for Migration Projects, ID Maps, and Migration Templates.
 *
 * Drives the actual StorageService against the chrome.storage.local mock so that
 * regressions in the persistence layer (e.g. wrong storage key, broken upsert
 * semantics, ID map entry overwrites) are caught before they ship.
 */

import { storageMock } from '../mocks/chromeMock';
import { StorageService } from '../../src/services/storage';
import type { MigrationProject, IdMap, IdMapEntry, MigrationTemplate } from '../../src/core/types/migration';

function makeProject(overrides: Partial<MigrationProject> = {}): Omit<MigrationProject, 'createdAt' | 'updatedAt'> {
  return {
    id: 'mig_test_1',
    name: 'Dev → UAT',
    sourceOrgId: 'src',
    targetOrgId: 'tgt',
    objects: [],
    status: 'draft',
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<MigrationTemplate> = {}): Omit<MigrationTemplate, 'createdAt' | 'updatedAt'> {
  return {
    id: 'tpl_1',
    name: 'Standard Account+Contact',
    objects: [
      { objectName: 'Account', operation: 'insert', fieldMappings: [] },
      { objectName: 'Contact', operation: 'insert', fieldMappings: [] },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  // Reset the in-memory chrome.storage between tests
  storageMock.local = {};
  storageMock.session = {};
});

describe('StorageService — migration projects', () => {
  it('returns an empty list when no projects have been saved', async () => {
    const svc = new StorageService();
    expect(await svc.getMigrationProjects()).toEqual([]);
  });

  it('upsert + get round-trips a project and stamps timestamps', async () => {
    const svc = new StorageService();
    const created = await svc.upsertMigrationProject(makeProject());

    expect(created.createdAt).toEqual(expect.any(Number));
    expect(created.updatedAt).toEqual(expect.any(Number));

    const fetched = await svc.getMigrationProject('mig_test_1');
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Dev → UAT');
  });

  it('upsert updates an existing project in place rather than creating a duplicate', async () => {
    const svc = new StorageService();
    await svc.upsertMigrationProject(makeProject());
    await svc.upsertMigrationProject(makeProject({ name: 'Renamed' }));

    const list = await svc.getMigrationProjects();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Renamed');
  });

  it('preserves createdAt across updates but advances updatedAt', async () => {
    const svc = new StorageService();
    const a = await svc.upsertMigrationProject(makeProject());
    await new Promise(r => setTimeout(r, 5));
    const b = await svc.upsertMigrationProject(makeProject({ name: 'v2' }));

    expect(b.createdAt).toBe(a.createdAt);
    expect(b.updatedAt).toBeGreaterThanOrEqual(a.updatedAt);
  });

  it('deleteMigrationProject removes only the matching id', async () => {
    const svc = new StorageService();
    await svc.upsertMigrationProject(makeProject({ id: 'a' }));
    await svc.upsertMigrationProject(makeProject({ id: 'b' }));

    await svc.deleteMigrationProject('a');
    const list = await svc.getMigrationProjects();
    expect(list.map(p => p.id)).toEqual(['b']);
  });

  it('getMigrationProject returns null for an unknown id', async () => {
    const svc = new StorageService();
    expect(await svc.getMigrationProject('nope')).toBeNull();
  });
});

describe('StorageService — ID maps', () => {
  function emptyMap(id = 'map_1'): IdMap {
    return {
      id,
      name: `Map ${id}`,
      sourceOrgId: 'src',
      targetOrgId: 'tgt',
      entries: {},
      objectCounts: {},
      createdAt: 1,
      updatedAt: 1,
    };
  }

  function entry(sourceId: string, targetId: string, objectName: string): IdMapEntry {
    return { sourceId, targetId, objectName, createdAt: Date.now() };
  }

  it('returns an empty list before any maps are created', async () => {
    const svc = new StorageService();
    expect(await svc.getIdMaps()).toEqual([]);
    expect(await svc.getIdMap('nope')).toBeNull();
  });

  it('createIdMap persists an empty map that round-trips', async () => {
    const svc = new StorageService();
    await svc.createIdMap(emptyMap());

    const fetched = await svc.getIdMap('map_1');
    expect(fetched?.id).toBe('map_1');
    expect(fetched?.entries).toEqual({});
  });

  it('addIdMapEntries accumulates entries and bumps per-object counts', async () => {
    const svc = new StorageService();
    await svc.createIdMap(emptyMap());

    await svc.addIdMapEntries('map_1', [
      entry('001old1', '001new1', 'Account'),
      entry('001old2', '001new2', 'Account'),
      entry('003old1', '003new1', 'Contact'),
    ]);

    const fetched = await svc.getIdMap('map_1');
    expect(Object.keys(fetched!.entries)).toHaveLength(3);
    expect(fetched!.entries['001old1'].targetId).toBe('001new1');
    expect(fetched!.objectCounts).toEqual({ Account: 2, Contact: 1 });
  });

  it('addIdMapEntries supports incremental additions across calls', async () => {
    const svc = new StorageService();
    await svc.createIdMap(emptyMap());

    await svc.addIdMapEntries('map_1', [entry('s1', 't1', 'Account')]);
    await svc.addIdMapEntries('map_1', [entry('s2', 't2', 'Account')]);

    const fetched = await svc.getIdMap('map_1');
    expect(Object.keys(fetched!.entries)).toEqual(expect.arrayContaining(['s1', 's2']));
    expect(fetched!.objectCounts.Account).toBe(2);
  });

  it('addIdMapEntries throws when the target map does not exist', async () => {
    const svc = new StorageService();
    await expect(svc.addIdMapEntries('missing', [entry('s', 't', 'Account')])).rejects.toThrow(/not found/);
  });

  it('deleteIdMap removes the map and leaves siblings untouched', async () => {
    const svc = new StorageService();
    await svc.createIdMap(emptyMap('keep'));
    await svc.createIdMap(emptyMap('drop'));

    await svc.deleteIdMap('drop');
    const all = await svc.getIdMaps();
    expect(all.map(m => m.id)).toEqual(['keep']);
  });
});

describe('StorageService — migration templates', () => {
  it('round-trips a template through upsert + list', async () => {
    const svc = new StorageService();
    const created = await svc.upsertMigrationTemplate(makeTemplate());
    expect(created.createdAt).toEqual(expect.any(Number));

    const list = await svc.getMigrationTemplates();
    expect(list).toHaveLength(1);
    expect(list[0].objects.map(o => o.objectName)).toEqual(['Account', 'Contact']);
  });

  it('upsert updates an existing template instead of duplicating', async () => {
    const svc = new StorageService();
    await svc.upsertMigrationTemplate(makeTemplate());
    await svc.upsertMigrationTemplate(makeTemplate({ name: 'Renamed' }));

    const list = await svc.getMigrationTemplates();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Renamed');
  });

  it('deleteMigrationTemplate removes the matching id only', async () => {
    const svc = new StorageService();
    await svc.upsertMigrationTemplate(makeTemplate({ id: 'tpl_keep' }));
    await svc.upsertMigrationTemplate(makeTemplate({ id: 'tpl_drop' }));

    await svc.deleteMigrationTemplate('tpl_drop');
    const list = await svc.getMigrationTemplates();
    expect(list.map(t => t.id)).toEqual(['tpl_keep']);
  });
});
