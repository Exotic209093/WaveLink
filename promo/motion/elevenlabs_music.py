"""Generate a music bed for the 15s promo with the ElevenLabs Music API.

    python promo/motion/elevenlabs_music.py [--takes 2] [--style viral|keynote|hard] [--cut 15|30]

Reads ELEVENLABS_API_KEY from the environment (never from the repo). Uses a
composition plan whose section durations match the scene cuts in cues.json, so
the build lands on the dashboard reveal and the drop on the cut into scene 3.
Candidates are written to output/audio/candidates/; pass one to the renderer with
    node promo/motion/render.mjs --music <file>
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "output" / "audio" / "candidates"
API = "https://api.elevenlabs.io/v1/music"

STYLES = {
    "viral": ["energetic tech-pop", "punchy four-on-the-floor kick", "sidechained synth chords", "glossy plucks",
              "risers and impacts", "premium product launch", "clean modern mix", "124 BPM", "instrumental"],
    "keynote": ["minimal electronic", "crisp claps", "deep sub bass", "shimmering arpeggios", "airy pads",
                "sleek and confident", "cinematic tech commercial", "120 BPM", "instrumental"],
    "hard": ["future bass meets electro house", "big supersaw drop", "snappy snares", "whooshes and riser FX",
             "hype tech trailer", "128 BPM", "instrumental"],
}
NEGATIVE = ["vocals", "singing", "spoken word", "lo-fi", "muddy mix", "acoustic guitar", "long fade-in"]


def audio_dir(cut):
    return HERE / "output" / ("cut-30" if cut == 30 else "") / "audio"


def scene_edges(cut=15):
    """Section boundaries (ms) from the composition's own cue map (fallback for old cue files)."""
    cues = json.loads((audio_dir(cut) / "cues.json").read_text(encoding="utf-8"))["cues"]
    at = {c["type"]: c["t"] for c in cues}
    # whoosh ≈ 3 s (dashboard), riser ≈ 8 s (scene 3), sting ≈ 12 s (outro); snap to 0.5 s for the model
    snap = lambda t: int(round(t * 2) / 2 * 1000)
    return [0, snap(at["whoosh"]), snap(at["riser"]), snap(at["sting"]), 16000]


def plan(style, cut=15):
    spec = json.loads((audio_dir(cut) / "cues.json").read_text(encoding="utf-8"))
    if spec.get("music"):
        return {
            "positive_global_styles": STYLES[style],
            "negative_global_styles": NEGATIVE,
            "sections": [
                {"section_name": m["name"], "positive_local_styles": m["pos"], "negative_local_styles": m["neg"],
                 "duration_ms": int(round((m["end"] - m["start"]) * 1000)), "lines": []}
                for m in spec["music"]
            ],
        }
    e = scene_edges(cut)
    sections = [
        ("Intro", ["sparse", "filtered synths", "soft sub swell", "anticipation"], ["drums at full power"]),
        ("Build", ["groove enters", "tight hats", "rising energy", "plucked arpeggio", "riser at the end"], ["drop"]),
        ("Drop", ["full drop", "big kick and clap", "wide sidechained chords", "maximum energy"], ["breakdown"]),
        ("Outro", ["final impact on the downbeat", "ambient tail", "shimmering pad", "decay to silence"], ["new melody"]),
    ]
    return {
        "positive_global_styles": STYLES[style],
        "negative_global_styles": NEGATIVE,
        "sections": [
            {"section_name": name, "positive_local_styles": pos, "negative_local_styles": neg,
             "duration_ms": e[i + 1] - e[i], "lines": []}
            for i, (name, pos, neg) in enumerate(sections)
        ],
    }


def generate(key, body, path):
    req = urllib.request.Request(f"{API}?output_format=mp3_44100_192", data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            path.write_bytes(r.read())
            return True
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:600]
        print(f"ElevenLabs API error {err.code}: {detail}")
        return False


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--takes", type=int, default=2)
    ap.add_argument("--style", choices=STYLES, default="viral")
    ap.add_argument("--model", default="music_v1")
    ap.add_argument("--cut", type=int, choices=(15, 30), default=15)
    args = ap.parse_args()
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("Set ELEVENLABS_API_KEY in the environment.")
    out = audio_dir(args.cut) / "candidates"
    out.mkdir(parents=True, exist_ok=True)
    body = {"composition_plan": plan(args.style, args.cut), "model_id": args.model, "respect_sections_durations": True}
    print("sections:", [(s["section_name"], s["duration_ms"]) for s in body["composition_plan"]["sections"]])
    taken = {int(p.stem.rsplit("-", 1)[1]) for p in out.glob(f"eleven-{args.style}-*.mp3") if p.stem.rsplit("-", 1)[1].isdigit()}
    numbers = [k for k in range(1, 1000) if k not in taken][: args.takes]
    for i, k in enumerate(numbers):
        path = out / f"eleven-{args.style}-{k}.mp3"
        if not generate(key, body, path):
            sys.exit(1)
        print(f"take {i + 1} → {path}")


if __name__ == "__main__":
    main()
