export interface ScheduleDraft {
  soql: string;
  orgId?: string;
}

export interface NewScheduleForm {
  name: string;
  soql: string;
  orgId: string;
  format: 'csv' | 'json' | 'excel' | 'xml';
  intervalKind: 'minutes' | 'hours' | 'days';
  intervalValue: number;
  retention: number;
  timeZone: string;
}

const DEFAULT_SOQL = 'SELECT Id, Name FROM Account LIMIT 100';

/** Build a fresh form without mutating the reusable defaults or query editor. */
export function createNewScheduleForm(draft?: ScheduleDraft, fallbackOrgId = ''): NewScheduleForm {
  return {
    name: '',
    soql: draft?.soql ?? DEFAULT_SOQL,
    orgId: draft?.orgId ?? fallbackOrgId,
    format: 'csv',
    intervalKind: 'hours',
    intervalValue: 6,
    retention: 10,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}
