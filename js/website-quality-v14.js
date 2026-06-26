/* Skibidi GoFood V14 website quality guard.
   Adds skip-link support, safer external links, image fallbacks, and local error
   capture. If Sentry is configured later, errors are forwarded automatically. */
(function () {
  'use strict';

  var VERSION = '20260526v21';
  var MAX_ERRORS = 20;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function saveError(payload) {
    try {
      var key = 'sg_client_errors';
      var list = JSON.parse(sessionStorage.getItem(key) || '[]');
      list.push(Object.assign({ version: VERSION, path: location.pathname, time: new Date().toISOString() }, payload));
      sessionStorage.setItem(key, JSON.stringify(list.slice(-MAX_ERRORS)));
    } catch (err) {
      // Storage can be unavailable in private modes; do not break the page.
    }
  }

  window.addEventListener('error', function (event) {
    saveError({ type: 'error', message: event.message || 'Script error', source: event.filename || '', line: event.lineno || 0, column: event.colno || 0 });
    if (window.Sentry && typeof window.Sentry.captureException === 'function' && event.error) {
      window.Sentry.captureException(event.error);
    }
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    saveError({ type: 'unhandledrejection', message: reason && reason.message ? reason.message : String(reason || 'Unknown rejection') });
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason || 'Unhandled rejection')));
    }
  });

  function ensureSkipLink() {
    if (document.querySelector('.skip-link')) return;
    var main = document.querySelector('main, [role="main"], .orders-page-shell, .menu-page-shell, .container, section');
    if (!main) return;
    if (!main.id) main.id = 'main-content';
    var link = document.createElement('a');
    link.className = 'skip-link';
    link.href = '#' + main.id;
    link.textContent = 'Skip to main content';
    document.body.insertBefore(link, document.body.firstChild);
  }

  function hardenExternalLinks() {
    var origin = location.origin;
    document.querySelectorAll('a[href]').forEach(function (anchor) {
      try {
        var url = new URL(anchor.getAttribute('href'), location.href);
        if (url.origin !== origin && /^https?:$/.test(url.protocol)) {
          var rel = (anchor.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
          ['noopener', 'noreferrer'].forEach(function (token) {
            if (rel.indexOf(token) === -1) rel.push(token);
          });
          anchor.setAttribute('rel', rel.join(' '));
          if (!anchor.getAttribute('target')) anchor.setAttribute('target', '_blank');
        }
      } catch (err) {}
    });
  }

  function hardenImages() {
    document.querySelectorAll('img').forEach(function (img, index) {
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (index > 2 && !img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
      img.addEventListener('error', function () {
        img.classList.add('image-load-error');
        saveError({ type: 'image', message: 'Image failed to load', source: img.currentSrc || img.src || '' });
      }, { once: true });
    });
  }

  function markQualityVersion() {
    document.documentElement.classList.add('sg-quality-v14');
    document.documentElement.setAttribute('data-quality-version', VERSION);
  }

  ready(function () {
    markQualityVersion();
    ensureSkipLink();
    hardenExternalLinks();
    hardenImages();
  });
})();
