// Tests for the EA dataLayer flat-array parser (mirrors tab-datalayer.js logic)

function parseEAArray(arr) {
  const pairs = {};
  if (!Array.isArray(arr)) return pairs;
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const k = String(arr[i]   == null ? '' : arr[i]);
    const v = String(arr[i+1] == null ? '' : arr[i+1]);
    if (k !== '') pairs[k] = v;
  }
  return pairs;
}

describe('parseEAArray', () => {
  test('parses a standard EA flat array', () => {
    const arr = ['path', '/billetterie', 'pagegroup', 'billet_landing_page'];
    const r = parseEAArray(arr);
    expect(r.path).toBe('/billetterie');
    expect(r.pagegroup).toBe('billet_landing_page');
  });

  test('parses the full Zoo Beauval example', () => {
    const arr = [
      'path',         '/billetterie',
      'pagegroup',    'billet_landing_page',
      'pagelabel',    ',,,,tunnel_billet_landing_page_step_1',
      'domaine',      'www.zoobeauval.com',
      'profile',      'LP-looker',
      'profile-type', 'billet'
    ];
    const r = parseEAArray(arr);
    expect(Object.keys(r)).toHaveLength(6);
    expect(r['profile-type']).toBe('billet');
    expect(r['pagelabel']).toBe(',,,,tunnel_billet_landing_page_step_1');
  });

  test('returns empty object for empty array', () => {
    expect(parseEAArray([])).toEqual({});
  });

  test('returns empty object for non-array', () => {
    expect(parseEAArray(null)).toEqual({});
    expect(parseEAArray(undefined)).toEqual({});
    expect(parseEAArray('string')).toEqual({});
    expect(parseEAArray({})).toEqual({});
  });

  test('skips entries where key is empty string', () => {
    const r = parseEAArray(['', 'ignored', 'realkey', 'realval']);
    expect(Object.keys(r)).toHaveLength(1);
    expect(r['realkey']).toBe('realval');
  });

  test('handles odd-length array (last key without value)', () => {
    const r = parseEAArray(['key1', 'val1', 'orphan']);
    expect(r['key1']).toBe('val1');
    expect(r['orphan']).toBeUndefined();
  });

  test('coerces null values to empty string', () => {
    const r = parseEAArray(['key', null]);
    expect(r['key']).toBe('');
  });

  test('coerces numeric values to string', () => {
    const r = parseEAArray(['count', 42]);
    expect(r['count']).toBe('42');
  });
});

describe('source field logic', () => {
  test('collector params object is already key/value (no array parsing needed)', () => {
    // Background stores collector params as a parsed object directly
    var colParams = { path: '/billetterie', pagegroup: 'billet_landing_page', profile: 'LP-looker' };
    var keys = Object.keys(colParams).sort(function(a,b){ return a.localeCompare(b); });
    expect(keys[0]).toBe('pagegroup');
    expect(keys[1]).toBe('path');
    expect(keys[2]).toBe('profile');
  });

  test('parseEAArray still handles window object arrays', () => {
    var r = parseEAArray(['path', '/shop', 'env', 'prod']);
    expect(r.path).toBe('/shop');
    expect(r.env).toBe('prod');
  });
});

describe('parseEAArray with plain object input', () => {
  function parseEAArray(raw) {
    var pairs = {};
    if (raw == null) return pairs;
    if (Array.isArray(raw)) {
      for (var i = 0; i + 1 < raw.length; i += 2) {
        var k = String(raw[i] == null ? '' : raw[i]);
        var v = String(raw[i+1] == null ? '' : raw[i+1]);
        if (k !== '') pairs[k] = v;
      }
      return pairs;
    }
    if (typeof raw === 'object') {
      Object.keys(raw).forEach(function(k) {
        var v = raw[k];
        pairs[k] = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
      return pairs;
    }
    return pairs;
  }

  test('parses a plain object directly', () => {
    var r = parseEAArray({ path: '/home', pagegroup: 'homepage' });
    expect(r.path).toBe('/home');
    expect(r.pagegroup).toBe('homepage');
  });

  test('returns empty object for null', () => {
    expect(parseEAArray(null)).toEqual({});
  });

  test('stringifies nested object values', () => {
    var r = parseEAArray({ meta: { env: 'prod' } });
    expect(r.meta).toBe('{"env":"prod"}');
  });

  test('still parses flat arrays correctly', () => {
    var r = parseEAArray(['k1', 'v1', 'k2', 'v2']);
    expect(r.k1).toBe('v1');
    expect(r.k2).toBe('v2');
  });
});
