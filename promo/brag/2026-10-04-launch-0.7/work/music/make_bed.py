"""Synthesise a calm 25 s ambient bed: soft pad, sparse felt-piano motif, sub bass, reverb.

Key of D major, 72 BPM. Chords: Dmaj9 -> Bm9 -> Gmaj9 -> Asus2 -> Dmaj9 (resolve at 21.8 s).
Writes bed.wav (44.1 kHz stereo, 16-bit).
"""
import wave
import numpy as np

SR = 44100
DUR = 25.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def env_adsr(n, a, r, sus=1.0):
    e = np.full(n, sus)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, sus, na) ** 2
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


# (start, end, midi notes) — pad voicings in a warm mid register.
CHORDS = [
    (0.0, 6.0, [50, 57, 61, 64, 66]),     # Dmaj9: D A C# E F#
    (5.4, 11.4, [47, 54, 57, 61, 62]),    # Bm9: B F# A C# D
    (10.8, 16.8, [43, 50, 54, 57, 59]),   # Gmaj9: G D F# A B
    (16.2, 22.2, [45, 52, 57, 59, 64]),   # Asus2: A E A B E
    (21.6, 25.0, [50, 57, 61, 64, 66]),   # Dmaj9 resolve
]

L = np.zeros(N)
R = np.zeros(N)

# Pad: three slightly detuned sines per note plus a soft octave partial.
for start, end, notes in CHORDS:
    i0, i1 = int(start * SR), min(int(end * SR), N)
    n = i1 - i0
    tt = np.arange(n) / SR
    e = env_adsr(n, a=1.6, r=1.8 if end < DUR else 0.0)
    for k, m in enumerate(notes):
        f = hz(m)
        for d, pan in ((-5, 0.3), (0, 0.5), (5, 0.7)):
            ff = f * 2 ** (d / 1200)
            ph = rng.uniform(0, 2 * np.pi)
            s = np.sin(2 * np.pi * ff * tt + ph) + 0.12 * np.sin(4 * np.pi * ff * tt + ph)
            s *= 0.9 + 0.1 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * tt)  # slow shimmer
            L[i0:i1] += s * e * (1 - pan) * 0.045
            R[i0:i1] += s * e * pan * 0.045

# Sub bass: chord roots, very soft.
for start, end, notes in CHORDS:
    i0, i1 = int(start * SR), min(int(end * SR), N)
    n = i1 - i0
    tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * hz(notes[0] - 12) * tt) * env_adsr(n, 1.2, 1.5 if end < DUR else 0.0) * 0.09
    L[i0:i1] += s
    R[i0:i1] += s

# Felt piano: sparse arpeggio motif on the beat grid (72 BPM, 0.833 s per beat).
BEAT = 60 / 72
MOTIF = {0: [74, 69, 73, 76], 1: [71, 66, 69, 73], 2: [67, 71, 74, 78], 3: [69, 73, 76, 71], 4: [74, 78, 81]}


def piano(f, dur=3.0, vel=0.5):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for h, amp, dec in ((1, 1.0, 2.2), (2, 0.35, 3.5), (3, 0.12, 5.0), (4, 0.05, 7.0)):
        s += amp * np.exp(-tt * dec) * np.sin(2 * np.pi * f * h * (1 + 0.0004 * h * h) * tt)
    attack = np.minimum(tt / 0.012, 1.0)  # felt: soft hammer
    return s * attack * vel


beat_times = []
for ci, (start, end, _) in enumerate(CHORDS):
    seq = MOTIF[ci]
    for j, m in enumerate(seq):
        bt = start + 0.6 + j * BEAT * 1.5
        if bt < min(end, DUR - 2.5):
            beat_times.append((bt, m, 0.38 - 0.04 * j))
for bt, m, vel in beat_times:
    p = piano(hz(m), vel=vel * 0.32)
    i0 = int(bt * SR)
    i1 = min(i0 + len(p), N)
    pan = 0.35 + 0.3 * ((m % 7) / 7)
    L[i0:i1] += p[: i1 - i0] * (1 - pan)
    R[i0:i1] += p[: i1 - i0] * pan

# Gentle one-pole low-pass to round off the top end.
def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(0, len(x), 4096):  # vectorised per block via cumulative filter
        blk = x[i:i + 4096]
        out = np.empty_like(blk)
        for j, v in enumerate(blk):
            acc = (1 - a) * v + a * acc
            out[j] = acc
        y[i:i + 4096] = out
    return y


L, R = lowpass(L, 6500), lowpass(R, 6500)

# Reverb: convolve with decaying stereo noise (2.8 s tail), FFT convolution.
irn = int(2.8 * SR)
it = np.arange(irn) / SR
decay = np.exp(-it * 2.4)
irL = rng.standard_normal(irn) * decay
irR = rng.standard_normal(irn) * decay
irL[:int(0.02 * SR)] = 0
irR[:int(0.027 * SR)] = 0


def conv(x, ir):
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]


wetL, wetR = conv(L, irL), conv(R, irR)
wetL /= np.max(np.abs(wetL)) + 1e-9
wetR /= np.max(np.abs(wetR)) + 1e-9
dryp = max(np.max(np.abs(L)), np.max(np.abs(R)))
L = 0.62 * L / dryp + 0.38 * wetL
R = 0.62 * R / dryp + 0.38 * wetR

# Fades: soft in, long tail out after the resolve.
fade = np.ones(N)
fade[: int(0.8 * SR)] = np.linspace(0, 1, int(0.8 * SR)) ** 2
tail = int(2.2 * SR)
fade[-tail:] = np.linspace(1, 0, tail) ** 1.6
L *= fade
R *= fade

peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / peak * 0.5, R / peak * 0.5  # -6 dBFS peak; loudness set at mix time
stereo = (np.stack([L, R], axis=1) * 32767).astype(np.int16)
with wave.open('bed.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())
print('wrote bed.wav', DUR, 's; piano notes:', len(beat_times))
