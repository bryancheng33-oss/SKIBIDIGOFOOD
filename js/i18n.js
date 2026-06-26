// Compatibility alias for pages/tools that look for /js/i18n.js.
(function () {
  'use strict';
  if (window.I18N) return;
  function interpolate(text, vars) {
    return String(text || '').replace(/\{\{?\s*(\w+)\s*\}?\}/g, function (_, key) {
      return vars && Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : '';
    });
  }
  window.I18N = {
    t: interpolate,
    applyTranslations: function () {},
    localizeVoucherLabel: function (id, fallback) { return fallback || id || ''; },
    localizeVoucherDesc: function (id, fallback) { return fallback || ''; },
    localizeVoucherRules: function (id, fallback) { return Array.isArray(fallback) ? fallback : []; },
    localizeCategory: function (value) { return String(value || '').replace(/[_-]+/g, ' '); },
    localizeCuisine: function (value) { return String(value || '').replace(/[_-]+/g, ' '); },
    localizeBadge: function (value) { return String(value || '').toUpperCase(); },
    localizeOrderStatus: function (value) { return String(value || '').replace(/[_-]+/g, ' '); },
    localizePaymentMethod: function (value) { return String(value || '').replace(/[_-]+/g, ' '); }
  };
})();
