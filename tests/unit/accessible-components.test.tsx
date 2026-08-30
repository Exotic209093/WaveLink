import { h } from 'preact';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { axe } from 'jest-axe';
import { HelpTooltip } from '../../src/ui/components/HelpTooltip';
import { SearchableSelect } from '../../src/ui/components/SearchableSelect';
import { TypedConfirmModal } from '../../src/ui/components/TypedConfirmModal';
import { AppShell } from '../../src/ui/components/AppShell';
import { ImportScreen } from '../../src/ui/screens/ImportScreen';
import { SavedJobsScreen } from '../../src/ui/screens/SavedJobsScreen';
import { SnapshotCenterScreen } from '../../src/ui/screens/SnapshotCenterScreen';
import type { SfApi } from '../../src/ui/api/sf';

describe('accessible shared components', () => {
  test('SearchableSelect supports keyboard selection and has no axe violations', async () => {
    const onChange = jest.fn();
    const { container } = render(
      <SearchableSelect
        ariaLabel="Salesforce object"
        value=""
        onChange={onChange}
        options={[
          { value: 'Account', label: 'Account' },
          { value: 'Contact', label: 'Contact' },
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Salesforce object' });
    fireEvent.click(trigger);
    const search = screen.getByPlaceholderText('Search...');
    fireEvent.input(search, { target: { value: 'Contact' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('Contact');
    expect(await axe(container)).toHaveNoViolations();
  });

  test('HelpTooltip toggles from its named button and has no axe violations', async () => {
    const { container } = render(<HelpTooltip text="Helpful context" />);
    const button = screen.getByRole('button', { name: 'Show help' });

    fireEvent.click(button);
    expect(screen.getByText('Helpful context')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('TypedConfirmModal exposes a named dialog and requires the confirmation phrase', async () => {
    const onConfirm = jest.fn();
    const { container } = render(
      <TypedConfirmModal
        open
        title="Delete saved query"
        confirmationPhrase="DELETE"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      >
        This action cannot be undone.
      </TypedConfirmModal>,
    );

    expect(screen.getByRole('dialog', { name: 'Delete saved query' })).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'DELETE' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  test('AppShell exposes one primary navigation row and keeps parent destinations active', async () => {
    const onRouteChange = jest.fn();
    const { container } = render(
      <AppShell
        mode="app"
        navItems={[
          { key: 'home', label: 'Home' },
          { key: 'jobs', label: 'Jobs & Activity', activeRoutes: ['schedules', 'advanced/history'] },
        ]}
        pinnedItems={[{ key: 'help', label: 'Help' }]}
        route="schedules"
        onRouteChange={onRouteChange}
      >
        <h2>Schedules</h2>
      </AppShell>,
    );

    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Jobs & Activity' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onRouteChange).toHaveBeenCalledWith('home');
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Guided Import opens at the Upload stage with named controls and no axe violations', async () => {
    const sf = {
      listTemplates: jest.fn().mockResolvedValue([]),
      describeGlobal: jest.fn().mockResolvedValue({ sobjects: [] }),
      describeSObject: jest.fn().mockResolvedValue({ fields: [] }),
    } as unknown as SfApi;
    const { container } = render(
      <ImportScreen
        sf={sf}
        tabId={1}
        context={{ orgId: '00D-preview', instanceUrl: 'https://example.my.salesforce.com', environment: 'sandbox' }}
        dataset={null}
        cleanedRecords={null}
        cleanedHeaders={null}
        onDataset={jest.fn()}
        onRequestCleanser={jest.fn()}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Import progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 Upload/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Drag and drop CSV, JSON, Excel, or XML')).toBeInTheDocument();
    await waitFor(() => expect(sf.describeGlobal).toHaveBeenCalled());
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Saved Jobs empty state and portable-config actions have no axe violations', async () => {
    await chrome.storage.local.clear();
    const { container } = render(
      <SavedJobsScreen
        sf={{} as SfApi}
        onRunExport={jest.fn()}
        onRunImport={jest.fn()}
        onOpenSchedules={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('No matching saved jobs')).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Snapshot Center empty timeline has named filters and no axe violations', async () => {
    await chrome.storage.local.clear();
    const { container } = render(
      <SnapshotCenterScreen sf={{} as SfApi} onCreateImport={jest.fn()} onOpenSchedules={jest.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('No snapshots match')).toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Filter by scheduled job' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
