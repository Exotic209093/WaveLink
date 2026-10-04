/**
 * Regression for #52: org-compare "Copy to target" must update Changed records
 * in place (by target Id) instead of inserting duplicates, and insert only
 * Added records. External ID match fields keep using a single upsert.
 */
import { h } from 'preact';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { DataComparisonScreen } from '../../src/ui/screens/DataComparisonScreen';
import type { SfApi } from '../../src/ui/api/sf';
import { buildCompareSyncPlan, diffRecords } from '../../src/ui/utils/dataDiff';

const SOURCE = '00DSOURCE';
const TARGET = '00DTARGET';

interface Fixture {
  fields: Array<{ name: string; label: string; type: string; externalId: boolean }>;
  source: Record<string, unknown>[];
  target: Record<string, unknown>[];
}

function makeSf(fixture: Fixture) {
  const queries: string[] = [];
  const startDataPush = jest.fn(async () => ({ pushId: 'p', strategy: 'rest' as const }));
  const sf = {
    listOrgs: async () => ({
      orgs: [
        { orgId: SOURCE, instanceUrl: 'https://src.my.salesforce.com', username: 'src@example.com', environment: 'sandbox' },
        { orgId: TARGET, instanceUrl: 'https://tgt.my.salesforce.com', username: 'tgt@example.com', environment: 'sandbox' },
      ],
      activeOrgId: SOURCE,
    }),
    crossOrgDescribeGlobal: async () => ({ sobjects: [{ name: 'Account', label: 'Account', queryable: true }] }),
    crossOrgDescribeSObject: async () => ({ name: 'Account', fields: fixture.fields }),
    crossOrgQuery: async (orgId: string, soql: string) => {
      queries.push(soql);
      const rows = orgId === SOURCE ? fixture.source : fixture.target;
      return { totalSize: rows.length, done: true, records: rows.map(r => ({ attributes: { type: 'Account' }, ...r })) };
    },
    startDataPush,
  } as unknown as SfApi;
  return { sf, queries, startDataPush };
}

async function runCompareAndCopy(sf: SfApi): Promise<void> {
  render(<DataComparisonScreen sf={sf} />);
  await screen.findAllByRole('option', { name: /src\.my\.salesforce\.com/ });
  fireEvent.change(screen.getByLabelText('Source Org'), { target: { value: SOURCE } });
  fireEvent.change(screen.getByLabelText('Target Org'), { target: { value: TARGET } });

  fireEvent.click(await screen.findByRole('button', { name: 'Load Common Objects' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Object to compare' }));
  fireEvent.mouseDown(await screen.findByRole('option', { name: /Account/ }));
  await screen.findByText(/COMPARE FIELDS/);

  fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Select All Syncable' }));
  fireEvent.click(screen.getByRole('button', { name: /Review 2 for Copy/ }));

  fireEvent.input(await screen.findByLabelText('Type COPY to confirm'), { target: { value: 'COPY' } });
}

const baseFields = [
  { name: 'Id', label: 'Account ID', type: 'id', externalId: false },
  { name: 'Name', label: 'Name', type: 'string', externalId: false },
  { name: 'Phone', label: 'Phone', type: 'phone', externalId: false },
];

describe('DataComparisonScreen copy to target (#52)', () => {
  test('inserts Added records and updates Changed records by target Id when matching on Name', async () => {
    const { sf, queries, startDataPush } = makeSf({
      fields: baseFields,
      source: [
        { Id: '001S00000000001', Name: 'Acme', Phone: '111' },
        { Id: '001S00000000002', Name: 'NewCo', Phone: '222' },
        { Id: '001S00000000003', Name: 'Same', Phone: '333' },
      ],
      target: [
        { Id: '001T00000000001', Name: 'Acme', Phone: '999' },
        { Id: '001T00000000003', Name: 'Same', Phone: '333' },
      ],
    });

    await runCompareAndCopy(sf);

    // Target Id is queried, but differing Ids are not reported as changes.
    expect(queries[0]).toMatch(/^SELECT Name, Phone, Id FROM Account/);
    expect(screen.getByText('Δ1 changed')).toBeTruthy();
    expect(screen.getByText('1 unchanged')).toBeTruthy();

    // Confirmation reflects the split.
    expect(screen.getByRole('dialog').textContent).toContain('1 insert, 1 update');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(startDataPush).toHaveBeenCalledTimes(2));

    expect(startDataPush).toHaveBeenCalledWith(expect.objectContaining({
      orgId: TARGET, objectName: 'Account', operation: 'insert', records: [{ Name: 'NewCo', Phone: '222' }],
    }));
    expect(startDataPush).toHaveBeenCalledWith(expect.objectContaining({
      orgId: TARGET, objectName: 'Account', operation: 'update', records: [{ Id: '001T00000000001', Phone: '111' }],
    }));
  });

  test('keeps a single upsert keyed on the External ID match field', async () => {
    const { sf, startDataPush } = makeSf({
      fields: [...baseFields, { name: 'Ext__c', label: 'Ext', type: 'string', externalId: true }],
      source: [
        { Id: '001S00000000001', Ext__c: 'A', Name: 'Acme', Phone: '111' },
        { Id: '001S00000000002', Ext__c: 'B', Name: 'NewCo', Phone: '222' },
      ],
      target: [
        { Id: '001T00000000001', Ext__c: 'A', Name: 'Acme', Phone: '999' },
      ],
    });

    await runCompareAndCopy(sf);
    expect(screen.getByRole('dialog').textContent).toContain('2 upserts by External ID');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(startDataPush).toHaveBeenCalledTimes(1));
    expect(startDataPush).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'upsert',
      externalIdField: 'Ext__c',
      records: [
        { Ext__c: 'B', Name: 'NewCo', Phone: '222' },
        { Ext__c: 'A', Name: 'Acme', Phone: '111' },
      ],
    }));
  });
});

describe('buildCompareSyncPlan', () => {
  test('skips Changed rows whose target record has no Id rather than inserting them', () => {
    const diff = diffRecords(
      [{ Name: 'Acme', Phone: '1' }],
      [{ Name: 'Acme', Phone: '2' }],
      'Name', ['Phone'], SOURCE, TARGET, 'Account',
    );
    const plan = buildCompareSyncPlan(diff, new Set(['Acme']), {});
    expect(plan.jobs).toEqual([]);
    expect(plan.skippedKeys).toEqual(['Acme']);
  });
});
