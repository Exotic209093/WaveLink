import { h } from 'preact';
import { render, waitFor } from '@testing-library/preact';
import { AppShell, envBandState } from '../../src/ui/components/AppShell';
import { HomeScreen, describeInterval } from '../../src/ui/screens/HomeScreen';
import type { SfApi } from '../../src/ui/api/sf';

describe('environment band', () => {
  test('names the kind of org a write will reach', () => {
    expect(envBandState(undefined).key).toBe('none');
    expect(envBandState({ orgId: '00D', instanceUrl: 'https://x.my.salesforce.com', environment: 'production' }))
      .toMatchObject({ key: 'production', label: 'Production' });
    expect(envBandState({ orgId: '00D', instanceUrl: 'https://x--dev.sandbox.my.salesforce.com', environment: 'sandbox' }))
      .toMatchObject({ key: 'sandbox', label: 'Sandbox' });
    // An org whose type is unknown must never read as safe.
    expect(envBandState({ orgId: '00D', instanceUrl: 'https://x.my.salesforce.com' }).key).toBe('unknown');
  });

  test('renders in the app shell with a text label, not color alone', () => {
    const { container, getByText } = render(
      <AppShell
        mode="app"
        context={{ orgId: '00D', instanceUrl: 'https://x.my.salesforce.com', environment: 'production' }}
        navItems={[{ key: 'home', label: 'Home' }]}
        route="home"
        onRouteChange={() => undefined}
      >
        <p>content</p>
      </AppShell>,
    );
    expect(container.querySelector('.wl-app')?.getAttribute('data-env')).toBe('production');
    expect(getByText('Production')).toBeTruthy();
  });

  test('is not shown in the popup', () => {
    const { container } = render(
      <AppShell mode="popup" navItems={[]} route="home" onRouteChange={() => undefined}><p>x</p></AppShell>,
    );
    expect(container.querySelector('.wl-envBand')).toBeNull();
  });
});

describe('Home recent runs', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  test('shows written and failed counts for each write', async () => {
    await chrome.storage.local.set({
      pushHistory: [
        { id: 'p1', orgId: '00D', objectName: 'Product2', operation: 'upsert', totalRecords: 64, successCount: 0, failureCount: 64, startedAt: 1, completedAt: Date.now() - 7_200_000 },
        { id: 'p2', orgId: '00D', objectName: 'Account', operation: 'insert', totalRecords: 48, successCount: 48, failureCount: 0, startedAt: 1, completedAt: Date.now() - 60_000 * 26 },
      ],
    });
    const { findByText, container } = render(<HomeScreen sf={{} as SfApi} hasOrg onNavigate={() => undefined} />);
    expect(await findByText('Insert Account')).toBeTruthy();
    expect(await findByText('Upsert Product2')).toBeTruthy();
    await waitFor(() => expect(container.querySelectorAll('.wl-runResult[data-state="failed"]').length).toBe(1));
    expect(container.textContent).toContain('48 of 48 written');
    expect(container.textContent).toContain('64 failed');
  });

  test('flags start actions that need an org when none is connected', async () => {
    const { findAllByText } = render(<HomeScreen sf={{} as SfApi} hasOrg={false} onNavigate={() => undefined} />);
    expect((await findAllByText('Needs a connected org')).length).toBe(2);
  });

  test('describes schedule cadence in plain words', () => {
    expect(describeInterval({ kind: 'days', days: 7 })).toBe('Weekly');
    expect(describeInterval({ kind: 'days', days: 1 })).toBe('Daily');
    expect(describeInterval({ kind: 'hours', hours: 6 })).toBe('Every 6 hours');
    expect(describeInterval({ kind: 'minutes', minutes: 30 })).toBe('Every 30 minutes');
  });
});
