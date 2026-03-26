#!/usr/bin/env node
/**
 * validate-manifest.js
 * Checks that manifest.json is well-formed and has all required fields
 * before a build or upload attempt.
 */

const fs   = require('fs');
const path = require('path');

const MANIFEST_PATH = path.resolve(__dirname, '../src/manifest.json');

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch(e) {
  console.error('❌ Could not parse manifest.json:', e.message);
  process.exit(1);
}

const errors = [];

// Required fields
const required = ['manifest_version', 'name', 'version', 'description'];
for (const field of required) {
  if (!manifest[field]) errors.push(`Missing required field: "${field}"`);
}

// Must be v3
if (manifest.manifest_version !== 3) {
  errors.push(`manifest_version must be 3, got ${manifest.manifest_version}`);
}

// Version format: semver x.y.z
if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  errors.push(`Version "${manifest.version}" does not match x.y.z format`);
}

// Description length (Chrome Web Store limit: 132 chars without build stamp)
const descBase = manifest.description;
if (descBase.length > 132) {
  errors.push(`Description too long: ${descBase.length} chars (max 132 for Chrome Web Store)`);
}

// Icons
const iconSizes = ['16', '48', '128'];
for (const size of iconSizes) {
  if (!manifest.icons?.[size]) errors.push(`Missing icon size: ${size}`);
}

// Action
if (!manifest.side_panel?.default_path) errors.push('Missing side_panel.default_path');
if (!manifest.permissions?.includes('sidePanel')) errors.push('Missing sidePanel permission');

// Background
if (!manifest.background?.service_worker) errors.push('Missing background.service_worker');

if (errors.length) {
  console.error('\n❌ Manifest validation failed:\n');
  errors.forEach(e => console.error('   •', e));
  console.error();
  process.exit(1);
}

console.log(`✅ manifest.json is valid (v${manifest.version})`);
