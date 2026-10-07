"""Render the WaveLink promo locally: python promo/render.py

Use --stills for quick visual QA. Outputs are reproducible; no remote services,
browser automation, product data or credentials are used. Fonts default to the
Windows Segoe UI family and can be overridden with WAVELINK_FONT_DIR.
"""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "output"
OUT.mkdir(exist_ok=True)
STORY = json.loads((HERE / "storyboard.json").read_text(encoding="utf-8"))
W, H = STORY["resolution"]
FPS = STORY["fps"]
DURATION = STORY["duration_seconds"]
INK = "#081D30"
WHITE = "#F5FBFF"
MUTED = "#ADCAD9"
CYAN = "#66DBEF"
FONT_DIR = Path(os.environ.get("WAVELINK_FONT_DIR", "C:/Windows/Fonts"))
FONTS = {}
ASSETS = {}


def font(size, weight="regular"):
    key = (size, weight)
    if key not in FONTS:
        name = {"regular": "segoeui.ttf", "bold": "segoeuib.ttf", "light": "segoeuil.ttf"}[weight]
        FONTS[key] = ImageFont.truetype(str(FONT_DIR / name), size)
    return FONTS[key]


def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def text(draw, xy, value, size, fill=WHITE, weight="regular", anchor=None):
    draw.text(xy, value, font=font(size, weight), fill=fill, anchor=anchor,
              stroke_width=0)


def tracking(draw, xy, value, size=20, spacing=4, fill=CYAN):
    x, y = xy
    for char in value:
        text(draw, (x, y), char, size, fill, "bold")
        x += draw.textlength(char, font=font(size, "bold")) + spacing


def group(canvas, elapsed, delay, painter, distance=34):
    a = ease((elapsed - delay) / 0.9)
    if a <= 0:
        return
    if a >= 1:
        painter(canvas, 0)
        return
    layer = Image.new("RGBA", (W, H))
    painter(layer, round(distance * (1 - a)))
    layer.putalpha(layer.getchannel("A").point(lambda p: round(p * a)))
    canvas.alpha_composite(layer)


def background():
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.exp(-(((xx - W * .82) / (W * .52)) ** 2 + ((yy - H * .48) / (H * .83)) ** 2) * 2)
    floor = yy / H
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    for i, (base, amp) in enumerate([(5, 5), (18, 41), (33, 50)]):
        arr[:, :, i] = base + amp * glow + floor * (2 if i == 0 else 5)
    return Image.fromarray(arr).convert("RGBA")


BG = background()
LOGO = Image.open(ROOT / "public/icons/icon-128.png").convert("RGBA")


def waves(canvas, t, center=770, amplitude=80, alpha=48):
    layer = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(layer)
    for n in range(4):
        pts = []
        for x in range(-10, W + 12, 8):
            y = center + n * 27 + amplitude * math.sin(x / 320 - t * .17 + n * .34)
            y += 26 * math.sin(x / 610 + t * .11)
            pts.append((x, y))
        d.line(pts, fill=(78, 212, 235, max(5, alpha - n * 9)), width=2)
        p = ((t * 105 + n * 510) % (W + 100)) - 50
        py = center + n * 27 + amplitude * math.sin(p / 320 - t * .17 + n * .34) + 26 * math.sin(p / 610 + t * .11)
        d.ellipse((p - 5, py - 5, p + 5, py + 5), fill=(120, 232, 246, alpha + 70))
    canvas.alpha_composite(layer)


def chrome(canvas, idx, t):
    d = ImageDraw.Draw(canvas)
    logo = LOGO.resize((46, 46), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, (98, 61))
    text(d, (159, 59), "WaveLink", 32, WHITE, "bold")
    tracking(d, (W - 395, 73), "PRODUCT PREVIEW", 15, 3, MUTED)
    d.line((100, 133, W - 100, 133), fill="#254051", width=1)
    text(d, (100, H - 69), "SALESFORCE DATA, IN YOUR FLOW.", 17, MUTED)
    text(d, (W - 100, H - 70), f"{idx + 1:02d} / 08", 19, MUTED, anchor="ra")
    for j in range(8):
        s = STORY["scenes"][j]
        x = 720 + j * 62
        d.rounded_rectangle((x, H - 55, x + 43, H - 52), radius=2, fill="#2C4656")
        frac = max(0, min(1, (t - s["start"]) / (s["end"] - s["start"])))
        if frac:
            d.rounded_rectangle((x, H - 55, x + 43 * frac, H - 52), radius=2, fill=CYAN)


def screenshot_card(name, crop):
    key = (name, tuple(crop))
    if key in ASSETS:
        return ASSETS[key]
    source = Image.open(ROOT / "screenshots" / name).convert("RGB").crop(tuple(crop))
    sw = 1080
    sh = round(source.height * sw / source.width)
    frame = Image.new("RGBA", (sw + 80, sh + 132))
    shadow = Image.new("RGBA", frame.size)
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((38, 27, sw + 42, sh + 103), radius=22, fill=(0, 0, 0, 130))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    frame.alpha_composite(shadow)
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle((40, 20, sw + 40, sh + 94), radius=17, fill="#DDEBF0")
    d.rounded_rectangle((40, 20, sw + 40, 78), radius=17, fill="#E9F3F6")
    d.rectangle((40, 60, sw + 40, 79), fill="#E9F3F6")
    for i in range(3):
        d.ellipse((61 + i * 20, 41, 69 + i * 20, 49), fill=["#A4C2CE", "#86B6C3", "#0284A8"][i])
    text(d, (sw // 2 + 40, 32), "WAVELINK  /  WORKSPACE", 16, "#426477", anchor="ma")
    frame.paste(source.resize((sw, sh), Image.Resampling.LANCZOS), (40, 79))
    ASSETS[key] = frame
    return frame


def hero(canvas, s, u, t):
    waves(canvas, t, 775, 83, 95)
    def label(im, dy):
        tracking(ImageDraw.Draw(im), (380, 255 + dy), s["eyebrow"], 20, 5)
    group(canvas, u, .1, label)
    for j, line in enumerate(s["title"]):
        def title(im, dy, j=j, line=line):
            text(ImageDraw.Draw(im), (W / 2, 322 + j * 146 + dy), line, 122, WHITE if j == 0 else CYAN, "bold", "ma")
        group(canvas, u, .3 + j * .25, title, 55)
    def subtitle(im, dy):
        text(ImageDraw.Draw(im), (W / 2, 671 + dy), "Meet WaveLink.", 36, MUTED, anchor="ma")
    group(canvas, u, 1.05, subtitle)


def screen(canvas, s, u, t):
    waves(canvas, t, 896, 28, 28)
    def label(im, dy):
        tracking(ImageDraw.Draw(im), (104, 269 + dy), s["eyebrow"], 17, 2.5)
    group(canvas, u, .06, label)
    for j, line in enumerate(s["title"]):
        def title(im, dy, j=j, line=line):
            text(ImageDraw.Draw(im), (100, 318 + j * 89 + dy), line, 74, CYAN if j == len(s["title"]) - 1 else WHITE, "bold")
        group(canvas, u, .18 + j * .13, title)
    body_y = 339 + len(s["title"]) * 89 + 28
    def desc(im, dy):
        d = ImageDraw.Draw(im)
        for j, line in enumerate(s["body"]):
            text(d, (105, body_y + j * 43 + dy), line, 27, MUTED)
    group(canvas, u, .68, desc)
    card = screenshot_card(s["image"], s["crop"])
    base_y = (H - card.height) // 2 + 4
    def shot(im, dy):
        # Subtle upward drift keeps the product image moving without sacrificing readability.
        drift = round(9 * math.sin(u * .28))
        im.alpha_composite(card, (680, base_y + dy - drift))
    group(canvas, u, .32, shot, 55)
    def tag(im, dy):
        d = ImageDraw.Draw(im)
        y = 864 + dy
        d.rounded_rectangle((729, y, 1787, y + 66), radius=17, fill="#123D50", outline="#2D6274", width=1)
        d.ellipse((752, y + 28, 762, y + 38), fill=CYAN)
        text(d, (783, y + 15), s["tag"], 24, WHITE)
    group(canvas, u, 1.12, tag, 20)
    text(ImageDraw.Draw(canvas), (1260, 951), "v0.6.0 preview • Redacted product screenshot", 17, MUTED, anchor="ma")


def local(canvas, s, u, t):
    waves(canvas, t, 847, 34, 44)
    def heading(im, dy):
        d = ImageDraw.Draw(im)
        tracking(d, (664, 222 + dy), s["eyebrow"], 19, 4)
        text(d, (960, 280 + dy), "Your browser. Your Salesforce orgs.", 71, WHITE, "bold", "ma")
    group(canvas, u, .08, heading)
    def diagram(im, dy):
        d = ImageDraw.Draw(im)
        y = 442 + dy
        for x, title, sub in [(335, "Your browser", "WaveLink workspace"), (1135, "Your Salesforce orgs", "Direct Salesforce connection")]:
            d.rounded_rectangle((x, y, x + 450, y + 220), radius=25, fill="#102F43", outline="#346071", width=2)
            text(d, (x + 225, y + 78), title, 34, WHITE, "bold", "ma")
            text(d, (x + 225, y + 132), sub, 23, MUTED, anchor="ma")
        im.alpha_composite(LOGO.resize((48, 48), Image.Resampling.LANCZOS), (536, y + 18))
        d.line((795, y + 110, 1125, y + 110), fill="#376579", width=2)
        text(d, (960, y + 55), "DIRECT", 17, CYAN, "bold", "ma")
        for n in range(3):
            x = 811 + ((u * 90 + n * 100) % 293)
            d.ellipse((x - 5, y + 105, x + 5, y + 115), fill=CYAN)
    group(canvas, u, .55, diagram)
    def proof(im, dy):
        d = ImageDraw.Draw(im)
        for x, a, b in [(480, "No backend", "operated by WaveLink"), (960, "No analytics", "built into WaveLink"), (1440, "No telemetry", "collected by WaveLink")]:
            text(d, (x, 737 + dy), a, 32, CYAN, "bold", "ma")
            text(d, (x, 787 + dy), b, 22, MUTED, anchor="ma")
    group(canvas, u, 1.6, proof)


def outro(canvas, s, u, t):
    waves(canvas, t, 750, 72, 78)
    def name(im, dy):
        d = ImageDraw.Draw(im)
        tracking(d, (594, 245 + dy), s["eyebrow"], 19, 4)
        im.alpha_composite(LOGO.resize((132, 132), Image.Resampling.LANCZOS), (592, 353 + dy))
        text(d, (757, 327 + dy), "WaveLink", 112, WHITE, "bold")
        text(d, (960, 521 + dy), s["body"][0], 42, MUTED, anchor="ma")
    group(canvas, u, .1, name)
    def cta(im, dy):
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((733, 640 + dy, 1187, 720 + dy), radius=40, fill=CYAN)
        text(d, (960, 656 + dy), "Explore the project  →", 29, INK, "bold", "ma")
        text(d, (960, 765 + dy), "github.com/Exotic209093/WaveLink", 29, WHITE, anchor="ma")
        text(d, (960, 832 + dy), "OPEN SOURCE  /  CHROME EXTENSION  /  LOCAL-FIRST", 18, MUTED, anchor="ma")
    group(canvas, u, .9, cta)


def render(t):
    idx = next((i for i, s in enumerate(STORY["scenes"]) if s["start"] <= t < s["end"]), 7)
    s = STORY["scenes"][idx]
    u = t - s["start"]
    canvas = BG.copy()
    {"hero": hero, "screen": screen, "local": local, "outro": outro}[s["kind"]](canvas, s, u, t)
    # Short restrained dips give each chapter a clean editorial transition.
    tail = s["end"] - t
    if idx < 7 and tail < .36:
        canvas = Image.blend(canvas, BG, smooth(1 - tail / .36))
    chrome(canvas, idx, t)
    if t < .5:
        canvas = Image.blend(BG, canvas, smooth(t / .5))
    return canvas.convert("RGB")


def score():
    """Original 96 BPM synth cue; deterministic harmonics, no external samples."""
    sr = 48000
    count = int(DURATION * sr)
    music = np.zeros((count, 2), np.float32)
    rng = np.random.default_rng(209093)
    beat = 60 / 96
    # Dmaj9 / Aadd9 / Bm7 / Gmaj7, an understated optimistic loop.
    chords = [[50, 57, 61, 66, 69], [45, 52, 59, 61, 64], [47, 54, 57, 62, 66], [43, 50, 54, 59, 62]]

    def add(signal, at, gain=.1, pan=.0):
        start = int(at * sr)
        length = min(len(signal), count - start)
        if length <= 0:
            return
        theta = (pan + 1) * math.pi / 4
        music[start:start + length, 0] += signal[:length] * gain * math.cos(theta)
        music[start:start + length, 1] += signal[:length] * gain * math.sin(theta)

    def hz(midi):
        return 440 * 2 ** ((midi - 69) / 12)

    for bar in range(30):
        at = bar * beat * 4
        chord = chords[(bar // 2) % 4]
        time = np.arange(int(sr * (beat * 4 + 1.5))) / sr
        env = np.minimum(time / .65, 1) * np.minimum((time[-1] - time) / 1.4, 1)
        for k, note in enumerate(chord):
            freq = hz(note + 12)
            pad = (np.sin(2 * np.pi * freq * time) + .22 * np.sin(2 * np.pi * freq * 2 * time + .2)) * env
            add(pad, at, .024, (k - 2) / 3)
        if at >= 5 and at < 69:
            for step in range(8):
                tt = np.arange(int(sr * 1.15)) / sr
                note = chord[[0, 2, 3, 1, 4, 2, 3, 1][step]] + 24
                freq = hz(note)
                sig = (np.sin(2 * np.pi * freq * tt) + .20 * np.sin(2 * np.pi * freq * 2 * tt)) * np.exp(-tt * 6) * np.minimum(tt / .008, 1)
                onset = at + step * beat / 2
                pan = -.5 if step % 2 else .5
                add(sig, onset, .057, pan)
                add(sig, onset + beat * .75, .02, -pan)
                add(sig, onset + beat * 1.5, .009, pan)
        for step in range(4):
            onset = at + step * beat
            if 7.5 <= onset < 68:
                tt = np.arange(int(sr * .38)) / sr
                phase = 2 * np.pi * (47 * tt + 7.2 * (1 - np.exp(-tt * 21)))
                kick = np.sin(phase) * np.exp(-tt * 12) * np.minimum(tt / .004, 1)
                add(kick, onset, .145)
                tt = np.arange(int(sr * .08)) / sr
                noise = rng.normal(0, 1, len(tt)).astype(np.float32)
                hat = np.diff(noise, prepend=noise[0]) * np.exp(-tt * 70) * np.minimum(tt / .003, 1)
                add(hat, onset + beat / 2, .012, .4)
        tt = np.arange(int(sr * 2.8)) / sr
        bass = np.sin(2 * np.pi * hz(chord[0] - 12) * tt) * np.minimum(tt / .04, 1) * np.exp(-tt * 1.2)
        add(bass, at, .105)
    # Soft tonal accents at chapter changes, with no abrasive impact sounds.
    for s in STORY["scenes"][1:]:
        tt = np.arange(int(sr * 1.8)) / sr
        bell = (np.sin(2 * np.pi * hz(86) * tt) + .3 * np.sin(2 * np.pi * hz(93) * tt)) * np.exp(-tt * 3.5) * np.minimum(tt / .012, 1)
        add(bell, s["start"], .038, -.15)
    time = np.arange(count) / sr
    fade = np.minimum(time / 2, 1) * np.clip((DURATION - time) / 3, 0, 1)
    music *= fade[:, None]
    music *= .78 / max(float(np.max(np.abs(music))), 1e-6)
    audio_path = OUT / "wavelink-original-score.wav"
    with wave.open(str(audio_path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes((music * 32767).astype("<i2").tobytes())
    return audio_path


def stills():
    frames = []
    for i, s in enumerate(STORY["scenes"]):
        frame = render(s["start"] + min(3.5, (s["end"] - s["start"]) / 2))
        frame.save(OUT / f"scene-{i + 1:02d}.jpg", quality=94)
        frames.append(frame)
    contact = Image.new("RGB", (1280, 4 * 392), "#061727")
    d = ImageDraw.Draw(contact)
    for i, f in enumerate(frames):
        x, y = (i % 2) * 640, (i // 2) * 392
        contact.paste(f.resize((640, 360), Image.Resampling.LANCZOS), (x, y))
        text(d, (x + 15, y + 365), f"{i + 1:02d}  /  {STORY['scenes'][i]['start']:g}s", 16, MUTED)
    contact.save(OUT / "storyboard.jpg", quality=94)
    frames[0].save(OUT / "wavelink-poster.jpg", quality=97)


def subtitles():
    def tc(t):
        ms = round(t * 1000)
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    entries = []
    for i, s in enumerate(STORY["scenes"]):
        entries.append(f"{i + 1}\n{tc(s['start'])} --> {tc(s['end'])}\n{s['caption']}\n")
    (OUT / "wavelink-promo.srt").write_text("\n".join(entries), encoding="utf-8")


def video():
    audio_path = score()
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    target = OUT / "wavelink-promo-full-polished.mp4"
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "warning", "-y", "-f", "rawvideo", "-vcodec", "rawvideo",
           "-s", f"{W}x{H}", "-pix_fmt", "rgb24", "-r", str(FPS), "-i", "-", "-i", str(audio_path),
           "-i", str(OUT / "wavelink-promo.srt"), "-map", "0:v:0", "-map", "1:a:0", "-map", "2:s:0",
           "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac",
           "-b:a", "192k", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata", "title=" + STORY["title"],
           "-metadata", "comment=Original WaveLink product preview with an original instrumental score.",
           "-movflags", "+faststart", "-t", str(DURATION), str(target)]
    with (OUT / "render.log").open("w", encoding="utf-8") as log:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log)
        try:
            for i in range(DURATION * FPS):
                proc.stdin.write(render(i / FPS).tobytes())
                if i % (FPS * 5) == 0:
                    print(f"Rendered {i // FPS:02d}/{DURATION}s", flush=True)
        finally:
            proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError((OUT / "render.log").read_text())
    print(f"Saved {target} ({target.stat().st_size / 1024 / 1024:.1f} MiB)", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stills", action="store_true")
    args = parser.parse_args()
    stills()
    subtitles()
    if not args.stills:
        video()
