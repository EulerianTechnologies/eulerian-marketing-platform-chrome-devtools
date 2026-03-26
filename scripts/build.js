#!/usr/bin/env node
/**
 * Build script — copies src/ → dist/ and produces eulerian-devtools.zip
 *
 * Usage:  node scripts/build.js [--minify]
 */

const fs      = require('fs');
const path    = require('path');
const archiver = require('archiver');

const SRC  = path.resolve(__dirname, '../src');
const DIST = path.resolve(__dirname, '../dist');
const ZIP  = path.resolve(__dirname, '../eulerian-marketing-platform-chrome-devtools.zip');

// ── Version bump from manifest ────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const version  = manifest.version;

console.log(`\nBuilding Eulerian Marketing Platform Chrome DevTools v${version}…\n`);

// ── Clean dist ────────────────────────────────────────────────────────────
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });
fs.mkdirSync(path.join(DIST, 'icons'), { recursive: true });

// ── Copy files ────────────────────────────────────────────────────────────
const filesToCopy = [
  'manifest.json',
  'background.js',
  'content.js',
  'injected.js',
  'sidepanel.html',
  'sidepanel.js',
  'tab-datalayer.js',
  'tab-traffic.js',
  'tab-identity.js',
  'tab-tcf.js',
  'tab-network.js',
  'utils.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

for (const file of filesToCopy) {
  const src  = path.join(SRC, file);
  const dest = path.join(DIST, file);
  if (!fs.existsSync(src)) {
    console.error(`  ❌ Missing: ${file}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  const size = (fs.statSync(dest).size / 1024).toFixed(1);
  console.log(`  ✓  ${file.padEnd(28)} ${size} kB`);
}

// ── Stamp build metadata into manifest ────────────────────────────────────
const distManifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
const buildTime    = new Date().toISOString();
console.log(`  build time: ${buildTime}`);
// Build time logged to console only — not written to manifest
fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(distManifest, null, 2));

// ── Create ZIP ────────────────────────────────────────────────────────────
if (fs.existsSync(ZIP)) fs.unlinkSync(ZIP);

const output  = fs.createWriteStream(ZIP);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const kb = (archive.pointer() / 1024).toFixed(1);
  console.log(`\n  📦 ${path.basename(ZIP)} — ${kb} kB\n`);
  console.log(`✅ Build complete — dist/ and ${path.basename(ZIP)} are ready.\n`);
});

archive.on('error', err => { throw err; });
archive.pipe(output);
archive.directory(DIST, false);
archive.finalize();
