// Eulerian Marketing Platform Chrome DevTools — tab-traffic.js
// "Traffic Source" tab — parses the current page URL for:
//   1. UTM parameters (utm_source, utm_medium, utm_campaign, utm_term,
//      utm_content, utm_id, utm_source_platform, utm_creative_format,
//      utm_marketing_tactic — any key starting with utm_)
//   2. Eulerian tracking parameters (esl-k, ead-, eaf-, ept-, epi-,
//      eml-, esc-, egn- — any key starting with those prefixes)
//   3. HTTP Referer (read from the page via the content script)

window.TabTraffic = (function() {

  'use strict';

  var EULERIAN_PREFIXES = ['esl-k', 'ead-', 'eaf-', 'ept-', 'epi-', 'eml-', 'esc-', 'egn-'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Parse URL params ───────────────────────────────────────────────────────
  function parseTrafficParams(url) {
    var utm     = {};
    var eulerian = {};

    if (!url) return { utm: utm, eulerian: eulerian };

    try {
      var u      = new URL(url);
      var search = u.search;
      if (!search) return { utm: utm, eulerian: eulerian };

      var q = search.startsWith('?') ? search.slice(1) : search;
      q.split('&').forEach(function(part) {
        var idx = part.indexOf('=');
        if (idx === -1) return;
        var k = part.slice(0, idx);
        var v = part.slice(idx + 1);
        var key, val;
        try {
          key = decodeURIComponent(k);
          val = decodeURIComponent(v.replace(/\+/g, ' '));
        } catch(e) {
          key = k; val = v;
        }

        // UTM — any key starting with utm_
        if (key.toLowerCase().startsWith('utm_')) {
          utm[key] = val;
          return;
        }

        // Eulerian — any key starting with one of the known prefixes
        var lk = key.toLowerCase();
        for (var i = 0; i < EULERIAN_PREFIXES.length; i++) {
          if (lk.startsWith(EULERIAN_PREFIXES[i]) || lk === EULERIAN_PREFIXES[i]) {
            eulerian[key] = val;
            return;
          }
        }
      });
    } catch(e) {}

    return { utm: utm, eulerian: eulerian };
  }

  // ── Render a param block (key/value table) ─────────────────────────────────
  function paramBlock(title, icon, params, emptyMsg) {
    var keys   = Object.keys(params);
    var hasData = keys.length > 0;

    var rows = hasData
      ? keys.map(function(k) {
          return '<tr>' +
            '<td class="ts-key">' + esc(k) + '</td>' +
            '<td class="ts-val">' + esc(params[k]) + '</td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="2" class="ts-empty-row">' + esc(emptyMsg) + '</td></tr>';

    var statusCls  = hasData ? 'ok'   : 'text3';
    var statusText = hasData ? keys.length + ' param' + (keys.length > 1 ? 's' : '') : 'none found';

    return '<div class="section" id="section-' + title.toLowerCase() + '">' +
      '<div class="sec-head" data-section="' + title.toLowerCase() + '">' +
        '<div class="sec-left">' +
          '<span class="sec-icon">' + icon + '</span>' +
          '<span class="sec-label">' + esc(title) + '</span>' +
        '</div>' +
        '<div class="sec-right">' +
          '<span class="sec-status" style="color:var(--' + statusCls + ')">' + esc(statusText) + '</span>' +
          '<span class="sec-chevron open">&#9662;</span>' +
        '</div>' +
      '</div>' +
      '<div class="sec-body" id="sec-body-' + title.toLowerCase() + '">' +
        '<table class="ts-table">' +
          '<thead><tr><th class="ts-th">Parameter</th><th class="ts-th">Value</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  // ── Render referer block ───────────────────────────────────────────────────
  function refererBlock(referer) {
    var hasRef = referer && referer !== '' && referer !== 'none';
    var statusCls  = hasRef ? 'ok'   : 'text3';
    var statusText = hasRef ? 'present' : 'none';

    var body = hasRef
      ? '<div style="display:flex;align-items:flex-start;gap:8px">' +
          '<span class="ts-referer-val" style="flex:1">' + esc(referer) + '</span>' +
          '<button class="copy-btn" data-copy="' + referer.replace(/"/g,'&quot;') + '" style="font-size:10px;padding:2px 8px;flex-shrink:0">Copy</button>' +
        '</div>'
      : '<div class="ts-empty-row">No HTTP Referer on this page</div>';

    return '<div class="section" id="section-referer">' +
      '<div class="sec-head" data-section="referer">' +
        '<div class="sec-left">' +
          '<span class="sec-icon">🔗</span>' +
          '<span class="sec-label">HTTP Referer</span>' +
        '</div>' +
        '<div class="sec-right">' +
          '<span class="sec-status" style="color:var(--' + statusCls + ')">' + statusText + '</span>' +
          '<span class="sec-chevron open">&#9662;</span>' +
        '</div>' +
      '</div>' +
      '<div class="sec-body" id="sec-body-referer">' + body + '</div>' +
    '</div>';
  }

  // ── Full render ────────────────────────────────────────────────────────────
  function render(container, url, referer) {
    if (!container) return;

    var parsed   = parseTrafficParams(url);
    var utmCount = Object.keys(parsed.utm).length;
    var eulCount = Object.keys(parsed.eulerian).length;
    var total    = utmCount + eulCount;

    var header = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span style="font-size:13px;font-weight:600;color:var(--text)">Traffic Source</span>' +
      (total > 0
        ? '<span class="badge badge-ok"><span class="badge-dot"></span>' + total + ' tracking param' + (total > 1 ? 's' : '') + '</span>'
        : '<span class="badge badge-warn"><span class="badge-dot"></span>no tracking params</span>') +
    '</div>';

    // Current URL display
    var rawUrl = url || '';
    var urlRow = '<div style="margin-bottom:12px;padding:7px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r-sm)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">' +
        '<span style="font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;font-weight:500">Current URL</span>' +
        (rawUrl ? '<button class="copy-btn" data-copy="' + rawUrl.replace(/"/g,'&quot;') + '" style="font-size:10px;padding:2px 8px">Copy</button>' : '') +
      '</div>' +
      '<div style="font-family:var(--mono);font-size:10px;color:var(--text2);word-break:break-all;line-height:1.5">' + esc(rawUrl || '—') + '</div>' +
    '</div>';

    container.innerHTML = header + urlRow +
      paramBlock('UTM', '📊', parsed.utm, 'No utm_* parameters found on this page') +
      paramBlock('Eulerian', '⚡', parsed.eulerian, 'No Eulerian tracking parameters found on this page') +
      refererBlock(referer || '');
  }

  // ── Render loading state (while waiting for content script response) ───────
  function renderLoading(container) {
    if (!container) return;
    container.innerHTML = '<div class="empty">Reading page parameters…</div>';
  }

  return { render: render, renderLoading: renderLoading, parseTrafficParams: parseTrafficParams };

})();
