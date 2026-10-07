WaveLink v3 ? motion design revision

brag.mp4              Final 22-second 1080p/30fps film with music and SFX
brag.jpg              Settled hook poster, also baked as frame zero
share-copy.txt        Posting caption
composition/          Editable HTML/GSAP project and local assets
brag-plan.md          V3 storyboard and creative direction
source-grounding.md   Original nine-question product rubric and sources
verification.json    Video, poster, full-decode and audio verification

V3 adds masked kinetic typography, a perspective query camera, record-to-file
choreography, a four-format fan and a cascading brand close. Fictional sample
records are labelled. No live Salesforce org was accessed.

Re-render from composition/ (PowerShell):
  npm ci
  $env:PATH="$PWD/tools;$PWD/node_modules/ffprobe-static/bin/win32/x64;$env:PATH"
  $env:DO_NOT_TRACK='1'
  npm run check
  npm run render -- --quality delivery --fps 30 --output ../brag-render.mp4
Then from this directory:
  python finish.py --poster-time 1.8

Studio: http://localhost:3018/#project/composition
Prior versions are preserved. No publication has been performed.
