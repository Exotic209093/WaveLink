# assets/

This folder contains static assets referenced in the documentation.

## Required Files

| File | Referenced In | Description |
|------|--------------|-------------|
| `screenshot-01.png` | README.md | Main app screenshot showing the Data Push screen |
| `demo.gif` | README.md | Animated demo showing a typical data push workflow |

## Producing the Screenshot

Capture `screenshot-01.png` from the WaveLink full-page app:

1. Open WaveLink full app (800px wide or wider)
2. Navigate to the Data Push screen with a sample dataset loaded
3. Use Chrome DevTools device emulation or a screenshot tool
4. Crop to show the app chrome, org switcher, and data table
5. Recommended dimensions: 1280 × 800px, PNG format

## Producing the Demo GIF

Record `demo.gif` showing the core workflow:

1. Open a Salesforce sandbox org → WaveLink auto-detects it
2. Open the full app → navigate to Data Push
3. Drag a CSV file onto the import area
4. Map fields → click Push → show progress → show success
5. Navigate to Push History to show the completed entry

Recommended tools: [LICEcap](https://www.cockos.com/licecap/) (Windows/Mac), [Kap](https://getkap.co/) (Mac), [Peek](https://github.com/phw/peek) (Linux)

Target: < 5 MB, 15–30 seconds, 600–800px wide, looping.
