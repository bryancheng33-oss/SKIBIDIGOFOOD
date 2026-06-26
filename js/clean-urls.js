(function () {
  'use strict';

  if (!/^https?:$/.test(window.location.protocol)) return;

  var path = window.location.pathname || '';
  if (/\/[^\/]+\.html?$/i.test(path)) {
    var cleanPath = path.replace(/\.html?$/i, '');
    if (/\/index$/i.test(cleanPath)) {
      cleanPath = cleanPath.replace(/\/index$/i, '/') || '/';
    }
    window.history.replaceState(null, document.title, cleanPath + window.location.search + window.location.hash);
  }
})();
