WaveLink v2 — brag full / polished
================================

The 22-second version follows the actual latent-spaces/brag skill and uses
HyperFrames 0.8.115 to render a local HTML/GSAP composition. It demonstrates
one export journey: query, sample records, CSV file. No voiceover.

Files
  brag.mp4               Final 1920x1080, 30fps video with poster as frame zero
  brag.jpg               Selected full-resolution poster
  brag-render.mp4        Original HyperFrames render before poster insertion
  share-copy.txt         Ready-to-use caption
  brag-plan.md           Product angle, storyboard and source grounding
  composition-brief.md   HyperFrames creative handoff
  composition/           Editable timeline, local assets and dependencies
  verification.json     Final duration, frame, decoding and audio checks
  credits.txt            Music, SFX, product and workflow attribution
  finish.py             Reproduce poster selection, frame-zero bake and QA

The UI is an illustrative reconstruction with fictional sample records,
not a recording of a live Salesforce org or a performance benchmark.
The first version remains in ../promo/.

Local editing / rendering (PowerShell, from composition/)
  npm ci
  $env:PATH="$PWD/tools;$PWD/node_modules/ffprobe-static/bin/win32/x64;$env:PATH"
  $env:DO_NOT_TRACK='1'
  npm run check
  npx --yes hyperframes@0.8.115 preview --background
  npm run render -- --quality delivery --fps 30 --output ../brag-render.mp4

The tools/ directory contains the local FFmpeg executable used for this run.
If recreating from source on another machine, install FFmpeg onto PATH or
place ffmpeg.exe in composition/tools. FFprobe is installed by npm ci.
Python finish.py uses Pillow; then run it from this directory with a selected
settled frame time (see verification.json for the delivered selection):
  python finish.py --poster-time 1.9

Creation and rendering were local. No publication has been performed.
