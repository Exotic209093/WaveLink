import type { QueryFolder, SavedQuery } from '../../src/core/types/storage';

describe('QueryFolder type', () => {
  describe('structure', () => {
    it('should create a valid QueryFolder object', () => {
      const folder: QueryFolder = {
        id: 'folder-1',
        name: 'My Queries',
        createdAt: Date.now(),
      };
      expect(folder.id).toBe('folder-1');
      expect(folder.name).toBe('My Queries');
      expect(typeof folder.createdAt).toBe('number');
    });

    it('should allow optional parentId for root folders', () => {
      const folder: QueryFolder = {
        id: 'folder-root',
        name: 'Root Folder',
        createdAt: Date.now(),
      };
      expect(folder.parentId).toBeUndefined();
    });

    it('should allow parentId for nested folders', () => {
      const folder: QueryFolder = {
        id: 'folder-child',
        name: 'Child Folder',
        parentId: 'folder-root',
        createdAt: Date.now(),
      };
      expect(folder.parentId).toBe('folder-root');
    });
  });

  describe('folder hierarchy', () => {
    it('should construct a parent-child folder hierarchy', () => {
      const rootFolder: QueryFolder = {
        id: 'root',
        name: 'All Queries',
        createdAt: Date.now(),
      };

      const childFolder: QueryFolder = {
        id: 'child-1',
        name: 'Account Queries',
        parentId: rootFolder.id,
        createdAt: Date.now(),
      };

      const grandchildFolder: QueryFolder = {
        id: 'grandchild-1',
        name: 'Active Accounts',
        parentId: childFolder.id,
        createdAt: Date.now(),
      };

      expect(childFolder.parentId).toBe(rootFolder.id);
      expect(grandchildFolder.parentId).toBe(childFolder.id);
      expect(rootFolder.parentId).toBeUndefined();
    });

    it('should find children of a folder by parentId', () => {
      const folders: QueryFolder[] = [
        { id: 'root', name: 'Root', createdAt: 1000 },
        { id: 'child-1', name: 'Child 1', parentId: 'root', createdAt: 2000 },
        { id: 'child-2', name: 'Child 2', parentId: 'root', createdAt: 3000 },
        { id: 'other', name: 'Other Root', createdAt: 4000 },
      ];

      const rootChildren = folders.filter(f => f.parentId === 'root');
      expect(rootChildren).toHaveLength(2);
      expect(rootChildren.map(f => f.id)).toEqual(['child-1', 'child-2']);

      const topLevelFolders = folders.filter(f => f.parentId === undefined);
      expect(topLevelFolders).toHaveLength(2);
    });
  });

  describe('SavedQuery folder assignment', () => {
    it('should assign a SavedQuery to a folder via folderId', () => {
      const folder: QueryFolder = {
        id: 'folder-1',
        name: 'My Queries',
        createdAt: Date.now(),
      };

      const query: SavedQuery = {
        id: 'query-1',
        name: 'Active Contacts',
        soql: 'SELECT Id, Name FROM Contact WHERE IsActive = true',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        folderId: folder.id,
      };

      expect(query.folderId).toBe(folder.id);
    });

    it('should allow queries without a folder', () => {
      const query: SavedQuery = {
        id: 'query-2',
        name: 'Unorganized Query',
        soql: 'SELECT Id FROM Account',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(query.folderId).toBeUndefined();
    });

    it('should filter queries by folder', () => {
      const queries: SavedQuery[] = [
        { id: 'q1', name: 'Q1', soql: 'SELECT Id FROM Account', createdAt: 1, updatedAt: 1, folderId: 'folder-1' },
        { id: 'q2', name: 'Q2', soql: 'SELECT Id FROM Contact', createdAt: 2, updatedAt: 2, folderId: 'folder-1' },
        { id: 'q3', name: 'Q3', soql: 'SELECT Id FROM Lead', createdAt: 3, updatedAt: 3, folderId: 'folder-2' },
        { id: 'q4', name: 'Q4', soql: 'SELECT Id FROM Case', createdAt: 4, updatedAt: 4 },
      ];

      const folder1Queries = queries.filter(q => q.folderId === 'folder-1');
      expect(folder1Queries).toHaveLength(2);

      const unfiledQueries = queries.filter(q => q.folderId === undefined);
      expect(unfiledQueries).toHaveLength(1);
      expect(unfiledQueries[0].id).toBe('q4');
    });
  });
});
