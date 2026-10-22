import { h } from 'preact';
import { render, waitFor } from '@testing-library/preact';
import { HomeScreen } from '../../src/ui/screens/HomeScreen';
import type { SfApi } from '../../src/ui/api/sf';

describe('Home schedules card', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  test('labels upcoming runs as future times, not "just now"', async () => {
    const nextRunAt = Date.now() + 3 * 3_600_000;
    await chrome.storage.local.set({
      scheduledExports: [{ id: 's1', name: 'Weekly Account backup', soql: 'SELECT Id FROM Account', orgId: '00D-a', format: 'csv', interval: { unit: 'weeks', value: 1 }, enabled: true, retention: 4, createdAt: 1, updatedAt: 1, nextRunAt }],
    });
    const { findByText, queryByText } = render(<HomeScreen sf={{} as SfApi} hasOrg onNavigate={() => undefined} />);
    expect(await findByText('Weekly Account backup')).toBeTruthy();
    await waitFor(() => expect(queryByText('in 3h')).not.toBeNull());
    expect(queryByText('just now')).toBeNull();
  });
});
