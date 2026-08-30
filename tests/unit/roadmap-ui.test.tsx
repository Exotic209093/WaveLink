import { h } from 'preact';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { axe } from 'jest-axe';
import { JobsActivityScreen } from '../../src/ui/screens/JobsActivityScreen';
import { OnboardingWizard } from '../../src/ui/components/OnboardingWizard';
import { SnapshotCenterScreen } from '../../src/ui/screens/SnapshotCenterScreen';
import { OrgSwitcher } from '../../src/ui/components/OrgSwitcher';
import { formatRelative as formatScheduleRelative } from '../../src/ui/screens/SchedulesScreen';
import type { SfApi } from '../../src/ui/api/sf';

describe('roadmap workflow surfaces', () => {
  beforeEach(async () => chrome.storage.local.clear());

  test('schedule timestamps do not render "just now ago"', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(10_000);
    expect(formatScheduleRelative(9_000)).toBe('just now');
    expect(formatScheduleRelative(11_000)).toBe('just now');
    now.mockRestore();
  });

  test('Activity merges imports and scheduled runs with roadmap filters and details', async () => {
    await chrome.storage.local.set({
      pushHistory: [{ id: 'push-1', orgId: '00D-a', objectName: 'Account', operation: 'insert', totalRecords: 3, successCount: 2, failureCount: 1, startedAt: 1000, completedAt: 2000, errors: [{ recordIndex: 1, message: 'Required field missing' }] }],
      scheduledExports: [{ id: 'schedule-1', name: 'Weekly contacts', soql: 'SELECT Id FROM Contact', orgId: '00D-b', format: 'csv', interval: { unit: 'weeks', value: 1 }, enabled: true, retention: 4, createdAt: 1, updatedAt: 1 }],
      scheduleRunHistory: [{ id: 'run-1', scheduleId: 'schedule-1', startedAt: 3000, completedAt: 4000, status: 'success', recordCount: 12, nextRunAt: 5000 }],
      exportSnapshots: { snap: { id: 'snap', scheduleId: 'schedule-1', capturedAt: 4000, recordCount: 12, columns: ['Id'], records: [{ Id: '003' }], orgId: '00D-b', objectName: 'Contact' } },
    });
    const sf = { getPushTransactions: jest.fn().mockResolvedValue([]), listActivePushes: jest.fn().mockResolvedValue([]) } as unknown as SfApi;
    const { container } = render(<JobsActivityScreen sf={sf} onNavigate={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(/INSERT Account/)).toBeInTheDocument());
    expect(screen.getByText('Weekly contacts')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter activity source' }), { target: { value: 'Schedule' } });
    expect(screen.queryByText(/INSERT Account/)).not.toBeInTheDocument();
    expect(screen.getByText('Weekly contacts')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Snapshot Center filters a timeline by org and object', async () => {
    await chrome.storage.local.set({
      scheduledExports: [{ id: 's', name: 'Nightly', soql: 'SELECT Id FROM Account', orgId: '00D-a', format: 'csv', interval: { unit: 'days', value: 1 }, enabled: true, retention: 5, createdAt: 1, updatedAt: 1 }],
      exportSnapshots: {
        a: { id: 'a', scheduleId: 's', capturedAt: 2, recordCount: 1, columns: ['Id'], records: [{ Id: '001' }], orgId: '00D-a', objectName: 'Account' },
        b: { id: 'b', scheduleId: 's', capturedAt: 3, recordCount: 1, columns: ['Id'], records: [{ Id: '003' }], orgId: '00D-b', objectName: 'Contact' },
      },
    });
    const { container } = render(<SnapshotCenterScreen sf={{} as SfApi} onCreateImport={jest.fn()} onOpenSchedules={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('2 snapshots')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by snapshot org' }), { target: { value: '00D-b' } });
    expect(screen.getByText('1 snapshots')).toBeInTheDocument();
    expect(screen.getByText(/org 00D-b/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Onboarding opens safe example data without claiming completion', async () => {
    const sf = { getOnboarding: jest.fn().mockResolvedValue({ completedSteps: [] }), setOnboarding: jest.fn().mockResolvedValue({}) } as unknown as SfApi;
    const onNavigate = jest.fn();
    const onOpenExample = jest.fn();
    render(<OnboardingWizard sf={sf} onDismiss={jest.fn()} onNavigate={onNavigate} onOpenExample={onOpenExample} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Query (0/2)' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Query (0/2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open guided example' }));
    expect(onOpenExample).toHaveBeenCalledWith('export');
    expect(onNavigate).toHaveBeenCalledWith('export');
    expect(sf.setOnboarding).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'I completed this' }));
    await waitFor(() => expect(sf.setOnboarding).toHaveBeenCalledWith({ completedSteps: ['run-query'] }));
  });

  test('Org switcher labels the connected tab context before it is saved', async () => {
    const sf = {
      listOrgs: jest.fn().mockResolvedValue({ orgs: [], activeOrgId: null }),
      getUiSettings: jest.fn().mockResolvedValue({}),
    } as unknown as SfApi;
    render(
      <OrgSwitcher
        sf={sf}
        context={{
          orgId: '00D-context',
          instanceUrl: 'https://example.my.salesforce.com',
          environment: 'production',
        }}
      />,
    );
    const trigger = await screen.findByRole('button', { name: /example\.my\.salesforce\.com.*PROD/ });
    fireEvent.click(trigger);
    expect(screen.getByText(/current Salesforce tab is connected for this session/i)).toBeInTheDocument();
  });
});
