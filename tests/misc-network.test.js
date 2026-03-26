/**
 * tests/misc-network.test.js
 * Unit tests for URL detection and parameter parsing in popup.js
 */

const { parseParams, isMiscUrl } = require('../src/utils.js');

describe('isMiscUrl', () => {
  test('detects /misc/ in a full URL', () => {
    expect(isMiscUrl('https://col.lemonde.fr/misc/ea.php?uid=123')).toBe(true);
  });

  test('detects /misc/ in a relative URL', () => {
    expect(isMiscUrl('/misc/ea.php?pmact=pageview')).toBe(true);
  });

  test('detects /misc/ in path with sub-paths', () => {
    expect(isMiscUrl('https://tracker.example.com/collect/misc/hit')).toBe(true);
  });

  test('returns false for URLs without /misc/', () => {
    expect(isMiscUrl('https://col.lemonde.fr/gtm/collect')).toBe(false);
  });

  test('returns false for the word "misc" not in a path segment', () => {
    expect(isMiscUrl('https://example.com/miscellaneous/file')).toBe(false); // /misc/ requires trailing slash
  });

  test('handles empty string gracefully', () => {
    expect(isMiscUrl('')).toBe(false);
  });

  test('handles null gracefully', () => {
    expect(isMiscUrl(null)).toBe(false);
  });
});

describe('parseParams', () => {
  test('parses a simple query string', () => {
    const result = parseParams('?uid=123&pmact=pageview');
    expect(result.uid).toBe('123');
    expect(result.pmact).toBe('pageview');
  });

  test('parses without leading ?', () => {
    const result = parseParams('uid=123&pmact=pageview');
    expect(result.uid).toBe('123');
  });

  test('decodes URL-encoded values', () => {
    const result = parseParams('?gdpr_consent=CPd%2Bm4A%3D%3D');
    expect(result.gdpr_consent).toBe('CPd+m4A==');
  });

  test('decodes + as space in values', () => {
    const result = parseParams('?name=hello+world');
    expect(result.name).toBe('hello world');
  });

  test('handles values with = in them (e.g. base64)', () => {
    const result = parseParams('?gdpr_consent=CPd_m4A==');
    expect(result.gdpr_consent).toBe('CPd_m4A==');
  });

  test('returns empty object for empty string', () => {
    const result = parseParams('');
    expect(result).toEqual({});
  });

  test('returns empty object for null', () => {
    const result = parseParams(null);
    expect(result).toEqual({});
  });

  test('parses gdpr_customvendor', () => {
    const result = parseParams('?gdpr_customvendor=BgAEABAAAA&gdpr_consent=CPd_m4A');
    expect(result.gdpr_customvendor).toBe('BgAEABAAAA');
    expect(result.gdpr_consent).toBe('CPd_m4A');
  });

  test('handles keys without values', () => {
    const result = parseParams('?flag&uid=123');
    expect(result.uid).toBe('123');
  });

  test('handles multiple pmact values (last wins)', () => {
    const result = parseParams('?pmact=pageview&pmact=purchase');
    expect(result.pmact).toBe('purchase');
  });
});

describe('TC string match logic', () => {
  const TC_STRING = 'CPd_m4APd_m4AAfKABENB4Cg';

  test('match is true when gdpr_consent equals TCString exactly', () => {
    const params        = parseParams(`?gdpr_consent=${encodeURIComponent(TC_STRING)}&pmact=pageview`);
    const gdprConsent   = params.gdpr_consent;
    const tcStringMatch = gdprConsent && TC_STRING ? (gdprConsent === TC_STRING) : null;
    expect(tcStringMatch).toBe(true);
  });

  test('match is false when gdpr_consent differs from TCString', () => {
    const params        = parseParams('?gdpr_consent=STALE_OLD_VALUE&pmact=click');
    const gdprConsent   = params.gdpr_consent;
    const tcStringMatch = gdprConsent && TC_STRING ? (gdprConsent === TC_STRING) : null;
    expect(tcStringMatch).toBe(false);
  });

  test('match is null when gdpr_consent is absent', () => {
    const params        = parseParams('?pmact=click');
    const gdprConsent   = params.gdpr_consent || null;
    const tcStringMatch = (gdprConsent && TC_STRING) ? (gdprConsent === TC_STRING) : null;
    expect(tcStringMatch).toBeNull();
  });
});
