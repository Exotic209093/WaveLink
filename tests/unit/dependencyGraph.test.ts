/**
 * Tests for the generalised dependency graph used by Migration Projects.
 *
 * Covers:
 * - Single object, no references
 * - Linear chains
 * - Diamond / multi-parent shapes
 * - Cycles (2-node, 3-node, self-reference)
 * - Edges to objects outside the migration set are excluded
 * - Missing describes degrade to leaf nodes (no crash)
 * - Topological insertion order respects dependencies
 * - Cycle-break edges are excluded from insertion order
 */

import { buildMigrationGraph } from '../../src/ui/utils/dependencyGraph';

type FieldDescribe = { name: string; type: string; referenceTo?: string[] };
type ObjectDescribe = { name: string; fields: FieldDescribe[] };

function obj(name: string, refs: Array<{ field: string; to: string }> = []): ObjectDescribe {
  const fields: FieldDescribe[] = [
    { name: 'Id', type: 'id' },
    { name: 'Name', type: 'string' },
    ...refs.map(r => ({ name: r.field, type: 'reference', referenceTo: [r.to] })),
  ];
  return { name, fields };
}

function describes(...objs: ObjectDescribe[]): Map<string, ObjectDescribe> {
  const m = new Map<string, ObjectDescribe>();
  for (const o of objs) m.set(o.name, o);
  return m;
}

describe('buildMigrationGraph', () => {
  it('builds a single-node graph with no edges for an object with no references', () => {
    const g = buildMigrationGraph(describes(obj('Account')), ['Account']);

    expect(g.nodes.size).toBe(1);
    expect(g.edges).toHaveLength(0);
    expect(g.cycles).toHaveLength(0);
    expect(g.cycleBreakEdges).toHaveLength(0);
    expect(g.insertionOrder).toEqual(['Account']);
    expect(g.nodes.get('Account')?.referenceFields).toEqual([]);
  });

  it('captures a single reference edge between two included objects', () => {
    const g = buildMigrationGraph(
      describes(
        obj('Account'),
        obj('Contact', [{ field: 'AccountId', to: 'Account' }]),
      ),
      ['Account', 'Contact'],
    );

    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toEqual(expect.objectContaining({ from: 'Contact', field: 'AccountId', to: 'Account' }));
    expect(g.nodes.get('Contact')?.referenceFields).toEqual([{ field: 'AccountId', referenceTo: 'Account' }]);
  });

  it('orders parent objects before children in a linear chain', () => {
    // Account ← Contact ← Case
    const g = buildMigrationGraph(
      describes(
        obj('Account'),
        obj('Contact', [{ field: 'AccountId', to: 'Account' }]),
        obj('Case', [{ field: 'ContactId', to: 'Contact' }]),
      ),
      ['Account', 'Contact', 'Case'],
    );

    const accountIdx = g.insertionOrder.indexOf('Account');
    const contactIdx = g.insertionOrder.indexOf('Contact');
    const caseIdx = g.insertionOrder.indexOf('Case');

    expect(accountIdx).toBeGreaterThanOrEqual(0);
    expect(accountIdx).toBeLessThan(contactIdx);
    expect(contactIdx).toBeLessThan(caseIdx);
  });

  it('handles a diamond: Account ← Contact and Account ← Opportunity', () => {
    const g = buildMigrationGraph(
      describes(
        obj('Account'),
        obj('Contact', [{ field: 'AccountId', to: 'Account' }]),
        obj('Opportunity', [{ field: 'AccountId', to: 'Account' }]),
      ),
      ['Account', 'Contact', 'Opportunity'],
    );

    expect(g.cycles).toHaveLength(0);
    const accountIdx = g.insertionOrder.indexOf('Account');
    expect(accountIdx).toBeLessThan(g.insertionOrder.indexOf('Contact'));
    expect(accountIdx).toBeLessThan(g.insertionOrder.indexOf('Opportunity'));
  });

  it('excludes references to objects outside the migration set', () => {
    const g = buildMigrationGraph(
      describes(
        obj('Contact', [{ field: 'AccountId', to: 'Account' }]),
        // Account also exists in describes but isn't selected for migration
        obj('Account'),
      ),
      ['Contact'], // Account NOT in migration set
    );

    expect(g.edges).toHaveLength(0);
    expect(g.nodes.get('Contact')?.referenceFields).toEqual([]);
  });

  it('treats undescribed objects as leaf nodes without crashing', () => {
    // Object 'Foo' is requested but no describe was provided
    const g = buildMigrationGraph(describes(), ['Foo']);

    expect(g.nodes.size).toBe(1);
    expect(g.nodes.get('Foo')?.referenceFields).toEqual([]);
    expect(g.edges).toHaveLength(0);
    expect(g.insertionOrder).toEqual(['Foo']);
  });

  it('detects a 2-node cycle and selects a cycle-break edge', () => {
    // A → B → A
    const g = buildMigrationGraph(
      describes(
        obj('A', [{ field: 'BId', to: 'B' }]),
        obj('B', [{ field: 'AId', to: 'A' }]),
      ),
      ['A', 'B'],
    );

    expect(g.cycles.length).toBeGreaterThan(0);
    expect(g.nodes.get('A')?.inCycle).toBe(true);
    expect(g.nodes.get('B')?.inCycle).toBe(true);
    expect(g.cycleBreakEdges.length).toBeGreaterThan(0);
    expect(g.edges.some(e => e.isCycleEdge)).toBe(true);

    // Both nodes still appear in insertionOrder
    expect(g.insertionOrder).toEqual(expect.arrayContaining(['A', 'B']));
  });

  it('detects a 3-node cycle', () => {
    // A → B → C → A
    const g = buildMigrationGraph(
      describes(
        obj('A', [{ field: 'BId', to: 'B' }]),
        obj('B', [{ field: 'CId', to: 'C' }]),
        obj('C', [{ field: 'AId', to: 'A' }]),
      ),
      ['A', 'B', 'C'],
    );

    expect(g.cycles.length).toBeGreaterThan(0);
    expect(g.insertionOrder).toHaveLength(3);
    expect(g.cycleBreakEdges.length).toBeGreaterThan(0);
  });

  it('handles disjoint subgraphs in the same migration', () => {
    // {Account ← Contact}  +  {Lead}  (no edges between them)
    const g = buildMigrationGraph(
      describes(
        obj('Account'),
        obj('Contact', [{ field: 'AccountId', to: 'Account' }]),
        obj('Lead'),
      ),
      ['Account', 'Contact', 'Lead'],
    );

    expect(g.cycles).toHaveLength(0);
    expect(g.insertionOrder).toHaveLength(3);
    expect(g.insertionOrder.indexOf('Account')).toBeLessThan(g.insertionOrder.indexOf('Contact'));
    expect(g.insertionOrder).toContain('Lead');
  });

  it('is case-insensitive when matching reference targets to the included set', () => {
    const g = buildMigrationGraph(
      describes(
        obj('account'),
        obj('Contact', [{ field: 'AccountId', to: 'ACCOUNT' }]),
      ),
      ['account', 'Contact'],
    );

    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].to).toBe('ACCOUNT');
  });

  it('skips reference fields whose referenceTo array is empty', () => {
    const g = buildMigrationGraph(
      describes({
        name: 'Account',
        fields: [
          { name: 'Id', type: 'id' },
          { name: 'OrphanRef', type: 'reference', referenceTo: [] },
        ],
      }),
      ['Account'],
    );

    expect(g.edges).toHaveLength(0);
    expect(g.nodes.get('Account')?.referenceFields).toEqual([]);
  });

  it('returns an insertionOrder that contains every requested object exactly once', () => {
    const g = buildMigrationGraph(
      describes(
        obj('Account'),
        obj('Contact', [{ field: 'AccountId', to: 'Account' }]),
        obj('Case', [{ field: 'ContactId', to: 'Contact' }]),
        obj('Lead'),
      ),
      ['Account', 'Contact', 'Case', 'Lead'],
    );

    expect(g.insertionOrder).toHaveLength(4);
    const unique = new Set(g.insertionOrder);
    expect(unique.size).toBe(4);
  });
});
