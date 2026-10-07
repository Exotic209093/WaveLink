#!/usr/bin/env node
// Render promo/motion/wavelink-15s.html to MP4, frame by frame, deterministically.
//
//   node promo/motion/render.mjs              cues → soundtrack → audit → frames → mux → verify
//   node promo/motion/render.mjs --stills     audit + key-frame PNGs and a contact sheet
//   node promo/motion/render.mjs --audit      layout-collision audit only
//   node promo/motion/render.mjs --audio-only rebuild the soundtrack and re-mux the last picture render
//   node promo/motion/render.mjs --no-audio   picture only
//   node promo/motion/render.mjs --cut 30     the 30-second cut (outputs under output/cut-30/)
//   node promo/motion/render.mjs --cues-only  export the cue map + music section plan only
//   node promo/motion/render.mjs --music track.mp3 [--music-start 31.5]   produced bed (Suno/ElevenLabs)
//   options: --fps 30  --crf 14  --out path.mp4  --safe 64 (px)  --no-audit  --force
//
// Needs Node 22+ (built-in WebSocket), Chrome/Edge/Chromium, and ffmpeg.
// Overrides: CHROME_PATH, FFMPEG_PATH, PYTHON. Audio needs Python with numpy + imageio-ffmpeg
// (promo/requirements.txt); ffmpeg falls back to imageio-ffmpeg's bundled binary.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const CUT = +opt('cut', 15) === 30 ? 30 : 15;
const OUT_DIR = path.join(HERE, 'output', ...(CUT === 30 ? ['cut-30'] : []));
const FPS = +opt('fps', 60);
const CRF = opt('crf', '14');
const OUT = path.resolve(opt('out', path.join(OUT_DIR, `wavelink-${CUT}s.mp4`)));
const BUILD = path.join(OUT_DIR, 'build');
const AUDIO_DIR = path.join(OUT_DIR, 'audio');
const SILENT = path.join(BUILD, 'picture.mp4');
const SOUNDTRACK = path.join(AUDIO_DIR, 'soundtrack.wav');
const STILL_TIMES = CUT === 30
  ? [1.9, 5.6, 8.35, 9.4, 10.2, 11.95, 13.7, 14.6, 16.9, 18.9, 20.3, 21.6, 23.6, 24.9, 26.8, 29.98]
  : [0.9, 1.9, 2.8, 3.9, 5.6, 7.3, 7.7, 8.5, 9.3, 10.0, 11.0, 11.7, 12.3, 13.2, 14.2, 14.98];

function findChrome() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const hit = c.find((p) => p && existsSync(p));
  if (!hit) throw new Error('No Chrome/Chromium found. Set CHROME_PATH.');
  return hit;
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  for (const py of ['python', 'python3']) {
    try {
      const p = execFileSync(py, ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (p && existsSync(p)) return p;
    } catch { /* try next */ }
  }
  return 'ffmpeg';
}

function findPython() {
  for (const py of [process.env.PYTHON, 'python', 'python3'].filter(Boolean)) {
    try { execFileSync(py, ['-c', 'import numpy, imageio_ffmpeg'], { stdio: 'ignore' }); return py; } catch { /* next */ }
  }
  throw new Error('Python with numpy + imageio-ffmpeg not found (pip install -r promo/requirements.txt), or pass --no-audio.');
}

function run(cmd, args) { execFileSync(cmd, args, { stdio: 'inherit' }); }

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.seq = 0; this.pending = new Map(); this.waiters = [];
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej, method } = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result);
      } else if (msg.method) {
        this.waiters = this.waiters.filter((w) => (w.method === msg.method ? (w.res(msg.params), false) : true));
      }
    };
  }
  open() { return new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; }); }
  send(method, params = {}) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej, method }));
  }
  once(method) { return new Promise((res) => this.waiters.push({ method, res })); }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  close() { this.ws.close(); }
}

async function launch() {
  const profile = mkdtempSync(path.join(tmpdir(), 'wl-motion-'));
  const proc = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--force-device-scale-factor=1', '--window-size=1920,1080', '--force-color-profile=srgb',
    '--allow-file-access-from-files', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    const timer = setTimeout(() => rej(new Error('Chrome did not start')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); res(m[1]); }
    });
    proc.on('exit', (c) => rej(new Error(`Chrome exited (${c})`)));
  });
  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.open();
  const stop = async () => {
    try { cdp.close(); } catch { /* already closed */ }
    const exited = new Promise((r) => (proc.exitCode !== null ? r() : proc.once('exit', r)));
    proc.kill();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* temp dir; best effort */ }
  };
  return { cdp, stop };
}

async function openComposition(cdp) {
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: `${pathToFileURL(path.join(HERE, 'wavelink-15s.html')).href}?render${CUT === 30 ? '&cut=30' : ''}` });
  await loaded;
  await cdp.eval('window.__wl.ready');
  return cdp.eval('({ d: __wl.duration, fonts: __wl.fonts(), face: getComputedStyle(document.getElementById("s1-title")).fontFamily })');
}

async function shot(cdp, t) {
  await cdp.eval(`__wl.seek(${t})`);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

async function buildSoundtrack(cdp) {
  if (48000 % FPS) throw new Error(`--fps ${FPS} does not divide 48 kHz evenly; frame-locked audio needs e.g. 24/25/30/48/50/60`);
  mkdirSync(AUDIO_DIR, { recursive: true });
  const spec = await cdp.eval(`__wl.cues(${FPS})`);
  const cuePath = path.join(AUDIO_DIR, 'cues.json');
  writeFileSync(cuePath, JSON.stringify(spec, null, 1));
  if (flag('cues-only')) { console.log(`cues → ${cuePath}`); return; }
  const music = opt('music');
  const extra = music ? ['--music', path.resolve(music), '--music-start', String(+opt('music-start', 0))] : [];
  run(findPython(), [path.join(HERE, 'audio.py'), cuePath, ...extra]);
}

function mux() {
  run(findFfmpeg(), ['-y', '-hide_banner', '-loglevel', 'error', '-i', SILENT, '-i', SOUNDTRACK,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    '-movflags', '+faststart', OUT]);
  run(findPython(), [path.join(HERE, 'audio.py'), '--verify', OUT, '--audio-dir', AUDIO_DIR]);
}

async function main() {
  mkdirSync(BUILD, { recursive: true });
  const { cdp, stop } = await launch();
  try {
    let info = await openComposition(cdp);
    console.log(`composition: ${info.d}s @ 1920x1080, ${FPS} fps`);

    const audio = !flag('no-audio') && !flag('audit') && !flag('stills');
    if (audio) {
      await buildSoundtrack(cdp);
      if (flag('cues-only')) return;
      info = await openComposition(cdp); // reload so the page picks up output/audio/reactive.js
      console.log(`audio-reactive envelopes: ${await cdp.eval('__wl.reactive') ? 'loaded' : 'missing'}`);
      if (flag('audio-only')) {
        if (!existsSync(SILENT)) throw new Error(`no picture render at ${SILENT}; run without --audio-only first`);
        mux();
        console.log(`video → ${OUT}`);
        return;
      }
    }

    if (!flag('no-audit')) {
      const issues = await cdp.eval(`__wl.audit(0.05, ${+opt('safe', 64)})`);
      if (issues.length) {
        console.log(`layout audit: ${issues.length} issue(s)`);
        for (const i of issues) console.log(`  ✗ ${i}`);
        if (!flag('force')) { process.exitCode = 1; return; }
      } else {
        console.log('layout audit: no collisions, overflows or safe-area breaches');
      }
    }
    if (flag('audit')) return;

    if (flag('stills')) {
      const dir = path.join(OUT_DIR, 'stills');
      rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
      for (const [i, t] of STILL_TIMES.entries()) {
        writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}.png`), await shot(cdp, t));
      }
      execFileSync(findFfmpeg(), ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '1', '-i', '%02d.png',
        '-vf', 'scale=480:-1,tile=4x4:padding=6:color=0x222222', '-frames:v', '1', path.join(OUT_DIR, 'contact-sheet.jpg')],
        { cwd: dir, stdio: 'inherit' });
      console.log(STILL_TIMES.map((t, i) => `  ${String(i).padStart(2, '0')}.png  t=${t}s`).join('\n'));
      console.log(`stills → ${dir}\ncontact sheet → ${path.join(OUT_DIR, 'contact-sheet.jpg')}`);
      return;
    }

    const total = Math.round(info.d * FPS);
    const target = audio ? SILENT : OUT;
    const ff = spawn(findFfmpeg(), [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-x264-params', 'aq-mode=3:aq-strength=0.9',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-r', String(FPS), '-frames:v', String(total), '-movflags', '+faststart', target,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
    const start = Date.now();
    for (let f = 0; f < total; f++) {
      const png = await shot(cdp, f / FPS);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % FPS === 0 || f === total - 1) {
        const el = (Date.now() - start) / 1000, eta = (el / (f + 1)) * (total - f - 1);
        process.stdout.write(`\rframe ${f + 1}/${total}  ${el.toFixed(0)}s elapsed  ~${eta.toFixed(0)}s left   `);
      }
    }
    ff.stdin.end();
    await done;
    process.stdout.write('\n');
    writeFileSync(path.join(OUT_DIR, 'poster.png'), await shot(cdp, info.d - 0.8));
    if (audio) mux();
    console.log(`video → ${OUT}\nposter → ${path.join(OUT_DIR, 'poster.png')}`);
  } finally {
    await stop();
  }
}

main().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
