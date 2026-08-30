const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'screenshots');
const iconPath = path.join(root, 'public', 'icons', 'wavelink-icon.svg');

const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function baseSvg(width, height, body) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#071B33"/>
          <stop offset="0.55" stop-color="#063F5A"/>
          <stop offset="1" stop-color="#0284A8"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#00111F" flood-opacity="0.35"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#background)"/>
      <circle cx="${width * 0.92}" cy="${height * 0.08}" r="${height * 0.58}" fill="#48CAE4" opacity="0.08"/>
      <circle cx="${width * 0.08}" cy="${height * 1.05}" r="${height * 0.5}" fill="#90E0EF" opacity="0.07"/>
      <path d="M0 ${height * 0.78} C ${width * 0.18} ${height * 0.58}, ${width * 0.30} ${height * 0.96}, ${width * 0.48} ${height * 0.74} S ${width * 0.76} ${height * 0.55}, ${width} ${height * 0.72}" fill="none" stroke="#90E0EF" stroke-width="2" opacity="0.12"/>
      ${body}
    </svg>
  `);
}

async function generateSmallPromo() {
  const width = 440;
  const height = 280;
  const body = `
    <text x="42" y="148" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="43" font-weight="700" letter-spacing="-1">${escapeXml('WaveLink')}</text>
    <text x="42" y="180" fill="#D7F6FB" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="500">${escapeXml('Safer Salesforce data workflows')}</text>
    <rect x="42" y="205" width="274" height="36" rx="18" fill="#FFFFFF" opacity="0.10"/>
    <text x="61" y="229" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" letter-spacing="0.2">EXPORT  •  IMPORT  •  COMPARE</text>
  `;
  const icon = await sharp(iconPath).resize(78, 78).png().toBuffer();
  await sharp(baseSvg(width, height, body))
    .composite([{ input: icon, left: 40, top: 38 }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, 'promo-small-440x280.png'));
}

async function generateMarqueePromo() {
  const width = 1400;
  const height = 560;
  const body = `
    <text x="150" y="118" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="700">WaveLink</text>
    <text x="76" y="222" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="700" letter-spacing="-1.4">Salesforce data work,</text>
    <text x="76" y="278" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="700" letter-spacing="-1.4">without the busywork.</text>
    <text x="78" y="324" fill="#D7F6FB" font-family="Segoe UI, Arial, sans-serif" font-size="20">Export, import, compare, schedule, and repeat</text>
    <text x="78" y="352" fill="#D7F6FB" font-family="Segoe UI, Arial, sans-serif" font-size="20">with production safeguards built in.</text>
    <g filter="url(#shadow)">
      <rect x="775" y="96" width="545" height="368" rx="28" fill="#F7FAFC"/>
      <rect x="775" y="96" width="545" height="62" rx="28" fill="#FFFFFF"/>
      <rect x="775" y="132" width="545" height="26" fill="#FFFFFF"/>
      <circle cx="812" cy="127" r="7" fill="#0284A8"/>
      <text x="834" y="134" fill="#102A43" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="700">Export records</text>
      <rect x="809" y="190" width="477" height="54" rx="12" fill="#EAF8FB"/>
      <text x="831" y="223" fill="#07506B" font-family="Consolas, monospace" font-size="16">SELECT Id, Name FROM Account</text>
      <rect x="809" y="270" width="148" height="82" rx="14" fill="#FFFFFF" stroke="#D7E5EC"/>
      <text x="829" y="299" fill="#627D98" font-family="Segoe UI, Arial, sans-serif" font-size="13">ENVIRONMENT</text>
      <text x="829" y="330" fill="#102A43" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700">Sandbox</text>
      <rect x="972" y="270" width="148" height="82" rx="14" fill="#FFFFFF" stroke="#D7E5EC"/>
      <text x="992" y="299" fill="#627D98" font-family="Segoe UI, Arial, sans-serif" font-size="13">FORMAT</text>
      <text x="992" y="330" fill="#102A43" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700">CSV</text>
      <rect x="1135" y="270" width="151" height="82" rx="14" fill="#FFFFFF" stroke="#D7E5EC"/>
      <text x="1155" y="299" fill="#627D98" font-family="Segoe UI, Arial, sans-serif" font-size="13">API MODE</text>
      <text x="1155" y="330" fill="#102A43" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700">Automatic</text>
      <rect x="1121" y="385" width="165" height="48" rx="13" fill="#0284A8"/>
      <text x="1164" y="416" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">Run export</text>
    </g>
    <g>
      <rect x="77" y="390" width="180" height="48" rx="24" fill="#FFFFFF" opacity="0.11"/>
      <circle cx="105" cy="414" r="7" fill="#48CAE4"/>
      <text x="124" y="421" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600">Local-first</text>
      <rect x="272" y="390" width="218" height="48" rx="24" fill="#FFFFFF" opacity="0.11"/>
      <circle cx="300" cy="414" r="7" fill="#48CAE4"/>
      <text x="319" y="421" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600">Production-aware</text>
      <rect x="505" y="390" width="184" height="48" rx="24" fill="#FFFFFF" opacity="0.11"/>
      <circle cx="533" cy="414" r="7" fill="#48CAE4"/>
      <text x="552" y="421" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600">Repeatable</text>
    </g>
  `;
  const icon = await sharp(iconPath).resize(58, 58).png().toBuffer();
  await sharp(baseSvg(width, height, body))
    .composite([{ input: icon, left: 76, top: 76 }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, 'promo-marquee-1400x560.png'));
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  await Promise.all([generateSmallPromo(), generateMarqueePromo()]);
  console.log('Generated Chrome Web Store promotional assets in screenshots/.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
