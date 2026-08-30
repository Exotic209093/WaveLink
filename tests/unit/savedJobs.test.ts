import { jobFromExportTemplate, mergeLegacyJobs, parsePortableJobs, reviseSavedJob, serializePortableJobs } from '../../src/ui/utils/savedJobs';
import type { SavedJobDefinition } from '../../src/core/types/storage';

describe('versioned saved jobs', () => {
  const template = {
    id: 'exp', kind: 'export' as const, name: 'Accounts', soql: 'SELECT Id FROM Account',
    format: 'csv' as const, lastOrgId: '00D-secret', createdAt: 1, updatedAt: 2,
  };

  it('migrates legacy configs without credentials or org IDs', () => {
    const job = jobFromExportTemplate(template);
    expect(job.definition.query).toBe(template.soql);
    expect(job.definition.orgRoles).toEqual({ source: 'choose-at-run' });
    expect(JSON.stringify(job)).not.toContain('00D-secret');
    expect(mergeLegacyJobs([job], [template], [], [])).toHaveLength(1);
  });

  it('creates an auditable revision only when material settings change', () => {
    const job = jobFromExportTemplate(template);
    expect(reviseSavedJob(job, { name: job.name, description: job.description, definition: job.definition })).toBe(job);
    const revised = reviseSavedJob(job, { name: 'Accounts v2', description: job.description, definition: job.definition }, 10);
    expect(revised.version).toBe(2);
    expect(revised.revisions[0]).toEqual(expect.objectContaining({ version: 1, name: 'Accounts' }));
  });

  it('round-trips the portable credential-free format', () => {
    const text = serializePortableJobs([jobFromExportTemplate(template)]);
    expect(text).not.toContain('00D-secret');
    expect(parsePortableJobs(text)[0].name).toBe('Accounts');
  });

  it('whitelists portable fields and removes secrets, records, org IDs, and literal defaults', () => {
    const job = jobFromExportTemplate(template) as ReturnType<typeof jobFromExportTemplate> & Record<string, unknown>;
    job.accessToken = 'token-secret';
    job.records = [{ Name: 'Customer secret' }];
    (job.definition as SavedJobDefinition & Record<string, unknown>).orgId = '00D-secret';
    job.definition.mappings = [{
      sourceField: 'Email', targetField: 'Email', required: false, defaultValue: 'customer@example.com',
    }];
    job.definition.orgRoles = { source: 'active-org' };

    const text = serializePortableJobs([job]);
    expect(text).not.toMatch(/token-secret|Customer secret|00D-secret|customer@example\.com/);
    expect(parsePortableJobs(text)[0].definition.mappings?.[0]).toEqual({
      sourceField: 'Email', targetField: 'Email', required: false,
    });
    expect(parsePortableJobs(text)[0].definition.orgRoles).toEqual({ source: 'active-org' });
  });
});
