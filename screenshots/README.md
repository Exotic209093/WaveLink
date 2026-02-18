# Store Screenshots

The Chrome Web Store requires **at least 1 screenshot** before your listing can go live.

## Requirements
- **Dimensions:** 1280x800 px or 640x400 px (exactly — no scaling)
- **Format:** PNG or JPEG
- **Count:** 1–5 screenshots

## Recommended Shots

Take screenshots of these key flows in the extension:

| File name | What to capture |
|-----------|----------------|
| `01-popup.png` | The popup with an active org connected |
| `02-data-push.png` | The data push screen mid-upload with field mapping visible |
| `03-soql-query.png` | The SOQL query editor with results |
| `04-schema-graph.png` | The schema relationship graph for a standard object |
| `05-org-comparison.png` | Side-by-side schema diff between two orgs |

## How to Take Them

1. Load the unpacked extension in Chrome (`chrome://extensions` → Load unpacked → select `dist/`)
2. Open a Salesforce org and trigger each feature
3. Use the browser's built-in screenshot tool or a tool like [Lightshot](https://app.prntscr.com/) to capture at exactly 1280×800

Place the finished PNG files in this `screenshots/` folder.
