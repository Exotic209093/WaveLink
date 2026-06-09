/**
 * Tests for the record diff engine that powers the Compare flow
 * (both local file/snapshot and live-org modes share diffRecords).
 */

import { diffRecords, diffToCsv } from '../../src/ui/utils/dataDiff';

const source = [
  { Id: 'a', Name: 'Acme', Phone: '111' },
  { Id: 'b', Name: 'Beta', Phone: '222' }, // changed Phone in target
  { Id: 'c', Name: 'Gamma', Phone: '333' }, // only in source -> added
  { Id: '', Name: 'NoKey', Phone: '000' }, // empty match key -> skipped
];
const target = [
  { Id: 'a', Name: 'Acme', Phone: '111' }, // unchanged
  { Id: 'b', Name: 'Beta', Phone: '999' }, // changed
  { Id: 'd', Name: 'Delta', Phone: '444' }, // only in target -> removed
];

describe('diffRecords', () => {
  const diff = diffRecords(source, target, 'Id', ['Name', 'Phone'], 'srcOrg', 'tgtOrg', 'Account');

  it('classifies added / removed / changed / unchanged correctly', () => {
    expect(diff.added.map(d => d.keyValue)).toEqual(['c']);
    expect(diff.removed.map(d => d.keyValue)).toEqual(['d']);
    expect(diff.changed.map(d => d.keyValue)).toEqual(['b']);
    expect(diff.unchanged.map(d => d.keyValue)).toEqual(['a']);
  });

  it('records only the fields that changed, with source/target values', () => {
    const changed = diff.changed[0];
    expect(changed.changedFields).toEqual(['Phone']);
    expect(changed.fieldDiffs).toEqual({ Phone: { source: '222', target: '999' } });
  });

  it('skips records with an empty match key', () => {
    const keys = [...diff.added, ...diff.removed, ...diff.changed, ...diff.unchanged].map(d => d.keyValue);
    expect(keys).not.toContain('');
  });

  it('summarises counts (total spans both orgs; unchanged excluded from summary)', () => {
    // distinct keys: a, b, c (source) + d (target) = 4
    expect(diff.summary).toEqual({ total: 4, added: 1, removed: 1, changed: 1 });
    expect(diff.objectName).toBe('Account');
    expect(diff.matchField).toBe('Id');
    expect(diff.fields).toEqual(['Name', 'Phone']);
  });

  it('treats null/undefined and numbers as their stringified form when comparing', () => {
    const s = [{ Id: '1', Amount: 100, Note: null }];
    const t = [{ Id: '1', Amount: '100', Note: undefined }];
    const d = diffRecords(s, t, 'Id', ['Amount', 'Note'], 'a', 'b', 'Obj');
    expect(d.unchanged).toHaveLength(1);
    expect(d.changed).toHaveLength(0);
  });
});

describe('diffToCsv', () => {
  it('emits a header plus a row per added/removed/changed record and escapes quotes', () => {
    const d = diffRecords(
      [{ Id: 'x', Name: 'has "quote"' }],
      [],
      'Id',
      ['Name'],
      'a',
      'b',
      'Obj',
    );
    const csv = diffToCsv(d);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Id","Status","Changed Fields","Source:Name","Target:Name"');
    expect(lines[1]).toContain('"x","added"');
    expect(lines[1]).toContain('has ""quote"""'); // doubled quotes
    expect(lines).toHaveLength(2);
  });
});
