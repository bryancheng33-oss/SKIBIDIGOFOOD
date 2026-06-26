/* Skibidi GoFood V16 final operational completion guard.
   This file completes all browser-achievable checks without needing live host credentials. */
(function () {
  'use strict';

  var VERSION = '20260526v21';
  var STORE = 'sg_v16_operational_events';
  var MAX = 80;
  var LOCAL = ['localhost', '127.0.0.1', '::1'];

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function isLocal() { return LOCAL.indexOf(location.hostname) !== -1 || location.hostname.endsWith('.local'); }

  function log(type, data) {
    var payload = Object.assign({ type: type, version: VERSION, path: location.pathname, time: new Date().toISOString() }, data || {});
    try {
      var list = JSON.parse(sessionStorage.getItem(STORE) || '[]');
      list.push(payload);
      sessionStorage.setItem(STORE, JSON.stringify(list.slice(-MAX)));
    } catch (err) {}
    if (window.Sentry && typeof window.Sentry.captureMessage === 'function') {
      window.Sentry.captureMessage('SGF V16 ' + type, { level: type.indexOf('error') >= 0 ? 'error' : 'info', extra: payload });
    }
    return payload;
  }

  window.addEventListener('error', function (event) {
    log('runtime-error', { message: event.message || 'Script error', source: event.filename || '', line: event.lineno || 0 });
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    log('runtime-unhandled-rejection', { message: reason && reason.message ? reason.message : String(reason || 'Unknown rejection') });
  });
  window.addEventListener('securitypolicyviolation', function (event) {
    log('runtime-csp-violation', { directive: event.effectiveDirective || event.violatedDirective || '', blockedURI: event.blockedURI || '' });
  });

  function ensureMainAndSkip() {
    var main = document.querySelector('main, [role="main"], .orders-page-shell, .menu-page-shell, .container, section');
    if (main) {
      if (!main.id) main.id = 'main-content';
      if (!main.getAttribute('role')) main.setAttribute('role', 'main');
      if (!document.querySelector('.sg-v16-skip-link')) {
        var link = document.createElement('a');
        link.className = 'sg-v16-skip-link';
        link.href = '#' + main.id;
        link.textContent = 'Skip to main content';
        document.body.insertBefore(link, document.body.firstChild);
      }
    }
  }

  function improveA11y() {
    document.querySelectorAll('img').forEach(function (img, i) {
      if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (i > 2 && !img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      img.addEventListener('error', function () {
        img.setAttribute('data-v16-image-error', 'true');
        log('image-load-error', { src: img.currentSrc || img.src || '' });
      }, { once: true });
    });
    document.querySelectorAll('button:not([type])').forEach(function (button) { button.setAttribute('type', 'button'); });
    document.querySelectorAll('input, textarea, select').forEach(function (field) {
      if (!field.id) field.id = 'sg-field-' + Math.random().toString(36).slice(2, 9);
      var safeId = (window.CSS && CSS.escape) ? CSS.escape(field.id) : String(field.id).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
      var hasName = field.getAttribute('aria-label') || field.getAttribute('aria-labelledby') || document.querySelector('label[for="' + safeId + '"]');
      if (!hasName && field.placeholder) field.setAttribute('aria-label', field.placeholder);
    });
  }

  function hardenExternalLinks() {
    document.querySelectorAll('a[href]').forEach(function (anchor) {
      try {
        var url = new URL(anchor.getAttribute('href'), location.href);
        if (/^https?:$/.test(url.protocol) && url.origin !== location.origin) {
          var rel = (anchor.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
          ['noopener', 'noreferrer'].forEach(function (token) { if (rel.indexOf(token) === -1) rel.push(token); });
          anchor.setAttribute('rel', rel.join(' '));
          if (!anchor.hasAttribute('target')) anchor.setAttribute('target', '_blank');
        }
      } catch (err) {}
    });
  }

  function monitorTimelineOverlap() {
    var list = document.querySelector('#orders-list, .orders-timeline, .order-timeline, [data-order-timeline="true"]');
    if (!list) return;
    list.setAttribute('data-order-timeline', 'true');
    Array.prototype.forEach.call(list.children, function (child) { child.setAttribute('data-order-card', 'true'); });
    function check() {
      var cards = Array.prototype.slice.call(list.children).filter(function (el) { return el.offsetParent !== null; });
      for (var i = 1; i < cards.length; i++) {
        var prev = cards[i - 1].getBoundingClientRect();
        var cur = cards[i].getBoundingClientRect();
        if (cur.top < prev.bottom - 1) {
          log('order-timeline-overlap-detected', { index: i, previousBottom: prev.bottom, currentTop: cur.top });
          list.setAttribute('data-v16-overlap-warning', 'true');
          return false;
        }
      }
      list.removeAttribute('data-v16-overlap-warning');
      return true;
    }
    setTimeout(check, 100);
    setTimeout(check, 800);
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(check);
      ro.observe(list);
      Array.prototype.forEach.call(list.children, function (child) { ro.observe(child); });
    }
  }

  function monitorPerformance() {
    if (!('PerformanceObserver' in window)) return;
    var supported = PerformanceObserver.supportedEntryTypes || [];
    function observe(type, cb) {
      if (supported.indexOf(type) === -1) return;
      try { new PerformanceObserver(cb).observe({ type: type, buffered: true }); } catch (err) {}
    }
    observe('largest-contentful-paint', function (list) {
      var entries = list.getEntries();
      var last = entries[entries.length - 1];
      if (last) log('metric-lcp', { value: Math.round(last.startTime) });
    });
    observe('layout-shift', function (list) {
      var total = 0;
      list.getEntries().forEach(function (entry) { if (!entry.hadRecentInput) total += entry.value || 0; });
      if (total > 0.1) log('metric-cls-warning', { value: Number(total.toFixed(4)) });
    });
    observe('longtask', function (list) {
      list.getEntries().forEach(function (entry) { if (entry.duration > 120) log('metric-long-task', { duration: Math.round(entry.duration) }); });
    });
  }

  function productionSecurityCheck() {
    if (location.protocol === 'http:' && !isLocal()) {
      log('production-http-warning', { message: 'Production page loaded without HTTPS.' });
      if (!sessionStorage.getItem('sg_v16_http_banner_closed')) {
        var banner = document.createElement('div');
        banner.className = 'sg-v16-security-warning';
        banner.setAttribute('role', 'status');
        banner.innerHTML = '<button type="button">OK</button>Production should use HTTPS/SSL before handling login, account, or order data.';
        banner.querySelector('button').addEventListener('click', function () {
          sessionStorage.setItem('sg_v16_http_banner_closed', '1');
          banner.remove();
        });
        document.body.appendChild(banner);
      }
    }
  }

  function exposeDiagnostics() {
    window.SGFV16 = Object.freeze({
      version: VERSION,
      getEvents: function () { try { return JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch (err) { return []; } },
      clearEvents: function () { try { sessionStorage.removeItem(STORE); } catch (err) {} },
      runSelfCheck: function () {
        var result = {
          version: VERSION,
          httpsOrLocal: location.protocol === 'https:' || isLocal(),
          hasMain: !!document.querySelector('main, [role="main"]'),
          hasSkipLink: !!document.querySelector('.skip-link, .sg-v16-skip-link'),
          orderTimelinePresent: !!document.querySelector('#orders-list, .orders-timeline, .order-timeline, [data-order-timeline="true"]'),
          events: this.getEvents().length
        };
        log('manual-self-check', result);
        return result;
      }
    });
  }

  ready(function () {
    document.documentElement.classList.add('sg-operational-v16');
    document.documentElement.setAttribute('data-operational-version', VERSION);
    ensureMainAndSkip();
    improveA11y();
    hardenExternalLinks();
    monitorTimelineOverlap();
    monitorPerformance();
    productionSecurityCheck();
    exposeDiagnostics();
  });
}());
