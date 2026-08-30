import { h } from 'preact';
import { act, render, waitFor } from '@testing-library/preact';
import { AppRoot } from '../../src/ui/app/AppRoot';
import { APP_ROUTES } from '../../src/ui/app/routes';
import { SfApi } from '../../src/ui/api/sf';

const defaultResponses: Record<string, unknown> = {
  listTabs: [{ tabId: 7, title: 'Salesforce test tab', url: 'https://example.my.salesforce.com/lightning/page/home', hostname: 'example.my.salesforce.com' }],
  getContext: { orgId: '00D-test', username: 'tester@example.com', instanceUrl: 'https://example.my.salesforce.com', apiVersion: 'v61.0', environment: 'sandbox' },
  getUiSettings: { theme: 'light' }, getOnboarding: { completedSteps: [], dismissedAt: 1 },
  getStorageUsage: { bytesInUse: 0, quota: 10_485_760 }, listOrgs: { orgs: [], activeOrgId: null },
  describeGlobal: { sobjects: [] }, describeSObject: { name: 'Account', fields: [], childRelationships: [] },
  listSavedQueries: [], listQueryFolders: [], listTemplates: [], getPushHistory: [],
  getPushTransactions: [], listActivePushes: [], listPipelines: [], listQualityRuleSets: [],
  getLimits: {}, runQuery: { totalSize: 0, done: true, records: [] },
  crossOrgDescribeGlobal: { source: { sobjects: [] }, target: { sobjects: [] } },
  crossOrgDescribeSObject: { source: { fields: [] }, target: { fields: [] } },
};

describe('every navigable screen', () => {
  beforeAll(() => {
    for (const name of Object.getOwnPropertyNames(SfApi.prototype)) {
      if (name === 'constructor' || typeof (SfApi.prototype as unknown as Record<string, unknown>)[name] !== 'function') continue;
      jest.spyOn(SfApi.prototype as never, name as never).mockImplementation((async () => defaultResponses[name] ?? {}) as never);
    }
  });

  beforeEach(async () => {
    await chrome.storage.local.clear();
    window.location.hash = '#home';
  });

  test('loads every canonical destination through the real AppRoot renderer', async () => {
    const { container } = render(<AppRoot />);
    for (const route of Object.values(APP_ROUTES)) {
      await act(async () => {
        window.location.hash = `#${route}`;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      await waitFor(() => {
        const main = container.querySelector('main');
        expect(main).not.toBeNull();
        expect(main?.textContent).not.toMatch(/Loading…|No Salesforce tab detected|Page not found|page is not available/);
        expect((main?.textContent ?? '').trim().length).toBeGreaterThan(10);
      }, { timeout: 5000 });
      expect(container.querySelector('nav [aria-current="page"]')).not.toBeNull();
      const destinationControl = container.querySelector('main button, main input, main select, main textarea, main [tabindex]');
      if (!destinationControl) throw new Error(`Route ${route} rendered without an interactive control`);
      (destinationControl as HTMLElement).focus();
      expect(document.activeElement).toBe(destinationControl);
    }
  }, 60_000);
});
