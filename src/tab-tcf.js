// Eulerian Marketing Platform Chrome DevTools — tab-tcf.js
// Renders the "TCF v2 Detection" tab including all sub-sections and
// the embedded /misc/ network monitor.
// Depends on: utils.js (decodeTCString), tab-network.js (TabNetwork)

window.TabTCF = (function() {

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '—')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function badge(type, label) {
    return `<span class="badge badge-${type}"><span class="badge-dot"></span>${label}</span>`;
  }

  function drow(key, val, cls) {
    return `<div class="d-row">
      <span class="d-key">${esc(key)}</span>
      <span class="d-val${cls ? ' ' + cls : ''}">${esc(String(val ?? '—'))}</span>
    </div>`;
  }

  // ── Section builder ───────────────────────────────────────────────────────
  // Uses data-section attribute for reliable toggle targeting
  function section(id, icon, title, statusCls, statusText, bodyHtml, collapsed) {
    const colCls   = collapsed ? ' collapsed' : '';
    const chevCls  = collapsed ? '' : ' open';
    const bodyStyle = collapsed ? ' style="display:none"' : '';
    return `
    <div class="section" id="section-${id}">
      <div class="sec-head${colCls}" data-section="${id}">
        <div class="sec-left">
          <span class="sec-icon">${icon}</span>
          <span class="sec-label">${title}</span>
        </div>
        <div class="sec-right">
          <span class="sec-status" style="color:var(--${statusCls})">${statusText}</span>
          <span class="sec-chevron${chevCls}">&#9662;</span>
        </div>
      </div>
      <div class="sec-body" id="sec-body-${id}"${bodyStyle}>${bodyHtml}</div>
    </div>`;
  }

  // ── Render empty / error states ───────────────────────────────────────────
  function renderEmpty(container) {
    container.innerHTML = `
      <div class="toolbar">
        <button class="btn-primary" id="btnRun">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="margin-right:2px">
            <path d="M5 1a4 4 0 1 1-4 4h1.5a2.5 2.5 0 1 0 .6-1.6L4.5 4.5H1V1l1.2 1.2A4 4 0 0 1 5 1z"/>
          </svg>
          Refresh
        </button>
        <div class="spinner" id="spinner"></div>
      </div>
      <div class="empty" id="auditBody">
        <div class="spinner" id="spinner-auto" style="display:block;width:18px;height:18px;border:2px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 10px"></div>
        Running TCF audit…
      </div>`;
  }

  // ── Full render ───────────────────────────────────────────────────────────
  function render(container, auditData, miscCalls) {
    const d = auditData;
    if (!d || d.error) {
      setBody(container, `<div class="notice notice-err">&#10006; ${esc(d?.error || 'Unknown error')}</div>
        <div class="empty">Refresh the page or click Refresh again.</div>`);
      return;
    }

    const tcString = d.tcStringApi || d.tcStringCookie || d.tcStringLocalStorage;
    const decoded  = tcString ? decodeTCString(tcString) : null;

    // ── Badges ──────────────────────────────────────────────────────────────
    let badges = '';
    badges += d.hasCmpApi ? badge('ok', 'CMP API ✓') : badge('err', 'No CMP API');
    badges += tcString    ? badge('ok', 'TC String ✓') : badge('err', 'No TC String');
    if (decoded && !decoded.error) {
      badges += decoded.gdprApplies ? badge('ok', 'GDPR applies') : badge('warn', 'GDPR false');
      badges += badge('info', 'v' + decoded.version);
      badges += decoded.cmpId > 0 ? badge('ok', 'CMP #' + decoded.cmpId) : badge('err', 'CMP ID invalid');
    }
    const mFail = (miscCalls || []).filter(c => c.tcStringMatch === false).length;
    if (miscCalls?.length) badges += badge('info', miscCalls.length + ' /misc/ call' + (miscCalls.length > 1 ? 's' : ''));
    if (mFail)             badges += badge('err',  mFail + ' TC mismatch');
    if (d.errors?.length)  badges += badge('err',  d.errors.length + ' error(s)');

    // ── CMP API section ──────────────────────────────────────────────────────
    const cmpBody = [
      drow('__tcfapi', d.hasCmpApi ? '✓ function present' : '✗ not found', d.hasCmpApi ? 'ok' : 'err'),
      d.tcData ? drow('GDPR applies',   d.tcData.gdprApplies ? '✓ true' : '⚠ false', d.tcData.gdprApplies ? 'ok' : 'warn') : '',
      d.tcData ? drow('CMP ID',         d.tcData.cmpId > 0  ? '✓ ' + d.tcData.cmpId : '✗ ' + d.tcData.cmpId, d.tcData.cmpId > 0 ? 'ok' : 'err') : '',
      d.tcData ? drow('CMP version',    d.tcData.cmpVersion) : '',
      d.tcData ? drow('Policy version', d.tcData.policyVersion ?? '—') : '',
      d.tcData ? drow('Service-specific', d.tcData.isServiceSpecific ? 'true' : 'false') : '',
      ...(d.errors || []).filter(e => e.startsWith('CMP')).map(e => `<div class="notice notice-err">${esc(e)}</div>`)
    ].join('');

    // ── TC String section ────────────────────────────────────────────────────
    let tcBody;
    if (tcString) {
      const src = d.tcStringApi ? 'CMP API' : d.tcStringCookie ? 'Cookie' : 'localStorage';
      tcBody = `
        <div class="tc-box">${esc(tcString.slice(0, 200))}${tcString.length > 200 ? '…' : ''}
          <button class="copy-btn" data-copy="${esc(tcString)}">Copy</button>
        </div>
        ${drow('Source',   src)}
        ${drow('Length',   tcString.length + ' chars', tcString.length > 50 ? 'ok' : 'err')}
        ${drow('Segments', tcString.split('.').length + (tcString.includes('.') ? ' (core + disclosed)' : ' (core only)'))}`;
    } else {
      tcBody = `<div class="notice notice-err">No TC string found via CMP API, cookies, or localStorage.</div>`;
    }

    // ── Decoded header section ───────────────────────────────────────────────
    let decSection = '';
    if (decoded && !decoded.error) {
      const consentsOn = Object.entries(decoded.purposeConsents).filter(([,v]) => v).map(([k]) => 'P' + k);

      // ── Eulerian vendor consent (ID 413) ──────────────────────────────────
      const vendorMap = d.tcData?.vendorConsentsMap || {};
      const eulerianConsented = vendorMap['413'] === true;
      const eulerianPresent   = '413' in vendorMap;
      const eulerianCls  = eulerianConsented ? 'ok' : eulerianPresent ? 'err' : 'warn';
      const eulerianVal  = eulerianConsented
        ? '✓ consented (ID 413)'
        : eulerianPresent
          ? '✗ not consented (ID 413)'
          : '— not in vendor list (ID 413)';

      // ── Eulerian vendor cell for the purposes grid ────────────────────────
      const eulerianCell = `
        <div style="margin-top:8px">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Eulerian (vendor #413)</div>
          <div style="display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:var(--r-sm);
            background:${eulerianConsented ? 'var(--ok-bg)' : eulerianPresent ? 'var(--er-bg)' : 'var(--wa-bg)'};
            border:1px solid ${eulerianConsented ? 'var(--ok-b)' : eulerianPresent ? 'var(--er-b)' : 'var(--wa-b)'}">
            <span style="font-size:18px;line-height:1">${eulerianConsented ? '✅' : eulerianPresent ? '❌' : '⚠️'}</span>
            <div>
              <div style="font-size:11px;font-weight:600;color:${eulerianConsented ? 'var(--ok)' : eulerianPresent ? 'var(--er)' : 'var(--wa)'}">
                Eulerian Technologies
              </div>
              <div style="font-size:10px;color:${eulerianConsented ? 'var(--ok)' : eulerianPresent ? 'var(--er)' : 'var(--wa)'}">
                ${eulerianConsented ? 'Consent granted' : eulerianPresent ? 'Consent NOT granted' : 'Vendor not found in TC string'}
              </div>
            </div>
          </div>
        </div>`;

      let pgrid = '<div style="margin-top:7px;font-size:10px;color:var(--text3);margin-bottom:3px">Purpose consents</div><div class="purposes-grid">';
      for (let i = 1; i <= 10; i++) {
        const on = decoded.purposeConsents[i];
        pgrid += `<div class="p-cell ${on ? 'on' : 'off'}"><div class="p-num">P${i}</div><div class="p-st">${on ? 'yes' : 'no'}</div></div>`;
      }
      pgrid += '</div>';

      const decBody = [
        drow('Version',          decoded.version + (decoded.version === 2 ? ' ✓' : ' ⚠'), decoded.version === 2 ? 'ok' : 'warn'),
        drow('GDPR applies',     decoded.gdprApplies ? '✓ true' : '⚠ false', decoded.gdprApplies ? 'ok' : 'warn'),
        drow('Created',          decoded.created),
        drow('Last updated',     decoded.lastUpdated),
        drow('Consent language', decoded.consentLanguage),
        drow('Vendor list ver.', decoded.vendorListVersion),
        drow('Purposes consented', consentsOn.length + '/10 (' + consentsOn.join(', ') + ')'),
        drow('Eulerian (ID 413)', eulerianVal, eulerianCls),
        pgrid,
        eulerianCell
      ].join('');
      decSection = section('dec', '📋', 'Decoded header', 'info', 'TCF v' + decoded.version, decBody, false);
    }

    // ── Cookies section ──────────────────────────────────────────────────────
    const tcCookies = (d.cookies || []).filter(c => /euconsent|consent|tc/i.test(c.name));
    const ckRows = (tcCookies.length ? tcCookies : (d.cookies || []).slice(0, 10)).map(c => `
      <tr class="${/euconsent/i.test(c.name) ? 'tc-row' : ''}">
        <td class="ck-name">${esc(c.name)}</td>
        <td class="ck-val">${esc(c.value.slice(0, 80))}${c.value.length > 80 ? '…' : ''}</td>
      </tr>`).join('');
    const ckBody = `
      <table class="ck-table">
        <thead><tr><th style="width:140px">Name</th><th>Value (preview)</th></tr></thead>
        <tbody>${ckRows || '<tr><td colspan="2" style="color:var(--text3);padding:8px 7px">No cookies found</td></tr>'}</tbody>
      </table>
      ${!tcCookies.length ? '<div class="notice notice-info" style="margin-top:7px">No euconsent-v2 cookie found.</div>' : ''}`;

    // ── /misc/ network subsection ────────────────────────────────────────────
    const netHtml = TabNetwork.renderSubSection(miscCalls || [], tcString);

    // ── Errors section ───────────────────────────────────────────────────────
    const errSection = (d.errors || []).length
      ? section('err', '⚠', 'Errors', 'er', d.errors.length + ' found',
          d.errors.map(e => `<div class="notice notice-err">${esc(e)}</div>`).join(''), false)
      : '';

    setBody(container, `
      <div class="status-bar">${badges}</div>
      ${section('cmp', '🔌', 'CMP API',    d.hasCmpApi ? 'ok' : 'er',   d.hasCmpApi ? '✓ present' : '✗ missing', cmpBody, false)}
      ${section('tcs', '🔑', 'TC String',  tcString ? 'ok' : 'er',       tcString ? 'found' : 'not found', tcBody, false)}
      ${decSection}
      ${section('ck',  '🍪', 'Cookies',    tcCookies.length ? 'ok' : 'text3', tcCookies.length + ' TC-related', ckBody, true)}
      ${netHtml}
      ${errSection}
    `);
  }

  function setBody(container, html) {
    const body = container.querySelector('#auditBody');
    if (body) body.innerHTML = html;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { renderEmpty, render };

})();
