# Changelog

All notable changes to WaveLink are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- **Lazy-load Excel support** — the SheetJS library (~875 KiB) now loads on demand only when an Excel file is imported or exported, cutting the main app bundle from ~745 KiB to ~344 KiB for the CSV/JSON/XML majority.

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

[0.2.0]: https://github.com/Exotic209093/WaveLink/releases/tag/v0.2.0
[0.1.0]: https://github.com/Exotic209093/WaveLink/releases/tag/v0.1.0
