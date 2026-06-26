// Skibidi GoFood route helper alias.
(function () {
  'use strict';
  function cleanPageName(value) {
    return String(value || '').replace(/^\/+|\.html$/g, '').trim() || 'home';
  }
  window.SGFRouter = window.SGFRouter || {
    page: function () { return cleanPageName(window.location.pathname.split('/').pop()); },
    path: function (page) { return cleanPageName(page); },
    go: function (page) { window.location.href = cleanPageName(page); }
  };
})();
