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
| `screenshot-02-export.png` | SOQL Export with redacted live results |
| `screenshot-03-import-review.png` | Production-aware Import review |
| `screenshot-04-compare.png` | Local files and snapshot Compare workspace |
| `screenshot-05-activity.png` | Unified Jobs & Activity history |

All five images were captured from the packaged v0.6.0 release-candidate build on 2026-08-30 at
exactly 1280x800. Org, user, and record identifiers were redacted before capture.

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
