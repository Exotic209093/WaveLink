import { h } from 'preact';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { DataPushScreen } from '../../src/ui/screens/DataPushScreen';
import { SfApi } from '../../src/ui/api/sf';
import type { SObjectField } from '../../src/core/types/salesforce';

function field(partial: Partial<SObjectField> & { name: string }): SObjectField {
  return {
    label: partial.name, type: 'string', length: 255, required: false, createable: true, updateable: true,
    nillable: true, defaultValue: null, externalId: false, unique: false, ...partial,
  } as SObjectField;
}

// Account (the screen's default object) with a self-referencing parent lookup.
const describes: Record<string, SObjectField[]> = {
  Account: [
    field({ name: 'Name', label: 'Account Name' }),
    field({ name: 'Parent_Account__c', label: 'Parent Account', type: 'reference', referenceTo: ['Account'], relationshipName: 'Parent_Account__r' }),
    field({ name: 'Legacy_Code__c', label: 'Legacy Code' }),
    field({ name: 'Account_Key__c', label: 'Account Key', externalId: true }),
  ],
};

function mockSfApi(matchField: string): void {
  const responses: Record<string, unknown> = {
    describeGlobal: { sobjects: [{ name: 'Account', label: 'Account', createable: true, updateable: true, deletable: true }] },
    listTemplates: [{
      id: 't1', name: 'Account map', objectName: 'Account',
      fieldMappings: [
        { sourceField: 'Org', targetField: 'Name', transformation: 'none', required: false },
        {
          sourceField: 'Parent', targetField: 'Parent_Account__c', transformation: 'none', required: false,
          lookup: { mode: 'externalId', relationshipName: 'Parent_Account__r', matchField },
        },
      ],
    }],
    getPushHistory: [], getPushTransactions: [], listActivePushes: [],
  };
  for (const name of Object.getOwnPropertyNames(SfApi.prototype)) {
    if (name === 'constructor' || typeof (SfApi.prototype as unknown as Record<string, unknown>)[name] !== 'function') continue;
    jest.spyOn(SfApi.prototype as never, name as never).mockImplementation((async () => responses[name] ?? {}) as never);
  }
  jest.spyOn(SfApi.prototype, 'describeSObject').mockImplementation((async (objectName: string) => (
    { name: objectName, fields: describes[objectName] ?? [], childRelationships: [] }
  )) as never);
}

async function validateWithTemplate(): Promise<void> {
  render(
    <DataPushScreen
      sf={new SfApi('app')}
      tabId={7}
      dataset={{ sourceRecords: [{ Org: 'Acme West', Parent: 'A-1' }], headers: ['Org', 'Parent'], filename: 'accounts.json', format: 'json' }}
      cleanedRecords={null}
      cleanedHeaders={null}
      onDataset={() => undefined}
      onRequestCleanser={() => undefined}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to mapping' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Apply: Account map' }));
  // The referenced object's describe is fetched once a lookup mapping exists.
  await waitFor(() => expect(SfApi.prototype.describeSObject).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: 'Apply mapping and continue' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Validate and review' }));
}

describe('Import validation of relationship lookups (#50)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a lookup whose match field is not an External ID on the referenced object', async () => {
    mockSfApi('Legacy_Code__c');
    await validateWithTemplate();
    expect(await screen.findByText(/"Account\.Legacy_Code__c" is not an External ID or idLookup field/)).toBeInTheDocument();
  }, 30_000);

  test('accepts a lookup that matches on an External ID field', async () => {
    mockSfApi('Account_Key__c');
    await validateWithTemplate();
    expect(await screen.findByRole('button', { name: 'Review confirmation' })).toBeInTheDocument();
    expect(screen.queryByText(/not an External ID/)).not.toBeInTheDocument();
  }, 30_000);
});
