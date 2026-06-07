# Changelog

All notable changes to WaveLink are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
