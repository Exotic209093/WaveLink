# Changelog

All notable changes to WaveLink are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] — 2026-08-31

### Added
- **Credential-free org roles** — Saved Jobs describe active/choose-at-run source and target roles without persisting org identities or authentication data.
- **Unified Activity trail** — combines imports, scheduled runs, durable export/import checkpoints, result downloads, grouped errors, retry, resume, cancel, and time-limited undo with status/org/object/operation/source filters.
- **Explicit null and relationship mapping** — each mapped field can ignore or clear blanks, and references can resolve by Salesforce ID, external ID, or related-record field through the REST-safe relationship path.
- **Complete push outcome files** — Results can download source-preserving success and error CSV files, including created IDs, source row numbers, and grouped Salesforce errors.
- **Safe onboarding examples** — onboarding can preload bounded export/import examples and only records completion after the user explicitly confirms the task.
- **Saved Jobs library** — versioned export/import/schedule definitions with search, favourites, duplicate, revision history, legacy-template migration, and a portable format that whitelists configuration while excluding credentials, org IDs, record data, and literal customer defaults.
- **Snapshot Center** — filter and pin scheduled snapshots, re-download four formats, compare snapshot-to-snapshot or against live org data, and turn reviewed differences into a guided Import.
- **Bulk API 2.0 Query** — asynchronous large exports with paged results, progress, cancellation, durable Salesforce job checkpoints, and browser-restart recovery.
- **Reliable long-running jobs** — offscreen Bulk finalization, durable non-sensitive progress checkpoints, resume by Salesforce job ID, actionable interruption states, and downloadable summaries.
- **Schedule operations** — IANA time zones, next-run previews, bounded run history, reconnect guidance, pinned retention, and snapshot storage forecasts.
- **REST / Tooling API Explorer** — a new Advanced tool to make ad-hoc authenticated calls against the org: pick a method and path (relative to `/services/data/vXX`, or a `/services/`-rooted absolute path) with an optional JSON body, and view the raw status + response. Quick-example chips for common endpoints; powered by a shared non-throwing `rawCall` primitive so error responses are visible too.
- **Apex debug-log capture** — the Anonymous Apex runner can now capture the execution's debug log: it ensures a short-lived TraceFlag/DebugLevel for the current user, then fetches the resulting ApexLog body (filtered to this run and polled for async persistence). Best-effort — the Apex still runs and reports status if capture is unavailable.
- **Anonymous Apex runner** — a new Advanced tool that executes anonymous Apex against the org via the Tooling API (⌘/Ctrl+Enter to run) and reports compile problems, runtime exceptions with stack traces, and line/column, with a note that debug-log capture requires trace flags.
- **Record Inspector — create & delete** — alongside inline edit, you can now create a new record of any createable object (with picklist/boolean selects) and jump straight into it, delete the current record (guarded), and drill into parent records via 🔍 on reference fields.
- **Smarter import field mapping** — auto-mapping now matches source headers against Salesforce field **labels** as well as API names (so a column like "Account Name" maps to the `Name` field), with a confidence-scored engine (`suggestFieldMappings`) that also surfaces fuzzy near-misses for review.
- **Unmapped-required warning** — the Import/Push screen now flags required, createable fields that have no mapping *before* you push, so rows no longer fail in the org with `REQUIRED_FIELD_MISSING`.
- **Searchable object & field pickers** — long object and field lists are now type-to-filter across the app. A new reusable combobox replaces the native dropdowns on Import/Push (object + per-row target-field), Compare/Data Comparison (object + match field), Bulk Object Ops, Duplicate Detection, Data Quality Scorecard, Clone Wizard, and the Cleanser validation panel — no more scrolling 500+ options. The Objects screen also gained a field search box.
- **Record Inspector** — a new Advanced tool (Salesforce-Inspector style): paste any 15/18-character record ID — or click the 🔍 on any ID in a results grid — and see every field with its value, API name, and label in one searchable table. **Edit updateable fields inline and save** them back to the org (behind a confirm dialog), **expand child relationships** to drill into related records, and copy any value. Re-enables inline cell editing in the SOQL results grid now that a verified single-record update path exists.
- **Mapping match badges & suggestions** — mapping rows show how each field was auto-matched (`auto` / `via label`), and weaker fuzzy matches appear as one-click `Suggest: <field>` chips instead of being applied silently.
- **Reusable mapping profiles** — when you load a file for an object that has saved mapping templates, the Push screen surfaces one-click `Apply: <name>` chips so saved mappings actually get reused.
- **Proactive low-storage warning** — an app-wide banner warns at ≥80% of the local storage quota with a shortcut to the Settings purge tools.
- **Field labels in the SOQL builder** — the field checklist, WHERE, ORDER BY, and aggregate pickers now show the field label alongside the API name.

### Changed
- **Guided product and UI rework** — simplified task-first navigation, quieter semantic design tokens, local SVG icons, responsive app/panel layouts, a seven-stage Import, named draggable Export tabs with per-tab settings and parameters, and a unified Jobs & Activity hub.
- **Honest cross-org workflow** — replaced the unvalidated migration-suite navigation with a bounded **Copy between orgs** flow that makes dry-run, typed confirmation, system-field stripping, and unsupported dependency/rollback behavior explicit.
- **Large-data envelope** — streams CSV input, builds large CSV/JSON/XML downloads from bounded chunks, warns at local limits, auto-selects Bulk where appropriate, and documents a measured 100,000-row test envelope.
- **Smaller startup bundles** — primary workflow screens load on navigation, keeping the app entrypoint around 189 KiB and reducing the popup entrypoint to about 142 KiB by loading Guided Import after connection. Enforced webpack budgets guard entrypoints and async assets.
- **Secured XLSX support** — upgraded from the vulnerable npm-registry SheetJS 0.18.5 build to the official 0.20.3 distribution and its XLSX-only mini browser build. Legacy `.xls` input is no longer accepted; `.xlsx` files are capped at 20 MB and 100,000 worksheet rows.

### Fixed
- **Production write safeguards** — insert, update, upsert, and delete now require an operation/count-specific typed phrase in production; regression coverage prevents ordinary confirmation from bypassing this boundary.
- **Fast push completion ordering** — very small REST/Bulk jobs yield until the start response is registered, preventing a completion broadcast from racing ahead of the Results screen.
- **Current-tab org context** — the header now shows the connected Salesforce host and PROD/SBX state even before that org is saved in the switcher.
- **Schedule relative timestamps** — sub-minute runs render as “just now” instead of “just now ago”.
- **REST Collections updates** — collection update requests now include the required Salesforce sObject type metadata instead of sending untyped records; a guarded real-org validator and regression test cover the request contract.
- **Compare orientation and keys** — local baseline comparisons now classify right-only rows as Added and left-only rows as Removed, and automatically choose a valid shared key when `Id` is absent or differently cased.
- **Onboarding and Help navigation** — tutorial targets use canonical route IDs, legacy leading-slash links resolve correctly, unknown routes show an explicit not-found state, and Org Health opens the actual Org Health screen.
- **Connected export flow** — the main query workflow exposes CSV, JSON, XLSX, and XML through one selected-column export path; JSON no longer leaks hidden fields or Salesforce `attributes` metadata.
- **Schedule current query** — **Schedule this** opens a new schedule with the exact editor SOQL and connected org preselected.
- **Core accessibility semantics** — Help topics are keyboard-operable, navigation exposes the current page, Query controls have accessible names, and the command palette now exposes dialog/combobox/listbox semantics, traps focus, supports Escape, and restores focus.
- **Production dependency gate** — CI now fails on high-severity production dependency findings.

## [0.2.0] — 2026-06-08

WaveLink is now focused on **fast Salesforce data export & import** — get data
in and out of Salesforce right from your browser, with nothing leaving your device.

### Added
- **Multi-format export** — export SOQL query results to CSV, JSON, Excel, or XML.
- **Scheduled snapshots** — schedule recurring exports so you always have a fresh copy of key objects.
- **Export diffing** — compare two exports side by side with colour-coded differences.
- **Import dry-run pre-flight** — simulate a push before it runs to catch problems early.
- **Live push progress** — a real-time migration/push progress dashboard with cancel, retry, and stored-ID views.
- **Data-quality scoring** in the Cleanser.
- **In-app dialogs** — native browser prompts/confirms replaced with consistent in-app modals.

### Changed
- Repositioned from a migration tool to a focused data export & import tool (name and store listing updated).
- Refreshed UI, including an overhauled in-page panel and a consolidated **Compare** tool (merged the former Diff and Data Comparison screens).
- Reorganised the Advanced area into a hub plus a dedicated Migration section.
- Adopted a consistent button system across the core data flows.
- Shortened the manifest description to meet the Chrome Web Store 132-character limit.

### Fixed
- Surfaced previously silent failures from user-triggered actions.
- Open the full app via the background tabs API to avoid ad-blocker blocking.
- Accessibility: labelled icon-only controls and marked dialogs for assistive tech.

## [0.1.0]

- Initial release.

[0.6.0]: https://github.com/Exotic209093/WaveLink/releases/tag/v0.6.0
[0.2.0]: https://github.com/Exotic209093/WaveLink/releases/tag/v0.2.0
[0.1.0]: https://github.com/Exotic209093/WaveLink/releases/tag/v0.1.0
