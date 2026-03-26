// Eulerian Marketing Platform Chrome DevTools — background.js
//
// Why in-memory first:
//   chrome.storage is async — if Chrome kills the service worker between the
//   webRequest callback firing and the storage callback completing, the record
//   is lost. We push to a module-level array IMMEDIATELY (sync), then persist
//   to storage async as a best-effort backup.
//
// Why <all_urls>:
//   Specific patterns like *://*/rpset/* can silently fail to match on some
//   host/path combinations. <all_urls> + explicit pathname check in the
//   callback is 100% reliable.

'use strict';

// ── In-memory stores (live as long as the service worker is alive) ────────────
var _misc    = [];
var _rpset   = [];
var _colData = null;  // latest EA collector hit with euidlls, keyed by tabId

// Restore persisted data when the SW restarts
chrome.storage.local.get(['miscCalls', 'rpsetCalls', 'colData'], function(data) {
  if (data.miscCalls)  _misc    = data.miscCalls;
  if (data.rpsetCalls) _rpset   = data.rpsetCalls;
  if (data.colData)    _colData = data.colData;
});

// ── Keep-alive alarm (fires every 20s to prevent SW termination) ──────────────
chrome.alarms.create('swKeepAlive', { periodInMinutes: 1 / 3 }); // ~20 seconds
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name !== 'swKeepAlive') return;
  // Persist in-memory data to storage while SW is awake
  if (_misc.length)   chrome.storage.local.set({ miscCalls:  _misc.slice(-100) });
  if (_rpset.length)  chrome.storage.local.set({ rpsetCalls: _rpset.slice(-200) });
  if (_colData)       chrome.storage.local.set({ colData: _colData });
});

// ── Side panel setup ──────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(function() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.alarms.create('swKeepAlive', { periodInMinutes: 1 / 3 });
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseParams(search) {
  var p = {};
  if (!search) return p;
  try {
    var q = search.startsWith('?') ? search.slice(1) : search;
    q.split('&').forEach(function(part) {
      var idx = part.indexOf('=');
      if (idx === -1) return;
      var k = part.slice(0, idx);
      var v = part.slice(idx + 1);
      try { p[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
      catch(e) { p[k] = v; }
    });
  } catch(e) {}
  return p;
}

function parseRpsetPath(pathname) {
  var parts = pathname.replace(/^\/rpset\//, '').split('/').filter(Boolean);
  return { site: parts[0] || null, visitorId: parts[1] || null };
}

function notify(action, record) {
  chrome.runtime.sendMessage({ action: action, record: record }, function() {
    void chrome.runtime.lastError; // silently ignore if side panel not open
  });
}

// ── /rpset/ listener — uses <all_urls> so no pattern can miss ─────────────────
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    var url = details.url;
    // Fast pre-check before URL parsing
    if (url.indexOf('/rpset/') === -1) return;

    try {
      var u        = new URL(url);
      var pathname = u.pathname;
      if (!pathname.startsWith('/rpset/')) return;

      var params = parseParams(u.search);
      var path   = parseRpsetPath(pathname);

      var record = {
        id:        details.requestId + '_' + Date.now(),
        timestamp: new Date().toISOString(),
        method:    details.method || 'GET',
        url:       url,
        tabId:     details.tabId,
        transport: details.type || 'other',
        status:    0,
        ok:        true,
        site:      path.site,
        visitorId: path.visitorId,
        params:    params
      };

      // 1. Capture immediately in memory — sync, never lost
      _rpset.push(record);
      if (_rpset.length > 200) _rpset = _rpset.slice(-200);

      // 2. Best-effort async persist
      chrome.storage.local.set({ rpsetCalls: _rpset }, function() {
        void chrome.runtime.lastError;
      });

      // 3. Notify side panel if open
      notify('rpsetCallAdded', record);

    } catch(e) {}
  },
  { urls: ['<all_urls>'] }
);

// ── Eulerian collector (/col.*) listener ──────────────────────────────────────
// Catches direct EA tag hits (no EA_datalayer / EA_data on window).
// Identifies them by the presence of the 'euidlls' parameter, which signals
// that the EA tag fired and all dataLayer variables are in the URL params.
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    var url = details.url;
    // Fast pre-checks before URL parsing
    if (url.indexOf('/col') === -1) return;
    if (url.indexOf('euidlls') === -1) return;

    try {
      var u        = new URL(url);
      var pathname = u.pathname;
      // Match /col followed by digits/letters (e.g. /col/, /col559a/, /collect, /colXXX/)
      // Uses regex to avoid false positives on /collection/, /color/, /colors/
      // Pattern: /col optionally followed by alphanumeric chars then / or end
      if (!/^\/col([a-zA-Z0-9]*)\//.test(pathname) && pathname !== '/col') return;

      var params = parseParams(u.search);
      // Double-check euidlls is actually present as a param
      if (!params.hasOwnProperty('euidlls')) return;

      // Only skip Eulerian identity tokens and raw URL duplicates —
      // everything else (consent, device, SDK params) is shown so the
      // user can cross-check the full payload.
      var SKIP = new Set([
        'euidlls',    // visitor ID hash
        'euid',       // visitor ID
        'eujid',      // journey ID
        'euidredir',  // redirect token
        'url',        // raw page URL (duplicate of browser URL)
        'urlp'        // raw page path (duplicate)
      ]);
      var dlParams = {};
      Object.keys(params).forEach(function(k) {
        if (!SKIP.has(k.toLowerCase())) dlParams[k] = params[k];
      });

      var record = {
        tabId:     details.tabId,
        timestamp: new Date().toISOString(),
        url:       url,
        params:    dlParams,
        allParams: params
      };

      // Store as array per tab — multiple /col hits per page are all kept
      if (!_colData) _colData = {};
      if (!Array.isArray(_colData[details.tabId])) _colData[details.tabId] = [];
      _colData[details.tabId].push(record);

      chrome.storage.local.set({ colData: _colData }, function() {
        void chrome.runtime.lastError;
      });
      notify('colDataUpdated', { tabId: details.tabId });

    } catch(e) {}
  },
  { urls: ['<all_urls>'] }
);

// ── /misc/ listener ────────────────────────────────────────────────────────────
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    var url = details.url;
    if (url.indexOf('/misc/') === -1) return;

    try {
      var u        = new URL(url);
      var pathname = u.pathname;
      if (!pathname.includes('/misc/')) return;

      var params = parseParams(u.search);
      var record = {
        id:               details.requestId + '_' + Date.now(),
        timestamp:        new Date().toISOString(),
        method:           details.method || 'GET',
        url:              url,
        tabId:            details.tabId,
        transport:        details.type || 'other',
        status:           0,
        ok:               true,
        gdprConsent:      params['gdpr_consent'] || params['gdpr'] || null,
        gdprCustomvendor: params['gdpr_customvendor'] || null,
        pmact:            params['pmact'] || null,
        tcStringMatch:    null
      };

      _misc.push(record);
      if (_misc.length > 100) _misc = _misc.slice(-100);

      chrome.storage.local.set({ miscCalls: _misc }, function() {
        void chrome.runtime.lastError;
      });

      notify('miscCallAdded', record);

    } catch(e) {}
  },
  { urls: ['<all_urls>'] }
);

// ── Message handler ────────────────────────────────────────────────────────────
// Returns from in-memory store — synchronous, no async needed
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (!message) return false;

  if (message.action === 'getMiscCalls') {
    sendResponse(_misc);
    return false;
  }

  if (message.action === 'getRpsetCalls') {
    sendResponse(_rpset);
    return false;
  }

  if (message.action === 'clearMiscCalls') {
    _misc = [];
    chrome.storage.local.set({ miscCalls: [] });
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === 'clearRpsetCalls') {
    _rpset = [];
    chrome.storage.local.set({ rpsetCalls: [] });
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === 'consentChanged') {
    notify('consentChanged', message.detail);
    return false;
  }

  if (message.action === 'getColData') {
    var tabId = message.tabId;

    function findCalls(store, tid) {
      if (!store) return null;
      // Primary: exact tab match
      if (Array.isArray(store[tid]) && store[tid].length > 0) return store[tid];
      // Fallback: tabId=-1 means request came from SW/prerender context, not a real tab
      // Associate those calls with whoever is asking
      if (Array.isArray(store[-1]) && store[-1].length > 0) return store[-1];
      return null;
    }

    // Try in-memory first
    var mem = findCalls(_colData, tabId);
    if (mem) { sendResponse(mem); return false; }

    // Fall back to storage (covers SW restart before async restore completed)
    chrome.storage.local.get(['colData'], function(data) {
      void chrome.runtime.lastError;
      if (data.colData) _colData = data.colData;
      sendResponse(findCalls(_colData, tabId));
    });
    return true;
  }

  if (message.action === 'clearColData') {
    var cTabId = message.tabId;
    if (!_colData) _colData = {};
    if (cTabId) _colData[cTabId] = [];
    _colData[-1] = []; // always clear the non-tab bucket too
    chrome.storage.local.set({ colData: _colData });
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === 'ping') {
    sendResponse({ ok: true, misc: _misc.length, rpset: _rpset.length });
    return false;
  }

  return false;
});
