/**
 * Creates a Chrome Web Store-ready zip from the dist/ folder.
 *
 * Excludes:
 *  - TypeScript declaration files (.d.ts, .d.ts.map)
 *  - License text files (.LICENSE.txt)
 *  - Source directories (src/, tests/) that tsc may emit
 *
 * Usage: node scripts/package-extension.js
 * Output: wavelink-<version>.zip
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST = path.resolve(__dirname, '..', 'dist');

if (!fs.existsSync(DIST)) {
  console.error('Error: dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
const version = manifest.version;
const outFile = path.resolve(__dirname, '..', `wavelink-${version}.zip`);

/** Directories inside dist/ that should NOT be packaged. */
const EXCLUDED_DIRS = new Set(['src', 'tests']);

/** File patterns to skip. */
function shouldExclude(name) {
  if (name.endsWith('.d.ts')) return true;
  if (name.endsWith('.d.ts.map')) return true;
  if (name.endsWith('.LICENSE.txt')) return true;
  return false;
}

/** Recursively collect relative paths from dist/, respecting exclusions. */
function collectFiles(dir, base) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip excluded top-level directories
      const rel = path.relative(base, full);
      if (EXCLUDED_DIRS.has(rel)) continue;
      files.push(...collectFiles(full, base));
    } else if (!shouldExclude(entry.name)) {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

const files = collectFiles(DIST, DIST);
console.log(`Packaging ${files.length} files into wavelink-${version}.zip...`);

// Remove existing zip
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

try {
  if (process.platform === 'win32') {
    // PowerShell Compress-Archive with flat file list loses directory structure.
    // Instead, create a clean temp directory with only the files we want, then zip it.
    const tmpDir = path.resolve(__dirname, '..', '_pkg_tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });

    // Copy each file preserving directory structure
    for (const rel of files) {
      const src = path.join(DIST, rel);
      const dest = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }

    // Zip the temp directory contents (not the directory itself)
    execSync(
      `powershell -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${outFile}'"`,
      { stdio: 'inherit' },
    );

    // Clean up
    fs.rmSync(tmpDir, { recursive: true });
  } else {
    // Unix: cd into dist and zip, excluding unwanted files
    execSync(
      `cd "${DIST}" && zip -r "${outFile}" . ` +
      `-x "src/*" "tests/*" "*.d.ts" "*.d.ts.map" "*.LICENSE.txt"`,
      { stdio: 'inherit' },
    );
  }

  const size = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`\nCreated wavelink-${version}.zip (${size} KB)`);
  console.log('Upload this file to the Chrome Web Store developer dashboard.');
} catch (err) {
  console.error('Packaging failed:', err.message);
  process.exit(1);
}
