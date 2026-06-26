/* Cross-browser viewport and rendering consistency helper.
   Keeps full-screen sections stable in Chrome, Edge, Firefox, Safari and mobile browsers. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('browser-consistency-ready');

  function viewportHeight() {
    if (window.visualViewport && window.visualViewport.height) {
      return window.visualViewport.height;
    }
    return window.innerHeight || root.clientHeight || 0;
  }

  function viewportWidth() {
    if (window.visualViewport && window.visualViewport.width) {
      return window.visualViewport.width;
    }
    return window.innerWidth || root.clientWidth || 0;
  }

  function setViewportVars() {
    var vh = viewportHeight() * 0.01;
    var vw = viewportWidth() * 0.01;
    if (vh > 0) root.style.setProperty('--app-vh', vh + 'px');
    if (vw > 0) root.style.setProperty('--app-vw', vw + 'px');
  }

  var scheduled = false;
  function scheduleViewportVars() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      setViewportVars();
    });
  }

  setViewportVars();
  window.addEventListener('resize', scheduleViewportVars, { passive: true });
  window.addEventListener('orientationchange', scheduleViewportVars, { passive: true });
  window.addEventListener('pageshow', scheduleViewportVars, { passive: true });
  document.addEventListener('DOMContentLoaded', scheduleViewportVars, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleViewportVars, { passive: true });
    window.visualViewport.addEventListener('scroll', scheduleViewportVars, { passive: true });
  }
})();
