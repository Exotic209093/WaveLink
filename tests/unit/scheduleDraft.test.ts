import { createNewScheduleForm } from '../../src/ui/utils/scheduleDraft';

describe('schedule draft', () => {
  it('preserves the exact Export query and connected org', () => {
    const soql = "SELECT Id FROM Contact WHERE LastName = 'Smith'";
    const form = createNewScheduleForm({ soql, orgId: '00D-source' });

    expect(form.soql).toBe(soql);
    expect(form.orgId).toBe('00D-source');
  });

  it('uses normal defaults for direct schedule creation', () => {
    const form = createNewScheduleForm(undefined, '00D-first');

    expect(form.soql).toBe('SELECT Id, Name FROM Account LIMIT 100');
    expect(form.orgId).toBe('00D-first');
  });
});
