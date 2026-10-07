WaveLink promo — full / polished
================================

DELIVERABLE
output/wavelink-promo-full-polished.mp4
75 seconds, 1920 x 1080, 30 fps, H.264 / AAC stereo.
Original instrumental music, animated typography, genuine redacted product
screenshots, eight chapters, optional embedded English subtitles.
No voiceover. Open index.html for the local player and download links.

ALSO INCLUDED
output/wavelink-promo.srt          Separate captions
output/wavelink-poster.jpg         Poster image
output/storyboard.jpg             Eight-scene contact sheet
output/wavelink-original-score.wav Original synthesized music master
storyboard.json                   Editable copy, timing and source references
render.py                         Reproducible animation, audio and encoding

RENDER
Run from the repository root:
  python -m pip install -r promo/requirements.txt
  python promo/render.py --stills
  python promo/render.py

The renderer uses the checked-in screenshots and Windows Segoe UI fonts.
WAVELINK_FONT_DIR can point to another directory containing segoeui.ttf,
segoeuib.ttf and segoeuil.ttf. No remote rendering or asset service is needed.

EDITORIAL SCOPE
This is a preview of the project represented by its v0.6.0 release screenshots.
It does not assert parity with the current Chrome Web Store release. The CTA
points to the source project. All UI images come from screenshots/; no live
org was accessed. See storyboard.json for claim sources and exclusions.

The soundtrack is composed and synthesized by render.py using deterministic
oscillators and percussion; there are no external music samples or stock tracks.
The product source and existing assets remain unchanged.
