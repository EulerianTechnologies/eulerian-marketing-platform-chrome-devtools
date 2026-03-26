// Eulerian Marketing Platform Chrome DevTools — injected.js (MAIN world)
// ONLY purpose: access window.__tcfapi (which lives in the real page context).
// Network interception (/misc/, /rpset/) is handled by chrome.webRequest
// in background.js — no transport patching needed here.

(function() {
  if (window.__EulerianTCFListenerActive) return;
  window.__EulerianTCFListenerActive = true;

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  // ── TCF audit (triggered by content.js) ──────────────────────────────────
  window.addEventListener('__eulerian_run_tcf_audit', function() {
    var result = {
      hasCmpApi: false,
      tcData: null,
      tcStringApi: null,
      errors: []
    };

    result.hasCmpApi = typeof window.__tcfapi === 'function';

    if (!result.hasCmpApi) {
      emit('__eulerian_tcf_result', result);
      return;
    }

    var timedOut = false;
    var timer = setTimeout(function() {
      timedOut = true;
      result.errors.push('CMP API: timeout after 4s');
      emit('__eulerian_tcf_result', result);
    }, 4000);

    try {
      window.__tcfapi('getTCData', 2, function(tcData, success) {
        if (timedOut) return;
        clearTimeout(timer);

        if (!success || !tcData) {
          result.errors.push('CMP API: returned success=false');
          emit('__eulerian_tcf_result', result);
          return;
        }

        var consents = {}, li = {};
        if (tcData.purpose && tcData.purpose.consents) {
          Object.keys(tcData.purpose.consents).forEach(function(k) {
            consents[k] = tcData.purpose.consents[k];
          });
        }
        if (tcData.purpose && tcData.purpose.legitimateInterests) {
          Object.keys(tcData.purpose.legitimateInterests).forEach(function(k) {
            li[k] = tcData.purpose.legitimateInterests[k];
          });
        }

        var vendorCount = 0;
        var vendorConsentsMap = {};
        if (tcData.vendor && tcData.vendor.consents) {
          Object.keys(tcData.vendor.consents).forEach(function(id) {
            vendorConsentsMap[id] = tcData.vendor.consents[id];
            if (tcData.vendor.consents[id]) vendorCount++;
          });
        }

        result.tcData = {
          tcString:             tcData.tcString || null,
          gdprApplies:          tcData.gdprApplies,
          cmpId:                tcData.cmpId,
          cmpVersion:           tcData.cmpVersion,
          purposeConsents:      consents,
          purposeLI:            li,
          vendorConsents:       vendorCount,
          vendorConsentsMap:    vendorConsentsMap,
          isServiceSpecific:    tcData.isServiceSpecific,
          useNonStandardStacks: tcData.useNonStandardStacks,
          policyVersion:        tcData.policyVersion
        };
        result.tcStringApi = tcData.tcString || null;

        if (tcData.tcString) {
          window.__EulerianLastTCString = tcData.tcString;
        }

        emit('__eulerian_tcf_result', result);
      });
    } catch(e) {
      clearTimeout(timer);
      result.errors.push('CMP API exception: ' + e.message);
      emit('__eulerian_tcf_result', result);
    }
  });

  // ── EA dataLayer reader — triggered by content.js ──────────────────────────
  // Runs in MAIN world so window.EA_datalayer / window.EA_data are the real
  // page-level objects, not the isolated-world proxies.
  //
  // Retries up to 5 times with 400ms gaps because EA_data / EA_datalayer is
  // often set by an async script that loads after document_start.
  // Also checks lowercase variants (ea_data, ea_datalayer) used by some impls.

  function readEADataLayer() {
    // Direct typeof checks — works for both arrays and plain objects
    // Log every candidate so we can see what's on window
    var candidates = [
      { key: 'EA_datalayer', val: window.EA_datalayer },
      { key: 'EA_data',      val: window.EA_data      },
      { key: 'ea_datalayer', val: window.ea_datalayer },
      { key: 'ea_data',      val: window.ea_data      }
    ];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (typeof c.val === 'object' && c.val !== null) {
        return { raw: c.val, varName: c.key };
      }
    }
    return null;
  }

  window.addEventListener('__eulerian_get_datalayer', function() {
    var MAX_MS     = 3000;
    var TICK_MS    = 300;
    var elapsed    = 0;
    var intervalId = null;

    function check() {
      elapsed += TICK_MS;
      var found = readEADataLayer();

      if (found || elapsed >= MAX_MS) {
        clearInterval(intervalId);
        emit(found);
      }
    }

    // Sanitize raw data — remove functions and non-serializable values so that
    // structured clone (used for CustomEvent.detail cross-world transfer) succeeds.
    // EA_data can contain 'onload': ƒ which causes the whole payload to null.
    function sanitize(raw) {
      if (raw == null) return null;
      if (Array.isArray(raw)) {
        // Flat alternating array — parse to plain object, drop non-serializable values
        var out = {};
        for (var i = 0; i + 1 < raw.length; i += 2) {
          var k = raw[i], v = raw[i + 1];
          if (typeof k === 'string' && k !== '' && typeof v !== 'function' && typeof v !== 'undefined') {
            out[k] = (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
              ? v
              : String(v);
          }
        }
        return out;
      }
      if (typeof raw === 'object') {
        var out2 = {};
        Object.keys(raw).forEach(function(k) {
          var v = raw[k];
          if (typeof v !== 'function' && typeof v !== 'undefined') {
            out2[k] = (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
              ? v
              : String(v);
          }
        });
        return out2;
      }
      return null;
    }

    function emit(found) {
      // Pass already-parsed + sanitized key/value object as CustomEvent.detail.
      // CustomEvent.detail DOES cross MAIN → ISOLATED, but only if the payload
      // is fully serializable (no functions, no DOM nodes, etc.).
      var detail = {
        found:   found != null,
        varName: found ? found.varName : null,
        parsed:  found ? sanitize(found.raw) : null  // clean object, no functions
      };
      window.dispatchEvent(new CustomEvent('__eulerian_datalayer_result', { detail: detail }));
    }

    // Check immediately first
    var immediate = readEADataLayer();
    if (immediate) {
      emit(immediate);
    } else {
      intervalId = setInterval(check, TICK_MS);
    }
  });

  // ── Subscribe to TCF consent-change events ────────────────────────────────
  function subscribeToTCFEvents() {
    if (typeof window.__tcfapi !== 'function') return;
    try {
      window.__tcfapi('addEventListener', 2, function(tcData, success) {
        if (!success || !tcData) return;
        if (tcData.tcString) window.__EulerianLastTCString = tcData.tcString;
        emit('__eulerian_consent_changed', {
          eventStatus: tcData.eventStatus,
          tcString:    tcData.tcString || null,
          gdprApplies: tcData.gdprApplies,
          cmpId:       tcData.cmpId
        });
      });
    } catch(e) {}
  }

  subscribeToTCFEvents();
  window.addEventListener('DOMContentLoaded', subscribeToTCFEvents, { once: true });

})();
