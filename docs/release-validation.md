# WaveLink release validation

Use a dedicated non-customer Salesforce development org and disposable test records. Record the
extension version, org ID suffix, browser version, timestamp, result, and any
GitHub issue for every row. Never paste access tokens or customer records into
the evidence.

## Packaged-extension real-org matrix

Run the exact `dist` output accepted by `npm run smoke:package`.

| Mode | Scenarios | Required evidence |
|---|---|---|
| Development org | REST query; Bulk Query 2.0; CSV/JSON/XLSX/XML downloads; insert/update/upsert/delete; dry run; REST Collections; Bulk ingest; retry; undo; schedule run; popup; in-page panel | Pass/fail, redacted screenshot, Salesforce job ID for Bulk operations, downloaded success/error files |
| Interruption | Start Bulk query and ingest jobs, recreate the service or reload the extension worker, reconnect, and resume by job ID | Checkpoint before/after, final Salesforce counts, result download |
| Production-warning mode | Repeat dry run and open each write review without committing; verify environment label, warning persistence, target org, operation, count, and typed confirmation | Redacted screenshots of every pre-commit guard; no production mutation required |

Stop and open a release-blocking issue for silent data loss, reversed compare
semantics, an incorrect target org, a write without confirmation, or a job that
cannot be reconciled with Salesforce after interruption.

### Guarded service-layer preflight

The repository includes a validator that runs WaveLink's real REST and Bulk API
clients against an org already authenticated by Salesforce CLI. It never prints
the session token. Use read-only mode in any org that is not a dedicated test
environment:

```powershell
$env:WL_SF_ORG_ALIAS = 'your-org-alias'
$env:WL_SF_READ_ONLY = '1'
npm run validate:salesforce
```

Only in a disposable development org with sufficient data storage, replace the
read-only variable with `$env:WL_SF_ALLOW_WRITE = '1'`. Write mode uses uniquely
tagged Account records, covers REST and Collections CRUD, Bulk ingest success
and failure files, corrected-row retry, and create undo, then attempts cleanup
in a `finally` block. This is service-layer evidence; it does not replace the
packaged-extension browser scenarios above.

### Validation execution log

#### 2026-08-30 — `nebula-dev` Developer Edition

- Org suffix: `…28TUAS`; Salesforce reports `IsSandbox=false`.
- Browsers: Google Chrome 152.0.7977.65 and Microsoft Edge 152.0.4191.53.
  The already-open normal Chrome profile had no remote-debugging endpoint, and
  Chrome ignored command-line unpacked-extension loading in an isolated profile.
  It was left untouched. The exact `dist` package was therefore loaded into an
  isolated Edge Chromium profile using the same Manifest V3 extension APIs.
- Authenticated Salesforce Lightning page and packaged full-app context: pass.
- WaveLink REST identity, limits, global describe, Account describe, and REST
  query through `SalesforceApiClient`: pass.
- WaveLink Bulk Query 2.0 creation, service recreation/resume by job ID, polling,
  and CSV result retrieval through `BulkApiService`: pass; job
  `750dL00000zI1FWQA0` returned one row.
- Initial write-mode preflight found the 5 MB data allocation full. With owner
  approval, 2,557 generated Nebula Vault backup/run/usage/notification/upload
  rows were permanently removed; configuration, connections, files, templates,
  users, standard records, and 49 immutable audit rows were preserved. The org
  then reported the full 5 MB available.
- Writable WaveLink service matrix: pass for REST insert/update/upsert/delete,
  REST Collections insert/update, Bulk ingest, success/error result retrieval,
  corrected failed-row retry, and create undo. Bulk jobs:
  `750dL00000zHs2XQAS`, `750dL00000zI5NuQAK`, and
  `750dL00000zI9mYQAS`.
- A final rerun passed every service check and reported cleanup `passed`; the
  org still reported all 5 MB of data storage available after validation.
- Packaged Export: live REST query passed. CSV, JSON, and XML blobs had the
  expected MIME types and contents; XLSX produced a 16,120-byte ZIP-based file
  with the expected `.xlsx` name and `PK` signature.
- Packaged Guided Import: CSV upload, Account selection, automatic Name and
  Billing City mapping, schema validation, dry run, production warning, and
  typed `INSERT 1 Account` confirmation passed. The created row was then removed
  through **Prepare Delete Push** and typed delete confirmation.
- Packaged fast-write recovery: a one-row completion race was found and fixed;
  insert and delete now reach Results instead of remaining stuck on Processing
  after Salesforce has completed the operation.
- Saved Job replay: a live export job was saved, opened from Saved Jobs, replayed,
  and returned one result.
- Schedule execution: a one-minute schedule was saved against the connected org,
  run immediately, captured one record and two columns, recorded successful run
  history, and registered its next alarm. The temporary schedule, alarm, eight
  snapshots, history, and Saved Job were removed after evidence capture.
- Popup: reconnected to the active Salesforce tab and rendered Guided Import.
- In-page panel: the content-script message handler mounted the Shadow DOM panel
  and rendered Query, Objects, and Settings. Direct cross-context delivery is a
  headless-Edge limitation, so the content handler was dispatched in its isolated
  extension context.
- Extension reload: the packaged extension reloaded, reconnected, and completed
  a fresh live query. Bulk query and ingest resumption also passed after service
  recreation using only Salesforce job IDs.
- Production safeguards: the org was labelled PROD; every write path now opens
  typed confirmation with operation, object, count, and target context.
- Store evidence: five redacted 1280x800 PNGs were captured from the packaged
  build for Home, Export, Import review, Compare, and Jobs & Activity.
- Result: maintainer dev-box release matrix complete. The only browser-specific
  caveat is that the already-open normal Chrome profile was not remotely
  attachable; it was not modified or restarted.

## Maintainer-authorized usability gate

Run the packaged build without using implementation notes:

1. Export Accounts to CSV, then change selected columns and download JSON.
2. Load a small CSV, map it, correct one validation problem, and complete a dry run.
3. Save the setup and run it again from Saved Jobs.

The walkthrough passes when all three tasks complete without consulting
developer documentation, the target org and commit boundary remain clear, and
no wrong turn causes an unintended write. On 2026-08-30 the dev-box walkthrough
completed Export, Guided Import and rollback, Saved Job replay, and schedule
execution. It found and fixed the current-org header, missing typed production
confirmation, fast-completion race, and schedule timestamp defects. After
release, collect optional feedback through
GitHub issues and store reviews; feedback is an input to prioritisation rather
than a blocker for the current release.

## Store screenshot gate

After real-org validation, capture the production theme at a consistent desktop
size for Home, Export results, Import review, Compare, and Jobs & Activity.
Redact org/user/record data, verify every image matches the packaged build, and
replace the Chrome Web Store listing assets in one reviewable update.

Completed 2026-08-30: `screenshots/screenshot-01-home.png` through
`screenshots/screenshot-05-activity.png` are packaged-build captures at exactly
1280x800 with org, user, and record identifiers redacted.

## Later-feature evidence queue

Later items are not current release commitments. Record concrete workflow
evidence from post-release issues, support reports, store feedback, or direct
requests, including frequency, workaround, and consequence. Promote an item
only through a dated roadmap decision; no interview count is a release gate.

| Candidate | Recurring workflow/problem | Current workaround and cost | Evidence source | Decision |
|---|---|---|---|---|
| Sensitive-field detection/masking |  |  |  | Deferred |
| Deterministic sandbox seeding |  |  |  | Deferred |
| Google Sheets source |  |  |  | Deferred |
| Scheduled local backups |  |  |  | Deferred |
| Permission/FLS preflight |  |  |  | Deferred |
| SOSL/GraphQL modes |  |  |  | Deferred |
| Local diagnostics bundle |  |  |  | Deferred |
| Edge/Firefox support |  |  |  | Deferred |
