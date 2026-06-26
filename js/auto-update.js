/* Skibidi GoFood auto update refresh
   Keeps already-open browser tabs on the newest deployed files.
   This is intentionally dependency-free and safe for all modern mobile/desktop browsers. */
(function () {
  'use strict';

  var CURRENT_VERSION = '20260526v21';
  var VERSION_URL = 'site-version.json';
  var CHECK_INTERVAL_MS = 30000;
  var RELOAD_DELAY_MS = 1500;
  var reloading = false;
  var lastCheckAt = 0;

  function canUseStorage() {
    try {
      var key = '__sgf_storage_test__';
      window.localStorage.setItem(key, '1');
      window.localStorage.removeItem(key);
      return true;
    } catch (err) {
      return false;
    }
  }

  var storageOK = canUseStorage();

  function getStoredVersion() {
    if (!storageOK) return CURRENT_VERSION;
    return window.localStorage.getItem('sgf_site_version') || CURRENT_VERSION;
  }

  function setStoredVersion(version) {
    if (!storageOK || !version) return;
    window.localStorage.setItem('sgf_site_version', String(version));
  }

  function clearKnownAppCaches() {
    if (!('caches' in window)) return Promise.resolve();
    return window.caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (/skibidi|gofood|sgf|workbox|precache/i.test(key)) {
          return window.caches.delete(key);
        }
        return Promise.resolve(false);
      }));
    }).catch(function () {});
  }

  function showUpdateNotice(latestVersion) {
    try {
      var old = document.getElementById('sgf-auto-update-notice');
      if (old) old.remove();
      var notice = document.createElement('div');
      notice.id = 'sgf-auto-update-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.textContent = 'New update found. Refreshing automatically…';
      notice.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:18px',
        'transform:translateX(-50%)',
        'z-index:2147483647',
        'max-width:min(92vw,420px)',
        'padding:12px 16px',
        'border-radius:999px',
        'background:#111827',
        'color:#fff',
        'font:600 14px/1.35 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'box-shadow:0 14px 40px rgba(0,0,0,.28)',
        'text-align:center',
        'letter-spacing:.01em'
      ].join(';');
      document.documentElement.appendChild(notice);
    } catch (err) {}
  }

  function forceFreshReload(latestVersion) {
    if (reloading) return;
    reloading = true;
    setStoredVersion(latestVersion);
    showUpdateNotice(latestVersion);

    clearKnownAppCaches().finally(function () {
      window.setTimeout(function () {
        try {
          var next = new URL(window.location.href);
          next.searchParams.set('sgf_update', String(latestVersion || Date.now()));
          next.hash = window.location.hash || '';
          window.location.replace(next.toString());
        } catch (err) {
          window.location.reload();
        }
      }, RELOAD_DELAY_MS);
    });
  }

  function parseVersionPayload(payload) {
    if (!payload) return '';
    if (typeof payload === 'string') return payload.trim();
    return String(payload.version || payload.build || payload.release || '').trim();
  }

  function checkForUpdate(reason) {
    if (reloading || !window.fetch) return;
    var now = Date.now();
    if (reason !== 'interval' && now - lastCheckAt < 3000) return;
    lastCheckAt = now;

    var url = VERSION_URL + '?t=' + now + '&current=' + encodeURIComponent(CURRENT_VERSION);
    window.fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error('version-check-failed');
        return response.json();
      })
      .then(function (payload) {
        var latestVersion = parseVersionPayload(payload);
        if (!latestVersion) return;
        var storedVersion = getStoredVersion();
        setStoredVersion(latestVersion);

        // Reload when the deployed version is newer than the JS running in this open tab.
        if (latestVersion !== CURRENT_VERSION || storedVersion !== latestVersion) {
          forceFreshReload(latestVersion);
        }
      })
      .catch(function () {
        // Silent by design: the site keeps working even if version polling is temporarily blocked/offline.
      });
  }

  window.SGF_CHECK_FOR_UPDATE = checkForUpdate;
  checkForUpdate('load');
  window.setInterval(function () { checkForUpdate('interval'); }, CHECK_INTERVAL_MS);
  window.addEventListener('focus', function () { checkForUpdate('focus'); });
  window.addEventListener('online', function () { checkForUpdate('online'); });
  window.addEventListener('pageshow', function (event) {
    if (event && event.persisted) checkForUpdate('bfcache');
    else checkForUpdate('pageshow');
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkForUpdate('visible');
  });
})();
