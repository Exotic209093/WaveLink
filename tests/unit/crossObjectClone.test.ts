import {
  buildDependencyGraph,
  topologicalSort,
  detectCircularReferences,
  remapIds,
} from '../../src/ui/utils/crossObjectClone';
import type { CloneGraph } from '../../src/ui/utils/crossObjectClone';

describe('buildDependencyGraph', () => {
  it('builds a single node with no edges for an object with no references', () => {
    const describes = new Map([
      ['Account', {
        name: 'Account',
        fields: [
          { name: 'Name', type: 'string' },
          { name: 'Industry', type: 'picklist' },
        ],
      }],
    ]);
    const graph = buildDependencyGraph(describes, 'Account');

    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.has('Account')).toBe(true);
    expect(graph.edges).toHaveLength(0);
  });

  it('creates an edge when an object references another', () => {
    const describes = new Map([
      ['Contact', {
        name: 'Contact',
        fields: [
          { name: 'Name', type: 'string' },
          { name: 'AccountId', type: 'reference', referenceTo: ['Account'] },
        ],
      }],
      ['Account', {
        name: 'Account',
        fields: [
          { name: 'Name', type: 'string' },
        ],
      }],
    ]);
    const graph = buildDependencyGraph(describes, 'Contact');

    expect(graph.nodes.size).toBe(2);
    expect(graph.nodes.has('Contact')).toBe(true);
    expect(graph.nodes.has('Account')).toBe(true);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toEqual({ from: 'Contact', field: 'AccountId', to: 'Account' });
  });

  it('only includes objects present in the describes map', () => {
    const describes = new Map([
      ['Contact', {
        name: 'Contact',
        fields: [
          { name: 'AccountId', type: 'reference', referenceTo: ['Account'] },
          { name: 'OwnerId', type: 'reference', referenceTo: ['User'] },
        ],
      }],
      ['Account', {
        name: 'Account',
        fields: [{ name: 'Name', type: 'string' }],
      }],
      // User is NOT in describes
    ]);
    const graph = buildDependencyGraph(describes, 'Contact');

    expect(graph.nodes.has('Contact')).toBe(true);
    expect(graph.nodes.has('Account')).toBe(true);
    expect(graph.nodes.has('User')).toBe(false);
    // Edge to User is still created but User node is not added
    expect(graph.edges).toHaveLength(2);
  });

  it('traverses dependencies recursively', () => {
    const describes = new Map([
      ['OpportunityLineItem', {
        name: 'OpportunityLineItem',
        fields: [
          { name: 'OpportunityId', type: 'reference', referenceTo: ['Opportunity'] },
        ],
      }],
      ['Opportunity', {
        name: 'Opportunity',
        fields: [
          { name: 'AccountId', type: 'reference', referenceTo: ['Account'] },
        ],
      }],
      ['Account', {
        name: 'Account',
        fields: [{ name: 'Name', type: 'string' }],
      }],
    ]);
    const graph = buildDependencyGraph(describes, 'OpportunityLineItem');

    expect(graph.nodes.size).toBe(3);
    expect(graph.edges).toHaveLength(2);
  });
});

describe('topologicalSort', () => {
  it('sorts a linear dependency chain with dependencies first', () => {
    // A depends on B, B depends on C => insert order: C, B, A
    const describes = new Map([
      ['A', {
        name: 'A',
        fields: [{ name: 'BId', type: 'reference', referenceTo: ['B'] }],
      }],
      ['B', {
        name: 'B',
        fields: [{ name: 'CId', type: 'reference', referenceTo: ['C'] }],
      }],
      ['C', {
        name: 'C',
        fields: [{ name: 'Name', type: 'string' }],
      }],
    ]);
    const graph = buildDependencyGraph(describes, 'A');
    const sorted = topologicalSort(graph);

    expect(sorted).toHaveLength(3);
    // C must come before B, B must come before A
    expect(sorted.indexOf('C')).toBeLessThan(sorted.indexOf('B'));
    expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('A'));
  });

  it('returns all nodes when there are no dependencies', () => {
    const graph: CloneGraph = {
      nodes: new Map([
        ['X', { objectName: 'X', referenceFields: [] }],
        ['Y', { objectName: 'Y', referenceFields: [] }],
        ['Z', { objectName: 'Z', referenceFields: [] }],
      ]),
      edges: [],
    };
    const sorted = topologicalSort(graph);

    expect(sorted).toHaveLength(3);
    expect(sorted).toContain('X');
    expect(sorted).toContain('Y');
    expect(sorted).toContain('Z');
  });

  it('produces a valid ordering from a buildDependencyGraph result', () => {
    const describes = new Map([
      ['Contact', {
        name: 'Contact',
        fields: [{ name: 'AccountId', type: 'reference', referenceTo: ['Account'] }],
      }],
      ['Account', {
        name: 'Account',
        fields: [{ name: 'Name', type: 'string' }],
      }],
    ]);
    const graph = buildDependencyGraph(describes, 'Contact');
    const sorted = topologicalSort(graph);

    expect(sorted).toHaveLength(2);
    expect(sorted.indexOf('Account')).toBeLessThan(sorted.indexOf('Contact'));
  });
});

describe('detectCircularReferences', () => {
  it('returns empty array for a linear chain with no cycles', () => {
    const describes = new Map([
      ['A', {
        name: 'A',
        fields: [{ name: 'BId', type: 'reference', referenceTo: ['B'] }],
      }],
      ['B', {
        name: 'B',
        fields: [{ name: 'CId', type: 'reference', referenceTo: ['C'] }],
      }],
      ['C', {
        name: 'C',
        fields: [{ name: 'Name', type: 'string' }],
      }],
    ]);
    const graph = buildDependencyGraph(describes, 'A');
    const cycles = detectCircularReferences(graph);

    expect(cycles).toHaveLength(0);
  });

  it('detects A -> B -> A cycle', () => {
    const graph: CloneGraph = {
      nodes: new Map([
        ['A', { objectName: 'A', referenceFields: [{ field: 'BId', referenceTo: 'B' }] }],
        ['B', { objectName: 'B', referenceFields: [{ field: 'AId', referenceTo: 'A' }] }],
      ]),
      edges: [
        { from: 'A', field: 'BId', to: 'B' },
        { from: 'B', field: 'AId', to: 'A' },
      ],
    };
    const cycles = detectCircularReferences(graph);

    expect(cycles.length).toBeGreaterThan(0);
    // At least one cycle should mention both A and B
    const flatCycles = cycles.flat();
    expect(flatCycles).toContain('A');
    expect(flatCycles).toContain('B');
  });

  it('returns empty for a graph with no circular references', () => {
    const graph: CloneGraph = {
      nodes: new Map([
        ['Parent', { objectName: 'Parent', referenceFields: [] }],
        ['Child', { objectName: 'Child', referenceFields: [{ field: 'ParentId', referenceTo: 'Parent' }] }],
      ]),
      edges: [
        { from: 'Child', field: 'ParentId', to: 'Parent' },
      ],
    };
    const cycles = detectCircularReferences(graph);

    expect(cycles).toHaveLength(0);
  });
});

describe('remapIds', () => {
  it('maps old IDs to new IDs in reference fields', () => {
    const records = [
      { Id: 'new_001', AccountId: 'old_A1', Name: 'Contact1' },
      { Id: 'new_002', AccountId: 'old_A2', Name: 'Contact2' },
    ];
    const idMap = new Map([
      ['old_A1', 'new_A1'],
      ['old_A2', 'new_A2'],
    ]);
    const result = remapIds(records, idMap, ['AccountId']);

    expect(result[0].AccountId).toBe('new_A1');
    expect(result[1].AccountId).toBe('new_A2');
  });

  it('leaves non-reference fields unchanged', () => {
    const records = [
      { Id: 'new_001', AccountId: 'old_A1', Name: 'Contact1' },
    ];
    const idMap = new Map([['old_A1', 'new_A1']]);
    const result = remapIds(records, idMap, ['AccountId']);

    expect(result[0].Name).toBe('Contact1');
    expect(result[0].Id).toBe('new_001');
  });

  it('leaves reference field unchanged when ID is not in the map', () => {
    const records = [
      { Id: 'new_001', AccountId: 'unknown_A1', Name: 'Contact1' },
    ];
    const idMap = new Map([['old_A1', 'new_A1']]);
    const result = remapIds(records, idMap, ['AccountId']);

    expect(result[0].AccountId).toBe('unknown_A1');
  });

  it('returns records unchanged when idMap is empty', () => {
    const records = [
      { Id: '001', AccountId: 'A1', OwnerId: 'U1' },
    ];
    const idMap = new Map<string, string>();
    const result = remapIds(records, idMap, ['AccountId', 'OwnerId']);

    expect(result[0].AccountId).toBe('A1');
    expect(result[0].OwnerId).toBe('U1');
  });

  it('remaps multiple reference fields on the same record', () => {
    const records = [
      { AccountId: 'old_A1', OwnerId: 'old_U1', Name: 'Test' },
    ];
    const idMap = new Map([
      ['old_A1', 'new_A1'],
      ['old_U1', 'new_U1'],
    ]);
    const result = remapIds(records, idMap, ['AccountId', 'OwnerId']);

    expect(result[0].AccountId).toBe('new_A1');
    expect(result[0].OwnerId).toBe('new_U1');
    expect(result[0].Name).toBe('Test');
  });
});
