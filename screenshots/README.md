# Store Screenshots

The Chrome Web Store requires **at least 1 screenshot** before your listing can go live.

## Requirements
- **Dimensions:** 1280x800 px or 640x400 px (exactly — no scaling)
- **Format:** PNG or JPEG
- **Count:** 1–5 screenshots

## Current release shots

Take screenshots of these key flows in the extension:

| File name | What to capture |
|-----------|----------------|
| `screenshot-01-home.png` | Connected Home workspace |
| `screenshot-02-export.png` | SOQL Export with results in the grid |
| `screenshot-03-import-review.png` | Production-aware Import review |
| `screenshot-04-compare.png` | Local files and snapshot Compare workspace |
| `screenshot-05-activity.png` | Unified Jobs & Activity history |

All five images were captured from the v1.0.0 build on 2026-10-22 at exactly 1280x800 PNG, using
fictional demo data only (an "Acme demo" org with made-up Accounts such as "Blue Harbor Logistics").
The production build (`npm run build`) was served locally with a scratch in-page fake `chrome.*` API and a
stubbed Salesforce REST endpoint, then captured with headless Edge over CDP (light theme; page scale 0.7-0.85
so results fit the frame). No real org, user, or record identifiers appear. The scratch harness lives in the
untracked `preview/harness/` folder.

## Promotional assets

Run `npm run assets:store` to regenerate the two brand-consistent promotional images:

- `promo-small-440x280.png` — required small promotional tile
- `promo-marquee-1400x560.png` — optional marquee promotional tile

The generator uses the checked-in WaveLink SVG and deterministic SVG composition, so the assets
can be reproduced without external services or licensed stock imagery.

## How to Take Them

1. Load the unpacked extension in Chrome (`chrome://extensions` → Load unpacked → select `dist/`)
2. Open a Salesforce org and trigger each feature
3. Use the browser's built-in screenshot tool or a tool like [Lightshot](https://app.prntscr.com/) to capture at exactly 1280×800

Place the finished PNG files in this `screenshots/` folder.
