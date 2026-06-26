// ============================================================
//  auth.js — Authentication: guard, register, login, logout
//  Enhanced: strict validation, unique username/email,
//            real MY phone format, age-realistic birthday,
//            strong 12-char password with complexity rules
// ============================================================


function authLang(en) { return en; }

function authTimeout(ms, fallback = null) {
  return new Promise(resolve => setTimeout(() => resolve(fallback), ms));
}

function setAuthBusy(formId, isBusy) {
  const form = document.getElementById(formId);
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled = !!isBusy;
  btn.style.opacity = isBusy ? '0.7' : '';
  btn.style.cursor = isBusy ? 'wait' : '';
}

/** Redirect to login if not authenticated */
function getPostAuthDestination(fallback) {
  var safeFallback = fallback || 'home';
  try {
    var stored = sessionStorage.getItem('sgf_next_after_login');
    if (stored) {
      sessionStorage.removeItem('sgf_next_after_login');
      if (!/^https?:/i.test(stored) && !/admin/i.test(stored)) return stored;
    }
  } catch (err) {}
  return safeFallback;
}

function rememberAuthDestination() {
  try {
    var path = (window.location.pathname || '').split('/').pop() || '';
    var clean = path.replace(/\.html$/i, '') || 'home';
    if (clean === 'index' || clean === 'admin' || clean === 'admin-login') return;
    var target = clean + (window.location.search || '') + (window.location.hash || '');
    sessionStorage.setItem('sgf_next_after_login', target);
  } catch (err) {}
}



const SGF_PENDING_CART_INTENT_KEY = 'sgf_pending_cart_intent';

function queueCartIntent(foodId, qty = 1, options = null, returnTo = 'menu#catalog-start') {
  const safeFoodId = Number(foodId);
  const safeQty = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
  if (!Number.isFinite(safeFoodId) || safeFoodId <= 0) return false;
  try {
    sessionStorage.setItem(SGF_PENDING_CART_INTENT_KEY, JSON.stringify({
      foodId: safeFoodId,
      qty: safeQty,
      options: options && typeof options === 'object' ? options : null,
      returnTo: String(returnTo || 'menu#catalog-start'),
      createdAt: Date.now(),
    }));
    sessionStorage.setItem('sgf_next_after_login', String(returnTo || 'menu#catalog-start'));
    return true;
  } catch (err) {
    return false;
  }
}

function completeQueuedCartIntent() {
  let intent = null;
  try {
    const raw = sessionStorage.getItem(SGF_PENDING_CART_INTENT_KEY);
    if (!raw) return { added: false };
    intent = JSON.parse(raw);
    sessionStorage.removeItem(SGF_PENDING_CART_INTENT_KEY);
  } catch (err) {
    try { sessionStorage.removeItem(SGF_PENDING_CART_INTENT_KEY); } catch (cleanupErr) {}
    return { added: false };
  }

  if (!intent || !State || typeof State.addToCart !== 'function') return { added: false };
  if (Date.now() - Number(intent.createdAt || 0) > 30 * 60 * 1000) return { added: false, expired: true };

  const food = State.getFoodById ? State.getFoodById(intent.foodId) : null;
  if (!food || food.isActive === false) return { added: false, missing: true };
  const qty = Math.max(1, Math.min(99, Math.floor(Number(intent.qty) || 1)));
  const added = State.addToCart(food, qty, intent.options || null);
  if (added && typeof updateHeader === 'function') updateHeader();
  return added ? { added: true, food, qty } : { added: false };
}

if (typeof window !== 'undefined') {
  window.SGFQueueCartIntent = queueCartIntent;
  window.SGFCompleteQueuedCartIntent = completeQueuedCartIntent;
}

function requireAuth() {
  if (!State.isLoggedIn()) {
    rememberAuthDestination();
    window.location.href = './?notice=login';
    return false;
  }
  return true;
}

/* ──────────────────────────────────────────────────────────
   VALIDATION HELPERS
   ────────────────────────────────────────────────────────── */

/**
 * Password rules (all must pass):
 *  - Minimum 8 characters
 *  - At least 1 uppercase letter (A-Z)
 *  - At least 1 lowercase letter (a-z)
 *  - At least 1 digit (0-9)
 *  - At least 1 special character (!@#$%^&*...)
 */
function validatePassword(pass) {
  const errors = [];
  if (pass.length < 8)                       errors.push(authLang('at least 8 characters'));
  if (!/[A-Z]/.test(pass))                   errors.push(authLang('at least 1 uppercase letter (A-Z)'));
  if (!/[a-z]/.test(pass))                   errors.push(authLang('at least 1 lowercase letter (a-z)'));
  if (!/[0-9]/.test(pass))                   errors.push(authLang('at least 1 number (0-9)'));
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>?\/\\|`~]/.test(pass))
                                             errors.push(authLang('at least 1 special character (e.g. !@#$%^&*)'));
  return errors;
}

/**
 * Password strength score 0-4 for the strength bar
 */
function passwordStrength(pass) {
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[!@#$%^&*()\-_=+\[\]{};:'",.<>?\/\\|`~]/.test(pass)) score++;
  return score;
}

/**
 * Username rules:
 *  - 3–30 characters
 *  - Must contain at least 1 uppercase, 1 lowercase, 1 digit, 1 special char
 *  - Allowed special chars: _ . - @
 */
function validateUsername(u) {
  const errors = [];
  const value = String(u || '').trim();
  if (value.length < 3 || value.length > 30) errors.push(authLang('must be 3-30 characters long'));
  if (/[^a-zA-Z0-9!@#$%^&*_\-.]/.test(value)) errors.push(authLang('only letters, numbers and _ . - @ ! # $ % ^ & * are allowed'));
  return errors;
}

/**
 * Malaysian phone number validation.
 * Accepted formats (normalised to +60...):
 *   +601X-XXXXXXX  (mobile: 011, 012, 013, 014, 015, 016, 017, 018, 019)
 *   +603-XXXXXXXX  (KL landline)
 *   +60X-XXXXXXX   (other state landlines: 03,04,05,06,07,08,09)
 * Length after country code: 7-11 digits.
 */
function validateMalaysianPhone(raw) {
  // Strip spaces, dashes, brackets
  let p = raw.replace(/[\s\-().]/g, '');

  // Normalise leading zeros / country code
  if (p.startsWith('+60'))      p = p;            // already normalised
  else if (p.startsWith('60'))  p = '+' + p;
  else if (p.startsWith('0'))   p = '+6' + p;
  else return { ok: false, msg: authLang('Phone must start with +60, 60, or 0 (Malaysian format).') };

  // Must be +60 followed by 7–11 digits
  if (!/^\+60\d{7,11}$/.test(p))
    return { ok: false, msg: authLang('Invalid Malaysian phone number. Example: +601X-XXXXXXX or +603-XXXXXXXX.') };

  // Mobile numbers start with +601
  const mobile = /^\+601[0-9]\d{7,8}$/.test(p);
  // Landline: +603 (8 digits after), +604/5/6/7/9 (7 digits after)
  const landline = /^\+60[3-9]\d{7,8}$/.test(p);

  if (!mobile && !landline)
    return { ok: false, msg: authLang('Phone number does not match a valid Malaysian mobile (+601X) or landline (+603/04/05/06/07/08/09) format.') };

  return { ok: true, normalised: p };
}

/**
 * Birthday validation:
 *  - Must be a real calendar date
 *  - User must be at least 13 years old (no child accounts)
 *  - User must be at most 110 years old (realistic maximum lifespan)
 */
function parseDateInputLocal(val) {
  const match = String(val || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function yearsBetweenDates(fromDate, toDate) {
  let years = toDate.getFullYear() - fromDate.getFullYear();
  const hasBirthdayPassed =
    toDate.getMonth() > fromDate.getMonth() ||
    (toDate.getMonth() === fromDate.getMonth() && toDate.getDate() >= fromDate.getDate());
  if (!hasBirthdayPassed) years -= 1;
  return years;
}

function validateBirthday(val) {
  if (!val) return { ok: false, msg: authLang('Birthday is required.') };
  const bd = parseDateInputLocal(val);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (!bd) return { ok: false, msg: authLang('Invalid date.') };
  if (bd >= todayStart) return { ok: false, msg: authLang('Birthday cannot be today or a future date.') };

  const ageYears = yearsBetweenDates(bd, todayStart);
  if (ageYears < 13)  return { ok: false, msg: authLang('You must be at least 13 years old to register.') };
  if (ageYears > 110) return { ok: false, msg: authLang('Please enter a realistic birthday (not more than 110 years ago).') };

  return { ok: true };
}

/**
 * Email basic format check
 */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * MMU email domain restriction — enforced at registration.
 * Only @mmu.edu.my (staff) and @student.mmu.edu.my (student) are accepted.
 * Login is not affected: existing accounts can still log in with username,
 * student ID, or email regardless of this check.
 */
const SGF_ALLOWED_AUTH_EMAIL_DOMAINS = ['student.mmu.edu.my', 'mmu.edu.my'];

function getEmailDomain(email) {
  const value = String(email || '').trim().toLowerCase();
  const at = value.lastIndexOf('@');
  return at >= 0 ? value.slice(at + 1) : '';
}

function isAllowedMMUEmail(email) {
  if (!validateEmail(email)) return false;
  const domain = getEmailDomain(email);
  // Only these two exact domains are accepted — staff (@mmu.edu.my) and
  // student (@student.mmu.edu.my). No other subdomain is allowed.
  return SGF_ALLOWED_AUTH_EMAIL_DOMAINS.includes(domain);
}

function validateMMUEmail(email) {
  // Registration is restricted to official MMU email addresses only:
  //   - staff:   name@mmu.edu.my
  //   - student: name@student.mmu.edu.my
  // Login is unaffected by this check — existing accounts can still sign in
  // with their username, student ID, or email regardless of this rule.
  if (!validateEmail(email)) {
    return { ok: false, msg: authLang('Please enter a valid email address.') };
  }
  if (!isAllowedMMUEmail(email)) {
    return { ok: false, msg: authLang('Only MMU emails are accepted: @mmu.edu.my (staff) or @student.mmu.edu.my (student).') };
  }
  return { ok: true };
}


/**
 * Login identifier matcher.
 * Accepts:
 *  - the app username saved during registration
 *  - the full MMU email address
 *  - the stored student ID / matric ID when the profile has one
 *  - the MMU email username/local-part, e.g. "1211101234" for
 *    "1211101234@student.mmu.edu.my"
 */
function normalizeLoginIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function getEmailLocalPart(email) {
  const value = normalizeLoginIdentifier(email);
  const at = value.indexOf('@');
  return at > 0 ? value.slice(0, at) : '';
}

function looksLikeEmailIdentifier(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function collectProfileLoginIds(user) {
  if (!user) return [];
  const ids = [
    user.username,
    user.email,
    getEmailLocalPart(user.email),
    user.studentId,
    user.studentID,
    user.student_id,
    user.mmuId,
    user.mmuID,
    user.mmu_id,
    user.matricId,
    user.matricID,
    user.matric_id
  ];
  if (user.profile && typeof user.profile === 'object') {
    ids.push(
      user.profile.username,
      user.profile.email,
      getEmailLocalPart(user.profile.email),
      user.profile.studentId,
      user.profile.studentID,
      user.profile.student_id,
      user.profile.mmuId,
      user.profile.mmuID,
      user.profile.mmu_id,
      user.profile.matricId,
      user.profile.matricID,
      user.profile.matric_id
    );
  }
  return ids.map(normalizeLoginIdentifier).filter(Boolean);
}

function authUserMatchesIdentifier(user, identifier) {
  const id = normalizeLoginIdentifier(identifier);
  if (!user || !id) return false;
  return collectProfileLoginIds(user).includes(id);
}

/* ──────────────────────────────────────────────────────────
   UNIQUENESS CHECK  (against all registered users)
   ────────────────────────────────────────────────────────── */
function isUsernameTaken(username) {
  const all = State.getAllUsers();
  return Object.values(all).some(u => u.username.toLowerCase() === username.toLowerCase());
}

function isEmailTaken(email) {
  const all = State.getAllUsers();
  return Object.values(all).some(u => u.email.toLowerCase() === email.toLowerCase());
}

/* ──────────────────────────────────────────────────────────
   REGISTER
   ────────────────────────────────────────────────────────── */
async function doRegister(e) {
  e.preventDefault();
  clearFieldErrors();
  setAuthBusy('form-register', true);

  const firstName = g('r-fname').value.trim();
  const lastName  = g('r-lname').value.trim();
  const username  = g('r-username').value.trim();
  const email     = g('r-email').value.trim().toLowerCase();
  const phone     = g('r-phone').value.trim();
  const birthday  = g('r-birthday').value;
  const pass      = g('r-pass').value;
  const cpass     = g('r-cpass').value;

  let hasError = false;

  // ── Name checks ──
  if (!firstName) { setFieldError('r-fname', authLang('First name is required.')); hasError = true; }
  if (!lastName)  { setFieldError('r-lname', authLang('Last name is required.'));  hasError = true; }

  // ── Username ──
  const uErrors = validateUsername(username);
  if (uErrors.length) {
    setFieldError('r-username', authLang('Username ') + uErrors.join('; ') + '.');
    hasError = true;
  } else if (isUsernameTaken(username)) {
    setFieldError('r-username', authLang('This username is already taken. Please choose another.'));
    hasError = true;
  }

  // ── Email ──
  const emailResult = validateMMUEmail(email);
  if (!emailResult.ok) {
    setFieldError('r-email', emailResult.msg);
    hasError = true;
  } else if (isEmailTaken(email)) {
    setFieldError('r-email', authLang('An account with this email already exists. Please login instead.'));
    hasError = true;
  }

  // ── Phone ──
  const phoneResult = validateMalaysianPhone(phone);
  if (!phoneResult.ok) {
    setFieldError('r-phone', phoneResult.msg);
    hasError = true;
  }

  // ── Birthday ──
  const bdResult = validateBirthday(birthday);
  if (!bdResult.ok) {
    setFieldError('r-birthday', bdResult.msg);
    hasError = true;
  }

  // ── Password ──
  const passErrors = validatePassword(pass);
  if (passErrors.length) {
    setFieldError('r-pass', authLang('Password must have: ') + passErrors.join('; ') + '.');
    hasError = true;
  } else if (pass !== cpass) {
    setFieldError('r-cpass', authLang('Passwords do not match.'));
    hasError = true;
  }

  if (hasError) {
    setAuthBusy('form-register', false);
    State.notify(authLang('⚠️ Please fix the errors highlighted below.'));
    const firstErr = document.querySelector('.field-error-msg');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (window.SGFBackend && window.SGFBackend.enabled && typeof window.SGFBackend.findUserByIdentifier === 'function') {
    try {
      const [remoteByUsername, remoteByEmail] = await Promise.all([
        Promise.race([window.SGFBackend.findUserByIdentifier(username), authTimeout(3500, null)]),
        Promise.race([window.SGFBackend.findUserByIdentifier(email), authTimeout(3500, null)])
      ]);
      if (remoteByUsername && String(remoteByUsername.username || '').toLowerCase() === username.toLowerCase()) {
        setFieldError('r-username', authLang('This username is already taken. Please choose another.'));
        setAuthBusy('form-register', false);
        return;
      }
      if (remoteByEmail && String(remoteByEmail.email || '').toLowerCase() === email.toLowerCase()) {
        setFieldError('r-email', authLang('An account with this email already exists. Please login instead.'));
        setAuthBusy('form-register', false);
        return;
      }
    } catch (err) {
      console.warn('[SGF Auth] remote uniqueness check skipped', err);
    }
  }

  // ── All valid — create account ──
  const user = {
    name: firstName + ' ' + lastName,
    firstName, lastName, username,
    email,
    phone: phoneResult.normalised,
    birthday,
    passwordHash: await sgfHashPassword(pass),
    wallet: 0, points: 0, vouchers: [], appliedVoucherIds: [], bdayClaimed: false,
    registeredAt: new Date().toISOString(),
  };

  // Seed per-user local stores before syncing remotely.
  localStorage.setItem(State._userKey(State.K.CART, username), JSON.stringify({}));
  localStorage.setItem(State._userKey(State.K.ORDERS, username), JSON.stringify([]));
  localStorage.setItem('sgf_spin_history_' + username, JSON.stringify([]));

  // Save to all-users registry (for admin + uniqueness checks)
  State.setUser(user);           // also calls _syncUserToAll internally

  let syncWarning = false;
  try {
    if (window.SGFBackend && window.SGFBackend.enabled) {
      await Promise.race([
        (async () => {
          await window.SGFBackend.saveUserByUsername(username);
          await window.SGFBackend.loadCurrentUser(username);
        })(),
        authTimeout(5000, 'timeout')
      ]);
    }
  } catch (err) {
    console.error('[SGF Auth] register sync failed', err);
    syncWarning = true;
  }

  const pendingCart = completeQueuedCartIntent();
  setAuthBusy('form-register', false);
  if (pendingCart.added) {
    State.notify(authLang('🎉 Account created! ') + pendingCart.food.name + authLang(' was added to your cart.'));
  } else {
    State.notify(syncWarning
      ? authLang('🎉 Account created locally. Cloud sync will retry the next time you open the app.')
      : authLang('🎉 Account created! Welcome, ') + firstName + '!');
  }
  setTimeout(() => { window.location.href = pendingCart.added ? 'cart' : getPostAuthDestination('home'); }, 250);
}

/* ──────────────────────────────────────────────────────────
   LOGIN  — must have registered first
   ────────────────────────────────────────────────────────── */
async function doLogin(e) {
  e.preventDefault();
  clearFieldErrors();
  setAuthBusy('form-login', true);

  const rawId = g('l-id').value.trim();
  const id = rawId.toLowerCase();
  const pass = g('l-pass').value;

  if (!id || !pass) {
    setAuthBusy('form-login', false);
    State.notify(authLang('⚠️ Please enter your username, student ID, or MMU email and password.'));
    return;
  }

  // Do not pre-validate the login identifier as an email. Usernames are allowed
  // to contain @, and MMU users may sign in with username, student ID/local-part,
  // or full MMU email. We validate the stored account email only after a match.

  // Find user in registry by username, student ID, full MMU email, OR MMU email local-part.
  // Prefer a direct backend lookup when available so we do not need to load every
  // user's password hash into the browser just to sign in.
  const all = State.getAllUsers();
  let match = Object.values(all).find(u => authUserMatchesIdentifier(u, rawId));

  if (window.SGFBackend && window.SGFBackend.enabled && typeof window.SGFBackend.findUserByIdentifier === 'function') {
    try {
      const remote = await Promise.race([
        window.SGFBackend.findUserByIdentifier(rawId),
        authTimeout(4500, null)
      ]);
      if (remote) match = remote;
      if (!match && rawId !== id) {
        match = await Promise.race([
          window.SGFBackend.findUserByIdentifier(id),
          authTimeout(2500, null)
        ]);
      }
    } catch (err) {
      console.error('[SGF Auth] login direct lookup failed', err);
    }
  }

  if (!match) {
    setAuthBusy('form-login', false);
    setFieldError('l-id', authLang('No account found with this username, student ID, or email. Please register first.'));
    State.notify(authLang('❌ Account not found. Please register first.'));
    return;
  }

  // Important: never block an existing registered account at login because of
  // its stored email domain. Some browsers have only local data and some use
  // the cloud directory, so re-checking the domain here created different
  // results. Once the username/student ID/email matches an account, the next
  // check should be password only.

  const passwordCheck = await sgfVerifyPassword(pass, match.passwordHash);
  if (!passwordCheck.ok) {
    setAuthBusy('form-login', false);
    const message = passwordCheck.needsReset
      ? authLang('This account needs a password reset or re-registration because no password hash was found.')
      : authLang('Incorrect password. Please try again.');
    setFieldError('l-pass', message);
    State.notify(passwordCheck.needsReset ? authLang('❌ Account password data is missing.') : authLang('❌ Incorrect password.'));
    return;
  }

  if (passwordCheck.needsUpgrade) {
    match.passwordHash = await sgfHashPassword(pass);
  }

  // Set the live session
  State.setUser(match);

  try {
    if (window.SGFBackend && window.SGFBackend.enabled) {
      await Promise.race([
        (async () => {
          if (passwordCheck.needsUpgrade && typeof window.SGFBackend.saveUserByUsername === 'function') {
            await window.SGFBackend.saveUserByUsername(match.username);
          }
          await window.SGFBackend.loadCurrentUser(match.username);
          await window.SGFBackend.loadOrders({ username: match.username });
        })(),
        authTimeout(4500, 'timeout')
      ]);
    }
  } catch (err) {
    console.error('[SGF Auth] login sync failed', err);
  }

  const pendingCart = completeQueuedCartIntent();
  setAuthBusy('form-login', false);
  if (pendingCart.added) {
    State.notify(authLang('👋 Welcome back! ') + pendingCart.food.name + authLang(' was added to your cart.'));
  } else {
    State.notify(authLang('👋 Welcome back, ') + (match.firstName || match.name) + '!');
  }
  setTimeout(() => { window.location.href = pendingCart.added ? 'cart' : getPostAuthDestination('home'); }, 200);
}

/** Legacy deterministic hash kept only for backward compatibility with old local demo accounts. */
function simpleHash(str) {
  return sgfLegacyHash(str);
}

/* ──────────────────────────────────────────────────────────
   LOGOUT
   ────────────────────────────────────────────────────────── */
function doLogout() {
  if (!confirm(authLang('Logout from Skibidi GoFood?'))) return;
  State.clearUser();
  window.location.href = './';
}

/* ──────────────────────────────────────────────────────────
   TAB SWITCHING
   ────────────────────────────────────────────────────────── */
function switchTab(tab) {
  const target = tab === 'register' ? 'register' : 'login';
  document.querySelectorAll('.tab-btn').forEach((b) => {
    const selected = b.id === 'tab-' + target;
    b.classList.toggle('active', selected);
    b.setAttribute('aria-selected', String(selected));
    b.setAttribute('tabindex', selected ? '0' : '-1');
  });
  document.querySelectorAll('.auth-form').forEach((f) => {
    const selected = f.id === 'form-' + target;
    f.classList.toggle('active', selected);
    f.hidden = !selected;
    f.querySelectorAll('input, select, textarea, button').forEach((control) => {
      control.disabled = !selected;
    });
  });
  clearFieldErrors();
}

/* ──────────────────────────────────────────────────────────
   INLINE FIELD ERROR HELPERS
   ────────────────────────────────────────────────────────── */
function setFieldError(id, msg) {
  const el = g(id);
  if (!el) return;
  el.classList.add('field-error');
  let errEl = el.parentElement.querySelector('.field-error-msg');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'field-error-msg';
    el.parentElement.appendChild(errEl);
  }
  errEl.textContent = 'Warning: ' + msg;
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
}

/* ──────────────────────────────────────────────────────────
   LIVE VALIDATION & PASSWORD STRENGTH METER
   ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  /* Cross-browser auth consistency: turn off native HTML5 validation and
     use the same JavaScript messages in Chrome, Edge, Firefox, and Safari. */
  document.querySelectorAll('.auth-form').forEach((form) => {
    form.setAttribute('novalidate', 'novalidate');
    form.noValidate = true;
  });
  ['l-id', 'r-email'].forEach((idName) => {
    const field = g(idName);
    if (!field) return;
    field.setAttribute('type', 'text');
    field.setAttribute('autocapitalize', 'none');
    field.setAttribute('spellcheck', 'false');
    field.removeAttribute('pattern');
    field.removeAttribute('title');
    if (typeof field.setCustomValidity === 'function') field.setCustomValidity('');
  });
  const activeRegisterTab = document.getElementById('tab-register');
  switchTab(activeRegisterTab && activeRegisterTab.classList.contains('active') ? 'register' : 'login');

  /* Password strength bar */
  const passEl = g('r-pass');
  if (passEl) {
    passEl.addEventListener('input', () => {
      const val   = passEl.value;
      const score = passwordStrength(val);
      const bar   = g('pass-strength-bar');
      const label = g('pass-strength-label');
      if (!bar || !label) return;

      const levels = authLang(['', 'Weak', 'Fair', 'Good', 'Strong']);
      const colors = ['', '#e74c3c', '#f39c12', '#3498db', '#27ae60'];
      bar.style.width    = (score * 25) + '%';
      bar.style.background = colors[score] || '#ddd';
      label.textContent  = val.length ? levels[score] || 'Weak' : '';
      label.style.color  = colors[score] || '#999';
    });
  }

  /* Live username availability check */
  const unameEl = g('r-username');
  if (unameEl) {
    unameEl.addEventListener('blur', () => {
      const val = unameEl.value.trim();
      if (!val) return;
      const errs = validateUsername(val);
      const hint = g('username-hint');
      if (errs.length) {
        if (hint) { hint.textContent = '✗ ' + errs[0]; hint.style.color = '#e74c3c'; }
      } else if (isUsernameTaken(val)) {
        if (hint) { hint.textContent = authLang('✗ Username already taken.'); hint.style.color = '#e74c3c'; }
      } else {
        if (hint) { hint.textContent = authLang('✓ Username available!'); hint.style.color = '#27ae60'; }
      }
    });
  }

  /* Live email availability check */
  const emailEl = g('r-email');
  if (emailEl) {
    emailEl.addEventListener('blur', () => {
      const val = emailEl.value.trim().toLowerCase();
      if (!val) return;
      const hint = g('email-hint');
      const emailResult = validateMMUEmail(val);
      if (!emailResult.ok) {
        if (hint) { hint.textContent = '✗ ' + emailResult.msg; hint.style.color = '#e74c3c'; }
      } else if (isEmailTaken(val)) {
        if (hint) { hint.textContent = authLang('✗ Email already registered.'); hint.style.color = '#e74c3c'; }
      } else {
        if (hint) { hint.textContent = authLang('✓ Email accepted.'); hint.style.color = '#27ae60'; }
      }
    });
  }

  /* Live phone format hint */
  const phoneEl = g('r-phone');
  if (phoneEl) {
    phoneEl.addEventListener('blur', () => {
      const val  = phoneEl.value.trim();
      const hint = g('phone-hint');
      if (!val) return;
      const res = validateMalaysianPhone(val);
      if (!res.ok) {
        if (hint) { hint.textContent = '✗ ' + res.msg; hint.style.color = '#e74c3c'; }
      } else {
        if (hint) { hint.textContent = authLang('✓ Valid: ') + res.normalised; hint.style.color = '#27ae60'; }
        phoneEl.value = res.normalised; // auto-normalise
      }
    });
  }

  /* Live birthday age check */
  const bdEl = g('r-birthday');
  if (bdEl) {
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    const minDate = new Date(today.getFullYear() - 110, today.getMonth(), today.getDate());
    const toInputDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    bdEl.max = toInputDate(maxDate);
    bdEl.min = toInputDate(minDate);

    bdEl.addEventListener('change', () => {
      const hint = g('birthday-hint');
      const res  = validateBirthday(bdEl.value);
      if (!res.ok) {
        if (hint) { hint.textContent = '✗ ' + res.msg; hint.style.color = '#e74c3c'; }
      } else {
        const parsedBirthday = parseDateInputLocal(bdEl.value);
        const age = parsedBirthday ? yearsBetweenDates(parsedBirthday, new Date()) : '';
        if (hint) { hint.textContent = authLang('✓ Age: ' + age + ' years old'); hint.style.color = '#27ae60'; }
      }
    });
  }

  /* Password match live check */
  const cpassEl = g('r-cpass');
  if (cpassEl && passEl) {
    cpassEl.addEventListener('input', () => {
      const hint = g('cpass-hint');
      if (!hint) return;
      if (cpassEl.value && cpassEl.value !== passEl.value) {
        hint.textContent = authLang('✗ Passwords do not match.'); hint.style.color = '#e74c3c';
      } else if (cpassEl.value) {
        hint.textContent = authLang('✓ Passwords match!'); hint.style.color = '#27ae60';
      } else {
        hint.textContent = '';
      }
    });
  }

  /* Clear field error on user input */
  document.querySelectorAll('.auth-form input').forEach(inp => {
    inp.addEventListener('input', () => {
      inp.classList.remove('field-error');
      const errEl = inp.parentElement.querySelector('.field-error-msg');
      if (errEl) errEl.remove();
    });
  });
});

/* helper */
function g(id) { return document.getElementById(id); }
