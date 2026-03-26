/**
 * tests/manifest.test.js
 * Ensures src/manifest.json always stays valid before any build.
 */

const fs   = require('fs');
const path = require('path');

const MANIFEST_PATH = path.resolve(__dirname, '../src/manifest.json');

let manifest;
beforeAll(() => {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
});

describe('manifest.json', () => {
  test('is valid JSON', () => {
    expect(manifest).toBeTruthy();
  });

  test('manifest_version is 3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test('has a name', () => {
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  test('version matches x.y.z semver', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('has a description', () => {
    expect(typeof manifest.description).toBe('string');
    expect(manifest.description.length).toBeGreaterThan(0);
  });

  test('base description (without build stamp) is within 132 chars', () => {
    const base = manifest.description;
    expect(base.length).toBeLessThanOrEqual(132);
  });

  test('has all three icon sizes', () => {
    expect(manifest.icons?.['16']).toBeTruthy();
    expect(manifest.icons?.['48']).toBeTruthy();
    expect(manifest.icons?.['128']).toBeTruthy();
  });

  test('has side_panel.default_path', () => {
    expect(manifest.side_panel?.default_path).toBeTruthy();
  });

  test('has sidePanel permission', () => {
    expect(manifest.permissions).toContain('sidePanel');
  });

  test('has background.service_worker', () => {
    expect(manifest.background?.service_worker).toBeTruthy();
  });

  test('has required permissions', () => {
    const perms = manifest.permissions || [];
    expect(perms).toContain('activeTab');
    expect(perms).toContain('scripting');
    expect(perms).toContain('storage');
    expect(perms).toContain('alarms');
  });

  test('incognito is spanning', () => {
    expect(manifest.incognito).toBe('spanning');
  });

  test('content_scripts run_at is document_start', () => {
    const cs = manifest.content_scripts?.[0];
    expect(cs?.run_at).toBe('document_start');
  });
});
