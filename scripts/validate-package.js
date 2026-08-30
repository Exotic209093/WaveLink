/** Static release smoke checks for the built Chrome extension. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function fail(message) {
  throw new Error(`Package validation failed: ${message}`);
}

function requireFile(relativePath) {
  const absolutePath = path.join(dist, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail(`missing ${relativePath}`);
  }
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
}

if (!fs.existsSync(dist)) fail('dist/ does not exist; run the production build first');

const manifestPath = path.join(dist, 'manifest.json');
requireFile('manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail('manifest version must be semver-like');
if (manifest.content_security_policy?.extension_pages !== "script-src 'self'; object-src 'self'") {
  fail('extension CSP must allow self-hosted scripts only');
}

requireFile(manifest.background.service_worker);
requireFile(manifest.action.default_popup);
for (const icon of Object.values(manifest.icons || {})) requireFile(icon);
for (const script of manifest.content_scripts || []) {
  for (const source of script.js || []) requireFile(source);
}

for (const required of ['app/app.html', 'app/index.js', 'offscreen/offscreen.html', 'offscreen/index.js']) {
  requireFile(required);
}

const files = walk(dist);
const forbidden = files
  .map(file => path.relative(dist, file))
  .filter(file => file.endsWith('.map') || file.endsWith('.d.ts') || file.includes('..'));
if (forbidden.length > 0) fail(`forbidden release files: ${forbidden.join(', ')}`);

for (const htmlPath of files.filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (/https?:\/\/[^"']+\.js(?:[?"'])/i.test(html)) {
    fail(`remote script reference in ${path.relative(dist, htmlPath)}`);
  }
}

console.log(`Validated Manifest V3 package ${manifest.version}: ${files.length} files, required entrypoints present, CSP and release contents clean.`);
