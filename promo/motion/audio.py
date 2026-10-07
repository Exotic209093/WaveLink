"""Frame-locked soundtrack for promo/motion/wavelink-15s.html.

    python promo/motion/audio.py output/audio/cues.json       synthesise + mix
    python promo/motion/audio.py output/audio/cues.json --music track.mp3 [--music-start 31.5]
    python promo/motion/audio.py --verify output/wavelink-15s.mp4   check the muxed file

The cue map comes from the composition itself (__wl.cues), so every transient is
placed with its *peak sample* on the frame where the matching visual peaks
(48 kHz / 60 fps = exactly 800 samples per frame). Everything here is synthesised
deterministically with numpy: an original score (no samples or stock music) plus
the micro-SFX. Outputs land in output/audio/:

    music.wav, sfx.wav      stems
    soundtrack.wav          master (-16 LUFS integrated, -1 dBTP ceiling, silent last frame)
    reactive.js             per-frame beat/SFX envelopes consumed by the composition
    cue-sheet.md            human-readable cue table
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / "output" / "audio"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
TARGET_LUFS = -16.0
CEILING_DB = -1.0
TAU = 2 * np.pi


# ── DSP helpers ──────────────────────────────────────────────────────────────
def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(dur):
    return np.arange(int(round(dur * SR))) / SR


def spectral(x, gain_fn):
    """Zero-phase FFT filter; gain_fn(freqs) -> linear gain."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) * gain_fn(f), n=n)


def lp(f, fc, order=2):
    return 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def hp(f, fc, order=2):
    r = (f / max(fc, 1e-3)) ** (2 * order)
    return np.sqrt(r / (1 + r))


def band(x, lo, hi, order=2):
    return spectral(x, lambda f: hp(f, lo, order) * lp(f, hi, order))


def stft_sweep(x, center, width_oct=0.9, hop=256, win=2048):
    """Time-varying band-pass: center(t_seconds_array) -> Hz per STFT frame."""
    n = len(x)
    pad = np.concatenate([np.zeros(win), x, np.zeros(win)])
    w = np.sqrt(np.hanning(win + 1)[:-1])
    starts = np.arange(0, len(pad) - win, hop)
    frames = np.stack([pad[s:s + win] * w for s in starts])
    spec = np.fft.rfft(frames, axis=1)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    tc = (starts + win / 2 - win) / SR
    fc = np.asarray(center(tc))[:, None]
    lf = np.log2(np.maximum(freqs[None, :], 20) / fc)
    spec *= np.exp(-0.5 * (lf / width_oct) ** 2)
    out = np.zeros(len(pad))
    norm = np.zeros(len(pad))
    for i, s in enumerate(starts):
        out[s:s + win] += np.fft.irfft(spec[i], n=win) * w
        norm[s:s + win] += w ** 2
    return (out / np.maximum(norm, 1e-6))[win:win + n]


def noise(n, seed, color="white"):
    r = np.random.default_rng(seed).standard_normal(n)
    if color == "pink":
        r = spectral(r, lambda f: 1 / np.sqrt(np.maximum(f, 20) / 20))
    return r / (np.abs(r).max() + 1e-12)


def env_ad(n, attack, decay, curve=1.0):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) / decay) ** curve


def fade(n, start, length, out=True):
    g = np.ones(n)
    i0, i1 = int(start * SR), int((start + length) * SR)
    ramp = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, max(i1 - i0, 1)))
    if out:
        g[i0:i1] = ramp[: max(0, min(i1, n) - i0)]
        g[i1:] = 0
    else:
        g[:i0] = 0
        g[i0:i1] = ramp[::-1][: max(0, min(i1, n) - i0)]
    return g


def pan_gains(p):
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def reverb_ir(seconds=2.6, seed=7, damp=5200, predelay=0.018):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n + int(predelay * SR)))
    for ch in range(2):
        r = noise(n, seed + ch)
        bright = spectral(r, lambda f: lp(f, damp, 1)) * np.exp(-t / 0.35)
        dark = spectral(r, lambda f: lp(f, 1800, 1)) * np.exp(-t / 0.9)
        ir[ch, int(predelay * SR):] = 0.55 * bright + dark
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def convolve(x, ir):
    n = x.shape[-1] + ir.shape[-1]
    m = 1 << int(np.ceil(np.log2(n)))
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)
    return y[..., : x.shape[-1]]


class Bus:
    """Stereo bus with an aux reverb send and a log of where transients landed."""

    def __init__(self, n):
        self.dry = np.zeros((2, n))
        self.send = np.zeros((2, n))
        self.n = n
        self.log = []

    def place(self, sig, t, pan=0.0, gain=1.0, send=0.0, anchor=None, label=None):
        """Place mono/stereo `sig` so that sample `anchor` (default: |peak|) lands at time t."""
        sig = np.atleast_2d(sig)
        if sig.shape[0] == 1:
            gl, gr = pan_gains(pan)
            sig = np.vstack([sig[0] * gl, sig[0] * gr])
        if anchor is None:
            anchor = int(np.abs(sig).sum(axis=0).argmax())
        start = int(round(t * SR)) - anchor
        a, b = max(start, 0), min(start + sig.shape[1], self.n)
        if b <= a:
            return
        seg = sig[:, a - start:b - start] * gain
        self.dry[:, a:b] += seg
        self.send[:, a:b] += seg * send
        if label:
            self.log.append((label, t, start + anchor))

    def render(self, ir, wet):
        return self.dry + wet * convolve(self.send, ir)


# ── Score: original 120 BPM half-time chill-tech bed ────────────────────────
# Bars are 2 s, so downbeats land on the scene cuts at 8 s and 12 s.
BEAT = 0.5
BAR = 2.0
CHORDS = [  # voicings (MIDI) and sub roots per bar
    ([50, 57, 61, 64, 66], 38),   # Dmaj9
    ([47, 54, 57, 61, 62], 35),   # Bm9
    ([43, 50, 54, 57, 61], 31),   # Gmaj9
    ([45, 52, 59, 61, 64], 33),   # A6/9
    ([50, 57, 61, 64, 66], 38),   # Dmaj9 (loop)
    ([47, 54, 57, 61, 62], 35),   # Bm9
    ([38, 50, 57, 61, 64, 66], 38),  # Dmaj9 — outro holds the tonic
    ([38, 50, 57, 61, 64, 66], 38),
]


OUTRO_BAR = 6


def chord_at(bar):
    """Loop the 4-bar progression until the outro bar, then hold the tonic."""
    return CHORDS[bar % 4] if bar < OUTRO_BAR else CHORDS[6]


def soft_saw(f0, dur, fc_fn, detune_cents=(-7, 0, 7), seed=0):
    """Band-limited additive saw stack with a time-varying low-pass (fc_fn(t)->Hz)."""
    t = tt(dur)
    fc = fc_fn(t)
    out = np.zeros((2, len(t)))
    rng = np.random.default_rng(seed)
    for v, cents in enumerate(detune_cents):
        f = f0 * 2 ** (cents / 1200)
        ph = rng.uniform(0, TAU)
        gl, gr = pan_gains((v - (len(detune_cents) - 1) / 2) * 0.55)
        voice = np.zeros(len(t))
        for h in range(1, int(5000 / f) + 1):
            amp = (1 / h) * lp(h * f, fc, 2)
            if amp.max() < 0.003:
                break
            voice += amp * np.sin(TAU * h * f * t + ph * h)
        out[0] += voice * gl
        out[1] += voice * gr
    return out / len(detune_cents)


def fm_pluck(f, dur=0.9, ratio=2.0, index=2.2, decay=0.32):
    t = tt(dur)
    ienv = index * np.exp(-t / 0.08)
    mod = np.sin(TAU * f * ratio * t) * ienv
    return np.sin(TAU * f * t + mod) * env_ad(len(t), 0.003, decay)


def kick(dur=0.6):
    t = tt(dur)
    f = 46 + 95 * np.exp(-t / 0.035)
    body = np.sin(TAU * np.cumsum(f) / SR) * env_ad(len(t), 0.002, 0.24)
    click = band(noise(len(t), 11), 1500, 6000) * env_ad(len(t), 0.0005, 0.004)
    return np.tanh(1.4 * body) * 0.9 + 0.15 * click


def snare(seed):
    n = int(0.5 * SR)
    nz = band(noise(n, seed), 900, 7500) * env_ad(n, 0.001, 0.12)
    tone = np.sin(TAU * 196 * tt(0.5)) * env_ad(n, 0.001, 0.05)
    return 0.7 * nz + 0.35 * tone


def hat(seed, open_=False):
    n = int((0.35 if open_ else 0.08) * SR)
    return band(noise(n, seed), 7000, 16000, 3) * env_ad(n, 0.0008, 0.09 if open_ else 0.018)


def build_music(n, duration, sting=11.9):
    global OUTRO_BAR
    OUTRO_BAR = int(round(sting / BAR))
    t_all = np.arange(n) / SR
    music = Bus(n)
    bass = np.zeros(n)
    kicks = []

    # Pad (whole track): filter opens with the energy of each scene.
    def pad_fc(t0):
        return lambda t: 650 + 700 * np.clip((t0 + t - 2.5) / 6, 0, 1) + 250 * np.sin(TAU * (t0 + t) / 7.5)

    for bar in range(int(np.ceil(duration / BAR))):
        t0 = bar * BAR
        notes, root = chord_at(bar)
        dur = BAR + 0.6
        layer = np.zeros((2, int(round(dur * SR))))
        for i, m in enumerate(notes):
            layer += soft_saw(midi(m), dur, pad_fc(t0), seed=bar * 10 + i)
        g = np.minimum(1, tt(dur) / 0.35) * np.minimum(1, (dur - tt(dur)) / 0.6)
        music.place(layer * g * 0.32, t0, anchor=0, send=0.55)
        # Sub bass enters with the dashboard (3 s).
        if t0 + BAR > 3.0:
            bt = tt(dur)
            sub = np.sin(TAU * midi(root) * bt) + 0.18 * np.sin(TAU * 2 * midi(root) * bt)
            sg = np.minimum(1, bt / 0.04) * np.minimum(1, (dur - bt) / 0.5)
            s0 = int(t0 * SR)
            e = min(n, s0 + len(bt))
            bass[s0:e] += (sub * sg)[: e - s0] * 0.30

    # Drums: soft half-time groove from 4 s, fuller from 8 s, out at the outro sting.
    for bar in range(2, OUTRO_BAR):
        t0 = bar * BAR
        hits = [0.0] if bar < 4 else [0.0, 1.25]
        for h in hits:
            kicks.append(t0 + h)
            music.place(kick() * 0.8, t0 + h, anchor=int(0.002 * SR), label="kick")
        music.place(snare(bar) * 0.33, t0 + 1.0, send=0.5, anchor=int(0.001 * SR))
    for k in range(int(3.0 / 0.125), int(sting / 0.125)):
        t = k * 0.125 + (0.018 if k % 2 else 0.0)  # light swing
        vel = (0.55 if k % 4 == 2 else 0.32) * (0.6 if t < 4 else 1.0)
        music.place(hat(k, open_=(k % 16 == 14)) * vel * 0.22, t, anchor=int(0.0008 * SR), pan=0.25)

    # FM bell arp with ping-pong delay, from the dashboard to the sting.
    pattern = [0, 2, 4, 3, 1, 4, 2, 3]
    arp = np.zeros((2, n))
    for k in range(int(3.0 / 0.25), int((sting - 0.15) / 0.25)):
        t = k * 0.25
        notes, _ = chord_at(int(t // BAR))
        m = notes[pattern[k % 8] % len(notes)] + 12
        p = fm_pluck(midi(m)) * (0.9 if k % 4 == 0 else 0.6) * 0.07
        s0 = int(t * SR)
        e = min(n, s0 + len(p))
        pl, pr = pan_gains(0.35 * np.sin(k * 0.7))
        arp[0, s0:e] += p[: e - s0] * pl
        arp[1, s0:e] += p[: e - s0] * pr
    d = int(0.375 * SR)  # dotted-eighth ping-pong
    delayed = np.zeros_like(arp)
    fb = 0.42
    for i in range(1, 6):
        src = arp[(i % 2)] * fb ** i
        delayed[(i + 1) % 2, d * i:] += src[: n - d * i]
    delayed = np.vstack([spectral(delayed[0], lambda f: lp(f, 3500) * hp(f, 300)),
                         spectral(delayed[1], lambda f: lp(f, 3500) * hp(f, 300))])
    music.dry += arp + delayed
    music.send += (arp + delayed) * 0.5

    # Air: breathing high texture.
    air = band(noise(n, 99, "pink"), 3000, 11000) * (0.5 + 0.5 * np.sin(TAU * t_all / 6.0)) * 0.012
    music.dry += np.vstack([air, np.roll(air, 2400)])

    # Sidechain the sub and pad under the kick.
    duck = np.ones(n)
    for k in kicks:
        s0 = int(k * SR)
        r = tt(0.4)
        e = min(n, s0 + len(r))
        duck[s0:e] = np.minimum(duck[s0:e], (1 - 0.55 * np.exp(-r / 0.12))[: e - s0])
    music.dry[:, :] *= 0.75 + 0.25 * duck
    music.dry += np.vstack([bass * duck, bass * duck])

    ir = reverb_ir()
    out = music.render(ir, 0.35)
    # Brief: bed loops under everything, fading out cleanly over the final 2 s.
    out *= fade(n, duration - 2.0, 1.95)
    out = np.vstack([spectral(out[0], lambda f: hp(f, 28)), spectral(out[1], lambda f: hp(f, 28))])
    return out, kicks


# ── SFX palette ──────────────────────────────────────────────────────────────
def sfx_sub_drop():
    t = tt(1.8)
    f = 30 + 70 * np.exp(-t / 0.42)
    s = np.sin(TAU * np.cumsum(f) / SR)
    body = np.tanh(1.6 * s) * env_ad(len(t), 0.006, 0.75)
    thump = spectral(noise(len(t), 3), lambda fr: lp(fr, 400, 2)) * env_ad(len(t), 0.002, 0.05)
    return 0.9 * body + 0.4 * thump


def sfx_write(dur, seed):
    """Organic pen/marker stroke: grainy band-limited noise with paper texture."""
    dur = float(np.clip(dur, 0.08, 0.3))
    n = int((dur + 0.05) * SR)
    rng = np.random.default_rng(seed)
    c = rng.uniform(2800, 4600)
    nz = band(noise(n, 500 + seed), c * 0.55, c * 1.7)
    tex = np.abs(spectral(noise(n, 900 + seed), lambda f: lp(f, 55, 2)))
    tex = 0.45 + tex / (tex.max() + 1e-9)
    t = np.arange(n) / SR
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6 * np.minimum(1, t / 0.006)
    s = nz * tex * shape
    return s / (np.abs(s).max() + 1e-9)


def sfx_whoosh(attack, release, seed=21, lo=260, hi=4200, stereo=(-0.6, 0.6)):
    n = int((attack + release) * SR)
    t = np.arange(n) / SR
    x = np.clip(t / attack, 0, 1)
    after = np.clip((t - attack) / release, 0, 1)
    center = lambda tc: np.where(tc < attack, lo * (hi / lo) ** (np.clip(tc / attack, 0, 1) ** 2),
                                 hi * (900 / hi) ** np.clip((tc - attack) / release, 0, 1))
    nz = stft_sweep(noise(n, seed, "pink"), center, 0.85)
    amp = np.where(t < attack, x ** 3.2, np.exp(-after * 4.5))
    s = nz * amp
    s /= np.abs(s).max() + 1e-9
    pan = np.interp(t, [0, attack, attack + release], [stereo[0], 0, stereo[1]])
    gl, gr = pan_gains(pan)
    return np.vstack([s * gl, s * gr]), int(attack * SR)


def sfx_key(seed, low=False):
    rng = np.random.default_rng(seed)
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    click = band(noise(n, 1000 + seed), 2500, 12000) * env_ad(n, 0.0003, 0.0022)
    body = np.sin(TAU * rng.uniform(1900, 2700) * t) * env_ad(n, 0.0004, 0.006)
    thock = np.sin(TAU * (rng.uniform(260, 340) if not low else 150) * t) * env_ad(n, 0.0008, 0.012 if not low else 0.03)
    return 0.8 * click + 0.35 * body + (0.35 if not low else 0.9) * thock


def sfx_tick(seed, f=None):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    f = f or 1500 + 70 * seed
    s = np.sin(TAU * f * t) * env_ad(n, 0.0004, 0.012) + 0.4 * band(noise(n, 70 + seed), 3000, 9000) * env_ad(n, 0.0002, 0.002)
    return s


def sfx_data(seed):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    f = 3800 if seed % 2 else 4300
    return np.sin(TAU * f * t) * env_ad(n, 0.0003, 0.005) + 0.3 * band(noise(n, 300 + seed), 6000, 14000) * env_ad(n, 0.0002, 0.0015)


def sfx_glass(note):
    f0 = midi([86, 88, 90, 93, 95, 98][note % 6]) * 1.0
    t = tt(0.9)
    partials = [(1.0, 1.0, 0.32), (2.32, 0.45, 0.16), (4.25, 0.25, 0.09), (6.8, 0.12, 0.05)]
    s = sum(a * np.sin(TAU * f0 * r * t) * env_ad(len(t), 0.0008, d) for r, a, d in partials)
    tap = band(noise(len(t), 40 + note), 1500, 8000) * env_ad(len(t), 0.0003, 0.004)
    return 0.6 * s + 0.35 * tap


def sfx_ping(note):
    t = tt(0.6)
    f = midi(93 if note else 88)
    return (np.sin(TAU * f * t) + 0.2 * np.sin(TAU * 2 * f * t)) * env_ad(len(t), 0.002, 0.14)


def sfx_check(warn=False):
    """Validation blip: bright rising pair for a pass, softer falling pair for a warning."""
    notes = [(85, 0.0), (81, 0.06)] if warn else [(88, 0.0), (93, 0.05)]
    out = np.zeros(int(0.5 * SR))
    for m, d in notes:
        t = tt(0.4)
        f = midi(m)
        tone = (np.sin(TAU * f * t) + 0.18 * np.sin(TAU * 2 * f * t)) * env_ad(len(t), 0.0015, 0.09)
        s0 = int(d * SR)
        out[s0:s0 + len(t)] += tone[: len(out) - s0]
    return out * (0.8 if warn else 1.0)


def sfx_success():
    out = np.zeros(int(0.8 * SR))
    for i, (m, d) in enumerate([(81, 0.0), (86, 0.075)]):
        t = tt(0.7)
        f = midi(m)
        tone = (np.sin(TAU * f * t) + 0.25 * np.sin(TAU * 2 * f * t) + 0.08 * np.sin(TAU * 3 * f * t)) * env_ad(len(t), 0.002, 0.18)
        s0 = int(d * SR)
        out[s0:s0 + len(t)] += tone[: len(out) - s0] * (1.0 if i else 0.8)
    return out, int(0.002 * SR)


def sfx_riser(attack, release):
    n = int((attack + release) * SR)
    t = np.arange(n) / SR
    x = np.clip(t / attack, 0, 1)
    sweep = 220 * (1800 / 220) ** (x ** 1.6)
    tone = np.sin(TAU * np.cumsum(sweep) / SR) * 0.25 + np.sin(TAU * np.cumsum(sweep * 1.5) / SR) * 0.12
    center = lambda tc: 400 * (7000 / 400) ** (np.clip(tc / attack, 0, 1) ** 1.8)
    nz = stft_sweep(noise(n, 77, "pink"), center, 1.0)
    amp = np.where(t < attack, x ** 2.6, np.exp(-np.clip((t - attack) / release, 0, 1) * 7))
    s = (nz + tone) * amp
    s /= np.abs(s).max() + 1e-9
    boom_t = tt(release + 0.6)
    boom = np.sin(TAU * np.cumsum(38 + 40 * np.exp(-boom_t / 0.08)) / SR) * env_ad(len(boom_t), 0.002, 0.28)
    full = np.zeros(int(attack * SR) + len(boom_t))
    full[: n] += s
    full[int(attack * SR):] += 0.75 * boom
    st = np.vstack([full, np.roll(full, 90)]) * 0.7071  # centred, with a touch of Haas width
    return st, int(attack * SR)


def sfx_ding(note, bright=False):
    f0 = midi(note)
    t = tt(3.2)
    ratios = [(1.0, 1.0, 2.2), (1.0035, 0.6, 2.0), (2.0, 0.3, 1.2), (2.76, 0.42, 0.9), (5.4, 0.18, 0.45), (8.93, 0.08, 0.25)]
    s = sum(a * np.sin(TAU * f0 * r * t) * env_ad(len(t), 0.0012, d) for r, a, d in ratios)
    strike = band(noise(len(t), note), 4000, 14000) * env_ad(len(t), 0.0003, 0.003 if not bright else 0.005)
    return 0.55 * s / 2.5 + 0.25 * strike


def sfx_suck(attack):
    n = int(attack * SR)
    tail = band(noise(n, 61, "pink"), 300, 6500) * np.exp(-np.arange(n) / SR / (attack / 4))
    s = tail[::-1]
    return s / (np.abs(s).max() + 1e-9), n - 1


def sfx_sting():
    t = tt(3.0)
    boom = np.sin(TAU * np.cumsum(42 + 34 * np.exp(-t / 0.12)) / SR) * env_ad(len(t), 0.003, 1.1)
    crack = spectral(noise(len(t), 88), lambda f: lp(f, 1400, 2)) * env_ad(len(t), 0.001, 0.22)
    shimmer = band(noise(len(t), 89), 7000, 15000) * env_ad(len(t), 0.002, 0.5) * 0.25
    return np.tanh(1.3 * boom) * 0.85 + 0.35 * crack + shimmer, int(0.003 * SR)


def sfx_pad(t0, end, swell_peak):
    """Deep atmospheric D pad for the outro; breathes up with the glow sweep."""
    dur = end - t0
    t = tt(dur)
    fc = lambda tl: 380 + 900 * np.exp(-0.5 * ((tl + t0 - swell_peak) / 0.55) ** 2)
    layer = np.zeros((2, len(t)))
    for i, m in enumerate([26, 38, 45, 50, 54, 57, 64]):
        layer += soft_saw(midi(m), dur, fc, detune_cents=(-9, -3, 4, 10), seed=300 + i) * (1.0 if m > 30 else 0.8)
    g = (1 - np.exp(-t / 0.7)) * (1 + 0.5 * np.exp(-0.5 * ((t + t0 - swell_peak) / 0.5) ** 2))
    g *= fade(len(t), (end - 2.0) - t0, 1.95)
    return layer * g * 0.22


def sfx_swell(t0, t1, peak, pan_from, pan_to):
    pre, post = peak - t0 + 0.25, (t1 - peak) + 0.5
    n = int((pre + post) * SR)
    t = np.arange(n) / SR
    center = lambda tc: 2000 * (9500 / 2000) ** np.clip(tc / (pre + post * 0.6), 0, 1)
    nz = stft_sweep(noise(n, 55, "pink"), center, 0.7)
    shimmer = sum(np.sin(TAU * midi(m) * t + k) * (0.6 + 0.4 * np.sin(TAU * (3 + k) * t)) for k, m in enumerate([86, 93, 100, 102]))
    amp = np.where(t < pre, (t / pre) ** 2.2, np.exp(-(t - pre) / (post / 3.5)))
    s = (nz * 0.8 + shimmer * 0.06) * amp
    s /= np.abs(s).max() + 1e-9
    pan = np.interp(t, [0.25, pre, pre + (t1 - peak)], [pan_from, 0, pan_to])
    gl, gr = pan_gains(pan)
    return np.vstack([s * gl, s * gr]), int(pre * SR)



# ── External music bed (Suno / ElevenLabs / licensed stock) ─────────────────
def load_audio(path):
    raw = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2",
                          "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, "<f4").reshape(-1, 2).T.astype(np.float64)


def kick_onsets(x, hop=480):
    """Low-band spectral-flux onset curve (10 ms hops) and picked kick-like onsets (seconds)."""
    low = spectral(x.mean(axis=0), lambda f: lp(f, 160, 2))
    nb = len(low) // hop
    e = np.log1p(200 * np.sqrt((low[: nb * hop].reshape(nb, hop) ** 2).mean(axis=1)))
    flux = np.maximum(np.diff(e, prepend=e[0]), 0)
    thr = flux.mean() + 1.5 * flux.std()
    picks, last = [], -1e9
    for i in range(1, nb - 1):
        if flux[i] > thr and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1] and i - last >= 20:
            picks.append(i * hop / SR)
            last = i
    return flux, hop, picks


def external_bed(path, n, duration, cues, start=0.0):
    """Cut a `duration` window from `path` so the track's biggest energy jump lands on a scene cut.

    Candidate cuts are the composition's structural transitions (drop/riser first, then the
    other whooshes and the outro sting). For each, the loudness jump (0.6 s before vs after)
    is measured within ±0.5 s; the strongest pairing wins and is snapped to the nearest
    low-end transient for sample precision. With no jump ≥ 3 dB anywhere, kick onsets are
    beat-matched to the drop, sting and whoosh cues instead."""
    x = load_audio(path)
    mono = x.mean(axis=0)
    flux, hop, _ = kick_onsets(x)
    at = {c["type"]: c["t"] for c in cues}
    drop_t = at.get("riser", 8.0)
    cuts = [(drop_t, 1.15)] + [(c["t"], 1.0) for c in cues if c["type"] in ("whoosh", "air", "sting")]
    rms = lambda s, e: 20 * np.log10(np.sqrt(np.mean(mono[max(int(s * SR), 0):max(int(e * SR), 1)] ** 2)) + 1e-9)
    jump = lambda t: rms(t, t + 0.6) - rms(t - 0.6, t)
    shifts = np.arange(-0.5, 0.5001, 0.005)
    best = max(((jump(start + d + ct) * w, d, ct) for ct, w in cuts for d in shifts), key=lambda z: z[0])
    if best[0] >= 3.0:
        _, d, anchor = best
        i = int(round((start + d + anchor) * SR / hop))
        lo, hi = max(i - 6, 0), min(i + 7, len(flux))
        d += (lo + int(flux[lo:hi].argmax()) - i) * hop / SR  # snap to the transient (±60 ms)
        how = f"+{jump(start + d + anchor):.1f} dB jump"
    else:
        anchor = drop_t
        anchors = [(drop_t, 3.0), (at.get("sting", 11.9), 2.0), (at.get("whoosh", 3.0), 1.0)]
        score = lambda d: sum(w * flux[max(0, int(round((start + d + t) * SR / hop)) - 2): int(round((start + d + t) * SR / hop)) + 3].max(initial=0)
                              for t, w in anchors)
        d = max(shifts, key=score)
        how = "beat-matched (no clear jump)"
    s0 = int(round((start + d) * SR))
    seg = np.zeros((2, n))
    src = x[:, max(s0, 0): s0 + n]
    seg[:, max(-s0, 0): max(-s0, 0) + src.shape[1]] = src[:, : n - max(-s0, 0)]
    seg *= np.minimum(1, np.arange(n) / (0.02 * SR))       # 20 ms de-click in
    seg *= fade(n, duration - 2.0, 1.95)                    # brief: clean fade over the final 2 s
    seg = np.vstack([spectral(seg[0], lambda f: hp(f, 25)), spectral(seg[1], lambda f: hp(f, 25))])
    _, _, kicks = kick_onsets(seg)
    print(f"music: {Path(path).name} from {start + d:.3f}s ({how}; track {start + d + anchor:.3f}s → cut at {anchor:.3f}s), "
          f"{len(kicks)} beat onsets")
    return seg, kicks


# ── Mix ──────────────────────────────────────────────────────────────────────
def build_sfx(n, cues):
    bus = Bus(n)
    swell = next((c for c in cues if c["type"] == "swell"), None)
    for c in cues:
        typ, t, g, p = c["type"], c["t"], c["gain"], c["pan"]
        lab = f'{typ}@{c["frame"]}'
        if typ == "sub_drop":
            bus.place(sfx_sub_drop() * 0.95 * g, t, anchor=int(0.006 * SR), label=lab)
        elif typ == "write":
            bus.place(sfx_write(c["dur"], c["seed"]) * 0.11 * g, t, pan=p, send=0.12, anchor=0, label=lab)
        elif typ in ("whoosh", "air"):
            s, a = sfx_whoosh(c["attack"], c["release"], seed=21 if typ == "whoosh" else 23,
                              lo=260 if typ == "whoosh" else 500, hi=4200 if typ == "whoosh" else 2600)
            bus.place(s * (0.55 if typ == "whoosh" else 0.3) * g, t, send=0.25, anchor=a, label=lab)
        elif typ == "key":
            bus.place(sfx_key(c["seed"]) * 0.16 * g, t, pan=p, send=0.05, label=lab)
        elif typ == "press":
            bus.place(sfx_key(7, low=True) * 0.32 * g, t, pan=p, send=0.1, label=lab)
        elif typ == "tick":
            bus.place(sfx_tick(c["seed"]) * 0.16 * g, t, pan=p, send=0.1, label=lab)
        elif typ == "data":
            bus.place(sfx_data(c["seed"]) * 0.12 * g, t, pan=p, label=lab)
        elif typ == "count":
            bus.place(sfx_data(c["seed"]) * 0.12 * g, t, pan=p, label=lab)
        elif typ == "glass":
            bus.place(sfx_glass(c["note"]) * 0.2 * g, t, pan=p, send=0.35, label=lab)
        elif typ in ("check", "warn"):
            bus.place(sfx_check(typ == "warn") * 0.16 * g, t, pan=p, send=0.3, anchor=int(0.0015 * SR), label=lab)
        elif typ == "ping":
            bus.place(sfx_ping(c["note"]) * 0.08 * g, t, pan=p, send=0.5, anchor=int(0.002 * SR), label=lab)
        elif typ == "success":
            s, a = sfx_success()
            bus.place(s * 0.2 * g, t, pan=p, send=0.35, anchor=a, label=lab)
        elif typ == "riser":
            s, a = sfx_riser(c["attack"], c["release"])
            bus.place(s * 0.6 * g, t, send=0.3, anchor=a, label=lab)
        elif typ == "ding":
            bus.place(sfx_ding(c["note"], c.get("metric", False)) * 0.5 * g, t, pan=p, send=0.55,
                      anchor=int(0.0012 * SR), label=lab)
        elif typ == "suck":
            s, a = sfx_suck(c["attack"])
            bus.place(s * 0.3 * g, t, send=0.2, anchor=a, label=lab)
        elif typ == "sting":
            s, a = sfx_sting()
            bus.place(s * 0.85 * g, t, send=0.4, anchor=a, label=lab)
        elif typ == "pad":
            peak = swell["t"] if swell else t + 1.7
            bus.place(sfx_pad(t, c["end"], peak) * g, t, anchor=0, send=0.5)
        elif typ == "swell":
            s, a = sfx_swell(c["start"], c["end"], t, c["panFrom"], c["panTo"])
            bus.place(s * 0.22 * g, t, send=0.45, anchor=a, label=lab)
    return bus.render(reverb_ir(3.2, seed=17, damp=7000), 0.45), bus.log


def follower(x, attack=0.005, release=0.22, block=48):
    """Peak envelope follower on 1 ms blocks, interpolated back to sample rate."""
    m = np.abs(x).max(axis=0)
    nb = int(np.ceil(len(m) / block))
    blocks = np.pad(m, (0, nb * block - len(m))).reshape(nb, block).max(axis=1)
    a = np.exp(-block / SR / attack)
    r = np.exp(-block / SR / release)
    out = np.empty(nb)
    e = 0.0
    for i, v in enumerate(blocks):
        e = a * e + (1 - a) * v if v > e else r * e + (1 - r) * v
        out[i] = e
    return np.interp(np.arange(len(m)), np.arange(nb) * block + block / 2, out)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def lufs(x):
    """Integrated loudness + true peak via ffmpeg's EBU R128 meter."""
    tmp = OUT / "_meter.wav"
    write_wav(tmp, x)
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostats", "-i", str(tmp), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    tmp.unlink(missing_ok=True)
    summary = r.stderr[r.stderr.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary).group(1))
    return i, tp


def limit(x, ceiling_db=CEILING_DB, look=0.002):
    """Look-ahead brickwall: min-filter the required gain, then smooth (never exceeds ceiling)."""
    c = 10 ** (ceiling_db / 20) * 0.97  # margin for inter-sample peaks
    need = np.minimum(1.0, c / np.maximum(np.abs(x).max(axis=0), 1e-9))
    r = int(look * SR)
    padded = np.pad(need, r, constant_values=1.0)
    win = np.lib.stride_tricks.sliding_window_view(padded, 2 * r + 1).min(axis=1)
    k = np.ones(2 * r + 1) / (2 * r + 1)
    g = np.convolve(np.pad(win, r, mode="edge"), k, mode="valid")
    return x * g


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1).T * 32767).round().astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main(cue_path, music_path=None, music_start=0.0):
    global OUT
    OUT = Path(cue_path).resolve().parent
    spec = json.loads(Path(cue_path).read_text(encoding="utf-8"))
    fps, duration, cues = spec["fps"], spec["duration"], spec["cues"]
    assert spec["sampleRate"] == SR and SR % fps == 0, "audio and video clocks must divide evenly"
    n = int(round(duration * SR))
    spf = SR // fps
    OUT.mkdir(parents=True, exist_ok=True)

    print(f"cues: {len(cues)} · {fps} fps · {spf} samples/frame")
    if music_path:
        music, kicks = external_bed(music_path, n, duration, cues, music_start)
        bed_db = -21.0   # produced tracks carry the energy, so they sit a little forward
    else:
        music, kicks = build_music(n, duration, next((c['t'] for c in cues if c['type'] == 'sting'), 11.9))
        bed_db = -24.0
    sfx, log = build_sfx(n, cues)

    # Separation: the bed sits well under the SFX bus peaks and ducks up to 6 dB beneath them.
    music *= 10 ** ((bed_db - rms_db(music)) / 20)
    env = follower(sfx)
    env /= env.max() + 1e-9
    duck_db = -6.0 * np.clip(env / 0.35, 0, 1)
    music_ducked = music * 10 ** (duck_db / 20)
    master = music_ducked + sfx

    # Loudness: measure, trim to target, brickwall to the ceiling, re-measure.
    i0, _ = lufs(master)
    master *= 10 ** ((TARGET_LUFS - i0) / 20)
    master = limit(master)
    # Silent last frame: cos fade, finishing two frames early (> one 1024-sample AAC window)
    # so the encoder has nothing left to smear into it.
    last = (round(duration * fps) - 1) * spf
    guard, ramp = 2 * spf, int(0.03 * SR)
    master[:, last - guard - ramp:last - guard] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, ramp))
    master[:, last - guard:] = 0.0
    i1, tp = lufs(master)

    scale = 10 ** ((TARGET_LUFS - i0) / 20)
    write_wav(OUT / "music.wav", music_ducked * scale)
    write_wav(OUT / "sfx.wav", sfx * scale)
    write_wav(OUT / "soundtrack.wav", master)

    # Audio-reactive envelopes, one value per video frame.
    frames = int(round(duration * fps))
    beat = np.zeros(frames)
    for k in kicks:
        f0 = int(round(k * fps))
        span = np.arange(frames - f0)
        beat[f0:] = np.maximum(beat[f0:], np.exp(-span / (0.22 * fps)))
    sfx_env = np.array([env[i * spf:(i + 1) * spf].max() for i in range(frames)])
    (OUT / "reactive.js").write_text(
        "// generated by audio.py — per-frame envelopes for the composition\n"
        f"window.__WL_AUDIO = {json.dumps({'fps': fps, 'beat': [round(v, 3) for v in beat], 'sfx': [round(float(v), 3) for v in sfx_env]}, separators=(',', ':'))};\n",
        encoding="utf-8")

    # Timing check: every logged transient's peak sample vs its target frame boundary.
    errs = [abs(s - round(t * SR)) for _, t, s in log]
    rows = ["| frame | time (s) | cue | pan | gain |", "|---:|---:|---|---:|---:|"]
    rows += [f"| {c['frame']} | {c['t']:.4f} | {c['type']} | {c['pan']:+.2f} | {c['gain']:.2f} |" for c in cues]
    (OUT / "cue-sheet.md").write_text(f"# WaveLink {round(duration)}s — audio cue sheet\n\n"
                                      f"{fps} fps · {SR} Hz · {spf} samples per frame. Generated from `__wl.cues()`.\n\n"
                                      + "\n".join(rows) + "\n", encoding="utf-8")

    last_peak = float(np.abs(master[:, last:]).max())
    print(f"placement: {len(log)} transients, max offset {max(errs)} samples ({max(errs) / SR * 1000:.3f} ms)")
    print(f"master: {i1:.1f} LUFS integrated, {tp:.1f} dBFS true peak, final frame peak {last_peak:.1e}")
    print(f"stems → {OUT}")


def verify(mp4, audio_dir=None):
    global OUT
    if audio_dir:
        OUT = Path(audio_dir).resolve()
    """Decode the muxed file and cross-correlate with the master to measure A/V offset."""
    raw = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", str(mp4), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    dec = np.frombuffer(raw, "<f4").reshape(-1, 2).T.astype(np.float64)
    with wave.open(str(OUT / "soundtrack.wav")) as w:
        ref = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2).T / 32767.0
    a, b = dec[0, : int(4 * SR)], ref[0, : int(4 * SR)]
    m = 1 << int(np.ceil(np.log2(len(a) + len(b))))
    xc = np.fft.irfft(np.fft.rfft(a, m) * np.conj(np.fft.rfft(b, m)), m)
    lag = int(np.argmax(np.concatenate([xc[-2000:], xc[:2000]]))) - 2000
    dur = dec.shape[1] / SR
    spec = json.loads((OUT / "cues.json").read_text(encoding="utf-8"))
    spf = SR // spec["fps"]
    last = (round(spec["duration"] * spec["fps"]) - 1) * spf + max(lag, 0)
    tail = float(np.abs(dec[:, last:last + spf]).max())
    print(f"verify: decoded {dur:.3f}s (incl. AAC padding), A/V offset {lag} samples ({lag / SR * 1000:+.2f} ms), "
          f"final-frame peak {20 * np.log10(tail + 1e-12):.0f} dBFS")
    if abs(lag) >= SR // 60:
        print("verify: FAIL — offset exceeds one frame")
        sys.exit(1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    import argparse
    ap = argparse.ArgumentParser(description="Frame-locked soundtrack for the 15s promo.")
    ap.add_argument("cues", nargs="?", help="output/audio/cues.json from the composition")
    ap.add_argument("--verify", metavar="MP4", help="check A/V sync and the silent final frame of a muxed file")
    ap.add_argument("--audio-dir", help="stem directory for --verify (default output/audio)")
    ap.add_argument("--music", metavar="FILE", help="use a produced track as the bed instead of the synthesised score")
    ap.add_argument("--music-start", type=float, default=0.0, help="seconds into --music where the 15 s window begins")
    a = ap.parse_args()
    if a.verify:
        verify(a.verify, a.audio_dir)
    elif a.cues:
        main(a.cues, a.music, a.music_start)
    else:
        ap.print_help()
        sys.exit(2)
