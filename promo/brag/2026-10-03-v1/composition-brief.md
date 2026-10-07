# Hyperframes Composition Brief: WaveLink v2

Create a polished 22-second landscape launch film following `brag-plan.md`. Composition: `composition/`; final: `brag.mp4`; resolution 1920×1080 at 30fps. This is the full brag workflow, not the generic Hyperframes intent interview.

## Product and creative contract

WaveLink is a local-first Salesforce data extension. Show the export journey: SOQL → records → CSV. Use the real logo and source-grounded UI elements from `src/ui/screens/ExportScreen.tsx`, `QueryScreen.tsx`, `src/ui/components/ResultsGrid.tsx`, `ExportModal.tsx`, and palette/type from `src/ui/styles/uiCss.ts`. Project root is two directories above the composition. The four-scene contract and exact copy are in the plan. Adapt framing to video, but do not invent controls or feature claims.

Tone is polished: clear medium-weight typography, readable UI, restrained motion, purposeful cursor interaction. V2 should visibly improve on v1's screenshot tour. One coherent job, not a catalogue of feature slides. Sample records are invented and labelled. No live customer/org data, tokens, hostnames or performance statistics.

## Audio and motion

Use the brag-bundled vol.12 music copied to `assets/music/` and its supplied cue JSON. Music gain around 0.3–0.35, a short fade-in and final 1.5–2s fade-out. No voice or narration assets. Select warm low-HF-risk SFX from the installed brag skill after authoring the actual interaction. Assets and analysis paths are in the plan's provenance and local `assets/` tree.

Subtle audio reactivity on the product-panel light/presence is desired. Read `hyperframes-creative/references/audio-reactive.md`; use its own extractor, not an invented path. Record any genuine extraction blocker. Prefer strong cue 8.74 for results, 13.11 if file payoff fits, 18.56 for logo; do not sacrifice reading time. Mark genuine beat locks in source.

## Implementation and verification

Read and apply the installed domain skills `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, and `hyperframes-cli`, plus their required references. Search the local catalog before hand-authoring an equivalent move. All fonts, media and runtime dependencies local. Keep the composition deterministic and seek-safe. Run `hyperframes check` and resolve all findings. Inspect snapshots of every scene and interaction state. Start Studio preview and render locally; the user requested a completed v2, so local rendering is already authorized. Do not publish or contact external services with project content. Preserve v1.

Final delivery includes best-frame poster and frame-zero poster bake, share copy, reproducible source, and verification. No blanket safety or release claims.
