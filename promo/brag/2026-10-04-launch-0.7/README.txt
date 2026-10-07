WaveLink 0.7 — calm cut (main) and energetic cut

brag.mp4          Calm cut: 25 s, 1080p/30fps, warm editorial style, Wavey mascot, voiceover + ambient bed
mascot/           Wavey, the WaveLink mascot: wavey.svg (editable) and wavey.png (512px, transparent)
brag-energetic.mp4  Earlier 21 s kinetic cut (dark/cyan, upbeat music); source in work/index-energetic.html
brag.jpg          Poster (hook frame at 2.6s), baked in as frame zero
share-copy.txt    Caption, postable as-is
brag-plan.md      Angle, answers, storyboard, music cues
composition/      Editable HTML/GSAP source (Hyperframes 0.8.115)
verification.json Video, poster, full-decode and audio checks

UI copy comes from the source (TypedConfirmModal, DataPushScreen toasts,
_locales). Records are fictional and labelled "sample data". No live org.

Not committed (see promo/brag/.gitignore): node_modules, the bundled ffmpeg,
raw renders, drafts, and the Microsoft fonts. Before re-rendering, run `npm ci`
in composition/, copy SitkaVF.ttf, SitkaVF-Italic.ttf, segoeui*.ttf, seguisb.ttf
and consola.ttf from C:\Windows\Fonts into composition/assets/fonts/, and put
ffmpeg.exe in composition/tools/.

Re-render (PowerShell, from composition/):
  $env:PATH="$PWD/tools;$PWD/node_modules/ffprobe-static/bin/win32/x64;$env:PATH"
  $env:DO_NOT_TRACK='1'
  npm run check
  npm run render -- --quality delivery --fps 30 --output ../brag-render.mp4
Then from this folder:
  python finish.py --poster-time 2.5

Nothing has been published.

Voiceover: ElevenLabs (voice "Eric"), generated on a free-tier account. Check
ElevenLabs' licence terms (attribution / commercial use) before publishing.
Line files are in composition/assets/vo/. After re-rendering, re-run the
loudness step: loudnorm I=-16 TP=-2 + alimiter, AAC 192k, -t 25.
Music bed: synthesised locally by work/music/make_bed.py (no third-party licence).
The API key is not stored anywhere in this folder.
