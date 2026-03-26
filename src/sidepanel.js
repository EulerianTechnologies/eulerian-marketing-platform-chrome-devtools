// Eulerian Marketing Platform Chrome DevTools — sidepanel.js
// Orchestrator: tab switching, messaging, event delegation, live updates.

'use strict';

// ─── Send to background (storage / consentChanged queries) ────────────────────
function sendToBackground(message, timeoutMs) {
  timeoutMs = timeoutMs || 4000;
  return new Promise(function(resolve) {
    var timer = setTimeout(function() {
      resolve({ ok: false, error: 'Background did not respond.' });
    }, timeoutMs);
    try {
      chrome.runtime.sendMessage(message, function(response) {
        clearTimeout(timer);
        void chrome.runtime.lastError;
        resolve({ ok: true, data: response });
      });
    } catch(e) {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message });
    }
  });
}

// ─── Send to active tab content script (TCF audit only) ──────────────────────
async function ensureContentScripts(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['injected.js'], world: 'MAIN' });
  } catch(e) {}
  try {
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'], world: 'ISOLATED' });
  } catch(e) {}
  await new Promise(function(r) { setTimeout(r, 80); });
}

async function sendToTab(tabId, message, timeoutMs) {
  timeoutMs = timeoutMs || 6000;
  await ensureContentScripts(tabId);
  return new Promise(function(resolve) {
    var timer = setTimeout(function() {
      resolve({ ok: false, error: 'Content script did not respond — reload the page.' });
    }, timeoutMs);
    try {
      chrome.tabs.sendMessage(tabId, message, function(response) {
        clearTimeout(timer);
        var err = chrome.runtime.lastError;
        if (err) resolve({ ok: false, error: err.message });
        else     resolve({ ok: true,  data: response });
      });
    } catch(e) {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message });
    }
  });
}

// ─── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  var panel = document.getElementById('panel-' + id);
  var tab   = document.querySelector('.nav-tab[data-tab="' + id + '"]');
  if (panel) panel.classList.add('active');
  if (tab)   tab.classList.add('active');

  if (id === 'datalayer') {
    loadDataLayerTab();
  }

  if (id === 'traffic') {
    loadTrafficTab();
  }

  if (id === 'identity') {
    loadIdentityTab(); // also starts the watch timer if needed
  }
}

// ─── Section toggle ────────────────────────────────────────────────────────────
function toggleSection(sectionId) {
  var body = document.getElementById('sec-body-' + sectionId);
  var head = document.querySelector('.sec-head[data-section="' + sectionId + '"]');
  if (!body || !head) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  head.classList.toggle('collapsed', isOpen);
  var chev = head.querySelector('.sec-chevron');
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ─── TCF Audit ─────────────────────────────────────────────────────────────────
async function runAudit() {
  var container = document.getElementById('panel-tcf');
  var btn       = document.getElementById('btnRun');
  var spinner   = document.getElementById('spinner');
  if (!btn || !spinner) return;

  btn.disabled          = true;
  spinner.style.display = 'block';
  var body = container.querySelector('#auditBody');
  if (body) body.innerHTML = '<div class="empty">Running audit…</div>';

  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url ||
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    if (body) body.innerHTML = '<div class="notice notice-err">Cannot run on this page.</div><div class="empty">Navigate to a regular website.</div>';
    btn.disabled = false; spinner.style.display = 'none';
    return;
  }

  // TCF audit goes to content script; /misc/ calls come from background storage
  var [tcfResult, miscResult] = await Promise.all([
    sendToTab(tab.id, { action: 'runTCFAudit' }, 8000),
    sendToBackground({ action: 'getMiscCalls' }, 3000)
  ]);

  if (!tcfResult.ok) {
    if (body) body.innerHTML = '<div class="notice notice-err">&#10006; ' + tcfResult.error + '</div><div class="empty">Refresh the page, then click Run Audit again.</div>';
    btn.disabled = false; spinner.style.display = 'none';
    return;
  }

  var miscCalls = miscResult.ok ? (miscResult.data || []) : [];
  TabTCF.render(container, tcfResult.data, miscCalls);
  btn.disabled = false; spinner.style.display = 'none';
}

function clearAudit() {
  var container = document.getElementById('panel-tcf');
  TabTCF.renderEmpty(container);
}

// ─── dataLayer tab ────────────────────────────────────────────────────────────
// Always fetches BOTH sources in parallel and renders two sections.
//   Section A: window.EA_datalayer / window.EA_data  (MAIN world via injected.js)
//   Section B: Collector URL /col.* params           (background webRequest)
async function loadDataLayerTab() {
  var container = document.getElementById('panel-datalayer');
  if (!container) return;
  TabDataLayer.renderLoading(container);

  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url ||
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    container.innerHTML = '<div class="notice notice-warn">Not available on this page.</div>';
    return;
  }

  // Fetch both sources in parallel
  var [windowResult, colRaw] = await Promise.all([
    sendToTab(tab.id, { action: 'getDataLayer' }, 6000),
    sendToBackground({ action: 'getColData', tabId: tab.id }, 3000)
  ]);

  // ── Build window section data ─────────────────────────────────────────────
  var windowData = { found: false, varName: null, data: {} };
  if (windowResult.ok && windowResult.data) {
    var raw = windowResult.data;
    windowData = {
      found:   raw.found || false,
      varName: raw.varName || null,
      // raw.raw is already a sanitized plain object from injected.js (functions stripped)
      // parseEAArray handles plain objects directly
      data:    raw.found ? TabDataLayer.parseEAArray(raw.raw) : {}
    };
  }

  // ── Build collector calls array ───────────────────────────────────────────
  // colRaw.data is now an array of { url, params, timestamp } objects
  var colCalls = (colRaw.ok && Array.isArray(colRaw.data)) ? colRaw.data : [];

  TabDataLayer.render(container, windowData, colCalls);
}

// ─── Traffic Source tab ───────────────────────────────────────────────────────
async function loadTrafficTab() {
  var container = document.getElementById('panel-traffic');
  if (!container) return;
  TabTraffic.renderLoading(container);

  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url ||
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    container.innerHTML = '<div class="notice notice-warn">Not available on this page.</div>';
    return;
  }

  // URL params are in tab.url — no content script needed for that
  // Referrer requires a content script round-trip
  var referrer = '';
  var result = await sendToTab(tab.id, { action: 'getTrafficInfo' }, 4000);
  if (result.ok && result.data) {
    referrer = result.data.referrer || '';
  }

  TabTraffic.render(container, tab.url, referrer);
}

// ─── Identity Sync tab ─────────────────────────────────────────────────────────
// State: null = never started, 'watching' = timer running, 'done' = timer fired
var _idState = null;
var _idTimer = null;

function startIdentityWatch() {
  // Clear any previous timer
  if (_idTimer) { clearTimeout(_idTimer); _idTimer = null; }
  _idState = 'watching';

  // 2-minute timeout — show notice if no calls captured
  _idTimer = setTimeout(function() {
    _idState = 'done';
    var container = document.getElementById('panel-identity');
    if (!container || !container.classList.contains('active')) return;
    // Only show notice if still empty
    sendToBackground({ action: 'getRpsetCalls' }, 2000).then(function(r) {
      var calls = r.ok ? (r.data || []) : [];
      if (calls.length === 0) {
        TabIdentity.renderTimeout(container);
      }
    });
  }, 2 * 60 * 1000);
}

async function resetIdentityTab() {
  // Stop any running timeout
  if (_idTimer) { clearTimeout(_idTimer); _idTimer = null; }
  _idState = null;

  // Clear panel immediately so there is zero flash of old data
  var container = document.getElementById('panel-identity');
  if (container) TabIdentity.render(container, []);

  // Clear all network call stores synchronously
  await Promise.all([
    sendToBackground({ action: 'clearRpsetCalls' }, 2000),
    sendToBackground({ action: 'clearMiscCalls' },  2000)
  ]);
  // colData is cleared separately at status:'loading' in the onUpdated listener
  // so deferred collector requests are still captured after 'loading'
}

async function loadIdentityTab() {
  var container = document.getElementById('panel-identity');
  if (!container) return;

  // Fetch only after background has been cleared by resetIdentityTab
  var result = await sendToBackground({ action: 'getRpsetCalls' }, 3000);
  TabIdentity.render(container, result.ok ? (result.data || []) : []);

  // Start the 2-minute watch only once per page
  if (_idState === null) startIdentityWatch();
}

// ─── Live updates from background.js via chrome.runtime.onMessage ──────────────
chrome.runtime.onMessage.addListener(function(message) {
  if (!message) return;

  if (message.action === 'rpsetCallAdded') {
    var container = document.getElementById('panel-identity');
    if (container) {
      sendToBackground({ action: 'getRpsetCalls' }, 3000).then(function(r) {
        var calls = r.ok ? (r.data || []) : [];
        TabIdentity.render(container, calls);
        // If we just received our first call, cancel the timeout notice
        if (calls.length > 0 && _idTimer) {
          clearTimeout(_idTimer);
          _idTimer = null;
          _idState = 'done';
        }
      });
    }
    return;
  }

  // Collector URL hit received — refresh dataLayer tab if visible
  if (message.action === 'colDataUpdated') {
    // Always refresh — some sites sends /col AFTER 'complete', so we must update
    // even if the panel was not yet re-rendered by the 'complete' handler
    loadDataLayerTab();
    return;
  }

  if (message.action === 'miscCallAdded') {
    // Refresh /misc/ section if TCF panel is visible
    var tcfPanel = document.getElementById('panel-tcf');
    if (tcfPanel && tcfPanel.classList.contains('active')) {
      sendToBackground({ action: 'getMiscCalls' }, 3000).then(function(r) {
        if (r.ok) TabNetwork.updateCalls(r.data || [], null);
      });
    }
    return;
  }

  if (message.action === 'consentChanged') {
    var detail = message.record || message.detail || {};
    if (detail.eventStatus === 'useractioncomplete' || detail.eventStatus === 'tcloaded') {
      setTimeout(function() { runAudit(); }, 300);
    }
    return;
  }
});

// ─── Copy helper ──────────────────────────────────────────────────────────────
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(function() {
    var orig = btn.textContent;
    btn.textContent = 'Copied!'; btn.style.color = 'var(--ok)';
    setTimeout(function() { btn.textContent = orig; btn.style.color = ''; }, 1500);
  });
}

// ─── etuix cookie ─────────────────────────────────────────────────────────────
// Looks for the etuix cookie across all subdomains by extracting the root domain
// and using getAll() — chrome.cookies.get() with an exact URL misses cookies
// set on parent domains (e.g. .melia.com won't be found via www1.melia.com).
// Retries up to 3 times with 800ms gaps in case the cookie is set after page load.
async function refreshEtuix(url) {
  var valEl  = document.getElementById('etuixVal');
  var copyEl = document.getElementById('etuixCopy');
  if (!valEl || !copyEl) return;

  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    valEl.textContent = '— unavailable'; valEl.className = 'etuix-val not-found';
    copyEl.classList.add('hidden');
    return;
  }

  // Extract root domain for cross-subdomain search (www1.melia.com → melia.com)
  var domain = '';
  try {
    var host  = new URL(url).hostname;        // e.g. www1.melia.com
    var parts = host.split('.');
    // Keep last two segments for most domains, last three for e.g. co.uk
    domain = parts.length > 2 ? parts.slice(-2).join('.') : host;
  } catch(e) {
    valEl.textContent = '— error'; valEl.className = 'etuix-val not-found';
    copyEl.classList.add('hidden');
    return;
  }

  // Retry loop: cookie may be written by a response that arrives after page load
  var found = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise(function(r) { setTimeout(r, 800); });
    }
    try {
      // getAll searches all matching cookies regardless of subdomain / path
      var cookies = await chrome.cookies.getAll({ name: 'etuix', domain: domain });
      if (cookies && cookies.length > 0) {
        found = cookies[0];
        break;
      }
    } catch(e) { break; }
  }

  if (found && found.value) {
    valEl.textContent = found.value;
    valEl.className   = 'etuix-val';
    copyEl.classList.remove('hidden');
    copyEl.onclick = function() { copyText(found.value, copyEl); };
  } else {
    valEl.textContent = '— cookie not found';
    valEl.className   = 'etuix-val not-found';
    copyEl.classList.add('hidden');
  }
}

// ─── Event delegation ─────────────────────────────────────────────────────────
document.addEventListener('click', function(e) {
  var navTab = e.target.closest('.nav-tab[data-tab]');
  if (navTab) { switchTab(navTab.getAttribute('data-tab')); return; }

  if (e.target.closest('#btnRun'))   { runAudit();   return; }

  var actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    // refresh-misc / clear-misc retained for completeness (toolbar removed but kept as hooks)
    return;
  }

  var copyBtn = e.target.closest('.copy-btn[data-copy]');
  if (copyBtn) { copyText(copyBtn.getAttribute('data-copy'), copyBtn); return; }

  // dataLayer refresh button
  if (e.target.id === 'dlRefreshBtn') { loadDataLayerTab(); return; }

  var secHead = e.target.closest('.sec-head[data-section]');
  if (secHead) { toggleSection(secHead.getAttribute('data-section')); return; }

  var netHead = e.target.closest('.net-sub-head[data-section]');
  if (netHead) { TabNetwork.toggleSubSection(); return; }

  var callHead = e.target.closest('.n-call-head[data-call]');
  if (callHead) { TabNetwork.toggleCall(callHead.getAttribute('data-call')); return; }

  var rpHead = e.target.closest('.id-head[data-rpcall]');
  if (rpHead) { TabIdentity.toggleCall(rpHead.getAttribute('data-rpcall')); return; }

});

// ─── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  // Site badge + etuix
  var _currentUrl = null;
  try {
    var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      _currentUrl = tab.url;
      document.getElementById('siteBadge').textContent = new URL(tab.url).hostname;
      refreshEtuix(tab.url);
    }
  } catch(e) {}

  // Tab switch — always reset identity panel immediately
  chrome.tabs.onActivated.addListener(async function(info) {
    await resetIdentityTab();
    try {
      var t = await chrome.tabs.get(info.tabId);
      if (t?.url) {
        document.getElementById('siteBadge').textContent = new URL(t.url).hostname;
        refreshEtuix(t.url);
      }
    } catch(e) {}
    // Re-run TCF audit for the newly activated tab
    var tcfPanelA = document.getElementById('panel-tcf');
    if (tcfPanelA) { TabTCF.renderEmpty(tcfPanelA); runAudit(); }
    if (document.getElementById('panel-traffic').classList.contains('active')) {
      loadTrafficTab();
    }
    if (document.getElementById('panel-datalayer').classList.contains('active')) {
      loadDataLayerTab();
    }
    if (document.getElementById('panel-identity').classList.contains('active')) {
      loadIdentityTab();
    }
  });

  // Page navigation — reset on 'loading' (instant), update badge on 'complete'
  chrome.tabs.onUpdated.addListener(async function(tabId, changeInfo, t) {
    try {
      var [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active || active.id !== tabId) return;
      var currentTabId = tabId; // explicit alias for use in closures below

      if (changeInfo.status === 'loading') {
        // Clear previous page data immediately at navigation start.
        // colData is cleared HERE (not at 'complete') so deferred collector
        // requests that fire after 'complete' are still captured for the new page.
        sendToBackground({ action: 'clearColData', tabId: currentTabId });
        await resetIdentityTab();
        var valEl = document.getElementById('etuixVal');
        if (valEl) { valEl.textContent = '— loading…'; valEl.className = 'etuix-val not-found'; }
        var copyEl = document.getElementById('etuixCopy');
        if (copyEl) copyEl.classList.add('hidden');
        if (document.getElementById('panel-identity').classList.contains('active')) {
          loadIdentityTab();
        }
      }

      if (changeInfo.status === 'complete' && t.url) {
        try { document.getElementById('siteBadge').textContent = new URL(t.url).hostname; } catch(e) {}
        refreshEtuix(t.url);
        // colData already cleared at 'loading' — just refresh tabs now
        // Refresh traffic/datalayer tabs if visible
        // Always re-run TCF audit on new page complete
        var tcfPanel = document.getElementById('panel-tcf');
        if (tcfPanel) { TabTCF.renderEmpty(tcfPanel); runAudit(); }
        if (document.getElementById('panel-traffic').classList.contains('active')) {
          loadTrafficTab();
        }
        // Always pre-fetch datalayer data so it's ready when user switches to that tab
        loadDataLayerTab();
      }
    } catch(e) {}
  });

  // Incognito notice
  try {
    if (chrome.extension.inIncognitoContext) {
      var dismissed = await chrome.storage.local.get('incognitoBannerDismissed');
      if (!dismissed.incognitoBannerDismissed) showIncognitoNotice();
    }
  } catch(e) {}

  // Render TCF tab and immediately run the audit
  var container = document.getElementById('panel-tcf');
  TabTCF.renderEmpty(container);
  runAudit();
});

function showIncognitoNotice() {
  var banner = document.createElement('div');
  banner.id = 'incognito-banner';
  banner.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;background:var(--accent-d);border:1px solid var(--accent-d2);border-radius:var(--r);padding:9px 12px;font-size:11px;color:var(--accent-t);display:flex;align-items:flex-start;gap:8px;z-index:999;box-shadow:var(--shadow)';
  banner.innerHTML = '<span style="flex:1;line-height:1.5"><strong>Incognito mode.</strong> Go to <strong>chrome://extensions</strong> &#8594; Eulerian DevTools &#8594; toggle <strong>Allow in Incognito</strong>.</span><button id="dismissIncognito" style="background:transparent;border:none;cursor:pointer;color:var(--accent-t);font-size:13px;padding:0;flex-shrink:0">&#10005;</button>';
  document.body.appendChild(banner);
  document.getElementById('dismissIncognito').addEventListener('click', function() {
    banner.remove();
    chrome.storage.local.set({ incognitoBannerDismissed: true });
  });
}
