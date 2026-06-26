(function () {
  'use strict';

  var startTime = Date.now();
  var minimumVisibleMs = 900;
  var maximumVisibleMs = 3000;
  var hideStarted = false;

  function hideGoFoodLoader() {
    if (hideStarted) return;
    hideStarted = true;

    var loader = document.getElementById('loader');
    if (!loader) return;

    var remaining = Math.max(0, minimumVisibleMs - (Date.now() - startTime));
    window.setTimeout(function () {
      loader.classList.add('hidden', 'is-hidden');
      loader.setAttribute('aria-hidden', 'true');
      window.setTimeout(function () {
        if (loader && loader.parentNode) loader.style.display = 'none';
      }, 520);
    }, remaining);
  }

  if (document.readyState === 'complete') {
    hideGoFoodLoader();
  } else {
    window.addEventListener('load', hideGoFoodLoader, { once: true });
  }

  window.setTimeout(hideGoFoodLoader, maximumVisibleMs);
})();
