# WaveLink - agent notes

WaveLink is a local-first Chrome Manifest V3 extension (TypeScript + Preact) for safer Salesforce
data exports, imports, comparisons, schedules and reusable jobs. Everything runs in the browser;
there is no WaveLink server. Existing docs are the source of truth, so link rather than copy:
[README.md](README.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md), [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md),
[docs/release-validation.md](docs/release-validation.md), [docs/large-job-limits.md](docs/large-job-limits.md).
Note: `docs/ARCHITECTURE.md` header still says v0.1.0 and lists four bundles; webpack now builds five.

## Directory map

- `src/background/` - service worker (`index.ts`, `offscreen.ts`); owns all business logic and message handlers.
- `src/popup/`, `src/app/`, `src/content/`, `src/offscreen/` - the other entry points (popup, full-page app, content script on Salesforce tabs, offscreen document).
- `src/core/` - `types/`, `constants/`, `errors/` (typed errors, `hints.ts`), `utils/`; shared, no UI.
- `src/services/salesforce/` - REST/Bulk/Composite/auth clients (`api-client.ts`, `bulk-api.ts`, `bulk-results.ts`, `composite-upsert.ts`, `auth.ts`).
- `src/services/messaging/`, `src/services/storage/` - message bus wrapper; `chrome.storage` abstraction.
- `src/data/` - `mappers/`, `validators/`, `templates/`.
- `src/ui/` - `app/` (`AppRoot.tsx`, `routes.ts`), `popup/`, `panel/`, `screens/` (one per screen), `components/`, `hooks/`, `api/sf.ts` (UI-to-background wrapper), `utils/`, `styles/uiCss.ts`.
- `tests/` - `unit/`, `mocks/` (chrome, style, runtime messages, `testSetup.ts`), `fixtures/`, `performance/`.
- `scripts/` - package/validation helpers (`package-extension.js`, `validate-package.js`, `generate-store-assets.js`, `generate-icons.js`, `chrome-cdp.js`, `validate-salesforce-org.ts`).
- `public/` - `manifest.json`, `_locales`, icons copied into `dist/`. `dist/` and `coverage/` are gitignored build output.
- `promo/` - motion/marketing work, NOT product code (see Gotchas).
- `docs/`, `roadmap.md`, `CHANGELOG.md` (root; `docs/CHANGELOG.md` is only a pointer to it).

## Architecture and data flow

Four isolated contexts talk over Chrome message passing. UI contexts are thin clients; the
background worker does the work. UI code calls `src/ui/api/sf.ts`, which sends a typed message
(`src/core/types/messaging.ts`); `MessageBus` handlers in `src/background/index.ts` call
`src/services/salesforce/*` and storage, and reply `{ ok, ... }`. Progress is broadcast back.
Webpack entries (from `webpack.config.ts`): background, popup, content, app, offscreen, output to
`dist/<name>/index.js`; async chunks go to `dist/chunks/`.

Key entry files:
- `src/ui/app/AppRoot.tsx` (~590 lines) - full-page shell: navigation, theme, org context, lazy screens. Routes and legacy aliases live in `src/ui/app/routes.ts`.
- `src/ui/screens/DataPushScreen.tsx` (~1490 lines) - the data push/import screen; large, edit carefully.
- `src/services/salesforce/bulk-api.ts` (~390 lines) - `BulkApiService`, CSV header/cell building (`bulkCsvHeaders`, `bulkCsvCellValue`, `BULK_NULL_VALUE`).
- `src/background/index.ts` - message routing (`AUTH_INITIATE`, `AUTH_STATUS`, ...).

## Commands (all from repo root; names verified in package.json)

- Install: `npm ci` (CI) or `npm install`.
- Dev watch build: `npm run dev` (webpack watch to `dist/`). Launch config `.claude/launch.json` defines `dev` and `test:watch` (via `cmd /c npm run ...`); there is no web server, load `dist/` via `chrome://extensions` > Developer mode > Load unpacked, and reload after rebuilds.
- Build: `npm run build`.
- Typecheck: `npm run typecheck` (`tsc --noEmit`, includes tests).
- Lint: `npm run lint -- --max-warnings=0` (CI requires zero warnings); fix with `npm run lint:fix`.
- Full tests: `npm test`. With coverage gates: `npm run test:coverage -- --runInBand`.
- Single file: `npx jest --config jest.config.ts tests/unit/<file>.test.tsx`
- Single test name: `npx jest --config jest.config.ts tests/unit/<file>.test.tsx -t "<name>"`
- Package check / zip: `npm run smoke:package`; `npm run package` (build + smoke + zip).
- Audits: `npm run audit:prod`, `npm run audit:dev` (both at `--audit-level=high`).
- Optional real-org check: `npm run validate:salesforce` (needs an org; see docs/release-validation.md).
- CI (`.github/workflows/ci.yml`, Node 20): typecheck, lint max-warnings=0, both audits, coverage with `--runInBand`, build, smoke:package.

## Gotchas

- Jest uses jsdom with `ts-jest`; `preact` and `@testing-library/preact` are mapped by path in `jest.config.ts`. Chrome APIs are mocked in `tests/mocks/chromeMock.ts`. Coverage thresholds are global floors (statements 30, branches 21, functions 20, lines 31).
- Path aliases (`@core`, `@services`, `@background`, `@popup`, `@content`, `@data`) exist in tsconfig and jest; there is no `@ui` alias, so use relative imports in `src/ui`.
- `promo/` has no root package.json. `promo/motion/` renders with `node promo/motion/render.mjs` plus Python (`pip install -r promo/requirements.txt`, Pillow/numpy/imageio-ffmpeg); `promo/render.py` builds the 75 s promo; `promo/brag/*/composition/` each have their own package.json (hyperframes + gsap). Do not touch it for product changes; do not lint or test it.
- Root contains old release zips (`wavelink-0.*.zip`), `brag-output-*`, `coverage/`, `dist/`; leave them alone.
- Python on this machine defaults to cp1252: set `PYTHONUTF8=1` for promo scripts; use `python`, not `python3`.
- Write multi-line scripts to a file rather than long inline heredocs. Do not poll with `sleep N; cat`; use background runs or monitors.
- Never use a production org for development or tests; no secrets, tokens or org identifiers in code, tests, fixtures or screenshots.
- Check `git status` first; the tree often has uncommitted work from other sessions.

## Conventions

- Branches off `main`: `feature/<name>`, `fix/<name>`, `docs/<name>` (docs/CONTRIBUTING.md). Recent history uses squash-merged PRs (`... (#131)`).
- Conventional Commits, subject under 72 chars: `feat(push): ...`, `fix(auth): ...`, `chore(deps): ...`.
- PR checklist (`.github/PULL_REQUEST_TEMPLATE.md`): typecheck, lint and tests pass; bug fixes add a regression test; Salesforce write-path changes state how they were verified; update README/CHANGELOG/docs for user-facing changes.
- Changelog: root `CHANGELOG.md`, Keep a Changelog format with an `## [Unreleased]` section.
- Strict TypeScript: no `any`, no unexplained `@ts-ignore`; shared types go in `src/core/types/`.
- Preact components: one per file, named exports, hooks only. UI must not import `@services/` directly; go through `src/ui/api/sf.ts`.
- All Salesforce calls go through `src/services/salesforce/api-client.ts` (no raw `fetch`); storage through `src/services/storage/index.ts`.
- Background handlers return `{ ok: false, error }` instead of throwing; use typed errors from `src/core/errors/`.
- Styles live only in `src/ui/styles/uiCss.ts`, using CSS custom properties (`--wl-*`) so dark mode works.
