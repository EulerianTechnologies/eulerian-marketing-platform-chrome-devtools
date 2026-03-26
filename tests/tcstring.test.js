/**
 * tests/tcstring.test.js
 * Unit tests for the TCString decoder logic in popup.js
 */

// The file uses module.exports when run in Node
const { decodeTCString } = require('../src/utils.js');

// A real TCF v2 TC string (truncated but structurally valid header)
// Created 2023-01-01, CMP ID = 10, GDPR applies = true
const VALID_TC_STRING = 'CPd_m4APd_m4AAfKABENB4CgAAAAAAAAAAAAAAAAAAA';

describe('decodeTCString', () => {
  test('returns error for empty input', () => {
    expect(decodeTCString('').error).toBeTruthy();
    expect(decodeTCString(null).error).toBeTruthy();
    expect(decodeTCString(undefined).error).toBeTruthy();
  });

  test('returns error for garbage input', () => {
    const result = decodeTCString('not-a-valid-tc-string!!!');
    expect(result.error).toBeTruthy();
  });

  test('decodes a valid TC string without error', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(result.error).toBeUndefined();
  });

  test('decoded version is a number', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(typeof result.version).toBe('number');
  });

  test('version is 2 for a TCF v2 string', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(result.version).toBe(2);
  });

  test('created and lastUpdated are ISO date strings', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(result.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(result.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  test('gdprApplies is a boolean', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(typeof result.gdprApplies).toBe('boolean');
  });

  test('purposeConsents has entries 1–24', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(typeof result.purposeConsents).toBe('object');
    for (let i = 1; i <= 24; i++) {
      expect(typeof result.purposeConsents[i]).toBe('boolean');
    }
  });

  test('purposeLI has entries 1–24', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(typeof result.purposeLI).toBe('object');
    for (let i = 1; i <= 24; i++) {
      expect(typeof result.purposeLI[i]).toBe('boolean');
    }
  });

  test('length matches input string length', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(result.length).toBe(VALID_TC_STRING.length);
  });

  test('segments is 1 for a single-segment string', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(result.segments).toBe(1);
  });

  test('segments is 2 for a two-segment string', () => {
    const result = decodeTCString(VALID_TC_STRING + '.EXTRA_SEGMENT');
    expect(result.segments).toBe(2);
  });

  test('cmpId is a non-negative number', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(typeof result.cmpId).toBe('number');
    expect(result.cmpId).toBeGreaterThanOrEqual(0);
  });

  test('consentLanguage is a 2-character string', () => {
    const result = decodeTCString(VALID_TC_STRING);
    expect(typeof result.consentLanguage).toBe('string');
    expect(result.consentLanguage).toHaveLength(2);
  });

  test('handles base64url encoding (- and _ chars)', () => {
    // Replace + with - and / with _ to simulate base64url
    const urlSafe = VALID_TC_STRING.replace(/\+/g, '-').replace(/\//g, '_');
    const result = decodeTCString(urlSafe);
    expect(result.error).toBeUndefined();
  });
});
