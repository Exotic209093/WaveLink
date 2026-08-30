import type { ExportTemplate, ImportTemplate, SavedJob, SavedJobDefinition, ScheduledExport } from '../../core/types/storage';

export interface PortableSavedJobs {
  format: 'wavelink-saved-jobs';
  schemaVersion: 1;
  exportedAt: string;
  jobs: SavedJob[];
}

function baseJob(id: string, name: string, description: string | undefined, definition: SavedJobDefinition, createdAt: number, updatedAt: number): SavedJob {
  return {
    schemaVersion: 1, id, name, description, favorite: false, definition,
    version: 1, revisions: [], createdAt, updatedAt, usageCount: 0,
  };
}

export function jobFromExportTemplate(template: ExportTemplate): SavedJob {
  return baseJob(`export:${template.id}`, template.name, template.description, {
    kind: 'export', operation: 'query', query: template.soql, columns: template.columns,
    orgRoles: { source: 'choose-at-run' },
    api: { strategy: 'rest' },
    safety: { dryRun: false, requireProductionConfirmation: false },
    output: { format: template.format, filenameBase: template.filenameBase },
  }, template.createdAt, template.updatedAt);
}

export function jobFromImportTemplate(template: ImportTemplate): SavedJob {
  return baseJob(`import:${template.id}`, template.name, template.description, {
    kind: 'import', objectName: template.objectName, operation: template.operation,
    orgRoles: { target: 'choose-at-run' },
    inputSource: 'local-file', mappings: template.fieldMappings,
    externalIdField: template.externalIdField,
    api: { strategy: template.strategy ?? 'auto' },
    safety: { dryRun: true, requireProductionConfirmation: true },
  }, template.createdAt, template.updatedAt);
}

export function jobFromSchedule(schedule: ScheduledExport): SavedJob {
  return baseJob(`schedule:${schedule.id}`, schedule.name, 'Migrated from a scheduled export.', {
    kind: 'export', operation: 'query', query: schedule.soql,
    orgRoles: { source: 'choose-at-run' },
    api: { strategy: 'auto' },
    safety: { dryRun: false, requireProductionConfirmation: false },
    output: { format: schedule.format },
    schedule: { interval: schedule.interval, retention: schedule.retention, timeZone: schedule.timeZone ?? 'UTC' },
  }, schedule.createdAt, schedule.updatedAt);
}

export function mergeLegacyJobs(
  existing: SavedJob[],
  exports: ExportTemplate[],
  imports: ImportTemplate[],
  schedules: ScheduledExport[],
): SavedJob[] {
  const byId = new Map(existing.map(job => [job.id, job]));
  for (const job of [...exports.map(jobFromExportTemplate), ...imports.map(jobFromImportTemplate), ...schedules.map(jobFromSchedule)]) {
    if (!byId.has(job.id)) byId.set(job.id, job);
  }
  return Array.from(byId.values());
}

export function reviseSavedJob(existing: SavedJob, update: Pick<SavedJob, 'name' | 'description' | 'definition'>, changedAt = Date.now()): SavedJob {
  const unchanged = existing.name === update.name
    && existing.description === update.description
    && JSON.stringify(existing.definition) === JSON.stringify(update.definition);
  if (unchanged) return existing;
  return {
    ...existing,
    ...update,
    version: existing.version + 1,
    updatedAt: changedAt,
    revisions: [...existing.revisions, {
      version: existing.version,
      changedAt,
      definition: existing.definition,
      name: existing.name,
      description: existing.description,
    }].slice(-20),
  };
}

export function duplicateSavedJob(job: SavedJob, now = Date.now()): SavedJob {
  return {
    ...job,
    id: `job-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${job.name} copy`,
    version: 1,
    revisions: [],
    favorite: false,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
    lastUsedAt: undefined,
  };
}

/** Copy only executable configuration fields; omit org IDs, tokens, rows, and literal defaults. */
function portableDefinition(definition: SavedJobDefinition): SavedJobDefinition {
  const apiStrategy = ['auto', 'rest', 'bulk'].includes(definition.api?.strategy)
    ? definition.api.strategy
    : 'auto';
  const result: SavedJobDefinition = {
    kind: definition.kind,
    api: {
      strategy: apiStrategy,
      ...(typeof definition.api?.batchSize === 'number' ? { batchSize: definition.api.batchSize } : {}),
      ...(typeof definition.api?.concurrency === 'number' ? { concurrency: definition.api.concurrency } : {}),
    },
    safety: {
      dryRun: definition.safety?.dryRun !== false,
      requireProductionConfirmation: definition.safety?.requireProductionConfirmation !== false,
    },
  };
  if (definition.orgRoles) {
    result.orgRoles = {
      ...(['active-org', 'choose-at-run'].includes(definition.orgRoles.source ?? '') ? { source: definition.orgRoles.source } : {}),
      ...(['active-org', 'choose-at-run'].includes(definition.orgRoles.target ?? '') ? { target: definition.orgRoles.target } : {}),
    };
  }
  if (typeof definition.objectName === 'string') result.objectName = definition.objectName;
  if (typeof definition.operation === 'string') result.operation = definition.operation;
  if (typeof definition.query === 'string') result.query = definition.query;
  if (definition.inputSource === 'local-file') result.inputSource = definition.inputSource;
  if (Array.isArray(definition.columns)) result.columns = definition.columns.filter((value): value is string => typeof value === 'string');
  if (Array.isArray(definition.mappings)) {
    result.mappings = definition.mappings.map(mapping => ({
      sourceField: mapping.sourceField,
      targetField: mapping.targetField,
      transformation: mapping.transformation,
      required: Boolean(mapping.required),
      ...(mapping.blankBehavior ? { blankBehavior: mapping.blankBehavior } : {}),
      ...(mapping.lookup ? { lookup: {
        mode: mapping.lookup.mode,
        ...(mapping.lookup.relationshipName ? { relationshipName: mapping.lookup.relationshipName } : {}),
        ...(mapping.lookup.matchField ? { matchField: mapping.lookup.matchField } : {}),
      } } : {}),
      // defaultValue is intentionally not portable: it may contain customer data.
    }));
  }
  if (typeof definition.externalIdField === 'string') result.externalIdField = definition.externalIdField;
  if (definition.output) {
    result.output = {
      format: definition.output.format,
      ...(typeof definition.output.filenameBase === 'string' ? { filenameBase: definition.output.filenameBase } : {}),
    };
  }
  if (definition.schedule) {
    result.schedule = {
      interval: { ...definition.schedule.interval },
      retention: definition.schedule.retention,
      timeZone: definition.schedule.timeZone,
    };
  }
  return result;
}

function portableJob(job: SavedJob): SavedJob {
  return {
    schemaVersion: 1,
    id: job.id,
    name: job.name,
    ...(typeof job.description === 'string' ? { description: job.description } : {}),
    favorite: Boolean(job.favorite),
    definition: portableDefinition(job.definition),
    version: Number.isFinite(job.version) ? job.version : 1,
    revisions: Array.isArray(job.revisions) ? job.revisions.map(revision => ({
      version: revision.version,
      changedAt: revision.changedAt,
      definition: portableDefinition(revision.definition),
      name: revision.name,
      ...(typeof revision.description === 'string' ? { description: revision.description } : {}),
    })).slice(-20) : [],
    createdAt: Number.isFinite(job.createdAt) ? job.createdAt : Date.now(),
    updatedAt: Number.isFinite(job.updatedAt) ? job.updatedAt : Date.now(),
    usageCount: Number.isFinite(job.usageCount) ? job.usageCount : 0,
    ...(typeof job.lastUsedAt === 'number' ? { lastUsedAt: job.lastUsedAt } : {}),
  };
}

export function serializePortableJobs(jobs: SavedJob[]): string {
  const portable: PortableSavedJobs = {
    format: 'wavelink-saved-jobs', schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    jobs: jobs.map(portableJob),
  };
  return JSON.stringify(portable, null, 2);
}

export function parsePortableJobs(text: string): SavedJob[] {
  const value = JSON.parse(text) as Partial<PortableSavedJobs>;
  if (value.format !== 'wavelink-saved-jobs' || value.schemaVersion !== 1 || !Array.isArray(value.jobs)) {
    throw new Error('Not a WaveLink saved-jobs file.');
  }
  return value.jobs.map((job, index) => {
    if (!job || job.schemaVersion !== 1 || typeof job.id !== 'string' || typeof job.name !== 'string') {
      throw new Error(`Invalid saved job at position ${index + 1}.`);
    }
    if (!job.definition || (job.definition.kind !== 'export' && job.definition.kind !== 'import')) {
      throw new Error(`Invalid definition for saved job "${job.name}".`);
    }
    return portableJob(job);
  });
}
