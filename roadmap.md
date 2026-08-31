# WaveLink Product Roadmap

> Last updated: 2026-08-31<br>
> Prepared release: **v0.6.0**; current Chrome Web Store release: **v0.2.0**<br>
> Product direction: **a fast, local-first Salesforce data workspace for safely exporting, importing, comparing, scheduling, and repeating data jobs**

## Road to 1.0 (2026-08-31 audit)

A full-project test pass on 2026-08-31 at commit `74cf21b` found the automated
gates all green — TypeScript, ESLint, `npm test` (499 tests / 49 suites), the
production build, the Manifest V3 package smoke, and both dependency audits (0
high/critical) all pass. The gap is in what those tests **don't** cover: the
write path, the scheduling runtime, and export/compare fidelity. A hands-on run
of the packaged 0.6.0 UI in a Chrome-API harness plus a five-way adversarial
code review surfaced **46 issues**, several data-corrupting.

The most serious findings — verified in code, several reproduced live:

- **Undo never runs.** Both undo entry points omit `tabId`/`orgId`; the
  background rejects the call and the error is swallowed ([#42](https://github.com/Exotic209093/WaveLink/issues/42)).
- **Copy between orgs writes into the source org** and never builds its ID map ([#43](https://github.com/Exotic209093/WaveLink/issues/43)).
- **A stale cleansed dataset silently replaces a newly uploaded import file** ([#44](https://github.com/Exotic209093/WaveLink/issues/44)).
- **Bulk import drops whole columns** and silently no-ops blank-means-clear ([#45](https://github.com/Exotic209093/WaveLink/issues/45)); retry re-sends succeeded rows and the error file blames the wrong rows ([#46](https://github.com/Exotic209093/WaveLink/issues/46), [#47](https://github.com/Exotic209093/WaveLink/issues/47)).
- **The production typed-confirmation gate is absent on the Advanced → Data Push route** ([#48](https://github.com/Exotic209093/WaveLink/issues/48)).
- **Every service-worker wake resets all schedule alarms**, so schedules drift and can never fire; snapshots can silently exceed the 10 MB quota while runs report success ([#54](https://github.com/Exotic209093/WaveLink/issues/54), [#56](https://github.com/Exotic209093/WaveLink/issues/56)).
- **Session tokens are persisted unencrypted** and the REST explorer can attach the Bearer token to arbitrary URLs ([#64](https://github.com/Exotic209093/WaveLink/issues/64), [#65](https://github.com/Exotic209093/WaveLink/issues/65)).

The 46 issues ([#40](https://github.com/Exotic209093/WaveLink/issues/40),
[#42–#87](https://github.com/Exotic209093/WaveLink/issues)) are grouped into four
milestones. **1.0 is the trust release: no known write-path data-corruption
defect, schedules that survive worker restarts, honest security posture, and the
UI screens under interaction-test coverage.**

| Milestone | Theme | Scope |
|---|---|---|
| **v0.7.0 — Data you can trust** | Write-path correctness | Undo, Copy between orgs, bulk CSV semantics, retry/error-file index integrity, per-row bulk errors, the production-gate bypass, clone remapping, lookup-validation deadlock, compare-copy duplicates, import date shift, POST retry idempotency ([#42–53](https://github.com/Exotic209093/WaveLink/issues), [#83](https://github.com/Exotic209093/WaveLink/issues/83)) |
| **v0.8.0 — Reliable automation** | MV3 runtime | Alarm-reset drift, stale schedule/snapshot writes, quota-blind snapshots, the interrupted-push race, cancel-after-restart, poll-cap false failures, duplicate history, mid-job token refresh, timezone, checkpoint pruning ([#54–63](https://github.com/Exotic209093/WaveLink/issues)) |
| **v0.9.0 — Security & data fidelity** | Tokens + output fidelity | Token storage/leaks, CSV formula injection, `ORG_LIST` token exposure, handler gating; nested-attribute leakage, 14-column truncation, snapshot `[object Object]`, CSV BOM, 50-row column sampling, cross-org snapshot compare, saved-job resurrection, workspace org leak, diff/convert round-trip loss ([#64–82](https://github.com/Exotic209093/WaveLink/issues)) |
| **v1.0.0 — Trust release** | Polish + honesty + coverage | Global Ctrl+Z hijack, legacy blocking tutorial, SECURITY.md/CHANGELOG honesty, and interaction-test coverage for every navigable screen ([#40](https://github.com/Exotic209093/WaveLink/issues/40), [#84–87](https://github.com/Exotic209093/WaveLink/issues)) |

### 1.0 release gate

- No open write-path data-corruption defect (all v0.7.0 issues closed with regression tests).
- A schedule set once fires on time across worker restarts and browser close/reopen; a moderate snapshot either persists or fails loudly (v0.8.0 verified against a real org).
- No session token on disk in cleartext; no path attaches credentials to a non-Salesforce origin; exports neutralize formula injection (v0.9.0).
- Every navigable screen has at least one interaction test with mocked Chrome/Salesforce boundaries, and every defect above has a regression test ([#40](https://github.com/Exotic209093/WaveLink/issues/40)).
- Store-facing docs (SECURITY.md, PRIVACY.md, CHANGELOG) match the code.

### How this pass was run

The UI was exercised outside a packaged extension by serving the production
`dist/` build with an in-memory `chrome.*` shim (storage, runtime messaging,
tabs, alarms, downloads) and canned Salesforce responses, then driving every
navigable screen and the four export formats through a browser-automation
harness. Findings were confirmed against source before filing; live-reproduced
items are labelled as such in their issue. The harness was scratch-only and left
no repository changes.

## Beyond 1.0 — the road to 3.0

> Added 2026-08-31. Context: roughly 15 active users, and the public Chrome Web
> Store listing is still v0.2.0 — the constraint today is awareness, not proven
> demand. 1.0 buys trust; the arc below turns trust into users and then, only
> with evidence, into scope. Each phase has an **entry gate**; a phase whose
> gate is unmet does not start, and GitHub milestones are created only when a
> gate is met. The demand log in [`docs/demand-research.md`](docs/demand-research.md)
> remains the source of truth for evidence.

### v1.1 — Relaunch and listen

**Goal:** turn the trust release into users. Marketing was deliberately held
back until the write path was safe; this phase spends the one first impression.

- Publish 1.0 to the Chrome Web Store with a rebuilt listing: keywords
  ("backup", "data loader", "export"), current screenshots, and a 30-second
  demo video.
- Lead positioning with the backup wedge: **free, local, scheduled Salesforce
  backups with snapshot diff** — the one capability the dominant free
  competitor lacks and the paid alternatives price for enterprises.
- One-off distribution with compounding search residue: an honest "I built
  this" post on r/salesforce, a SalesforceBen pitch, awesome-salesforce list
  submissions, Salesforce StackExchange answers where genuinely relevant, and a
  README with GIFs plus a fair comparison table against Inspector Reloaded,
  Jetstream, and Data Loader.
- Ask the existing users for honest store reviews once 1.0 ships; add an
  opt-in feedback link in Help and the local diagnostics bundle (promoted from
  Later) so bug reports never need customer data.
- Start a weekly metrics log: store installs/uninstalls, review velocity,
  GitHub traffic and stars. No telemetry — store and repo stats only.

**Release gate:** listing at 1.x with refreshed assets; ten or more honest
reviews; feedback channel live; four consecutive weekly metric entries.

### v1.5 — Own the backup wedge

**Entry gate:** relaunch complete and schedules/snapshots holding in the field
— no new critical schedule or snapshot defect for one full release cycle.

- Scheduled **backup profiles**: one profile covering multiple objects with
  shared cadence and retention.
- Move snapshot storage out of the 10 MB `chrome.storage` quota (IndexedDB or
  OPFS, with an explicit `unlimitedStorage` decision) and keep retention
  forecasting measured rather than estimated.
- **Restore**: snapshot diff → reviewed import with per-field selection, and a
  one-record "restore to snapshot state" action.
- Sensitive-field detection and masking on export (promoted from Later — it
  deepens the local-first differentiator rather than widening the tool belt).
- A backup-health surface: last good snapshot per object, loud failure alerts.

**Release gate:** weekly backups of several objects configurable in under three
minutes; a deleted/modified record restored against a real org; masking
verified on a real export; no silent snapshot failure mode remains.

### v2.0 — The connected data workspace

**Entry gate:** sustained growth (on the order of hundreds of weekly actives)
plus repeated inbound requests recorded in the demand log. Without both, stay
on 1.x — this is the same discipline that produced the v0.6 migration decision.

- Revisit that v0.6 decision with evidence: relationship-aware, resumable
  cross-org migration done properly — dependency ordering, persistent ID maps,
  per-object retry, reverse-order rollback, verification counts.
- Google Sheets as an import/export source.
- SOSL and Salesforce GraphQL query modes.
- Shareable job configurations with secrets and record data stripped.

The major version is justified by the scope change (single-job tool →
multi-object, multi-org workflows) and the storage-schema migration it needs.

### v2.1 — Scale-out hardening

The ".1 after the major," on the same philosophy as v0.7: a full adversarial
audit and correctness pass over everything 2.0 introduced **before** promoting
it in the listing. Measured large-migration envelopes, enforced performance
budgets for the new surfaces, and a real-org regression matrix for the
migration suite. No new features ship in this release.

### v2.5 — Reach

Independent items, each with its own evidence gate rather than a shared one:

- **Edge and Firefox ports** — once Chrome behavior is stable and the demand
  shows up in reviews/issues.
- **Sandbox seeding recipes** with deterministic generated data.
- **Permission and field-level-security preflight reports.**
- **Team features exploration** (shared job libraries) — only with concrete
  multi-seat demand, and never via cloud sync of customer data.

> The phases from here to 3.0 are directional: further out means less detail
> on purpose. Each still carries an entry gate, and none is a commitment until
> a dated roadmap decision promotes it.

### v2.6 — Parity and stability

The hardening release for reach, on the x.1 pattern (v0.7, v2.1): no new
features. One shared test matrix across every shipped browser; per-browser
quirks (storage quotas, alarm behavior, offscreen equivalents) measured and
documented; the release/packaging pipeline produces every target from one
build. **Release gate:** the full real-org validation matrix passes on every
shipped browser, not just Chrome.

### v2.7 — Always-on backups

**Entry gate:** the backup wedge is the demonstrated reason users install
(reviews/requests say so), and missed-while-closed runs are a recorded top
complaint.

The browser-extension ceiling is that `chrome.alarms` cannot fire with the
browser closed. This phase breaks that ceiling without breaking local-first:

- An optional **native companion** (native messaging host + OS scheduled
  task) that runs scheduled backup jobs with the browser closed and writes
  snapshots to user-chosen local folders.
- Same core job definitions — the extension and companion execute one format.
- Companion is strictly opt-in, separately installed, and auditable; the
  extension remains fully functional without it.

**Release gate:** a schedule created in the extension runs on time with the
browser closed; snapshots land in the chosen folder; uninstalling the
companion leaves the extension exactly as before.

### v2.8 — Governance

**Entry gate:** inbound demand from admins responsible for compliance
(masking, audit, retention requests in the demand log).

- Masking **policies**: reusable sensitive-field rules applied across export,
  backup, and sharing — not per-export toggles.
- Permission/FLS preflight grown into a reviewable report suite.
- Local audit exports: who-ran-what job histories exportable for review.
- Retention policies per backup profile with measured storage forecasting.

**Release gate:** a masked export provably contains no unmasked sensitive
field; audit exports round-trip through Compare like any other data.

### v3.0 — One local core, many surfaces

**Entry gate:** thousands of weekly actives, companion adoption from v2.7,
and sustained inbound demand for use outside the browser. This is the next
major because it changes what WaveLink *is*, not just what it does.

- Extract the job engine (query, push, snapshot, diff, saved jobs) into one
  core shared by every surface.
- **Surfaces:** the browser extensions, the native companion, and a thin CLI
  for scripted/CI use — same job files, same results format everywhere.
- Shareable, versioned job libraries (secrets and data stripped) as the
  team story — configurations travel, customer data never does.
- The 3.0 audit: a v0.7-style adversarial pass over the extracted core before
  any surface ships on it.

**Release gate:** one job definition runs identically from extension,
companion, and CLI against a real org; the core has its own test suite and
measured envelopes; local-first holds — no server, no account, no customer
data leaving the device.

### Principles that survive every phase

- **Evidence-gated:** no phase starts before its entry gate; the demand log
  decides, not enthusiasm.
- **Trust before reach:** any recurrence of write-path data corruption pauses
  feature work for a v0.7-style correctness release.
- **Local-first is non-negotiable:** customer data never leaves the device,
  including in any future team features.

## Product focus

WaveLink already has a broad feature set. The next stage is not about adding more
screens; it is about making the most important workflows trustworthy, easy to
understand, reliable at scale, and quick to repeat.

The primary audience is:

1. Salesforce administrators performing recurring data work.
2. Developers investigating records, schemas, queries, and APIs.
3. Consultants moving controlled sets of data between orgs.

Export, Import, Convert, Compare, Schedules, Saved Jobs, Snapshots, and Activity
are the primary product. Developer tools remain available through Advanced. The
former migration suite has been reduced to the smaller, explicitly bounded
**Copy between orgs** workflow described in the v0.6 decision.

### Product principles

- **Local-first privacy:** Salesforce data stays on the user's device and is sent
  only to the Salesforce orgs the user selects.
- **Safe by default:** preview impact, expose the target environment, validate
  permissions and mappings, and make recovery obvious.
- **Progressive disclosure:** common jobs should be simple; advanced settings
  should not dominate the default workflow.
- **Hierarchy before decoration:** use spacing, typography, and clear primary
  actions to guide attention. Gradients, glass effects, pills, and shadows should
  be reserved for elements that genuinely need emphasis.
- **Task-first interface:** screens should follow the user's job from setup to
  review, execution, results, and recovery instead of exposing the application's
  internal feature structure.
- **One job model:** exports, imports, schedules, templates, results, and retries
  should feel like parts of one system rather than separate tools.
- **Honest capability:** documentation and navigation must reflect what is
  actually tested and available.
- **Finish before expanding:** reliability and usability take priority over new
  admin utilities or speculative integrations.

## Current health

Audit baseline from 2026-08-30 at commit `01a5279`:

| Check | Result |
|---|---|
| TypeScript | Pass |
| ESLint | Pass |
| Unit tests | 456 tests across 37 suites, all passing |
| Production build | Pass with size warnings |
| Coverage | 12.55% statements; user-facing screens and Salesforce UI API are 0% |
| Dependency audit | 20 findings; direct production `xlsx` dependency is high severity |
| App bundle | 346 KiB; above webpack's 244 KiB recommendation |
| XLSX chunk | 409 KiB |

The detailed audit findings are tracked in GitHub issues
[#31–#41](https://github.com/Exotic209093/WaveLink/issues).

Implementation snapshot on 2026-08-30 after the roadmap build:

| Check | Current result |
|---|---|
| Unit tests | 499 tests across 49 suites, all passing |
| Coverage | 32.18% statements, 22.96% branches, 21.67% functions, 33.23% lines, with raised CI thresholds |
| Production and development dependency audit | 0 high or critical findings |
| App bundle | 189 KiB with an enforced entrypoint budget |
| Popup bundle | 142 KiB with an enforced 220 KiB entrypoint budget; Guided Import loads after connection |
| XLSX chunk | About 250 KiB, isolated behind Excel actions with a 260 KiB asset budget |
| Manifest V3 package smoke | Pass: 58 release files, required entrypoints, CSP, and contents validated |
| Real-org validation | Full REST, Collections, Bulk Query/ingest/retry, undo, and cleanup matrix passes against `nebula-dev`; packaged Chromium workflows pass for four-format export, Guided Import, typed production confirmation, rollback, Saved Jobs, schedules, snapshots, popup, and panel |
| Release evidence | Maintainer-authorized dev-box walkthrough complete; five redacted 1280x800 Web Store screenshots captured from the packaged build |

## Implementation status

> **Correction (2026-08-31):** the 0.6.0 phases below were built, but the audit
> above shows several are not defect-free as "Complete" implies — Undo (v0.5)
> does not execute, schedules (v0.4) reset on every worker wake, and the
> production write gate (v0.2.1) is bypassable via one route. The "None"
> evidence-needed entries are superseded by the v0.7.0–v1.0.0 milestones; treat
> those phases as feature-complete but not yet trustworthy pending 1.0.

| Roadmap phase | Engineering status | Evidence still needed before release |
|---|---|---|
| v0.2.1 Trust and polish | Complete: #31-#41 fixes, accessibility semantics/tests, secure spreadsheet dependency, UI coverage, CI audit and bundle gates, full real-org service matrix, packaged production safeguards, and four-format export evidence | None |
| v0.3 Guided product and UI rework | Complete: task-first shell, one-row navigation, seven-stage Import, stateful multi-tab Export, Activity hub, responsive visual system, local SVG icons, maintainer-authorized walkthrough, and refreshed store screenshots | None |
| v0.4 Scale and reliability | Complete: Bulk Query 2.0, chunked parsing/output, offscreen Bulk finalization, durable write/query checkpoints, resume/cancel, schedules, forecasts, measured 100k-row envelope, service recreation/resume, and packaged extension reload | None |
| v0.5 Repeatable workflows | Complete: versioned Saved Jobs, legacy migration, secret/data-safe portability, scheduled-job handoff, Snapshot Center, comparison, pinning, re-download, reviewed-import creation, and Saved Job replay | None |
| v0.6 Migration decision | Decided and implemented: no validated demand for a full migration suite; navigation now exposes a bounded, dry-run-first **Copy between orgs** workflow and removes the larger suite | Revisit only if research demonstrates demand for relationship-aware migration |
| Later differentiation | Deliberately deferred | Pull an item forward only through a dated, evidence-backed roadmap decision; no tester count blocks this release |

The completed dev-box evidence and the repeatable validation procedure are recorded in
[`docs/release-validation.md`](docs/release-validation.md).

## v0.2.1 — Trust and polish

**Goal:** make the shipped product dependable before expanding its scope.

### Correctness

- Fix local Compare's reversed Added/Removed classification ([#31](https://github.com/Exotic209093/WaveLink/issues/31)).
- Select or request a valid comparison key when `Id` is unavailable ([#32](https://github.com/Exotic209093/WaveLink/issues/32)).
- Repair onboarding and Help routes instead of silently falling back to Home ([#33](https://github.com/Exotic209093/WaveLink/issues/33)).
- Route the Org Health quick link to the actual Org Health view ([#34](https://github.com/Exotic209093/WaveLink/issues/34)).
- Make Excel and XML available from the primary SOQL export flow ([#35](https://github.com/Exotic209093/WaveLink/issues/35)).
- Make every export format honor the selected columns ([#36](https://github.com/Exotic209093/WaveLink/issues/36)).
- Preserve the current query and org when the user selects **Schedule this** ([#37](https://github.com/Exotic209093/WaveLink/issues/37)).

### Quality and safety

- Complete the accessibility pass across forms, navigation, Help, command
  palette, dialogs, and keyboard focus ([#38](https://github.com/Exotic209093/WaveLink/issues/38)).
- Replace the vulnerable spreadsheet parser and clear actionable dependency
  findings ([#39](https://github.com/Exotic209093/WaveLink/issues/39)).
- Add interaction tests around every primary workflow and navigable screen
  ([#40](https://github.com/Exotic209093/WaveLink/issues/40)).
- Establish enforced app and lazy-chunk performance budgets
  ([#41](https://github.com/Exotic209093/WaveLink/issues/41)).
- Run a packaged-extension smoke matrix against a dedicated Salesforce development org:
  query, four-format export, insert, update, upsert, delete, dry run, Bulk API,
  REST Collections, retry, undo, schedule execution, popup, and in-page panel.

### Release gate

- No known critical or primary-workflow correctness defects.
- Export, Import, Convert, Compare, and Schedule interaction tests pass.
- The real-org smoke matrix passes in a dedicated non-customer org and production safeguards are verified before writes.
- Primary workflows are usable with keyboard-only navigation and have no unnamed
  controls in the accessibility tree.
- The production dependency audit has no unaccepted high or critical findings.

## v0.3 — Guided product and UI rework

**Goal:** make WaveLink feel like one guided data product rather than a collection
of utilities. Reduce cognitive load, strengthen visual hierarchy, and organize
the interface around user jobs rather than historical screens.

### Target experience

Every primary workflow should use the same understandable lifecycle:

```text
Choose job → Configure → Review impact → Run → Results & recovery
```

- Display one obvious primary action per stage.
- Keep secondary actions available without competing with the primary action.
- Preserve work when the user moves between connected stages.
- Keep target org, environment, operation, and record count visible before and
  during every Salesforce write.
- Put errors beside the setting or record that caused them, then summarize them
  at the stage level.
- Use plain Salesforce/data language instead of internal WaveLink terminology.

### Navigation and information architecture

- Keep **Workflow** focused on Home, Export, Import, and Convert.
- Rename **Library** to **Jobs & Activity**, containing Saved Jobs, Schedules,
  Compare, snapshots, results, and recovery.
- Keep developer/admin utilities inside one **Advanced** destination rather than
  promoting individual utilities into primary navigation.
- Remove Migration from top-level navigation and place it under an explicitly
  labelled **Experimental** area until the v0.6 decision.
- Use one navigation row at a time. Avoid stacking group navigation, sub-tabs,
  breadcrumbs, and local tabs unless each level communicates a distinct scope.
- Add predictable breadcrumbs and back behavior inside Advanced and project
  workspaces.
- Ensure every navigable destination has a stable route, page title, and active
  navigation state.

### Visual system rework

- Keep the existing blue/teal identity, but use a flatter and quieter surface
  system with fewer simultaneous gradients, glass effects, shadows, and pills.
- Define semantic design tokens for surfaces, text, borders, focus, brand,
  success, warning, danger, spacing, typography, and elevation.
- Establish a clear type scale with body and control text normally at 13–14px;
  reserve 11–12px text for supporting metadata rather than instructions.
- Standardize page headers, cards, form sections, tables, dialogs, empty states,
  progress states, and result summaries.
- Reduce nested cards and use whitespace or section dividers when another
  container does not add meaning.
- Replace emoji with a consistent, local SVG icon set using a shared size,
  stroke, alignment, and accessible-label policy.
- Keep Brand, Neutral, Destructive, and Text as the core button hierarchy and
  remove one-off button treatments.
- Use motion sparingly for navigation context and progress; respect reduced
  motion everywhere.
- Design light and dark themes together, including contrast, focus rings,
  validation states, tables, charts, and disabled controls.
- Refresh Chrome Web Store screenshots after the new UI ships so the listing
  represents the current product and primary workflows.

### Responsive and data-dense behavior

- Define layouts for the full app, in-page panel, and popup rather than shrinking
  one desktop layout into every surface.
- Keep critical actions visible through sticky stage/action bars on long forms.
- Let dense tables use the available width while keeping filters, column
  selection, pagination, and row actions predictable.
- Collapse secondary metadata before compressing labels or interactive targets.
- Set minimum keyboard/touch target sizes and test common laptop widths as well
  as the narrow in-page panel.

### Export workspace

- Use one export experience for CSV, JSON, Excel, and XML.
- Connect **Run**, **Download**, **Save**, and **Schedule** without losing state.
- Add multiple named query tabs with drag-and-drop reordering.
- Save column selections and output settings per query.
- Support parameterized queries for reusable values such as dates, owners,
  statuses, and record IDs.
- Clearly explain and select between REST Query and Bulk API 2.0 Query.
- Remember the last useful workspace state per org.

### Guided Import

Replace the current dense surface with a staged workflow:

```text
Upload → Object & operation → Mapping → Clean & validate → Review → Run → Results
```

- Make Cleanser an optional Import stage rather than a disconnected destination.
- Show mapping confidence, unresolved fields, and missing required fields.
- Resolve lookup relationships using IDs, external IDs, or related-record fields.
- Add an explicit **blank means ignore / blank means clear** choice.
- Preview operation, target org, API mode, record count, and likely API usage.
- Keep production-org warnings visible throughout review and execution.
- Download complete success and error files.
- Retry failed rows without reprocessing successful rows.
- Save the completed setup as a reusable job.

### Activity and recovery

Combine Push History, Audit Trail, Undo history, scheduled runs, and migration
reports into one **Activity** center with:

- Status, org, object, operation, source, duration, and record counts.
- Detailed success and grouped error results.
- Retry, resume, cancel, download results, and undo actions where applicable.
- Clear recovery limits and expiration dates.

### Onboarding and navigation

- Replace the generic tutorial with short contextual guidance inside each stage.
- Open the relevant feature with safe example data rather than marking a step
  complete merely because a link was clicked.
- Add visible breadcrumbs/back behavior for Advanced and project workflows.
- Preserve unsaved work when switching between related destinations.

### Screen rework order

1. **App shell and Home:** simplify navigation, org/environment context, global
   actions, responsive layout, and product entry points.
2. **Guided Import:** replace the densest and highest-risk screen with the staged
   workflow below.
3. **Export workspace:** connect query, results, column selection, download,
   save, and schedule actions in one stateful workspace.
4. **Activity and Recovery:** unify status, results, retry, undo, and downloads.
5. **Schedules, Saved Jobs, and Compare:** apply the shared job model and visual
   system to recurring/read-only workflows.
6. **Advanced and Experimental:** standardize utility layouts only after the
   primary workflows are stable.

### Accessibility requirements

- Every control has a programmatic name and every visible label is correctly
  associated with its control.
- Dialogs trap and restore focus; tabs, comboboxes, menus, tables, and progress
  indicators follow their expected keyboard and ARIA patterns.
- Current navigation and workflow stage are available to assistive technology.
- Status is communicated through text and semantics, never colour alone.
- Focus order follows the visible workflow, and all actions work without a mouse.
- Automated accessibility scans and keyboard smoke tests run for every primary
  screen and representative modal.

### Release gate

- A new user can complete an export and a validated import without documentation.
- No primary job requires navigating through unrelated screens.
- The maintainer-authorized dev-box walkthrough confirms that target org, operation, and commit step
  are understood before any write begins.
- The owner completes first export, dry-run import, and Saved Job replay without
  consulting developer documentation.
- A visual inventory finds no duplicate navigation destinations, unexplained
  one-off control styles, or emoji icons in primary workflows.
- Primary screens pass automated accessibility scans at desktop and panel widths.
- The refreshed store screenshots accurately show Home, Export, Import, Compare,
  and Activity using the production theme.

## v0.4 — Scale and reliability

**Goal:** make large and long-running jobs trustworthy under Manifest V3.

- Add Bulk API 2.0 query for high-volume exports.
- Stream file parsing and output generation instead of retaining entire datasets
  in memory.
- Persist job checkpoints so a service-worker restart does not lose progress.
- Resume interrupted export and import jobs by job ID.
- Extend offscreen execution to long imports and migration operations.
- Report progress using processed and failed record counts.
- Support cancel, resume, serial mode, concurrency limits, and safe timeouts.
- Warn before processing files or record counts likely to exceed local limits.
- Add schedule time zones, next-run preview, run history, failure reason, and a
  visible reconnect requirement.
- Forecast snapshot storage usage before retention settings are saved.

### Release gate

- Worker/extension reload and service-recreation tests do not corrupt or silently lose jobs.
- Large-job limits are measured and documented.
- Every background job leaves a recoverable status and downloadable result.

## v0.5 — Repeatable data workflows

**Goal:** make recurring work take a few clicks rather than rebuilding a setup.

### Saved Jobs library

Unify export templates, import mapping profiles, schedules, and legacy templates
around a versioned saved-job definition:

- Operation, object, query or input source.
- Field selection, mappings, transformations, and lookup rules.
- Source and target org roles without storing secrets.
- API and safety settings.
- Output format and naming.
- Optional schedule and retention policy.
- Version history, duplicate, favourite, import, and export configuration.

### Snapshot center

- Browse snapshots on a timeline by job, org, object, and status.
- Re-download in supported formats.
- Compare any two snapshots or compare a snapshot with live org data.
- Turn selected differences into a reviewed import job.
- Pin important snapshots and preview retention/storage impact.

### Release gate

- A saved weekly export or import can be run safely in three clicks or fewer.
- Saved jobs are portable between browsers without credentials or customer data.
- Editing a saved job produces an auditable new version.

## v0.6 — Migration decision

**Goal:** either make migration credible or reduce it to a smaller, honest
cross-org copy workflow.

Decision recorded 2026-08-30: current evidence does not justify maintaining a
full migration product. WaveLink therefore ships the smaller path below and does
not expose the former project/validation/report/template/ID-map suite in normal
navigation.

If user demand justifies the investment, consolidate the current Migration
Projects, Validation, Reports, Templates, and ID Maps screens into one project
workspace:

```text
Project setup
  → Source/target preflight
  → Object selection
  → Dependency plan
  → Field and relationship mapping
  → Validation
  → Execute or resume
  → Verify
  → Report or rollback
```

Production-ready migration requires:

- Cross-org field and external-ID mapping.
- Relationship dependency ordering and explicit cycle handling.
- Per-object filters, defaults, and transformations.
- Persistent ID remapping.
- Resumable execution and per-object retry.
- Migration-wide rollback in reverse dependency order.
- Pre/post record counts and configurable data verification.
- Complete success/error/ID-map report.
- Automated and real-org coverage for every phase.

The selected direction is a guided **Copy between orgs** job for one controlled
object at a time. It requires a dry-run review and typed confirmation, strips
system fields, supports insert/update/upsert with explicit external-ID handling,
and states that it does not provide dependency migration or migration-wide
rollback. The larger migration navigation surface has been removed.

## Later — Differentiation

> **2026-08-31:** most of this list is now sequenced, with entry gates, in
> [Beyond 1.0 — the road to 3.0](#beyond-10--the-road-to-30):
> diagnostics bundle → v1.1; backup profiles, masking → v1.5; Sheets,
> SOSL/GraphQL, shareable configs → v2.0; seeding, FLS preflight, browser
> ports → v2.5. The list is kept for reference.

Consider these only after the earlier release gates are met and user demand is
validated:

- Sensitive-field detection, masking, and export warnings.
- Sandbox seeding recipes with deterministic generated data.
- Google Sheets as an import/export source.
- Shareable job configurations with secrets and record data removed.
- Scheduled local backup profiles.
- Permission and field-level-security preflight reports.
- Optional SOSL and Salesforce GraphQL query modes.
- Local diagnostics bundle for troubleshooting without exposing customer data.
- Edge and Firefox support after extension behavior is stable in Chrome.

## Consolidate the current product

| Current surfaces | Direction |
|---|---|
| Export + legacy Query | One Export workspace |
| Import + Data Push + Cleanser | One guided Import workflow |
| Push History + Audit Trail + Undo + reports | One Activity and Recovery center |
| Export/import templates + legacy templates | One Saved Jobs library |
| Diff + live Data Comparison | Keep one Compare workspace and share semantics |
| Schema comparison entry points | One Schema Gap Analysis tool |
| Migration Projects + Validation + Reports + Templates + ID Maps | Removed from navigation; replaced by bounded Copy between orgs |
| Anonymous Apex + REST Explorer + API Usage + Inspector | One clearly labelled Developer Tools area |
| Org Health + Coverage nested inside Cleanser | Move to Developer/Admin tools; do not mix with data cleaning |

## Explicitly defer

The following are attractive but should not interrupt the core roadmap:

- AI-generated SOQL or AI field mapping.
- Metadata deployment, bulk field creation, and flow scanning.
- Permission-set/profile administration.
- Git-based data versioning.
- Cloud synchronization of customer data.
- Additional browser ports before Chrome workflows are stable.

These features expand WaveLink toward a general Salesforce administration suite,
where mature tools already compete. WaveLink should first win on safe,
connected, local data workflows.

## Measures of success

WaveLink does not need invasive telemetry to improve the experience. Release
reviews can use opt-in feedback, structured manual tests, and local diagnostics.

- Time for a new user to complete first export and first dry-run import.
- Percentage of users who identify the correct primary action within five seconds.
- Number of simultaneously visible actions and navigation levels per workflow stage.
- Percentage of test scenarios completed without documentation.
- Failed jobs with an actionable error and recoverable result.
- Jobs successfully resumed after worker/browser interruption.
- Steps required to rerun a saved job.
- Keyboard and accessibility audit pass rate.
- Primary workflow bundle size and time to interactive.
- Defect escape rate for core workflows.

## Recommended sequence

1. Ship **v0.2.1 Trust and polish**.
2. Build **v0.3 Guided product and UI rework**, starting with the app shell and
   Guided Import, without adding unrelated tools.
3. Prove **v0.4 Scale and reliability** with measured large-job tests.
4. Add **v0.5 Repeatable data workflows** once the job model is stable.
5. Use real user demand to choose the scope of **v0.6 Migration**.
6. Pull Later items forward only when they support validated workflows.
7. Fix the audit findings through **v0.7–v0.9** and ship the **v1.0 trust
   release** (see [Road to 1.0](#road-to-10-2026-08-31-audit)).
8. Relaunch and grow through the **1.x arc**, then let evidence gates decide
   entry into the **2.x arc and 3.0** (see [Beyond 1.0](#beyond-10--the-road-to-30)).

## Market reference points

- [Salesforce Data Loader](https://help.salesforce.com/s/articleView?id=sf.data_loader_about.htm&language=en_US)
  sets expectations for large files, reusable mappings, and detailed success and
  error logs.
- [Salesforce CLI Bulk Export](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data_export_bulk.html)
  demonstrates resumable, job-based exports at millions-of-record scale.
- [Jetstream Load Records](https://docs.getjetstream.app/load) demonstrates
  related-field mapping, null-handling controls, multiple file sources, and
  explicit API-mode choices.
- [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded)
  covers a broad developer/admin surface; WaveLink should differentiate through
  connected data workflows, local-first privacy, and safer repeatability rather
  than duplicating every utility.
