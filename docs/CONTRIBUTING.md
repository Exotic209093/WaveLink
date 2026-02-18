# WaveLink — Contributing Guide

> Thank you for considering a contribution to WaveLink. Whether it's a bug fix, a new feature, improved docs, or just a well-written issue — it all matters.

---

## Table of Contents

1. [Code of Conduct](#1-code-of-conduct)
2. [Ways to Contribute](#2-ways-to-contribute)
3. [Development Setup](#3-development-setup)
4. [Project Structure](#4-project-structure)
5. [Development Workflow](#5-development-workflow)
6. [Code Conventions](#6-code-conventions)
7. [Testing](#7-testing)
8. [Submitting a Pull Request](#8-submitting-a-pull-request)
9. [Issue Guidelines](#9-issue-guidelines)
10. [Architectural Principles](#10-architectural-principles)

---

## 1. Code of Conduct

Be respectful. Contributions should be made in good faith and with the goal of improving the project for the Salesforce community. Harassment, dismissiveness, or bad-faith contributions will not be tolerated.

---

## 2. Ways to Contribute

| Type | How |
|------|-----|
| **Bug report** | [Open an issue](https://github.com/jc-wave/wave-link/issues) with the Bug Report template |
| **Feature request** | [Open an issue](https://github.com/jc-wave/wave-link/issues) with the Feature Request template |
| **Bug fix** | Fork → branch → fix → PR |
| **New feature** | Discuss in an issue first, then fork → branch → implement → PR |
| **Documentation** | Edit docs directly and open a PR — no build needed |
| **Tests** | Add tests to `tests/unit/` for any untested utility or service |
| **Translations / i18n** | [TODO: i18n is not yet implemented — raise an issue to discuss approach] |

---

## 3. Development Setup

### Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| Node.js | 18 | LTS recommended |
| npm | 9 | Included with Node 18 |
| Google Chrome | 115 | Manifest V3 support |
| Git | 2.x | Any recent version |

### Clone and Install

```bash
git clone https://github.com/jc-wave/wave-link.git
cd wave-link
npm install
```

### Build

```bash
npm run build        # Production build → dist/
npm run dev          # Watch mode — rebuilds on file change
```

### Load into Chrome for Development

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `dist/` folder

After each `npm run dev` rebuild, click the **reload icon** on the WaveLink card in `chrome://extensions`.

### TypeScript Check

```bash
npm run typecheck    # Runs tsc --noEmit; exits 0 if clean
```

### Lint

```bash
npm run lint         # ESLint report
npm run lint:fix     # ESLint with auto-fix
```

### Tests

```bash
npm test             # Run all unit tests
npm run test:watch   # Watch mode
npm run test:coverage  # Coverage report in /coverage
```

All three checks (`typecheck`, `lint`, `test`) should pass before opening a PR.

---

## 4. Project Structure

```
src/
├── background/          Background service worker — message routing, push orchestration
├── popup/               Popup entry point
├── app/                 Full-page app entry point
├── content/             Content script (Salesforce page detection, panel injection)
├── core/
│   ├── types/           TypeScript type definitions (Salesforce, messaging, storage)
│   ├── constants/       App-wide constants (API versions, batch sizes, TTLs)
│   ├── errors/          Error class hierarchy
│   └── utils/           Pure utility functions
├── services/
│   ├── salesforce/      Salesforce API clients (REST, Bulk, Composite, Auth)
│   ├── messaging/       Chrome extension message bus wrappers
│   └── storage/         chrome.storage.local abstraction
├── data/
│   ├── mappers/         Field mapping + transformations
│   ├── validators/      Schema-aware data validation
│   └── templates/       Data template definitions
└── ui/
    ├── app/             AppRoot — full-page app component
    ├── popup/           PopupRoot — popup component
    ├── panel/           PanelRoot — in-page side panel component
    ├── components/      Reusable Preact components
    ├── screens/         One component per screen (19+ screens)
    ├── hooks/           Custom Preact hooks
    ├── api/             UI-specific API wrappers (thin layer over messaging)
    ├── utils/           Pure UI utility functions (SOQL builder, exports, diffs, etc.)
    └── styles/          uiCss.ts — CSS-in-JS design tokens and dark mode
tests/
├── unit/               Jest unit tests
└── mocks/              Chrome API mocks, CSS mocks
```

---

## 5. Development Workflow

### Branching

| Branch | Purpose |
|--------|---------|
| `main` | Stable, released code |
| `feature/<name>` | New feature in development |
| `fix/<name>` | Bug fix |
| `docs/<name>` | Documentation-only changes |

Always branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
```

### Making Changes

1. Make your change in the appropriate layer (see [Project Structure](#4-project-structure))
2. Run `npm run dev` to rebuild continuously
3. Test your change in Chrome against a Salesforce org (sandbox is fine — never use production for development)
4. Add or update unit tests in `tests/unit/`
5. Ensure `npm run typecheck`, `npm run lint`, and `npm test` all pass

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(push): add dry-run mode that validates without committing
fix(auth): handle expired refresh token gracefully
docs(contributing): add branching conventions
test(soql): add coverage for nested relationship queries
refactor(storage): extract TTL logic into helper
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`, `perf`

Scopes (optional): `push`, `auth`, `query`, `schema`, `storage`, `ui`, `popup`, `background`, `content`, `cleanser`, `pipeline`, `export`, `import`

Keep the subject line under 72 characters. Add a body paragraph for non-obvious changes.

---

## 6. Code Conventions

### TypeScript

- **Strict mode** is enabled — no `any`, no implicit `any`, no `@ts-ignore` without a comment explaining why
- Use `interface` for object shapes, `type` for unions and aliases
- Export types from `src/core/types/` — do not define shared types inline in component files
- Use `const` by default; `let` only when reassignment is needed
- Prefer explicit return types on functions that are part of a public API

### Components (Preact)

- One component per file
- Named exports only — no default exports from component files
- Use hooks for state and side effects; avoid class components
- Keep components small — extract logic into `utils/` when a component function exceeds ~50 lines
- Do not import directly from `@services/` in components — use the `ui/api/sf.ts` wrapper

### Styling

- All styles live in `src/ui/styles/uiCss.ts`
- Use the existing CSS custom properties (`--wl-primary`, `--wl-bg`, `--wl-text`, etc.) — do not hard-code colours
- Dark mode is handled via `data-theme="dark"` on the root — your CSS selectors should not need to check for dark mode manually if you use the tokens
- Do not use external CSS files for component styles — inject into the same `uiCss.ts` string

### Services and Background

- All Salesforce API calls go through `src/services/salesforce/api-client.ts` — do not call `fetch()` directly in background or UI code
- All storage reads/writes go through `src/services/storage/index.ts`
- Message handlers in `background/index.ts` should be short — extract business logic into separate functions
- Add complexity comments (e.g., `// O(n log n) — sorts by fetchedAt`) for non-trivial algorithms

### Error Handling

- Use the typed error classes in `src/core/errors/` — `AuthError`, `ApiError`, `ValidationError`, `PushError`
- Always return `{ ok: false, error: message }` from background message handlers on failure — never throw across context boundaries
- Log errors to the background console, not to `chrome.storage` or user-visible UI, unless surfacing them intentionally

---

## 7. Testing

### What to Test

| Layer | Test focus |
|-------|-----------|
| `src/core/utils/` | All utility functions — pure functions are easy to test |
| `src/data/validators/` | Validation logic with valid and invalid inputs |
| `src/data/mappers/` | Field mapping transformations |
| `src/ui/utils/` | SOQL builder, data diff, export, duplicate detection, etc. |
| `src/services/storage/` | Storage CRUD operations (use the Chrome storage mock) |

### What Not to Test (at unit level)

- UI rendering — screen components are integration-tested manually in Chrome
- Background message routing — covered by manual testing of the full flow
- Salesforce API responses — use integration tests (not yet implemented) or manual testing

### Writing Tests

```typescript
// tests/unit/my-util.test.ts
import { myFunction } from '../../src/ui/utils/myUtil';

describe('myFunction', () => {
  it('returns X when given Y', () => {
    expect(myFunction('input')).toBe('expected');
  });

  it('throws ValidationError for invalid input', () => {
    expect(() => myFunction('')).toThrow('Expected error message');
  });
});
```

The Chrome API mock (`tests/mocks/chromeMock.ts`) is available globally in all tests — you can use `chrome.storage.local.get` etc. in tests without additional setup.

### Running Tests

```bash
npm test                      # Run all tests once
npm run test:watch            # Re-run on file change
npm run test:coverage         # Generate HTML coverage report in /coverage
```

Target: maintain or improve coverage for any file you modify.

---

## 8. Submitting a Pull Request

### Before Opening

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0 (or `npm run lint:fix` has been run)
- [ ] `npm test` exits 0
- [ ] `npm run build` produces a clean `dist/`
- [ ] You've manually tested your change in Chrome against a sandbox org
- [ ] New or modified functionality has unit tests where practical
- [ ] The PR description explains **what** changed and **why**

### PR Title

Follow the same Conventional Commits format as commit messages:

```
feat(cleanser): add regex-based column filter step
fix(push): prevent double-submit on rapid button clicks
```

### PR Description Template

```markdown
## What
A short description of what this PR does.

## Why
The problem it solves or the feature it adds, and why this approach was chosen.

## Testing
- [ ] Tested in Chrome against [Org type: sandbox / scratch org]
- [ ] Unit tests added for [what]
- [ ] Manual test steps: [list steps]

## Notes
Any caveats, known limitations, or follow-up work.
```

### Review Process

- PRs are reviewed by the maintainer (@jc-wave) within 5 business days
- Automated checks: TypeScript, ESLint, Jest (no CI yet — planned in roadmap)
- Feedback will be specific; address all comments before requesting re-review
- Once approved, the maintainer merges using squash-and-merge to keep history clean

---

## 9. Issue Guidelines

### Bug Reports

Include:
- Chrome version
- WaveLink version
- Steps to reproduce (minimal, reproducible)
- Expected vs. actual behaviour
- Service worker console output (sanitise any org-specific data)

### Feature Requests

Include:
- The problem you're trying to solve (not just the solution)
- How you currently work around it (if at all)
- How often you'd use this feature
- Whether you'd be willing to implement it

### Questions

For general questions, open a Discussion rather than an Issue. Issues are reserved for confirmed bugs and accepted feature requests.

---

## 10. Architectural Principles

If you're contributing a non-trivial feature, keep these principles in mind:

1. **Business logic in the background** — UI contexts are thin clients. Push orchestration, API calls, and data transformation happen in the background service worker, not in component files.

2. **Pure functions in utils** — All `src/ui/utils/` functions should be pure (no side effects, no API calls). This makes them easy to test and reason about.

3. **Typed everything** — Add types to `src/core/types/` for any new data structures that cross context boundaries (messages, storage, API responses).

4. **No circular dependencies** — The dependency graph is strictly layered: `ui` → `services` → `core`. Never import from `ui/` inside `services/` or `core/`.

5. **Chrome storage is the source of truth** — In-memory state is a cache of storage. On service worker restart, state is rebuilt from storage. Design features to be resilient to worker restarts.

6. **No external dependencies for core flows** — The push and query flows must work offline (except for the Salesforce API calls themselves). Do not add runtime dependencies that phone home.

7. **Fail gracefully** — Every background handler should return `{ ok: false, error: string }` instead of throwing. The UI should render error states for all failure modes.

See [docs/ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.
