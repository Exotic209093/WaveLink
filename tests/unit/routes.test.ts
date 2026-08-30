import { APP_ROUTES, resolveAppRoute } from '../../src/ui/app/routes';
import { ONBOARDING_STEPS } from '../../src/ui/utils/onboarding';

describe('application routes', () => {
  it('resolves every onboarding destination to its intended screen', () => {
    const expected = new Map([
      ['connect-org', APP_ROUTES.home],
      ['run-query', APP_ROUTES.export],
      ['export-results', APP_ROUTES.export],
      ['upload-data', APP_ROUTES.import],
      ['push-data', APP_ROUTES.import],
      ['use-templates', APP_ROUTES.templates],
      ['use-cleanser', APP_ROUTES.advancedCleanse],
      ['generate-test-data', APP_ROUTES.advancedTestData],
      ['schema-comparison', APP_ROUTES.advancedSchemaCompare],
      ['use-pipelines', APP_ROUTES.advancedPipeline],
      ['detect-duplicates', APP_ROUTES.advancedDuplicates],
    ]);

    for (const step of ONBOARDING_STEPS) {
      if (!step.targetRoute) continue;
      expect(resolveAppRoute(step.targetRoute)).toBe(expected.get(step.id));
    }
  });

  it('normalizes legacy URL-style routes while rejecting unknown pages', () => {
    expect(resolveAppRoute('/query')).toBe(APP_ROUTES.export);
    expect(resolveAppRoute('/generate')).toBe(APP_ROUTES.advancedTestData);
    expect(resolveAppRoute('/schema-diff')).toBe(APP_ROUTES.advancedSchemaCompare);
    expect(resolveAppRoute('/activity')).toBe(APP_ROUTES.jobs);
    expect(resolveAppRoute('org-health')).toBe(APP_ROUTES.advancedOrgHealth);
    expect(resolveAppRoute('/does-not-exist')).toBeNull();
  });
});
