// Eulerian Marketing Platform Chrome DevTools — content.js (ISOLATED world)
// Responsibilities:
//  1. Bridge between injected.js (MAIN world, __tcfapi access) and background.js
//  2. Read cookies + localStorage for the TCF audit
//  3. Relay TCF consent-change events to background.js
//
// /misc/ and /rpset/ network capture is handled entirely by chrome.webRequest
// in background.js — no content script involvement needed.

// ── Relay TCF consent-change events to background ─────────────────────────
window.addEventListener('__eulerian_consent_changed', function(e) {
  try {
    chrome.runtime.sendMessage({ action: 'consentChanged', detail: e.detail }, function() {
      void chrome.runtime.lastError;
    });
  } catch(err) {}
});

// ── Message router ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (!message || !message.action) return false;

  switch (message.action) {
    case 'runTCFAudit':
      runFullAudit()
        .then(function(r) { sendResponse(r); })
        .catch(function(e) { sendResponse({ error: e.message }); });
      return true;

    case 'getPageInfo':
      sendResponse({ url: location.href, hostname: location.hostname, title: document.title });
      return false;

    case 'getTrafficInfo':
      sendResponse({
        url:      location.href,
        referrer: document.referrer || ''
      });
      return false;

    case 'getDataLayer':
      (function() {
        var timer = setTimeout(function() {
          sendResponse({ found: false, varName: null, raw: null });
        }, 4500);  // 3s polling + margin

        window.addEventListener('__eulerian_datalayer_result', function handler(e) {
          clearTimeout(timer);
          window.removeEventListener('__eulerian_datalayer_result', handler);
          // detail is a sanitized serializable object — no functions, safe to clone
          var detail = (e && e.detail) ? e.detail : { found: false, varName: null, parsed: null };
          // Return parsed (already a clean key/value object) instead of raw array
          sendResponse({ found: detail.found, varName: detail.varName, raw: detail.parsed });
        });

        window.dispatchEvent(new CustomEvent('__eulerian_get_datalayer'));
      })();
      return true;

    default:
      sendResponse({ error: 'Unknown action: ' + message.action });
      return false;
  }
});

// ── Full audit ─────────────────────────────────────────────────────────────
async function runFullAudit() {
  var tcfResult = await runTCFAuditInMainWorld();
  enrichWithCookiesAndStorage(tcfResult);
  return tcfResult;
}

function runTCFAuditInMainWorld() {
  return new Promise(function(resolve) {
    var timer = setTimeout(function() {
      resolve({
        hasCmpApi: false, tcData: null, tcStringApi: null,
        cookies: [], localStorageKeys: [], errors: ['Injected script did not respond — reload the page.']
      });
    }, 6000);

    window.addEventListener('__eulerian_tcf_result', function handler(e) {
      clearTimeout(timer);
      window.removeEventListener('__eulerian_tcf_result', handler);
      resolve(e.detail || {});
    });

    window.dispatchEvent(new CustomEvent('__eulerian_run_tcf_audit'));
  });
}

function enrichWithCookiesAndStorage(result) {
  result.cookies = [];
  try {
    var allCookies = document.cookie.split(';').map(function(c) { return c.trim(); }).filter(Boolean);
    result.cookies = allCookies.map(function(c) {
      var eq = c.indexOf('=');
      return { name: c.slice(0, eq), value: c.slice(eq + 1) };
    });
    if (!result.tcStringApi) {
      var tcNames = ['euconsent-v2', 'euconsent', 'CookieConsent', 'sp_eu_cookie'];
      for (var i = 0; i < tcNames.length; i++) {
        var m = result.cookies.find(function(c) { return c.name === tcNames[i]; });
        if (m) { result.tcStringCookie = decodeURIComponent(m.value); break; }
      }
    }
  } catch(e) { (result.errors = result.errors || []).push('Cookies: ' + e.message); }

  result.localStorageKeys = [];
  result.tcStringLocalStorage = null;
  try {
    var lsKeys = ['euconsent-v2', 'tcstring', 'TCString', 'IABTCF_TCString'];
    for (var j = 0; j < lsKeys.length; j++) {
      var val = localStorage.getItem(lsKeys[j]);
      if (val) { result.tcStringLocalStorage = val; break; }
    }
  } catch(e) { (result.errors = result.errors || []).push('localStorage: ' + e.message); }
}
