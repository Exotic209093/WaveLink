# WaveLink
Salesforce Data Seeding Tool

## Current Limits (As Implemented)
- Full app push is blocked when dataset is larger than:
  - 25,000 records
  - ~10MB file size
- Auto strategy switches to Bulk API at 2,000+ records.
- REST batching:
  - Insert/Update/Delete use SObject Collections (up to 200 records per request).
  - Upsert uses Composite API subrequests (up to 25 per request).
- Bulk pushes poll job completion every 5s for up to ~10 minutes.
- REST requests retry transient failures up to 3 attempts with backoff.
- Background runs as a Manifest V3 service worker (long-running work relies on async execution + broadcasts; SW lifecycle can still be a constraint).

## Feature Ideas (Not Implemented Yet)
- Org health screen: limits, auth/session health, storage usage, active pushes.
- Show build/test coverage: would require CI/build metadata to be bundled into the extension at build time.
- Retry failed rows: generate a new dataset from only failed records.
- Export stored push IDs to CSV + copy-to-clipboard.
- Cleanser: column reordering (would allow fixing Id-first inside WaveLink).
- Safer delete confirmations (type-to-confirm for delete).
- Push history detail view: group errors, export error rows, filter/sort.

## Org Health + Coverage
- Org Health is available under the Cleanser tab: it shows org context and `SF_LIMITS_GET`.
- Coverage is available under the Cleanser tab: it shows **Salesforce Apex** coverage using Tooling API (`ApexOrgWideCoverage`, `ApexCodeCoverageAggregate`).
