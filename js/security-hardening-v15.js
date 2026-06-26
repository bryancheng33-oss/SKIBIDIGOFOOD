/* Skibidi GoFood V15 security guard.
   This complements server headers by detecting CSP violations, mixed content,
   unsafe external links, insecure form methods, and optional Sentry forwarding. */
(function () {
  'use strict';

  var VERSION = '20260526v21';
  var MAX_EVENTS = 40;
  var STORAGE_KEY = 'sg_security_events';
  var LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function isLocalHost() {
    return LOCAL_HOSTS.indexOf(location.hostname) !== -1 || location.hostname.endsWith('.local');
  }

  function securityEvent(payload) {
    var event = Object.assign({
      version: VERSION,
      path: location.pathname,
      time: new Date().toISOString()
    }, payload || {});

    try {
      var list = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      list.push(event);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_EVENTS)));
    } catch (err) {}

    if (window.Sentry && typeof window.Sentry.captureMessage === 'function') {
      window.Sentry.captureMessage('Skibidi GoFood security event: ' + (event.type || 'unknown'), { level: 'warning', extra: event });
    }
  }

  window.addEventListener('securitypolicyviolation', function (event) {
    securityEvent({
      type: 'csp-violation',
      directive: event.violatedDirective || event.effectiveDirective || '',
      blockedURI: event.blockedURI || '',
      sourceFile: event.sourceFile || '',
      lineNumber: event.lineNumber || 0
    });
  });

  function markVersion() {
    document.documentElement.classList.add('sg-security-v15');
    document.documentElement.setAttribute('data-security-version', VERSION);
  }

  function showHttpsWarning() {
    if (location.protocol !== 'http:' || isLocalHost() || sessionStorage.getItem('sg_https_warning_closed') === '1') return;
    document.documentElement.setAttribute('data-insecure-context', 'true');
    securityEvent({ type: 'insecure-context', message: 'Page loaded over HTTP instead of HTTPS.' });

    var banner = document.createElement('div');
    banner.className = 'sg-security-warning';
    banner.setAttribute('role', 'status');
    banner.innerHTML = '<button type="button" aria-label="Dismiss security warning">OK</button>This page is not using HTTPS. Deploy with SSL/TLS before collecting account or payment information.';
    banner.querySelector('button').addEventListener('click', function () {
      sessionStorage.setItem('sg_https_warning_closed', '1');
      banner.remove();
    });
    document.body.appendChild(banner);
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

  function detectMixedContent() {
    var selector = '[src^="http:"], [href^="http:"], form[action^="http:"]';
    document.querySelectorAll(selector).forEach(function (node) {
      var attr = node.hasAttribute('src') ? 'src' : (node.hasAttribute('href') ? 'href' : 'action');
      var raw = node.getAttribute(attr);
      securityEvent({ type: 'mixed-content-reference', tag: node.tagName.toLowerCase(), attribute: attr, value: raw });
      try {
        var url = new URL(raw, location.href);
        if (location.protocol === 'https:' && url.hostname === location.hostname) {
          url.protocol = 'https:';
          node.setAttribute(attr, url.toString());
        }
      } catch (err) {}
    });
  }

  function hardenForms() {
    document.querySelectorAll('form').forEach(function (form) {
      var hasPassword = !!form.querySelector('input[type="password"]');
      var method = (form.getAttribute('method') || 'get').toLowerCase();
      if (hasPassword && method === 'get') {
        form.setAttribute('method', 'post');
        securityEvent({ type: 'form-method-upgraded', message: 'Password form method changed from GET to POST client-side.' });
      }
      form.querySelectorAll('input[type="password"]').forEach(function (input) {
        if (!input.hasAttribute('autocomplete')) input.setAttribute('autocomplete', 'current-password');
      });
    });
  }

  function exposeSecurityDiagnostics() {
    window.SGSecurity = Object.freeze({
      version: VERSION,
      getEvents: function () {
        try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); } catch (err) { return []; }
      },
      clearEvents: function () { try { sessionStorage.removeItem(STORAGE_KEY); } catch (err) {} }
    });
  }

  ready(function () {
    markVersion();
    showHttpsWarning();
    hardenExternalLinks();
    detectMixedContent();
    hardenForms();
    exposeSecurityDiagnostics();
  });
})();
