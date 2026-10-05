import { h } from 'preact';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { axe } from 'jest-axe';
import { Wavey } from '../../src/ui/components/Wavey';
import { DataPushScreen } from '../../src/ui/screens/DataPushScreen';
import { SfApi } from '../../src/ui/api/sf';

describe('Wavey mascot', () => {
  test('is decorative: hidden from assistive technology and has no axe violations', async () => {
    const { container } = render(<div><Wavey mood="wave" /><p>No activity yet</p></div>);
    const svg = container.querySelector('svg.wl-wavey')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(await axe(container)).toHaveNoViolations();
  });

  test('gives every instance unique gradient and clip-path ids', () => {
    const { container } = render(<div><Wavey /><Wavey mood="happy" /><Wavey mood="curious" /></div>);
    const ids = [...container.querySelectorAll('[id]')].map(el => el.id);
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(ids.length);
    // Each instance references only its own gradient.
    const fills = [...container.querySelectorAll('svg')].map(svg => svg.querySelector('path[fill^="url("]')!.getAttribute('fill'));
    expect(new Set(fills).size).toBe(3);
  });

  test('renders the requested mood and size', () => {
    const { container } = render(<Wavey mood="happy" size={56} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-mood')).toBe('happy');
    expect(svg.getAttribute('width')).toBe('56');
    expect(svg.getAttribute('height')).toBe('61');
  });
});

describe('Import success celebration', () => {
  function mockSfApi(): void {
    const responses: Record<string, unknown> = {
      describeGlobal: { sobjects: [{ name: 'Account', label: 'Account', createable: true, updateable: true, deletable: true }] },
      describeSObject: { name: 'Account', childRelationships: [], fields: [{
        name: 'Name', label: 'Account Name', type: 'string', length: 255, required: false, createable: true, updateable: true,
        nillable: true, defaultValue: null, externalId: false, unique: false,
      }] },
      listTemplates: [], getPushHistory: [], getPushTransactions: [], listActivePushes: [],
      startDataPush: { pushId: 'p1', strategy: 'rest' },
    };
    for (const name of Object.getOwnPropertyNames(SfApi.prototype)) {
      if (name === 'constructor' || typeof (SfApi.prototype as unknown as Record<string, unknown>)[name] !== 'function') continue;
      jest.spyOn(SfApi.prototype as never, name as never).mockImplementation((async () => responses[name] ?? {}) as never);
    }
  }

  async function broadcast(type: string, payload: unknown): Promise<void> {
    const listeners = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls.map(call => call[0] as (...args: unknown[]) => unknown);
    await act(async () => {
      for (const listener of listeners) listener({ type, payload, requestId: `req-${type}` }, {}, () => undefined);
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (chrome.runtime.onMessage.addListener as jest.Mock).mockClear();
    mockSfApi();
  });

  async function startPush(): Promise<void> {
    render(
      <DataPushScreen
        sf={new SfApi('app')}
        tabId={7}
        dataset={{ sourceRecords: [{ Name: 'A' }, { Name: 'B' }], headers: ['Name'], filename: 'a.json', format: 'json' }}
        cleanedRecords={null}
        cleanedHeaders={null}
        onDataset={() => undefined}
        onRequestCleanser={() => undefined}
      />,
    );
    const next = await screen.findByRole('button', { name: 'Continue to mapping' });
    await waitFor(() => expect(next).not.toBeDisabled());
    fireEvent.click(next);
    const apply = await screen.findByRole('button', { name: 'Apply mapping and continue' });
    await waitFor(() => expect(apply).not.toBeDisabled());
    fireEvent.click(apply);
    fireEvent.click(await screen.findByRole('button', { name: 'Validate and review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Review confirmation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start Push' }));
    await waitFor(() => expect(SfApi.prototype.startDataPush).toHaveBeenCalled());
  }

  test('shows Wavey and a success message only when every row succeeded', async () => {
    await startPush();
    await broadcast('DATA_PUSH_COMPLETE', { pushId: 'p1', totalRecords: 2, processedRecords: 2, failedRecords: 0, status: 'complete', errors: [] });
    expect(await screen.findByText('All 2 rows succeeded')).toBeInTheDocument();
    expect(document.querySelector('.wl-waveyCelebrate svg.wl-wavey[data-mood="happy"]')).not.toBeNull();
  }, 30_000);

  test('does not celebrate when any row failed', async () => {
    await startPush();
    await broadcast('DATA_PUSH_COMPLETE', { pushId: 'p1', totalRecords: 2, processedRecords: 2, failedRecords: 1, status: 'complete', errors: [{ recordIndex: 1, message: 'DUPLICATE_VALUE' }] });
    await screen.findByRole('button', { name: 'Download error file' });
    expect(screen.queryByText(/rows? succeeded$/)).not.toBeInTheDocument();
    expect(document.querySelector('.wl-waveyCelebrate')).toBeNull();
  }, 30_000);
});
