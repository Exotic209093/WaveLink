# Large-job operating limits

WaveLink keeps customer data local, so its safe envelope is bounded by browser memory and the extension's 10 MB local-storage quota. These limits are enforced or surfaced in the UI:

| Workflow | Envelope | Behaviour |
|---|---:|---|
| CSV/TSV/JSON/XML input | 50 MB hard limit | CSV is read in 256 KiB chunks; files over the limit are rejected before parsing. |
| Excel input | 20 MB and 100,000 rows | XLSX remains isolated in its lazy chunk and is rejected above either limit. |
| Guided Import | 100,000 rows / 50 MB | A warning appears above 25,000 rows or 10 MB; larger accepted writes use Bulk API 2.0 in Auto mode. |
| REST write | Below 2,000 rows by default | 1–200 records per batch, 1–4 concurrent requests, upsert fixed at 25 composite requests. |
| Bulk write | 2,000–100,000 local rows | Salesforce owns the job; polling/finalization runs offscreen and can resume from its job ID. |
| Bulk query result page | 10,000 rows | Locator-based Load More prevents one response from growing without bound. |
| Snapshots | User retention, 10 MB total local quota | The schedule editor forecasts retained bytes before save and warns above 85% of quota. |

## Regression measurement

`tests/performance/large-job.test.ts` generates 100,000 records with five fields, maps them, and serializes the Bulk CSV payload. The release guard requires completion under 10 seconds and a payload below 50 MB in the Jest/Chrome-compatible runtime. This is a regression ceiling, not a promise that every machine or unusually wide dataset will have identical memory use.

## Recovery semantics

- REST checkpoints record processed and failed counts after every completed batch. A worker restart marks the job interrupted and asks for the original source file because Salesforce has no server-side job to resume.
- Bulk ingest checkpoints include the Salesforce job ID. The offscreen context owns long polling and final result storage; an interrupted monitor can resume by ID from Jobs & Activity.
- Bulk query jobs are asynchronous, cancellable, and use Salesforce locators for result-page resume.
- Every write leaves a summary in Activity. Result and error summaries can be downloaded without including access tokens.
