import { h } from 'preact';
import type { VNode } from 'preact';
import { useState } from 'preact/hooks';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { AppRoot } from '../../src/ui/app/AppRoot';
import { DataPushScreen } from '../../src/ui/screens/DataPushScreen';
import { SfApi } from '../../src/ui/api/sf';
import type { SObjectField } from '../../src/core/types/salesforce';

function field(name: string, label: string): SObjectField {
  return {
    name, label, type: 'string', length: 255, required: false, createable: true, updateable: true,
    nillable: true, defaultValue: null, externalId: false, unique: false,
  };
}

const accountFields = [field('Name', 'Account Name'), field('Description', 'Description')];

function makeResponses(environment: 'production' | 'sandbox'): Record<string, unknown> {
  return {
    listTabs: [{ tabId: 7, title: 'Salesforce test tab', url: 'https://example.my.salesforce.com/lightning/page/home', hostname: 'example.my.salesforce.com' }],
    getContext: { orgId: '00D-test', username: 'tester@example.com', instanceUrl: 'https://example.my.salesforce.com', apiVersion: 'v61.0', environment },
    getUiSettings: { theme: 'light' }, getOnboarding: { completedSteps: [], dismissedAt: 1 },
    getStorageUsage: { bytesInUse: 0, quota: 10_485_760 }, listOrgs: { orgs: [], activeOrgId: null },
    describeGlobal: { sobjects: [{ name: 'Account', label: 'Account', createable: true, updateable: true, deletable: true }] },
    describeSObject: { name: 'Account', fields: accountFields, childRelationships: [] },
    listTemplates: [], listSavedQueries: [], listQueryFolders: [], getPushHistory: [],
    getPushTransactions: [], listActivePushes: [],
    startDataPush: { pushId: 'push-1', strategy: 'rest' },
  };
}

function mockSfApi(responses: Record<string, unknown>): void {
  for (const name of Object.getOwnPropertyNames(SfApi.prototype)) {
    if (name === 'constructor' || typeof (SfApi.prototype as unknown as Record<string, unknown>)[name] !== 'function') continue;
    jest.spyOn(SfApi.prototype as never, name as never).mockImplementation((async () => responses[name] ?? {}) as never);
  }
}

// jsdom's File lacks .text() in this jest version; the parsers only need these members.
function jsonFile(name: string, records: Array<Record<string, unknown>>): File {
  const content = JSON.stringify(records);
  return { name, size: content.length, type: 'application/json', text: async () => content } as unknown as File;
}

/** Dispatch a native event carrying `file` (fireEvent does not reach the screen's file handlers here). */
async function dispatchFile(target: Element, type: 'change' | 'drop', file: File): Promise<void> {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (type === 'drop') Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
  else Object.defineProperty(target, 'files', { value: [file], configurable: true });
  await act(async () => { target.dispatchEvent(event); });
}

async function navigate(route: string): Promise<void> {
  await act(async () => {
    window.location.hash = `#${route}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

/** Deliver a background broadcast to every live MessageBus listener. */
async function broadcast(type: string, payload: unknown): Promise<void> {
  const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls.map(call => call[0] as (...args: unknown[]) => unknown);
  await act(async () => {
    for (const listener of listeners) listener({ type, payload, requestId: `req-${type}` }, {}, () => undefined);
  });
}

function stepButton(label: string): HTMLButtonElement {
  return screen.getByRole('button', { name: new RegExp(`^\\d+\\s*${label}$`) }) as HTMLButtonElement;
}

/** Drive the staged Import flow from Configure to the confirmation modal. */
async function advanceToConfirmation(): Promise<void> {
  const next = await screen.findByRole('button', { name: 'Continue to mapping' });
  await waitFor(() => expect(next).not.toBeDisabled());
  fireEvent.click(next);
  const apply = await screen.findByRole('button', { name: 'Apply mapping and continue' });
  await waitFor(() => expect(apply).not.toBeDisabled());
  fireEvent.click(apply);
  fireEvent.click(await screen.findByRole('button', { name: 'Validate and review' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Review confirmation' }));
}

async function uploadOnImport(container: Element, file: File): Promise<void> {
  // The lazily loaded screen shows a drop zone without a dataset, or the
  // Configure card's file input once one is loaded.
  const target = await waitFor(() => {
    const found = container.querySelector('main .wl-dropZone, main input[type="file"][accept=".csv,.tsv,.json,.xlsx,.xml"]');
    if (!found) throw new Error('Import upload control not rendered yet');
    return found as HTMLElement;
  });
  await dispatchFile(target, target.classList.contains('wl-dropZone') ? 'drop' : 'change', file);
  await screen.findAllByText(new RegExp(file.name));
}

describe('import state invalidation', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (chrome.runtime.onMessage.addListener as jest.Mock).mockClear();
    await chrome.storage.local.clear();
    window.location.hash = '#home';
  });

  test('a file uploaded on Import after cleansing another file is pushed as itself (#44)', async () => {
    mockSfApi(makeResponses('sandbox'));
    const { container } = render(<AppRoot />);
    await navigate('advanced/cleanse');

    const cleanserInput = await screen.findByLabelText('Upload CSV or JSON file');
    await dispatchFile(cleanserInput, 'change', jsonFile('file-a.json', [{ Name: 'A1' }, { Name: 'A2' }, { Name: 'A3' }]));
    const applyCleanse = await screen.findByRole('button', { name: 'Apply cleanser changes' });
    await waitFor(() => expect(applyCleanse).not.toBeDisabled());
    fireEvent.click(applyCleanse);
    fireEvent.click(screen.getByRole('button', { name: 'Send dataset to Data Push' }));

    // The intended Cleanser -> Import hand-off still uses the cleaned rows.
    expect(await screen.findByText('Using cleaned records from Cleanser.')).toBeInTheDocument();

    await uploadOnImport(container, jsonFile('file-b.json', [{ Name: 'B1' }]));
    expect(screen.queryByText('Using cleaned records from Cleanser.')).not.toBeInTheDocument();

    await advanceToConfirmation();
    fireEvent.click(await screen.findByRole('button', { name: 'Start Push' }));
    await waitFor(() => expect(SfApi.prototype.startDataPush).toHaveBeenCalled());
    expect((SfApi.prototype.startDataPush as jest.Mock).mock.calls[0][0].records).toEqual([{ Name: 'B1' }]);
  }, 30_000);

  test.each(['import', 'advanced/push'])('production pushes from #%s require the typed confirmation phrase (#48)', async (route) => {
    mockSfApi(makeResponses('production'));
    const { container } = render(<AppRoot />);
    await navigate(route);
    await uploadOnImport(container, jsonFile('prod.json', [{ Name: 'P1' }, { Name: 'P2' }]));
    await advanceToConfirmation();

    expect(await screen.findByRole('dialog', { name: 'Confirm Production Data Push' })).toBeInTheDocument();
    expect(screen.getByLabelText('Type INSERT 2 Account to confirm')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Push' })).not.toBeInTheDocument();
  }, 30_000);

  describe('DataPushScreen dataset changes (#51)', () => {
    type Dataset = Parameters<typeof DataPushScreen>[0]['dataset'];

    function Harness(props: { initial: Dataset }): VNode {
      const [dataset, setDataset] = useState<Dataset>(props.initial);
      return (
        <DataPushScreen
          sf={new SfApi('app')}
          tabId={7}
          dataset={dataset}
          cleanedRecords={null}
          cleanedHeaders={null}
          onDataset={setDataset}
          onRequestCleanser={() => undefined}
        />
      );
    }

    const original: Dataset = {
      sourceRecords: [{ Org: 'Alpha', Code: '1' }, { Org: 'Beta', Code: '2' }, { Org: 'Gamma', Code: '3' }],
      headers: ['Org', 'Code'],
      filename: 'orgs.json',
      format: 'json',
    };

    function targetFor(container: Element, source: string): string {
      return container.querySelector(`[aria-label="Target field for ${source}"]`)?.textContent?.replace('▾', '').trim() ?? '';
    }

    test('Retry keeps the restored manual mappings and only re-pushes the failed rows', async () => {
      mockSfApi({
        ...makeResponses('sandbox'),
        // A saved mapping supplies the manual "Org -> Name" choice that automap would not make.
        listTemplates: [{
          id: 't1', name: 'Org map', objectName: 'Account',
          fieldMappings: [
            { sourceField: 'Org', targetField: 'Name', transformation: 'none', required: false },
            { sourceField: 'Code', targetField: '', transformation: 'none', required: false },
          ],
        }],
      });
      const { container } = render(<Harness initial={original} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Continue to mapping' }));
      await waitFor(() => expect(targetFor(container, 'Org')).toBe('(skip)'));
      fireEvent.click(await screen.findByRole('button', { name: 'Apply: Org map' }));
      expect(targetFor(container, 'Org')).toBe('Account Name');

      const apply = screen.getByRole('button', { name: 'Apply mapping and continue' });
      fireEvent.click(apply);
      fireEvent.click(await screen.findByRole('button', { name: 'Validate and review' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Review confirmation' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Start Push' }));
      await waitFor(() => expect(SfApi.prototype.startDataPush).toHaveBeenCalledTimes(1));
      expect((SfApi.prototype.startDataPush as jest.Mock).mock.calls[0][0].records).toHaveLength(3);

      await broadcast('DATA_PUSH_COMPLETE', {
        pushId: 'push-1', totalRecords: 3, processedRecords: 3, failedRecords: 1, status: 'complete',
        errors: [{ recordIndex: 1, message: 'DUPLICATE_VALUE' }],
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Retry Failed Rows' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Generate Retry Dataset' }));
      await screen.findByText(/retry-push-1\.json/);

      // The restored manual mapping must survive the dataset swap.
      expect(targetFor(container, 'Org')).toBe('Account Name');

      await advanceToConfirmation();
      fireEvent.click(await screen.findByRole('button', { name: 'Start Push' }));
      await waitFor(() => expect(SfApi.prototype.startDataPush).toHaveBeenCalledTimes(2));
      expect((SfApi.prototype.startDataPush as jest.Mock).mock.calls[1][0].records).toEqual([{ Name: 'Beta' }]);
    }, 30_000);

    test('Prepare Delete Push still hands the rollback IDs straight to Review', async () => {
      mockSfApi({
        ...makeResponses('sandbox'),
        getDataPushResult: { ids: ['001A', '001B'], capturedAt: 1 },
      });
      render(<Harness initial={{
        sourceRecords: [{ Name: 'A1' }, { Name: 'A2' }], headers: ['Name'], filename: 'a.json', format: 'json',
      }} />);
      await advanceToConfirmation();
      fireEvent.click(await screen.findByRole('button', { name: 'Start Push' }));
      await waitFor(() => expect(SfApi.prototype.startDataPush).toHaveBeenCalledTimes(1));
      await broadcast('DATA_PUSH_COMPLETE', { pushId: 'push-1', totalRecords: 2, processedRecords: 2, failedRecords: 0, status: 'complete' });

      fireEvent.click(await screen.findByRole('button', { name: 'Prepare Delete Push' }));
      await screen.findAllByText(/rollback-push-1\.json/);
      fireEvent.click(stepButton('Review'));
      fireEvent.click(await screen.findByRole('button', { name: 'Review confirmation' }));
      expect(await screen.findByLabelText('Type DELETE 2 RECORDS to confirm')).toBeInTheDocument();
    }, 30_000);

    test('Retry invalidates the previous mapped records so Review cannot re-push them', async () => {
      mockSfApi(makeResponses('sandbox'));
      render(<Harness initial={original} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Continue to mapping' }));
      const apply = await screen.findByRole('button', { name: 'Apply mapping and continue' });
      await waitFor(() => expect(apply).not.toBeDisabled());
      fireEvent.click(apply);
      fireEvent.click(await screen.findByRole('button', { name: 'Validate and review' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Review confirmation' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Start Push' }));
      await waitFor(() => expect(SfApi.prototype.startDataPush).toHaveBeenCalledTimes(1));

      await broadcast('DATA_PUSH_COMPLETE', {
        pushId: 'push-1', totalRecords: 3, processedRecords: 3, failedRecords: 1, status: 'complete',
        errors: [{ recordIndex: 1, message: 'DUPLICATE_VALUE' }],
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Retry Failed Rows' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Generate Retry Dataset' }));
      await screen.findByText(/retry-push-1\.json/);

      // Review was reachable for the old dataset; it must not be for the new one.
      expect(stepButton('Review')).toBeDisabled();
      expect(stepButton('Mapping')).toBeDisabled();
      expect(await screen.findByRole('button', { name: 'Continue to mapping' })).toBeInTheDocument();
    }, 30_000);

    test('uploading a new file after validation forces the new file through mapping again', async () => {
      mockSfApi(makeResponses('sandbox'));
      const { container } = render(<Harness initial={{
        sourceRecords: [{ Name: 'A1' }, { Name: 'A2' }, { Name: 'A3' }], headers: ['Name'], filename: 'a.json', format: 'json',
      }} />);
      await advanceToConfirmation();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(stepButton('Review')).not.toBeDisabled();

      await dispatchFile(container.querySelector('input[type="file"]')!, 'change', jsonFile('b.json', [{ Name: 'B1' }]));
      await screen.findAllByText(/b\.json/);

      expect(stepButton('Review')).toBeDisabled();
      await advanceToConfirmation();
      fireEvent.click(await screen.findByRole('button', { name: 'Start Push' }));
      await waitFor(() => expect(SfApi.prototype.startDataPush).toHaveBeenCalled());
      expect((SfApi.prototype.startDataPush as jest.Mock).mock.calls[0][0].records).toEqual([{ Name: 'B1' }]);
    }, 30_000);
  });
});
