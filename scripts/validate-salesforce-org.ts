/**
 * Guarded real-org validation for WaveLink's Salesforce REST and Bulk clients.
 *
 * This script creates only uniquely tagged Account records and removes them in
 * a finally block. It deliberately requires WL_SF_ALLOW_WRITE=1 so it cannot
 * mutate an org by accident. Credentials are read from environment variables
 * and are never printed.
 *
 * Run through the Salesforce CLI wrapper documented in
 * docs/release-validation.md; do not paste a token into a shell command.
 */

import { SalesforceApiClient } from '../src/services/salesforce/api-client';
import { BulkApiService } from '../src/services/salesforce/bulk-api';
import type { ApiVersion, BulkJob } from '../src/core/types/salesforce';
import path from 'node:path';

type Check = {
  name: string;
  status: 'pass' | 'fail';
  detail?: string;
  jobId?: string;
};

const allowWrite = process.env.WL_SF_ALLOW_WRITE === '1';
const readOnly = process.env.WL_SF_READ_ONLY === '1';
const apiVersion = (process.env.WL_SF_API_VERSION || 'v63.0') as ApiVersion;

if (!allowWrite && !readOnly) {
  throw new Error('Set WL_SF_READ_ONLY=1, or explicitly allow mutation with WL_SF_ALLOW_WRITE=1.');
}

let instanceUrl = '';
let accessToken = '';
let api: SalesforceApiClient;
let bulk: BulkApiService;
const tag = `WaveLink validation ${new Date().toISOString()} ${Math.random().toString(36).slice(2, 8)}`;
const createdIds = new Set<string>();
const checks: Check[] = [];

async function resolveCredentials(): Promise<{ instanceUrl: string; accessToken: string }> {
  if (process.env.WL_SF_INSTANCE_URL && process.env.WL_SF_ACCESS_TOKEN) {
    return {
      instanceUrl: process.env.WL_SF_INSTANCE_URL,
      accessToken: process.env.WL_SF_ACCESS_TOKEN,
    };
  }

  const orgAlias = process.env.WL_SF_ORG_ALIAS;
  if (!orgAlias) {
    throw new Error('Set WL_SF_ORG_ALIAS, or provide WL_SF_INSTANCE_URL and WL_SF_ACCESS_TOKEN.');
  }
  const appData = process.env.APPDATA;
  if (!appData) throw new Error('APPDATA is required to locate the installed Salesforce CLI.');
  // Salesforce CLI owns the encrypted auth material. Loading its local core
  // library lets us refresh and consume a session without ever printing it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AuthInfo, Connection, StateAggregator } = require(path.join(
    appData,
    'npm',
    'node_modules',
    '@salesforce',
    'cli',
    'node_modules',
    '@salesforce',
    'core',
  )) as {
    AuthInfo: { create(options: { username: string }): Promise<unknown> };
    Connection: { create(options: { authInfo: unknown }): Promise<{ accessToken?: string; instanceUrl: string; identity(): Promise<unknown> }> };
    StateAggregator: { getInstance(): Promise<{ aliases: { resolveUsername(value: string): string } }> };
  };
  const state = await StateAggregator.getInstance();
  const username = state.aliases.resolveUsername(orgAlias);
  const authInfo = await AuthInfo.create({ username });
  const connection = await Connection.create({ authInfo });
  await connection.identity();
  if (!connection.accessToken) throw new Error('Salesforce CLI session did not provide an access token.');
  return { instanceUrl: connection.instanceUrl, accessToken: connection.accessToken };
}

function pass(name: string, detail?: string, jobId?: string): void {
  checks.push({ name, status: 'pass', detail, jobId });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function pollQuery(service: BulkApiService, jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = await service.getQueryJobStatus(jobId);
    if (state.state === 'JobComplete') return;
    if (state.state === 'Failed' || state.state === 'Aborted') {
      throw new Error(`Bulk query ${jobId} ended in ${state.state}.`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Bulk query ${jobId} did not complete in time.`);
}

async function completeIngest(service: BulkApiService, job: BulkJob): Promise<BulkJob> {
  const completed = await service.pollJobCompletion(job.id, 1000, 90);
  assert(completed.state === 'JobComplete', `Bulk ingest ${job.id} ended in ${completed.state}.`);
  return completed;
}

async function main(): Promise<void> {
  const org = await api.query<{ Id: string; IsSandbox: boolean }>(
    'SELECT Id, IsSandbox FROM Organization LIMIT 1',
  );
  assert(org.records.length === 1, 'Could not identify the Salesforce org.');
  const orgId = org.records[0].Id;
  pass('org identity', `org …${orgId.slice(-6)}, sandbox=${org.records[0].IsSandbox}`);

  const limits = await api.getLimits();
  assert(Boolean(limits.DailyApiRequests), 'Daily API limits were not returned.');
  const global = await api.describeGlobal();
  assert(global.sobjects.some(object => object.name === 'Account' && object.createable), 'Account is not createable.');
  const accountDescribe = await api.describeSObject('Account');
  assert(accountDescribe.fields.some(field => field.name === 'Name' && field.createable), 'Account.Name is not createable.');
  await api.query('SELECT Id, Name FROM Account LIMIT 1');
  pass('REST query and metadata');

  const queryJob = await bulk.createQueryJob('SELECT Id, Name FROM Account LIMIT 5');
  // Recreate the service to prove that resumption needs only the Salesforce job ID.
  const resumedQuery = new BulkApiService({ instanceUrl, accessToken, apiVersion });
  await pollQuery(resumedQuery, queryJob.id);
  const queryPage = await resumedQuery.getQueryResults(queryJob.id, undefined, 100);
  assert(queryPage.records.length <= 5, 'Bulk query exceeded its requested record limit.');
  pass('Bulk Query 2.0 create, resume, and results', `${queryPage.records.length} records`, queryJob.id);

  if (readOnly && !allowWrite) {
    pass('write safety guard', 'write scenarios intentionally skipped');
    return;
  }

  const created = await api.createRecord('Account', { Name: `${tag} REST` });
  assert(created.success && created.id, 'REST insert did not return a record ID.');
  createdIds.add(created.id);
  await api.updateRecord('Account', created.id, { Name: `${tag} REST updated` });
  const updated = await api.query<{ Id: string; Name: string }>(
    `SELECT Id, Name FROM Account WHERE Id = '${created.id}'`,
  );
  assert(updated.records[0]?.Name === `${tag} REST updated`, 'REST update was not persisted.');
  await api.upsertRecord('Account', 'Id', created.id, { Name: `${tag} REST upserted` });
  const upserted = await api.query<{ Name: string }>(`SELECT Name FROM Account WHERE Id = '${created.id}'`);
  assert(upserted.records[0]?.Name === `${tag} REST upserted`, 'REST upsert was not persisted.');
  pass('REST insert, update, and upsert');

  const collection = await api.collectionCreate(
    'Account',
    [{ Name: `${tag} Collection A` }, { Name: `${tag} Collection B` }],
  );
  assert(collection.length === 2 && collection.every(result => result.success && result.id), 'Collection insert failed.');
  collection.forEach(result => createdIds.add(result.id));
  const collectionRecords = collection.map((result, index) => ({
    Id: result.id,
    Name: `${tag} Collection ${index + 1} updated`,
  }));
  const collectionUpdated = await api.collectionUpdate('Account', collectionRecords);
  assert(collectionUpdated.every(result => result.success), 'Collection update failed.');
  pass('REST Collections insert and update');

  const ingestJob = await bulk.createJob({ object: 'Account', operation: 'insert' });
  await bulk.uploadJobData(
    ingestJob.id,
    bulk.recordsToCsv([{ Name: `${tag} Bulk A` }, { Name: `${tag} Bulk B` }]),
  );
  await bulk.closeJob(ingestJob.id);
  const resumedIngest = new BulkApiService({ instanceUrl, accessToken, apiVersion });
  await completeIngest(resumedIngest, ingestJob);
  const ingestSuccess = await resumedIngest.getSuccessfulResults(ingestJob.id);
  const ingestFailed = await resumedIngest.getFailedResults(ingestJob.id);
  assert(ingestSuccess.length === 2 && ingestFailed.length === 0, 'Bulk insert result counts were incorrect.');
  ingestSuccess.forEach(result => createdIds.add(result.sf__Id));
  pass('Bulk ingest insert, resume, and result files', '2 successes, 0 failures', ingestJob.id);

  const failedJob = await bulk.createJob({ object: 'Account', operation: 'insert' });
  await bulk.uploadJobData(failedJob.id, bulk.recordsToCsv([{ Name: 'x'.repeat(300) }]));
  await bulk.closeJob(failedJob.id);
  await completeIngest(bulk, failedJob);
  const failures = await bulk.getFailedResults(failedJob.id);
  assert(failures.length === 1 && Boolean(failures[0].sf__Error), 'Expected one downloadable Bulk error row.');
  pass('Bulk failed-row result download', '1 expected validation failure', failedJob.id);

  const retryJob = await bulk.createJob({ object: 'Account', operation: 'insert' });
  await bulk.uploadJobData(retryJob.id, bulk.recordsToCsv([{ Name: `${tag} Retry corrected` }]));
  await bulk.closeJob(retryJob.id);
  await completeIngest(bulk, retryJob);
  const retrySuccess = await bulk.getSuccessfulResults(retryJob.id);
  assert(retrySuccess.length === 1 && Boolean(retrySuccess[0].sf__Id), 'Corrected retry did not succeed.');
  retrySuccess.forEach(result => createdIds.add(result.sf__Id));
  pass('Bulk failed-row retry', '1 corrected success', retryJob.id);

  const undo = await api.createRecord('Account', { Name: `${tag} Undo` });
  assert(undo.success && undo.id, 'Undo setup insert failed.');
  createdIds.add(undo.id);
  await api.deleteRecord('Account', undo.id);
  createdIds.delete(undo.id);
  const undone = await api.query(`SELECT Id FROM Account WHERE Id = '${undo.id}'`);
  assert(undone.totalSize === 0, 'Undo delete did not remove the created record.');
  pass('create undo');
}

async function cleanup(): Promise<void> {
  if (!api) return;
  const discovered = await api.query<{ Id: string }>(
    `SELECT Id FROM Account WHERE Name LIKE '${tag}%'`,
  ).catch(() => ({ records: [] as Array<{ Id: string }> }));
  discovered.records.forEach(record => createdIds.add(record.Id));
  const ids = [...createdIds];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200);
    await api.collectionDelete(batch, false).catch(async () => {
      for (const id of batch) await api.deleteRecord('Account', id).catch(() => undefined);
    });
  }
  // Soft-deleted validation rows still consume storage until Salesforce purges
  // them. Empty only this run's uniquely tagged recycle-bin records.
  const escapedTag = tag.replace(/'/g, "\\'");
  const purge = await api.executeAnonymous(
    `List<Account> rows = [SELECT Id FROM Account WHERE Name LIKE '${escapedTag}%' ALL ROWS]; `
    + 'if (!rows.isEmpty()) Database.emptyRecycleBin(rows);',
  );
  assert(purge.compiled, `Cleanup Apex did not compile: ${purge.compileProblem ?? 'unknown error'}`);
  assert(purge.success, `Cleanup Apex failed: ${purge.exceptionMessage ?? 'unknown error'}`);
}

(async () => {
  let failure: unknown;
  let cleanupStatus = 'not required';
  try {
    ({ instanceUrl, accessToken } = await resolveCredentials());
    api = new SalesforceApiClient({ instanceUrl, accessToken, apiVersion });
    bulk = new BulkApiService({ instanceUrl, accessToken, apiVersion });
    await main();
  } catch (error) {
    failure = error;
    checks.push({
      name: 'validation run',
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    try {
      await cleanup();
      cleanupStatus = 'passed';
    } catch (error) {
      cleanupStatus = `failed: ${error instanceof Error ? error.message : String(error)}`;
      checks.push({ name: 'validation-record cleanup', status: 'fail', detail: cleanupStatus });
      failure ??= error;
    }
  }

  process.stdout.write(`${JSON.stringify({
    timestamp: new Date().toISOString(),
    apiVersion,
    checks,
    cleanup: cleanupStatus,
  }, null, 2)}\n`);
  if (failure) process.exitCode = 1;
})();
