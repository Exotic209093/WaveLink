import { diffSchemas, diffToCsv, diffToHtml } from '../../src/ui/utils/schemaDiff';
import type { SchemaDiff } from '../../src/ui/utils/schemaDiff';

describe('diffSchemas', () => {
  describe('field categorization', () => {
    it('marks fields only in right as added', () => {
      const left: Array<{ name: string; [key: string]: unknown }> = [];
      const right = [{ name: 'NewField', type: 'string' }];
      const diff = diffSchemas(left, right, 'Left', 'Right');

      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].name).toBe('NewField');
      expect(diff.added[0].status).toBe('added');
      expect(diff.added[0].rightField).toBeDefined();
      expect(diff.added[0].leftField).toBeUndefined();
    });

    it('marks fields only in left as removed', () => {
      const left = [{ name: 'OldField', type: 'string' }];
      const right: Array<{ name: string; [key: string]: unknown }> = [];
      const diff = diffSchemas(left, right, 'Left', 'Right');

      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].name).toBe('OldField');
      expect(diff.removed[0].status).toBe('removed');
      expect(diff.removed[0].leftField).toBeDefined();
      expect(diff.removed[0].rightField).toBeUndefined();
    });

    it('marks fields in both with different type as changed', () => {
      const left = [{ name: 'Status', type: 'string', label: 'Status' }];
      const right = [{ name: 'Status', type: 'picklist', label: 'Status' }];
      const diff = diffSchemas(left, right, 'Left', 'Right');

      expect(diff.changed).toHaveLength(1);
      expect(diff.changed[0].name).toBe('Status');
      expect(diff.changed[0].status).toBe('changed');
      expect(diff.changed[0].changedProperties).toContain('type');
    });

    it('marks fields in both with same properties as unchanged', () => {
      const left = [{ name: 'Name', type: 'string', label: 'Name' }];
      const right = [{ name: 'Name', type: 'string', label: 'Name' }];
      const diff = diffSchemas(left, right, 'Left', 'Right');

      expect(diff.unchanged).toHaveLength(1);
      expect(diff.unchanged[0].name).toBe('Name');
      expect(diff.unchanged[0].status).toBe('unchanged');
      expect(diff.unchanged[0].changedProperties).toHaveLength(0);
    });
  });

  describe('mixed scenarios', () => {
    it('handles a mix of added, removed, changed, and unchanged fields', () => {
      const left = [
        { name: 'Unchanged', type: 'string' },
        { name: 'Changed', type: 'string', length: 100 },
        { name: 'Removed', type: 'boolean' },
      ];
      const right = [
        { name: 'Unchanged', type: 'string' },
        { name: 'Changed', type: 'string', length: 255 },
        { name: 'Added', type: 'date' },
      ];
      const diff = diffSchemas(left, right, 'Org A', 'Org B');

      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].name).toBe('Added');
      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].name).toBe('Removed');
      expect(diff.changed).toHaveLength(1);
      expect(diff.changed[0].name).toBe('Changed');
      expect(diff.changed[0].changedProperties).toContain('length');
      expect(diff.unchanged).toHaveLength(1);
      expect(diff.unchanged[0].name).toBe('Unchanged');
    });
  });

  describe('summary', () => {
    it('provides correct counts in summary', () => {
      const left = [
        { name: 'A', type: 'string' },
        { name: 'B', type: 'string' },
        { name: 'C', type: 'int' },
      ];
      const right = [
        { name: 'A', type: 'string' },
        { name: 'B', type: 'boolean' },
        { name: 'D', type: 'date' },
      ];
      const diff = diffSchemas(left, right, 'L', 'R');

      expect(diff.summary.total).toBe(4); // A, B, C, D
      expect(diff.summary.added).toBe(1); // D
      expect(diff.summary.removed).toBe(1); // C
      expect(diff.summary.changed).toBe(1); // B
    });
  });

  describe('labels', () => {
    it('stores labels in the result', () => {
      const diff = diffSchemas([], [], 'Source Org', 'Target Org');
      expect(diff.leftLabel).toBe('Source Org');
      expect(diff.rightLabel).toBe('Target Org');
    });
  });

  describe('edge cases', () => {
    it('returns empty diff for two empty arrays', () => {
      const diff = diffSchemas([], [], 'Left', 'Right');

      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.changed).toHaveLength(0);
      expect(diff.unchanged).toHaveLength(0);
      expect(diff.summary.total).toBe(0);
      expect(diff.summary.added).toBe(0);
      expect(diff.summary.removed).toBe(0);
      expect(diff.summary.changed).toBe(0);
    });
  });
});

describe('diffToCsv', () => {
  const baseDiff: SchemaDiff = diffSchemas(
    [
      { name: 'Name', type: 'string' },
      { name: 'Status', type: 'string' },
    ],
    [
      { name: 'Name', type: 'string' },
      { name: 'Status', type: 'picklist' },
      { name: 'NewField', type: 'date' },
    ],
    'Left Org',
    'Right Org',
  );

  it('returns CSV with a header row', () => {
    const csv = diffToCsv(baseDiff);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Field,Status,Changed Properties,Left Type,Right Type');
  });

  it('contains field names and statuses', () => {
    const csv = diffToCsv(baseDiff);
    expect(csv).toContain('NewField');
    expect(csv).toContain('added');
    expect(csv).toContain('Status');
    expect(csv).toContain('changed');
    expect(csv).toContain('Name');
    expect(csv).toContain('unchanged');
  });

  it('includes changed properties in CSV output', () => {
    const csv = diffToCsv(baseDiff);
    expect(csv).toContain('type');
  });
});

describe('diffToHtml', () => {
  const baseDiff: SchemaDiff = diffSchemas(
    [{ name: 'Old', type: 'string' }],
    [{ name: 'New', type: 'date' }],
    'Prod',
    'Sandbox',
  );

  it('returns an HTML string with labels', () => {
    const html = diffToHtml(baseDiff);
    expect(html).toContain('<html>');
    expect(html).toContain('Prod');
    expect(html).toContain('Sandbox');
    expect(html).toContain('Prod vs Sandbox');
  });

  it('contains field names in the output', () => {
    const html = diffToHtml(baseDiff);
    expect(html).toContain('Old');
    expect(html).toContain('New');
  });

  it('contains summary counts', () => {
    const html = diffToHtml(baseDiff);
    expect(html).toContain('Added: 1');
    expect(html).toContain('Removed: 1');
  });
});
