/**
 * Generate WaveLink extension icons from SVG at all required sizes.
 * Usage: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path = require('path');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a6e8a"/>
      <stop offset="100%" stop-color="#48cae4"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="26" ry="26" fill="url(#bg)"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 46 Q34 30, 46 46 T70 46 T94 46 T106 42"
          stroke="rgba(255,255,255,0.35)" stroke-width="5.5"/>
    <path d="M22 64 Q34 44, 46 64 T70 64 T94 64 T106 58"
          stroke="rgba(255,255,255,0.92)" stroke-width="7.5"/>
    <path d="M22 82 Q34 62, 46 82 T70 82 T94 82 T106 76"
          stroke="rgba(255,255,255,0.35)" stroke-width="5.5"/>
  </g>
  <circle cx="22" cy="64" r="4.5" fill="white" fill-opacity="0.9"/>
  <circle cx="106" cy="58" r="4.5" fill="white" fill-opacity="0.9"/>
</svg>`;

const sizes = [16, 32, 48, 128];
const outDir = path.resolve(__dirname, '..', 'public', 'icons');

async function main() {
  for (const size of sizes) {
    await sharp(Buffer.from(SVG))
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon-${size}.png`));
    console.log(`icon-${size}.png`);
  }
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
