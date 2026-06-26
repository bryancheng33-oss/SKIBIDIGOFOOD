// Static compatibility entry point for /assets/index.js.
(function () {
  'use strict';
  window.SGFAssets = Object.assign({}, window.SGFAssets, {
    loaded: true,
    entry: 'assets/index.js',
    note: 'Page-specific logic is loaded from /js and inline static page scripts.'
  });
})();
