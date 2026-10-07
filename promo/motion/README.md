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
