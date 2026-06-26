(function () {
  'use strict';

  var MOON_ONLY_RE = /^(?:🌙|☾|☽|◐|◑|◒|◓|🌗|🌘|🌚)$/u;
  var THEME_RE = /(?:^|[-_\s])(theme|theme-toggle|theme-switch|dark-mode|darkmode|moon-toggle|color-mode|appearance-toggle)(?:$|[-_\s])/i;
  var LABEL_RE = /\b(theme|dark\s*mode|moon|night\s*mode|appearance)\b/i;

  function attrText(el) {
    return [
      el.id || '',
      typeof el.className === 'string' ? el.className : '',
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.getAttribute('data-theme-toggle') || '',
      el.getAttribute('onclick') || ''
    ].join(' ');
  }

  function looksLikeThemeToggle(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    var text = (el.textContent || '').trim();
    var attrs = attrText(el);

    if (MOON_ONLY_RE.test(text)) return true;
    if (/toggleTheme\s*\(/i.test(attrs)) return true;
    if (THEME_RE.test(attrs)) return true;
    if ((tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button') && LABEL_RE.test(attrs) && text.length <= 24) return true;
    if (tag === 'img' && LABEL_RE.test((el.getAttribute('alt') || '') + ' ' + attrs)) return true;

    return false;
  }

  function removeThemeToggles() {
    document.querySelectorAll('button, a, [role="button"], input, img, span, div').forEach(function (el) {
      if (!looksLikeThemeToggle(el)) return;
      var target = el.closest('button, a, [role="button"]') || el;
      if (target && target.parentNode) target.parentNode.removeChild(target);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeThemeToggles, { once: true });
  } else {
    removeThemeToggles();
  }

  window.addEventListener('load', removeThemeToggles, { once: true });
  window.setTimeout(removeThemeToggles, 250);
  window.setTimeout(removeThemeToggles, 1000);

  if (window.MutationObserver) {
    new MutationObserver(removeThemeToggles).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
