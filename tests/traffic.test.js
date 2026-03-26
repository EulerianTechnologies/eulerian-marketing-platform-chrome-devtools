
// ── Traffic Source parameter parsing ────────────────────────────────────────
// tab-traffic.js exposes parseTrafficParams via window.TabTraffic in browser.
// We test the same logic here inline since we can't import DOM-scoped modules.

function parseTrafficParams(url) {
  const EULERIAN_PREFIXES = ['esl-k', 'ead-', 'eaf-', 'ept-', 'epi-', 'eml-', 'esc-', 'egn-'];
  const utm = {}, eulerian = {};
  if (!url) return { utm, eulerian };
  try {
    const q = new URL(url).search.replace(/^\?/, '');
    q.split('&').forEach(part => {
      const idx = part.indexOf('=');
      if (idx === -1) return;
      const key = decodeURIComponent(part.slice(0, idx));
      const val = decodeURIComponent(part.slice(idx + 1).replace(/\+/g, ' '));
      if (key.toLowerCase().startsWith('utm_')) { utm[key] = val; return; }
      const lk = key.toLowerCase();
      for (const p of EULERIAN_PREFIXES) {
        if (lk.startsWith(p) || lk === p) { eulerian[key] = val; return; }
      }
    });
  } catch(e) {}
  return { utm, eulerian };
}

describe('parseTrafficParams', () => {
  test('extracts utm_ params', () => {
    const r = parseTrafficParams('https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test');
    expect(r.utm['utm_source']).toBe('google');
    expect(r.utm['utm_medium']).toBe('cpc');
    expect(r.utm['utm_campaign']).toBe('test');
  });

  test('extracts Eulerian esl-k param', () => {
    const r = parseTrafficParams('https://example.com?esl-k=sea|google|cpc|brand');
    expect(r.eulerian['esl-k']).toBe('sea|google|cpc|brand');
  });

  test('extracts Eulerian ead- prefix params', () => {
    const r = parseTrafficParams('https://example.com?ead-publisher=google&ead-creative=banner');
    expect(r.eulerian['ead-publisher']).toBe('google');
    expect(r.eulerian['ead-creative']).toBe('banner');
  });

  test('ignores unrelated params', () => {
    const r = parseTrafficParams('https://example.com?gclid=abc&fbclid=def&page=1');
    expect(Object.keys(r.utm)).toHaveLength(0);
    expect(Object.keys(r.eulerian)).toHaveLength(0);
  });

  test('handles mixed UTM and Eulerian', () => {
    const r = parseTrafficParams('https://example.com?utm_source=google&esl-k=sea&ept-channel=paid');
    expect(r.utm['utm_source']).toBe('google');
    expect(r.eulerian['esl-k']).toBe('sea');
    expect(r.eulerian['ept-channel']).toBe('paid');
  });

  test('returns empty objects for URL with no params', () => {
    const r = parseTrafficParams('https://example.com/page');
    expect(Object.keys(r.utm)).toHaveLength(0);
    expect(Object.keys(r.eulerian)).toHaveLength(0);
  });

  test('handles null/empty input gracefully', () => {
    expect(parseTrafficParams(null)).toEqual({ utm: {}, eulerian: {} });
    expect(parseTrafficParams('')).toEqual({ utm: {}, eulerian: {} });
  });

  test('decodes URL-encoded values', () => {
    const r = parseTrafficParams('https://example.com?utm_campaign=hello%20world');
    expect(r.utm['utm_campaign']).toBe('hello world');
  });
});
