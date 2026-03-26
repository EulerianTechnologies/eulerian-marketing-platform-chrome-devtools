// Eulerian Marketing Platform Chrome DevTools — tab-network.js
// Renders the /misc/ network monitor subsection embedded inside the TCF tab.
// Also handles the future standalone Network tab if needed.

window.TabNetwork = (function() {

  function esc(s) {
    return String(s ?? '—')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Transport metadata ────────────────────────────────────────────────────
  const TRANSPORT = {
    image:  { label: 'img beacon', cls: 'tp-image'  },
    beacon: { label: 'sendBeacon', cls: 'tp-beacon' },
    xhr:    { label: 'XHR',        cls: 'tp-xhr'    },
    fetch:  { label: 'fetch',      cls: 'tp-fetch'  }
  };

  // ── Single call card ──────────────────────────────────────────────────────
  function callCard(c, idx, latestTC) {
    const matchCls = c.tcStringMatch === true  ? 'tc-ok'
                   : c.tcStringMatch === false ? 'tc-fail' : 'tc-none';
    const matchTxt = c.tcStringMatch === true  ? 'TC match ✓'
                   : c.tcStringMatch === false ? 'TC mismatch ✗' : 'no TC param';
    const stCls    = c.ok ? 'st-ok' : 'st-err';
    const mCls     = c.method === 'POST' ? 'm-post' : 'm-get';
    const tp       = TRANSPORT[c.transport] || { label: c.transport || '?', cls: 'tp-xhr' };

    let displayUrl = c.url;
    try { const u = new URL(c.url); displayUrl = u.pathname + u.search; } catch(e) {}
    if (displayUrl.length > 60) displayUrl = displayUrl.slice(0, 58) + '…';

    const time = c.timestamp
      ? new Date(c.timestamp).toLocaleTimeString('fr-FR', { hour12: false }) : '';

    // gdpr_consent row
    let consentRow;
    if (c.gdprConsent) {
      const inline = c.tcStringMatch === true
        ? '<span class="np-v ok" style="margin-left:5px">&#10003; matches TCString</span>'
        : c.tcStringMatch === false
          ? '<span class="np-v err" style="margin-left:5px">&#10007; does NOT match</span>' : '';
      consentRow = `<div class="np-row">
        <span class="np-k">gdpr_consent=</span>
        <span style="flex:1;word-break:break-all">
          <span class="np-v" style="color:var(--text2)">${esc(c.gdprConsent.slice(0, 60))}${c.gdprConsent.length > 60 ? '…' : ''}</span>
          ${inline}
        </span>
      </div>`;
      if (c.tcStringMatch === false) {
        const ref = latestTC || '(TCString not captured yet)';
        consentRow += `<div class="diff-box">
          <div class="diff-lbl">gdpr_consent in call</div>
          <div class="diff-val" style="color:var(--er)">${esc(c.gdprConsent.slice(0, 100))}${c.gdprConsent.length > 100 ? '…' : ''}</div>
          <div class="diff-lbl" style="margin-top:5px">actual TCString (CMP)</div>
          <div class="diff-val" style="color:var(--ok)">${esc(ref.slice(0, 100))}${ref.length > 100 ? '…' : ''}</div>
        </div>`;
      }
    } else {
      consentRow = `<div class="np-row"><span class="np-k">gdpr_consent=</span><span class="np-v dim">— not present</span></div>`;
    }

    const custRow = c.gdprCustomvendor
      ? `<div class="np-row"><span class="np-k">gdpr_customvendor=</span><span class="np-v info">${esc(c.gdprCustomvendor.slice(0, 80))}${c.gdprCustomvendor.length > 80 ? '…' : ''}</span></div>`
      : `<div class="np-row"><span class="np-k">gdpr_customvendor=</span><span class="np-v dim">— not present</span></div>`;

    const pmactRow = c.pmact
      ? `<div class="np-row"><span class="np-k">pmact=</span><span class="np-v info">${esc(c.pmact)}</span></div>`
      : `<div class="np-row"><span class="np-k">pmact=</span><span class="np-v dim">— not present</span></div>`;

    return `<div class="n-call">
      <div class="n-call-head" data-call="${idx}">
        <span class="m-pill ${mCls}">${esc(c.method)}</span>
        <span class="tp-pill ${tp.cls}">${tp.label}</span>
        <span class="n-url">${esc(displayUrl)}</span>
        <span class="st-pill ${stCls}">${c.status || '—'}</span>
        <span class="tc-pill ${matchCls}">${matchTxt}</span>
        <span class="sec-chevron" style="flex-shrink:0">&#9662;</span>
      </div>
      <div class="n-call-body" id="ncb-${idx}">
        <div style="font-size:9.5px;color:var(--text3);margin-bottom:5px">${esc(time)} — ${esc(c.method)}</div>
        ${consentRow}${custRow}${pmactRow}
        <div class="np-row" style="margin-top:4px;padding-top:5px;border-top:1px solid var(--border)">
          <span class="np-k" style="font-family:var(--sans)">Full URL</span>
          <span class="np-v dim">${esc(c.url)}</span>
        </div>
      </div>
    </div>`;
  }

  // ── Subsection HTML (embedded inside TCF tab) ─────────────────────────────
  function renderSubSection(calls, tcString) {
    const count  = calls.length;
    const nFail  = calls.filter(c => c.tcStringMatch === false).length;
    const status = count === 0 ? 'no calls yet'
      : nFail > 0 ? `${count} call${count>1?'s':''}, ${nFail} mismatch`
      : `${count} call${count>1?'s':''} — all OK`;

    const cardsHtml = count === 0
      ? `<div class="net-empty">No /misc/ calls captured yet.<br>Navigate the page or interact with the consent banner.</div>`
      : calls.slice().reverse().map((c, i) => callCard(c, i, tcString)).join('');

    return `
    <div class="net-sub" id="net-sub">
      <div class="net-sub-head" data-section="net">
        <div class="net-sub-title">
          <span>🌐</span>/misc/ Network Calls
          ${count > 0 ? '<span class="live-dot"></span>' : ''}
        </div>
        <span class="net-count">${esc(status)}</span>
        <span class="sec-chevron open" id="net-chevron">&#9662;</span>
      </div>
      <div class="net-body" id="net-calls">${cardsHtml}</div>
    </div>`;
  }

  // ── Toggle a call card open/closed ────────────────────────────────────────
  function toggleCall(idx) {
    const body = document.getElementById('ncb-' + idx);
    if (!body) return;
    const open = body.classList.toggle('open');
    const head = document.querySelector(`.n-call-head[data-call="${idx}"]`);
    const chev = head?.querySelector('.sec-chevron');
    if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
  }

  // ── Toggle the whole subsection ───────────────────────────────────────────
  function toggleSubSection() {
    const body = document.getElementById('net-calls');
    const chev = document.getElementById('net-chevron');
    const head = document.querySelector('.net-sub-head');
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    head?.classList.toggle('collapsed', isOpen);
    if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
  }

  // ── Refresh /misc/ list ───────────────────────────────────────────────────
  function updateCalls(calls, tcString) {
    const container = document.getElementById('net-calls');
    const badge     = document.querySelector('#net-sub .net-count');
    if (!container) return;

    const nFail  = calls.filter(c => c.tcStringMatch === false).length;
    const count  = calls.length;
    const status = count === 0 ? 'no calls yet'
      : nFail > 0 ? `${count} call${count>1?'s':''}, ${nFail} mismatch`
      : `${count} call${count>1?'s':''} — all OK`;

    container.innerHTML = count
      ? calls.slice().reverse().map((c, i) => callCard(c, i, tcString)).join('')
      : `<div class="net-empty">No /misc/ calls captured yet.</div>`;

    if (badge) badge.textContent = status;
  }

  return { renderSubSection, toggleCall, toggleSubSection, updateCalls };

})();
