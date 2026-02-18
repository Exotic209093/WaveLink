# WaveLink — Salesforce Data Seeding Chrome Extension

Push CSV/JSON data into Salesforce orgs, run SOQL queries, compare schemas, and seed test data — all directly from your browser.

---

## Features

- **Data Push** — Upload CSV or JSON files and push records into any Salesforce object using the REST or Bulk API v2. Supports field mapping, data transformation, and duplicate detection.
- **SOQL Query Runner** — Write and execute SOQL queries against any connected org. Save and organise queries in folders.
- **Schema Explorer** — Browse Salesforce object schemas, view field metadata, and visualise object relationships as an interactive graph.
- **Schema Comparison** — Diff the schema of any two objects or two orgs side-by-side to spot configuration drift.
- **Data Comparison** — Compare record-level data across orgs to validate data migrations.
- **Push History & Undo** — Track every push operation and roll back inserts when needed.
- **Multi-Org Support** — Connect and switch between multiple Salesforce orgs (production and sandbox).

---

## Installation

### From the Chrome Web Store *(coming soon)*

Search for **WaveLink** in the Chrome Web Store and click **Add to Chrome**.

### From Source

1. Clone the repo: `git clone https://github.com/jc-wave/wave-link.git`
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` folder.

---

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Watch mode — rebuilds on file changes |
| `npm run build` | Production build |
| `npm run test` | Run unit tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint TypeScript source |
| `npm run typecheck` | Type-check without emitting |
| `npm run package` | Create a store-ready zip |

---

## Privacy

WaveLink stores all data locally on your device using `chrome.storage.local`. No data is sent to any server other than Salesforce. See the full [Privacy Policy](public/privacy.html).

---

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines on pull requests, coding style, and how to run tests.

---

## Security

To report a security vulnerability, please open a private security advisory on GitHub. See [SECURITY.md](docs/SECURITY.md) for details.

---

## License

MIT © James C
