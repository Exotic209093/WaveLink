# Brag Plan: WaveLink v2

Invocation: `$brag --full --tone polished`. Landscape, 1920×1080, 30 fps, 22 seconds. Music and SFX on; narration off. This new run preserves `promo/` (v1).

## Nine-question planning rubric

1. **What is it?** A local-first Chrome extension for exporting, importing, comparing and reusing Salesforce data jobs.
2. **Strongest claim:** “Run a SOQL query, preview results, then download as CSV, JSON, Excel, or XML.” This is the actual Export screen copy.
3. **Visual hook:** A large SOQL query becomes a crisp results table, then an export file; the cyan WaveLink mark links the sequence.
4. **Actual UI:** Recreate the key elements of `ExportScreen.tsx`, `QueryScreen.tsx`, `ResultsGrid.tsx` and `ExportModal.tsx`: SOQL editor, Run query, Results, export format and filename. Include the real logo. Preserve source labels and hierarchy while enlarging the relevant elements for video.
5. **Shortest satisfying film:** 22 seconds. Enough for query → results → file, with a clear opening and closing.
6. **Tone:** Polished; a precise, quiet product film. Medium-weight type, generous space, one idea at a time, soft transitions. The app interaction provides the movement.
7. **Audio:** Bundled Happy Beats / Business Moves vol. 12 at restrained volume, a few warm click/reveal sounds, final fade. No voiceover.
8. **Share caption:** “Meet WaveLink: a local-first Salesforce data workspace in your browser. Write SOQL, preview records, and export to CSV, JSON, Excel or XML.”
9. **User flow:** Enter a SOQL query → run and inspect three sample records → select CSV and export. All data is fictional; this is an illustrative animation, not a timed benchmark or live org session.

## The angle

Show one useful job from beginning to end. V1 surveyed features using screenshots; v2 brings the export interaction to life using source-grounded UI at readable scale. Hook: **Salesforce data. Ready to move.** End: **WaveLink. Local-first. Built for Salesforce.**

## Visual identity

From `src/ui/styles/uiCss.ts`: ink `#072033`, paper `#f0f7ff`, secondary paper `#e3f0fc`, accent `#0284a8`, cyan `#48cae4`. Dark scene option: `#091b2a`, text `#e5f2ff`. Use the actual `public/icons/wavelink-icon.svg`. Product font stack starts with Aptos / Segoe UI; ship a local Segoe UI fallback for consistent renders. Monospace is the source's Consolas fallback.

Bright product-focused middle scenes, dark or brand-ink bookends. Avoid persistent presentation headers, decorative progress bars, generic waves, tiny full-page screenshots and unrelated feature grids. UI labels can be supporting detail, but headlines and query text must read at social-video size.

## Storyboard

### 1 — Ready to move — 0.0–3.8 (3.8s)

WaveLink mark and the two-line hook settle by 0.7s. An enlarged genuine SOQL editor element begins the product reveal; product presence in the first two seconds. Keep the headline settled for at least 2.4s. Sequential/interaction: one query panel enters, no long copy. Audio: music fade-in and one soft panel accent. Transition: 0.6s clean move/crossfade into the working app.

### 2 — Query to records — 3.8–10.8 (7.0s)

Heading: **Query. Preview.** Enlarge the source SOQL interface. Reveal `SELECT Name, Industry FROM Account LIMIT 3`; a cursor presses **Run query**, then **Results** appears with three rows. Fictional sample names: Northstar Labs / Harbor Studio / Summit Works. Industry values: Technology / Media / Manufacturing. “Sample data” remains visible. No fabricated elapsed time or performance claim. Sequential/interaction: cursor → press → results arrive, with enough time to inspect the settled result. Warm click at press; restrained reveal cue for results. Target results landing near strong cue 8.74s. Transition to Export Data modal.

### 3 — Records to file — 10.8–17.5 (6.7s)

Heading: **Your data. Your format.** Recreate ExportModal controls with exact labels **Export Data**, **Export Format**, **Filename**, **Export**. Formats CSV / JSON / Excel (XLSX) / XML are source-grounded. CSV is selected; filename `accounts.csv`. A cursor clicks Export and the file tile appears as the payoff. Sequential/interaction: choose CSV → export → file. No fake success percentages, user counts or safety guarantees. File payoff may land near strong cue 13.11s or use natural timing if readability needs longer. All essential text holds at least 1.2s. Transition: soft reduction into logo.

### 4 — WaveLink — 17.5–22.0 (4.5s)

Real logo, **WaveLink**, **Local-first. Built for Salesforce.** and `github.com/Exotic209093/WaveLink`. Logo settle near 18.56s strong cue. Long final hold, music fade to silence. No availability claim about store release. Product-preview / illustrative sample-data label stays discreet and readable.

Scene durations: 3.8 + 7.0 + 6.7 + 4.5 = **22.0 seconds**.

## Music cue guidance

Track: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`; preset read from installed brag skill's `assets/music/cues/`. Estimated tempo 109.96 BPM. Strong cues: 8.74, 13.11, 18.56 seconds. Use 1–3 genuine locks; shift only when readability survives. Sequential accents may follow 7.64 / 8.19 / 8.74, but readable table rows can arrive together and hold. A subtle music-reactive highlight on the product panel is appropriate; no equalizer, particles or distracting pulse.

SFX: low-risk interface clicks and warm soft impact for one reveal; avoid bright repeated ticks. Exact placement follows the authored motion. Music is a bed, never louder than the skill's 0.5 gain cap.

## Grounding and delivery

Sources: the screen/components listed above, `uiCss.ts`, `README.md`, `PRIVACY.md`, and real logo. No org access. UI is a faithful illustrative reconstruction with invented records, explicitly labelled. Avoid unfinished rollback/scheduling claims. Deliver local `brag.mp4`, a selected `brag.jpg` baked into frame zero, editable Hyperframes composition, and `share-copy.txt`. Use the complete brag workflow and Hyperframes check; no publication.
