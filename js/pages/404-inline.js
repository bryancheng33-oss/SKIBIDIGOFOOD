(function () {
  'use strict';
  var backNow = document.getElementById('back-now');
  var homeLink = document.getElementById('home-link');
  var menuLink = document.getElementById('menu-link');
  var brandHomeLink = document.querySelector('.brand-mark');
  var progressBar = document.getElementById('progress-bar');
  var redirectMessage = document.getElementById('redirect-message');
  var isHttp = /^https?:$/i.test(window.location.protocol);

  function getFallbackPage(cleanName) {
    return isHttp ? '/' + cleanName : cleanName + '.html';
  }

  function isLoggedIn() {
    try {
      var raw = localStorage.getItem('sgf_user');
      if (!raw) return false;
      var user = JSON.parse(raw);
      return !!(user && user.username);
    } catch (err) {
      return false;
    }
  }

  function getLoginPage(nextPage) {
    try { sessionStorage.setItem('sgf_next_after_login', nextPage || 'home'); } catch (err) {}
    return isHttp ? '/?notice=login' : './index.html?notice=login';
  }

  function protectedPage(cleanName) {
    return isLoggedIn() ? getFallbackPage(cleanName) : getLoginPage(cleanName);
  }

  function goProtected(cleanName) {
    window.location.href = protectedPage(cleanName);
  }

  if (homeLink) {
    homeLink.setAttribute('href', protectedPage('home'));
    homeLink.addEventListener('click', function (event) {
      if (!isLoggedIn()) {
        event.preventDefault();
        goProtected('home');
      }
    });
  }
  if (brandHomeLink) {
    brandHomeLink.setAttribute('href', protectedPage('home'));
    brandHomeLink.addEventListener('click', function (event) {
      if (!isLoggedIn()) {
        event.preventDefault();
        goProtected('home');
      }
    });
  }
  if (menuLink) menuLink.setAttribute('href', getFallbackPage('menu'));
  if (progressBar) progressBar.style.transform = 'scaleX(1)';
  if (redirectMessage && !isLoggedIn()) redirectMessage.textContent = 'Login is required before opening Home';
  if (backNow) {
    backNow.addEventListener('click', function () {
      if (document.referrer && window.history.length > 1) window.history.back();
      else goProtected('home');
    });
  }
})();
