// src/utils.js
// Pure functions with zero browser/chrome dependencies.
// Imported by popup.js at runtime and by Jest tests directly.

'use strict';

// Node.js (Jest) polyfill for atob
/* istanbul ignore next */
const _atob = typeof atob === 'function' ? atob : (b64) => Buffer.from(b64, 'base64').toString('binary');

/**
 * Decode the binary header of a TCF v2 TC string.
 * @param {string} tcString
 * @returns {object} decoded fields, or { error: string } on failure
 */
function decodeTCString(tcString) {
  if (!tcString || typeof tcString !== 'string') return { error: 'Empty TC string' };
  try {
    const segment = tcString.split('.')[0];
    const base64  = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded  = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary  = _atob(padded);
    let bits = '';
    for (let i = 0; i < binary.length; i++) bits += binary.charCodeAt(i).toString(2).padStart(8, '0');

    const ri = (s, l) => parseInt(bits.slice(s, s + l), 2);
    const rd = s => new Date(ri(s, 36) * 100).toISOString().slice(0, 19) + 'Z';
    const rb = s => bits[s] === '1';
    const rs = (s, l) => {
      let str = '';
      for (let i = 0; i < l; i++) str += String.fromCharCode(ri(s + i * 6, 6) + 65);
      return str;
    };

    const purposeConsents = {};
    const purposeLI       = {};
    for (let i = 0; i < 24; i++) {
      purposeConsents[i + 1] = rb(152 + i);
      purposeLI[i + 1]       = rb(176 + i);
    }

    return {
      version:              ri(0, 6),
      created:              rd(6),
      lastUpdated:          rd(42),
      cmpId:                ri(78, 12),
      cmpVersion:           ri(90, 12),
      consentScreen:        ri(102, 6),
      consentLanguage:      rs(108, 2),
      vendorListVersion:    ri(120, 12),
      tcfPolicyVersion:     ri(132, 6),
      isServiceSpecific:    rb(138),
      useNonStandardStacks: rb(139),
      gdprApplies:          rb(172),
      purposeConsents,
      purposeLI,
      length:   tcString.length,
      segments: tcString.split('.').length
    };
  } catch (e) {
    return { error: 'Parse error: ' + e.message };
  }
}

/**
 * Parse a URL query string or POST body string into a key/value object.
 * @param {string|null} search
 * @returns {object}
 */
function parseParams(search) {
  const p = {};
  if (!search) return p;
  try {
    const q = search.startsWith('?') ? search.slice(1) : search;
    q.split('&').forEach(part => {
      const idx = part.indexOf('=');
      if (idx === -1) return;
      const k = part.slice(0, idx);
      const v = part.slice(idx + 1);
      try { p[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
      catch(e) { p[k] = v; }
    });
  } catch(e) {}
  return p;
}

/**
 * Returns true if the URL path contains /misc/
 * @param {string|null} url
 * @returns {boolean}
 */
function isMiscUrl(url) {
  if (!url) return false;
  try { return new URL(url, 'https://example.com').pathname.includes('/misc/'); }
  catch(e) { return String(url).includes('/misc/'); }
}

// Node.js (Jest) export — tree-shaken away in browser bundle
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { decodeTCString, parseParams, isMiscUrl };
}
