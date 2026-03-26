// Eulerian Marketing Platform Chrome DevTools — tab-datalayer.js
// "dataLayer" tab — two sections always shown:
//
//   Section A — Window object (EA_datalayer / EA_data)
//     • Read from MAIN world via injected.js → CustomEvent bridge
//     • Shows key/value table sorted alphabetically if found
//     • Shows explanatory bullets if not found
//
//   Section B — Collector URL params (/col.* with euidlls)
//     • Intercepted by background.js webRequest
//     • Always shown — lets you cross-check against Section A
//     • Shows "no collector call captured yet" if nothing intercepted

window.TabDataLayer = (function() {

  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Parse EA dataLayer — handles both flat array and plain object ─────────────
  // Flat array:    ["path", "/foo", "pagegroup", "home", ...]   (classic EA format)
  // Plain object:  { path: "/foo", pagegroup: "home", ... }     (some impls use this)
  function parseEAArray(raw) {
    var pairs = {};
    if (raw == null) return pairs;

    if (Array.isArray(raw)) {
      // Flat alternating key/value pairs
      for (var i = 0; i + 1 < raw.length; i += 2) {
        var k = String(raw[i]   == null ? '' : raw[i]);
        var v = String(raw[i+1] == null ? '' : raw[i+1]);
        if (k !== '') pairs[k] = v;
      }
      return pairs;
    }

    if (typeof raw === 'object') {
      // Already a key/value object — just stringify values
      Object.keys(raw).forEach(function(k) {
        var v = raw[k];
        pairs[k] = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
      return pairs;
    }

    return pairs;
  }

  // ── Sorted key/value table ─────────────────────────────────────────────────
  function paramTable(pairs, emptyMsg) {
    var keys = Object.keys(pairs).sort(function(a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    if (keys.length === 0) {
      return '<div class="ts-empty-row" style="padding:10px;text-align:center;color:var(--text3)">' + esc(emptyMsg || 'No entries') + '</div>';
    }
    return '<table class="ts-table">' +
      '<thead><tr>' +
        '<th class="ts-th">Key</th>' +
        '<th class="ts-th">Value</th>' +
      '</tr></thead>' +
      '<tbody>' +
      keys.map(function(k) {
        return '<tr><td class="ts-key">' + esc(k) + '</td><td class="ts-val">' + esc(pairs[k]) + '</td></tr>';
      }).join('') +
      '</tbody></table>';
  }

  // ── Section wrapper (collapsible, reusing existing section styles) ──────────
  function sectionBlock(id, icon, title, statusCls, statusText, bodyHtml, collapsed) {
    var col = collapsed ? ' collapsed' : '';
    var chevCls = collapsed ? '' : ' open';
    var bodyStyle = collapsed ? ' style="display:none"' : '';
    return '<div class="section" id="section-' + id + '">' +
      '<div class="sec-head' + col + '" data-section="' + id + '">' +
        '<div class="sec-left">' +
          '<span class="sec-icon">' + icon + '</span>' +
          '<span class="sec-label">' + esc(title) + '</span>' +
        '</div>' +
        '<div class="sec-right">' +
          '<span class="sec-status" style="color:var(--' + statusCls + ')">' + esc(statusText) + '</span>' +
          '<span class="sec-chevron' + chevCls + '">&#9662;</span>' +
        '</div>' +
      '</div>' +
      '<div class="sec-body" id="sec-body-' + id + '"' + bodyStyle + '>' + bodyHtml + '</div>' +
    '</div>';
  }

  // ── Section A: Window object ───────────────────────────────────────────────
  function windowSection(windowResult) {
    var found   = windowResult && windowResult.found;
    var varName = windowResult && windowResult.varName;
    var pairs   = windowResult && windowResult.data ? windowResult.data : {};
    var count   = Object.keys(pairs).length;

    var statusCls  = found ? 'ok' : 'er';
    var statusText = found ? esc(varName) + ' — ' + count + ' key' + (count !== 1 ? 's' : '') : 'not found';

    var body;
    if (found) {
      body = '<div class="dl-source-banner source-window">' +
        '<span class="dl-source-icon">🪟</span>' +
        '<div>' +
          '<div class="dl-source-title">Source</div>' +
          '<div class="dl-source-value">' + esc('window.' + varName) + '</div>' +
        '</div>' +
      '</div>' + paramTable(pairs, 'Object found but contains no entries');
    } else {
      body = '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px">' +
        '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Checked window for 3 seconds — object not found. Possible reasons:</div>' +
        '<ul style="margin:0;padding-left:18px;line-height:1.9;font-size:11px;color:var(--text3)">' +
          '<li>The page is not tagged with Eulerian EA.js</li>' +
          '<li>The object name differs from <code style="font-family:var(--mono);background:var(--bg3);padding:1px 4px;border-radius:3px">EA_datalayer</code> / <code style="font-family:var(--mono);background:var(--bg3);padding:1px 4px;border-radius:3px">EA_data</code></li>' +
          '<li>The call is made directly without going through a dedicated object</li>' +
          '<li>The integration is server-side</li>' +
        '</ul>' +
      '</div>';
    }

    return sectionBlock('dl-window', '🪟', 'Window object', statusCls, statusText, body, false);
  }

  // ── Section B: Collector URL calls (array) ────────────────────────────────
  // colCalls = array of { url, params, timestamp } objects (one per /col hit)
  function collectorSection(colCalls) {
    var calls   = Array.isArray(colCalls) ? colCalls : (colCalls ? [colCalls] : []);
    var hasData = calls.length > 0;
    var statusCls  = hasData ? 'ok' : 'text3';
    var statusText = hasData
      ? calls.length + ' call' + (calls.length > 1 ? 's' : '') + ' captured'
      : 'no call captured yet';

    var body;
    if (!hasData) {
      body = '<div style="padding:10px;color:var(--text3);font-size:11px;text-align:center;line-height:1.7">' +
        'No <code style="font-family:var(--mono);background:var(--bg3);padding:1px 4px;border-radius:3px">/col.*</code> call captured yet.' +
        '<br>This appears when EA.js fires a direct hit (no window object).' +
      '</div>';
    } else {
      body = calls.map(function(call, idx) {
        var pairs   = call.params || {};
        var count   = Object.keys(pairs).length;
        var time    = call.timestamp ? new Date(call.timestamp).toLocaleTimeString('fr-FR', { hour12: false }) : '';
        var urlShort = (call.url || '').length > 72 ? (call.url || '').slice(0, 70) + '…' : (call.url || '');

        // Use raw URL in data-copy (not HTML-escaped) so clipboard gets the real URL
        var rawUrl  = call.url || '';
        var callHeader = '<div class="dl-source-banner source-url" style="margin-bottom:8px;flex-wrap:wrap;gap:6px">' +
          '<span class="dl-source-icon">🌐</span>' +
          '<div style="min-width:0;flex:1">' +
            '<div class="dl-source-title">Call ' + (idx + 1) + (time ? ' &mdash; ' + esc(time) : '') + '</div>' +
            '<div class="dl-source-value">direct URL (/col.*)</div>' +
            (rawUrl ? '<div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:2px;word-break:break-all">' + esc(urlShort) + '</div>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' +
            '<span style="font-size:10px;color:var(--ok);font-weight:500">' + count + ' key' + (count !== 1 ? 's' : '') + '</span>' +
            (rawUrl ? '<button class="copy-btn" data-copy="' + rawUrl.replace(/"/g, '&quot;') + '" style="font-size:10px;padding:2px 8px">Copy URL</button>' : '') +
          '</div>' +
        '</div>';

        return callHeader + paramTable(pairs, 'No dataLayer params in this call');
      }).join('<hr style="border:none;border-top:1px solid var(--border);margin:10px 0">');
    }

    return sectionBlock('dl-collector', '🌐', 'Collector URL', statusCls, statusText, body, !hasData);
  }

  // ── Full render ────────────────────────────────────────────────────────────
  // windowResult = { found, varName, data }   (from content script → injected.js)
  // colCalls     = array of { url, params }   (from background.js webRequest — multiple per page)
  function render(container, windowResult, colCalls) {
    if (!container) return;

    var calls  = Array.isArray(colCalls) ? colCalls : (colCalls ? [colCalls] : []);
    var wFound = windowResult && windowResult.found;
    var cFound = calls.length > 0;

    var header = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span style="font-size:13px;font-weight:600;color:var(--text)">dataLayer</span>' +
      (wFound || cFound
        ? '<span class="badge badge-ok"><span class="badge-dot"></span>data found</span>'
        : '<span class="badge badge-warn"><span class="badge-dot"></span>no data yet</span>') +
      '<button id="dlRefreshBtn" style="margin-left:auto;background:transparent;border:1px solid var(--border2);color:var(--text3);border-radius:3px;padding:3px 9px;font-size:10px;cursor:pointer">&#8635; Refresh</button>' +
    '</div>';

    container.innerHTML = header + windowSection(windowResult) + collectorSection(calls);
  }

  function renderLoading(container) {
    if (!container) return;
    container.innerHTML = '<div class="empty">Reading EA dataLayer…</div>';
  }

  return { render: render, renderLoading: renderLoading, parseEAArray: parseEAArray };

})();
