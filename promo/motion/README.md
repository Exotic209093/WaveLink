# WaveLink motion promos (15 s and 30 s)

- `output/wavelink-15s.mp4`: 15 s, 1920×1080 at 60 fps, with music and sound effects.
- `output/cut-30/wavelink-30s.mp4`: 30 s cut that adds the Push and Compare scenes.

## How it works

- **`wavelink-15s.html`** is a deterministic composition: every frame is a pure function of time. The `TL` table drives both the animation and the audio cue map (`__wl.cues()`). Open it in Chrome to preview. Space pauses, ←/→ scrub, and `?cut=30` switches to the 30 s cut.
- **`render.mjs`** drives headless Chrome over the DevTools protocol. It runs a layout-collision audit, renders frames into ffmpeg, muxes the soundtrack, and verifies A/V sync.
- **`audio.py`** builds frame-locked sound effects on the cue map (numpy only) and mixes them over either a synthesised score or a supplied music bed. The master is −16 LUFS with a −1 dBTP ceiling, and the final frame is silent.
- **`elevenlabs_music.py`** generates music beds with the ElevenLabs Music API. The section lengths come from the composition, so the drops line up with the scene cuts.

## Render

Needs Node 22+, Chrome or Edge, and Python with `numpy` and `imageio-ffmpeg` (`pip install -r promo/requirements.txt`).

```
node promo/motion/render.mjs --music promo/motion/output/audio/candidates/eleven-viral-1.mp3
node promo/motion/render.mjs --cut 30 --music promo/motion/output/cut-30/audio/candidates/eleven-viral-1.mp3
node promo/motion/render.mjs --stills          # audit + key frames and a contact sheet
python promo/motion/elevenlabs_music.py --cut 30 --takes 3   # needs ELEVENLABS_API_KEY in the environment
```

Without `--music`, the soundtrack uses the built-in synthesised score.

## WaveLink 1.0 launch pieces (`wavelink-v1.html`)

A separate composition for the 1.0 launch. It covers scheduled backups, the snapshot diff, export, guarded import, the audit fixes and an end card with Wavey. One file renders two formats:

- `?format=landscape`: 1920×1080, 30 s → `output/v1/wavelink-1.0-30s.mp4`
- `?format=vertical`: 1080×1920, 15 s → `output/v1/wavelink-1.0-15s-vertical.mp4`

Its `TL` table holds the scene windows for both formats plus each scene's beats. Vertical scenes play the same beats faster. Working files (cues, stems, stills, contact sheet, poster) go to `output/v1/landscape/` and `output/v1/vertical/`. The audit enforces a 64 px safe area for landscape. For vertical it enforces 90 px, with the bottom 220 px kept clear for platform UI.

```
# audit + stills/contact sheet
node promo/motion/render.mjs --src wavelink-v1.html --format landscape --stills --out-dir promo/motion/output/v1/landscape
node promo/motion/render.mjs --src wavelink-v1.html --format vertical  --stills --out-dir promo/motion/output/v1/vertical

# music beds (optional; ElevenLabs sections must be >= 3 s): export cues, then generate takes
node promo/motion/render.mjs --src wavelink-v1.html --format landscape --cues-only --out-dir promo/motion/output/v1/landscape
python promo/motion/elevenlabs_music.py --audio-dir promo/motion/output/v1/landscape/audio --takes 2

# full renders (omit --music for the synthesised score)
node promo/motion/render.mjs --src wavelink-v1.html --format landscape --duration 30 --out-dir promo/motion/output/v1/landscape --out promo/motion/output/v1/wavelink-1.0-30s.mp4 --music promo/motion/output/v1/landscape/audio/candidates/eleven-viral-2.mp3
node promo/motion/render.mjs --src wavelink-v1.html --format vertical --duration 15 --out-dir promo/motion/output/v1/vertical --out promo/motion/output/v1/wavelink-1.0-15s-vertical.mp4 --music promo/motion/output/v1/vertical/audio/candidates/eleven-viral-2.mp3
```

`render.mjs` options for other compositions: `--src` (the HTML file), `--format landscape|vertical` (sets the viewport), `--duration` (asserts the composition's length), and `--out-dir` (working folder; the default is `output/<src>-<format>/`). Without `--src`, it renders `wavelink-15s.html` exactly as before.

`output/v1/share/` holds 30 fps copies for posting and for players that stutter on 60 fps (H.264 Main@4.1, CRF 18, AAC 192 kb/s, faststart):

```
ffmpeg -i wavelink-1.0-30s.mp4 -vf fps=30,format=yuv420p -c:v libx264 -profile:v main -level:v 4.1 -preset slow -crf 18 -maxrate 8M -bufsize 16M -g 60 -c:a aac -b:a 192k -movflags +faststart share/wavelink-1.0-30s-share.mp4
```
