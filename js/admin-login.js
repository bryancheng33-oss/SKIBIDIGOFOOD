(function () {
  'use strict';


  var ADMIN_LOCK_KEY = 'sgf_admin_login_lock_v16';
  var MAX_ADMIN_ATTEMPTS = 5;
  var ADMIN_LOCK_MS = 15 * 60 * 1000;

  function getLockState() {
    try { return JSON.parse(localStorage.getItem(ADMIN_LOCK_KEY) || '{}') || {}; }
    catch (err) { return {}; }
  }

  function setLockState(state) {
    try { localStorage.setItem(ADMIN_LOCK_KEY, JSON.stringify(state || {})); }
    catch (err) {}
  }

  function clearLockState() {
    try { localStorage.removeItem(ADMIN_LOCK_KEY); } catch (err) {}
  }

  function getLockMessage() {
    var state = getLockState();
    var until = Number(state.lockedUntil || 0);
    if (until > Date.now()) {
      var mins = Math.ceil((until - Date.now()) / 60000);
      return 'Too many failed attempts. Try again in about ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.';
    }
    return '';
  }

  function recordFailedAttempt() {
    var state = getLockState();
    var attempts = Number(state.attempts || 0) + 1;
    state.attempts = attempts;
    state.lastFailedAt = Date.now();
    if (attempts >= MAX_ADMIN_ATTEMPTS) {
      state.lockedUntil = Date.now() + ADMIN_LOCK_MS;
      state.attempts = 0;
    }
    setLockState(state);
    return getLockMessage();
  }

  function runAdminLogin() {
    if (!window.State) return;
    if (State.isAdmin()) {
      window.location.href = 'admin';
      return;
    }

    var form = document.getElementById('adm-login-form');
    var error = document.getElementById('adm-login-error');
    var userInput = document.getElementById('adm-user');
    var passInput = document.getElementById('adm-pass');
    if (!form || !userInput || !passInput) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var username = String(userInput.value || '').trim();
      var password = String(passInput.value || '');
      if (error) error.textContent = '';

      var lockedMsg = getLockMessage();
      if (lockedMsg) {
        if (error) error.textContent = lockedMsg;
        if (window.State && typeof State.notify === 'function') State.notify('⛔ ' + lockedMsg);
        return;
      }

      if (!username || !password) {
        if (error) error.textContent = 'Please enter both admin username and password.';
        if (window.State && typeof State.notify === 'function') State.notify('⚠️ Please enter both admin username and password.');
        return;
      }

      Promise.resolve(State.verifyAdminCredentials(username, password)).then(function (result) {
        if (!result || !result.ok) {
          var msg = (result && result.msg) || 'Invalid admin credentials.';
          var lockMessage = recordFailedAttempt();
          if (error) error.textContent = lockMessage || msg;
          if (typeof State.notify === 'function') State.notify('❌ ' + (lockMessage || msg));
          passInput.value = '';
          passInput.focus();
          return;
        }
        clearLockState();
        State.loginAdmin(result.username);
        if (typeof State.notify === 'function') State.notify('✅ Admin login successful!');
        window.setTimeout(function () { window.location.href = 'admin'; }, 250);
      }).catch(function () {
        var msg = 'Unable to verify admin credentials.';
        if (error) error.textContent = msg;
        if (typeof State.notify === 'function') State.notify('❌ ' + msg);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runAdminLogin);
  else runAdminLogin();
}());
