// Eulerian Marketing Platform Chrome DevTools — tab-identity.js
// Renders the "Identity Sync" tab — captures and displays all /rpset/ calls.
// Calls are captured via PerformanceObserver in injected.js (transport-agnostic).
// Cards show the full URL broken into path segments + all raw query params as
// a simple key/value table with no partner guessing.

window.TabIdentity = (function() {

  'use strict';

  function esc(s) {
    return String(s == null ? '—' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Single call card — always expanded, collapsible on click ─────────────
  function callCard(c, idx) {
    var time   = c.timestamp
      ? new Date(c.timestamp).toLocaleTimeString('fr-FR', { hour12: false }) : '';
    var params = c.params || {};
    var keys   = Object.keys(params);

    // Path pills: /rpset/{site}/{visitorId}
    var pathHtml = '';
    if (c.site)      pathHtml += '<span class="id-seg id-seg-site">' + esc(c.site) + '</span>';
    if (c.visitorId) pathHtml += '<span class="id-seg id-seg-vid">'  + esc(c.visitorId.length > 20 ? c.visitorId.slice(0, 20) + '…' : c.visitorId) + '</span>';
    if (!pathHtml)   pathHtml  = '<span class="id-seg id-seg-site">?</span>';

    // Raw key/value rows — no interpretation, no badges
    var paramRows = keys.map(function(k) {
      var val = params[k];
      return '<tr class="id-row">' +
        '<td class="id-key">' + esc(k) + '</td>' +
        '<td class="id-val">' + esc(val) + '</td>' +
      '</tr>';
    }).join('');

    if (!paramRows) {
      paramRows = '<tr class="id-row"><td class="id-key" colspan="2" style="color:var(--text3);text-align:center">No query parameters</td></tr>';
    }

    var transport = c.transport || 'image';

    return '<div class="id-call" id="idc-' + idx + '">' +
      '<div class="id-head" data-rpcall="' + idx + '">' +
        '<div class="id-head-left">' +
          '<span class="tp-pill tp-' + transport + '">' + esc(transport) + '</span>' +
          '<div class="id-path">' + pathHtml + '</div>' +
        '</div>' +
        '<div class="id-head-right">' +
          (c.duration ? '<span class="id-dur">' + esc(c.duration) + '</span>' : '') +
          '<span class="id-time">' + esc(time) + '</span>' +
          '<span class="id-chev open">&#9662;</span>' +
        '</div>' +
      '</div>' +
      '<div class="id-body open" id="idb-' + idx + '">' +
        '<div class="id-url" style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
        '<span style="flex:1;word-break:break-all">' + esc(c.url) + '</span>' +
        '<button class="copy-btn" data-copy="' + (c.url||'').replace(/"/g,'&quot;') + '" style="flex-shrink:0;font-size:10px;padding:2px 8px;margin-top:1px">Copy</button>' +
      '</div>' +
        '<table class="id-table">' +
          '<thead><tr><th class="id-th">Parameter</th><th class="id-th">Value</th></tr></thead>' +
          '<tbody>' + paramRows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  // ── Full tab render ───────────────────────────────────────────────────────
  function render(container, calls) {
    if (!container) return;
    calls = calls || [];
    var count = calls.length;

    var header = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span style="font-size:13px;font-weight:600;color:var(--text)">Identity Sync</span>' +
      '<span class="badge ' + (count > 0 ? 'badge-info' : 'badge-warn') + '">' +
        '<span class="badge-dot"></span>' +
        (count > 0 ? count + ' /rpset/ call' + (count > 1 ? 's' : '') : 'listening…') +
      '</span>' +
      '<span class="live-dot" style="flex-shrink:0;margin-left:4px"></span>' +
    '</div>';

    var body;
    if (count === 0) {
      body = '<div class="empty">' +
        '<div style="margin-bottom:10px">' +
          '<span class="live-dot" style="display:inline-block;vertical-align:middle;margin-right:6px"></span>' +
          '<span style="font-size:12px;color:var(--text2)">Listening for <code style="font-family:var(--mono);background:var(--bg3);padding:1px 5px;border-radius:3px">/rpset/</code> calls…</span>' +
        '</div>' +
        '<span style="font-size:11px;color:var(--text3)">Navigate or interact with the page.<br>Identity sync pixels will appear here automatically.</span>' +
        '</div>';
    } else {
      // Newest first
      body = calls.slice().reverse().map(callCard).join('');
    }

    container.innerHTML = header + body;
  }

  // ── Toggle card expanded/collapsed ────────────────────────────────────────
  function toggleCall(idx) {
    var body = document.getElementById('idb-' + idx);
    var head = document.querySelector('.id-head[data-rpcall="' + idx + '"]');
    if (!body) return;
    var open = body.classList.toggle('open');
    var chev = head && head.querySelector('.id-chev');
    if (chev) {
      chev.style.transform = open ? '' : 'rotate(-90deg)';
      chev.classList.toggle('open', open);
    }
  }

  // ── Timeout notice (shown after 2 minutes with no calls) ──────────────────
  function renderTimeout(container) {
    if (!container) return;
    // Replace only the empty body — if calls appeared, don't overwrite them
    var emptyDiv = container.querySelector('.empty');
    if (!emptyDiv) return; // calls already rendered, nothing to replace
    emptyDiv.innerHTML =
      '<div style="margin-bottom:12px;font-size:22px">⏱</div>' +
      '<div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">' +
        'No identity sync calls detected' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text3);line-height:1.6;max-width:260px;margin:0 auto">' +
        'We waited 2 minutes. Either no <code style="font-family:var(--mono);background:var(--bg3);' +
        'padding:1px 4px;border-radius:3px">/rpset/</code> calls were fired on this page, ' +
        'or they were sent before the extension was ready.' +
      '</div>';
  }

  return { render: render, toggleCall: toggleCall, renderTimeout: renderTimeout };

})();
