// ============================================================
//  state.js — Centralised state via localStorage
//  Enhanced: multi-voucher stacking + admin account support
// ============================================================

// ── Shared safety helpers ──────────────────────────────────
function sgfEscapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sgfEscapeAttr(value) {
  return sgfEscapeHtml(value);
}

function sgfLegacyHash(str) {
  // Kept only to verify and upgrade older local accounts that used simpleHash().
  let hash = 0;
  const input = String(str || '');
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

function sgfBytesToBase64(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  arr.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function sgfBase64ToBytes(base64) {
  const binary = atob(String(base64 || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sgfHashPassword(password, opts = {}) {
  const pass = String(password || '');
  if (!pass) throw new Error('Password is required.');
  if (window.crypto && crypto.subtle && crypto.getRandomValues) {
    const iterations = Number(opts.iterations || 150000);
    const salt = opts.salt ? sgfBase64ToBytes(opts.salt) : crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pass),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return `pbkdf2_sha256$${iterations}$${sgfBytesToBase64(salt)}$${sgfBytesToBase64(new Uint8Array(bits))}`;
  }
  // Old-browser fallback. Modern browsers use PBKDF2 above.
  return `legacy$${sgfLegacyHash(pass)}`;
}

async function sgfVerifyPassword(password, storedHash) {
  const stored = String(storedHash || '').trim();
  if (!stored) return { ok: false, needsReset: true };
  if (stored.startsWith('pbkdf2_sha256$')) {
    const parts = stored.split('$');
    if (parts.length !== 4) return { ok: false };
    const [, iterRaw, salt, expected] = parts;
    const fresh = await sgfHashPassword(password, { iterations: Number(iterRaw), salt });
    const actual = fresh.split('$')[3] || '';
    return { ok: actual === expected };
  }
  if (stored.startsWith('legacy$')) {
    return { ok: stored === `legacy$${sgfLegacyHash(password)}`, needsUpgrade: true };
  }
  // Support old v11 simpleHash values and upgrade them after a successful login.
  return { ok: stored === sgfLegacyHash(password), needsUpgrade: true };
}

function sgfSanitizeProfile(user) {
  const payload = JSON.parse(JSON.stringify(user || {}));
  delete payload.password;
  delete payload.passwordHash;
  delete payload.password_hash;
  delete payload.cart;
  delete payload.spin_history;
  delete payload.spinHistory;
  return payload;
}

const SGF_DEFAULT_ADMIN = Object.freeze({
  username: 'admin',
  // V16: the legacy demo password is no longer stored as plaintext.
  // Real production admin authentication still requires a backend identity provider.
  passwordHash: 'pbkdf2_sha256$150000$U0dGdjE2LWFkbWluLXNhbHQ=$U7NB6U/4ZchjJCD/QOCreuoxq9xiPAA7D8YVzmznXgc=',
});

// ── Voucher rule definitions (single source of truth) ───────
const VOUCHER_RULES = {
  DRINK_FREE: {
    label: 'Free Drink', icon: '🥤',
    desc: 'Get any drink item FREE (up to RM 8.90 value).',
    rules: [
      'Deducts up to RM 8.90 from your cart total.',
      'Applies to items in the "Drinks" category only.',
      'Only 1 Free Drink voucher can be active per order.',
      'Cannot be stacked with a second Free Drink voucher.',
      'Remaining value is non-transferable and non-cashable.',
    ],
    stackable: true, maxPerOrder: 1, category: 'drinks',
    conflictsWith: ['DRINK_FREE'],
  },
  BURGER_FREE: {
    label: 'Free Burger', icon: '🍔',
    desc: 'Get any fast-food item FREE (up to RM 13.90 value).',
    rules: [
      'Deducts up to RM 13.90 from your cart total.',
      'Applicable to any fast-food or burger item.',
      'Cannot be stacked with Birthday Free Burger voucher.',
      'Only 1 Free Burger voucher can be active per order.',
      'Remaining value is non-transferable.',
    ],
    stackable: true, maxPerOrder: 1, category: 'fast food',
    conflictsWith: ['BURGER_FREE', 'BIRTHDAY_BURGER'],
  },
  DISC_10: {
    label: '10% Discount', icon: '🏷️',
    desc: '10% off your entire cart total. Maximum saving: RM 6.',
    rules: [
      'Applies 10% discount to the cart subtotal.',
      'Maximum discount capped at RM 6.',
      'Cannot be stacked with RM 5 Off or Mystery voucher.',
      'Can be combined with Free Drink or Free Burger vouchers.',
      'Percentage is calculated after item-level discounts are applied.',
    ],
    stackable: true, maxPerOrder: 1, category: null,
    conflictsWith: ['DISC_10', 'RM5_OFF', 'MYSTERY'],
  },
  RM5_OFF: {
    label: 'RM 5 Off', icon: '💰',
    desc: 'Flat RM 5 off your total bill. Valid on orders RM 10+.',
    rules: [
      'Deducts exactly RM 5 from the final cart total.',
      'Minimum order value of RM 10 is required.',
      'Cannot be combined with the 10% Discount or Mystery voucher.',
      'Stackable with Free Drink or Free Burger vouchers.',
      'Only 1 RM 5 Off voucher can be active per order.',
    ],
    stackable: true, maxPerOrder: 1, category: null,
    conflictsWith: ['RM5_OFF', 'DISC_10', 'MYSTERY'],
  },
  DBL_PTS: {
    label: '2× Points', icon: '👑',
    desc: 'Earn double loyalty points on your next order.',
    rules: [
      'Doubles all loyalty points earned from this order.',
      'Points are credited after the order is delivered successfully.',
      'Can be stacked with any discount or free-item voucher.',
      'Cannot be combined with a second 2× Points voucher.',
      'Applies to the single next order only — does not carry over.',
    ],
    stackable: true, maxPerOrder: 1, category: null,
    conflictsWith: ['DBL_PTS'],
  },
  MYSTERY: {
    label: 'Mystery Gift', icon: '🎁',
    desc: 'A mystery discount between 5–12% off (max RM 12).',
    rules: [
      'Applies a hidden discount between 5%–12% on your cart total.',
      'Maximum mystery discount capped at RM 12.',
      'Exact discount revealed at checkout summary.',
      'Cannot be stacked with 10% Discount or RM 5 Off voucher.',
      'Only 1 Mystery voucher can be active per order.',
    ],
    stackable: false, maxPerOrder: 1, category: null,
    conflictsWith: ['MYSTERY', 'DISC_10', 'RM5_OFF'],
  },
  BIRTHDAY_BURGER: {
    label: 'Birthday Free Burger', icon: '🎂',
    desc: 'Happy Birthday! One free fast-food item on us (up to RM 13.90).',
    rules: [
      'Granted once per year on your registered birthday.',
      'Deducts up to RM 13.90 from your cart total.',
      'Cannot be combined with a regular Free Burger voucher.',
      'Stackable with discount vouchers (10% Off or RM 5 Off).',
      'Expires 7 days after your birthday if unused.',
    ],
    stackable: true, maxPerOrder: 1, category: 'fast food',
    conflictsWith: ['BIRTHDAY_BURGER', 'BURGER_FREE'],
  },
};

function voucherCompatible(newId, existingIds) {
  const def = VOUCHER_RULES[newId];
  if (!def) return false;
  const blocked = def.conflictsWith || [];
  for (const id of existingIds) {
    if (blocked.includes(id)) return false;
    const exDef = VOUCHER_RULES[id];
    if (exDef && (exDef.conflictsWith || []).includes(newId)) return false;
  }
  return true;
}

function buildVoucherPayload(voucher = {}) {
  const voucherId = String((voucher || {}).id || '').trim();
  const def = VOUCHER_RULES[voucherId] || {};
  const payload = {
    ...(voucher || {}),
    uid: String((voucher || {}).uid || `vch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    id: voucherId,
    label: String((voucher || {}).label || def.label || voucherId || 'Voucher').trim(),
    icon: String((voucher || {}).icon || def.icon || '🎟️').trim(),
    createdAt: (voucher || {}).createdAt || new Date().toISOString(),
  };

  if (voucherId === 'MYSTERY') {
    const existingPct = Number((voucher || {}).mysteryPct);
    const generatedPct = (Math.floor(Math.random() * 8) + 5) / 100;
    payload.mysteryPct = Number((existingPct >= 0.05 && existingPct <= 0.12 ? existingPct : generatedPct).toFixed(2));
  }

  if (voucherId === 'BIRTHDAY_BURGER') {
    const expiresAt = (voucher || {}).expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    payload.expiresAt = expiresAt;
  }

  return payload;
}

const State = {
  K: {
    USER:       'sgf_user',
    CART:       'sgf_cart',
    ORDERS:     'sgf_orders',
    ADMIN:      'sgf_admin_session',
    ADMIN_ACCOUNT: 'sgf_admin_account',
    ALL_USERS:  'sgf_all_users',
    ALL_ORDERS: 'sgf_all_orders',
    MESSAGES:   'sgf_messages',
  },

  _get(key)      { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  _set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
  _del(key)      { localStorage.removeItem(key); },

  _safeUsername(username) {
    return String(username || (this.getUser() || {}).username || 'guest').trim() || 'guest';
  },
  _userKey(baseKey, username) {
    return `${baseKey}_${this._safeUsername(username)}`;
  },

  _normalizeAssetPath(src, fallback = '') {
    if (typeof SGFImagePath === 'function') return SGFImagePath(src, fallback);
    const raw = String(src || '').trim();
    const backup = String(fallback || '').trim();
    const value = raw || backup;
    if (!value) return '';
    if (/^(javascript|vbscript|file|blob):/i.test(value) || (/^data:/i.test(value) && !/^data:image\//i.test(value))) {
      return backup && backup !== raw ? this._normalizeAssetPath(backup, '') : '';
    }
    if (/^data:image\//i.test(value) || /^(https?:)?\/\//i.test(value)) return value;
    return value
      .replace(/-100(?:%25|%)?\.webp(?=([?#]|$))/i, '.webp')
      .replace(/\.(?:png|svg|jpe?g|gif)(?=([?#]|$))/i, '.webp');
  },

  _normalizeRecordImages(record) {
    if (!record || typeof record !== 'object') return false;
    let changed = false;
    ['img', 'logo', 'bLogo', 'avatar'].forEach((key) => {
      if (!record[key]) return;
      const clean = this._normalizeAssetPath(record[key]);
      if (clean && clean !== record[key]) {
        record[key] = clean;
        changed = true;
      }
    });
    return changed;
  },

  /* ── Auth ── */
  isLoggedIn()  { return !!this._get(this.K.USER); },
  isAdmin()     {
    const session = this._get(this.K.ADMIN);
    if (!session || !session.username || !session.expiresAt) return false;
    if (Number(session.expiresAt) <= Date.now()) {
      this.logoutAdmin();
      return false;
    }
    return true;
  },
  getAdminUsername() {
    const session = this._get(this.K.ADMIN);
    return session && this.isAdmin() ? session.username : '';
  },
  hasAdminAccount() {
    return true;
  },
  async createAdminAccount() {
    this.logoutAdmin();
    return { ok: false, msg: 'Local administrator creation is disabled. Use the original administrator credentials.' };
  },
  async verifyAdminCredentials(username, password) {
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '');

    if (cleanUsername.toLowerCase() === SGF_DEFAULT_ADMIN.username.toLowerCase()) {
      const verified = await sgfVerifyPassword(cleanPassword, SGF_DEFAULT_ADMIN.passwordHash);
      if (verified && verified.ok) return { ok: true, username: SGF_DEFAULT_ADMIN.username };
    }

    return { ok: false, msg: 'Invalid admin credentials.' };
  },
  getUser()     {
    const user = this._get(this.K.USER);
    if (!user) return null;
    let changed = false;
    if (user.avatar) {
      const cleanAvatar = this._normalizeAssetPath(user.avatar, 'images/user-avatar.webp');
      if (cleanAvatar !== user.avatar) {
        user.avatar = cleanAvatar;
        changed = true;
      }
    }
    if (typeof this._ensureVoucherState === 'function') {
      changed = this._ensureVoucherState(user) || changed;
    }
    if (typeof this._refreshMembershipForUser === 'function') {
      const result = this._refreshMembershipForUser(user);
      changed = !!(result && result.changed) || changed;
    }
    if (changed) {
      this._set(this.K.USER, user);
      this._syncUserToAll(user);
    }
    return user;
  },
  setUser(u)    {
    if (u && typeof u === 'object' && u.avatar) u.avatar = this._normalizeAssetPath(u.avatar, 'images/user-avatar.webp');
    this._set(this.K.USER, u);
    this._syncUserToAll(u);
  },
  clearUser()   { this._del(this.K.USER); },
  loginAdmin(username) {
    const account = this._get(this.K.ADMIN_ACCOUNT) || {};
    const sessionUser = String(username || account.username || 'admin').trim() || 'admin';
    this._set(this.K.ADMIN, {
      username: sessionUser,
      signedInAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });
  },
  logoutAdmin() { this._del(this.K.ADMIN); },

  /* ── Multi-user registry ── */
  _syncUserToAll(u) {
    if (!u || !u.username) return;
    const all = this._get(this.K.ALL_USERS) || {};
    all[u.username] = u;
    this._set(this.K.ALL_USERS, all);
  },
  getAllUsers() { return this._get(this.K.ALL_USERS) || {}; },
  _findUserRegistryKey(username, allUsers = null) {
    const all = allUsers || this.getAllUsers();
    const raw = String(username || '').trim();
    if (raw && Object.prototype.hasOwnProperty.call(all, raw)) return raw;
    const target = this._safeUsername(raw);
    return Object.keys(all).find((candidate) => {
      return candidate === raw || this._safeUsername(candidate) === target;
    }) || '';
  },
  updateUserByAdmin(username, changes) {
    const all = this.getAllUsers();
    const target = this._safeUsername ? this._safeUsername(username) : String(username || '').trim();
    const key = this._findUserRegistryKey(username, all);
    if (!key || !all[key]) return false;

    const safeChanges = { ...(changes || {}) };
    if (Object.prototype.hasOwnProperty.call(safeChanges, 'points')) {
      const pts = Number.parseInt(safeChanges.points, 10);
      if (!Number.isFinite(pts) || pts < 0) return false;
      safeChanges.points = pts;
    }
    if (Object.prototype.hasOwnProperty.call(safeChanges, 'wallet')) {
      const wallet = Number.parseFloat(safeChanges.wallet);
      if (!Number.isFinite(wallet) || wallet < 0) return false;
      safeChanges.wallet = Number(wallet.toFixed(2));
    }

    Object.assign(all[key], safeChanges);
    this._set(this.K.ALL_USERS, all);
    const cu = this.getUser();
    if (cu && (cu.username === key || (this._safeUsername && this._safeUsername(cu.username) === target))) {
      Object.assign(cu, safeChanges);
      this._set(this.K.USER, cu);
    }
    return true;
  },
  creditWalletToUser(username, amount) {
    const safeUsername = this._safeUsername(username);
    const credit = Number(amount) || 0;
    if (credit <= 0) return false;
    const all = this.getAllUsers();
    const key = this._findUserRegistryKey(username, all);
    if (!key || !all[key]) return false;
    all[key].wallet = Number(((Number(all[key].wallet) || 0) + credit).toFixed(2));
    this._set(this.K.ALL_USERS, all);
    const cu = this.getUser();
    if (cu && this._safeUsername(cu.username) === safeUsername) {
      cu.wallet = Number(((Number(cu.wallet) || 0) + credit).toFixed(2));
      this._set(this.K.USER, cu);
    }
    return true;
  },
  deleteUserByAdmin(username) {
    const all = this.getAllUsers();
    const key = this._findUserRegistryKey(username, all);
    if (!key || !all[key]) return false;
    delete all[key];
    this._set(this.K.ALL_USERS, all);
    this._del(this._userKey(this.K.CART, key));
    this._del(this._userKey(this.K.ORDERS, key));
    const safeKey = this._safeUsername(key);
    const filteredOrders = this.getAllOrders().filter(o => this._safeUsername(o.username) !== safeKey);
    this._set(this.K.ALL_ORDERS, filteredOrders);
    const filteredMessages = this.getMessages().filter(m => this._safeUsername(m.username) !== safeKey);
    this._set(this.K.MESSAGES, filteredMessages);
    const cu = this.getUser();
    if (cu && this._safeUsername(cu.username) === safeKey) this.clearUser();
    return true;
  },
  addVoucherToUser(username, voucher) {
    const all = this.getAllUsers();
    const key = this._findUserRegistryKey(username, all);
    if (!key || !all[key]) return false;
    const payload = buildVoucherPayload(voucher);
    if (!all[key].vouchers) all[key].vouchers = [];
    if (!Array.isArray(all[key].appliedVoucherIds)) all[key].appliedVoucherIds = [];
    all[key].vouchers.push(payload);
    this._set(this.K.ALL_USERS, all);
    const cu = this.getUser();
    if (cu && this._safeUsername(cu.username) === this._safeUsername(key)) {
      if (!cu.vouchers) cu.vouchers = [];
      if (!Array.isArray(cu.appliedVoucherIds)) cu.appliedVoucherIds = [];
      cu.vouchers.push(payload);
      this._ensureVoucherState(cu);
      this._set(this.K.USER, cu);
    }
    return true;
  },

  /* ── All Orders registry ── */
  getAllOrders() { return this._get(this.K.ALL_ORDERS) || []; },
  _saveOrderGlobal(order, username) {
    const all = Array.isArray(this._get(this.K.ALL_ORDERS)) ? this._get(this.K.ALL_ORDERS) : [];
    const safeUsername = this._safeUsername(username);
    const cleanOrder = order && typeof order === 'object' ? { ...order, username: safeUsername } : { username: safeUsername };
    const orderId = String(cleanOrder.id || '').trim();
    if (!orderId) return false;
    const existingIdx = all.findIndex((entry) => entry && String(entry.id) === orderId && this._safeUsername(entry.username) === safeUsername);
    if (existingIdx >= 0) all.splice(existingIdx, 1);
    all.unshift(cleanOrder);
    this._set(this.K.ALL_ORDERS, all);
    return true;
  },
  syncUserOrderStatus(username, orderId, newStatus, extra = {}) {
    const safeUsername = this._safeUsername(username);
    const key = this._userKey(this.K.ORDERS, safeUsername);
    const userOrders = this._get(key) || [];
    let updated = false;
    userOrders.forEach(o => {
      if (String(o.id) === String(orderId)) {
        Object.assign(o, { status: newStatus }, extra || {});
        updated = true;
      }
    });
    if (updated) this._set(key, userOrders);

    const all = this.getAllOrders();
    let globalUpdated = false;
    all.forEach(o => {
      if (this._safeUsername(o.username) === safeUsername && String(o.id) === String(orderId)) {
        Object.assign(o, { status: newStatus }, extra || {});
        globalUpdated = true;
      }
    });
    if (globalUpdated) this._set(this.K.ALL_ORDERS, all);
  },
  updateOrderStatus(orderId, newStatus, username = null) {
    const safeUsername = username ? this._safeUsername(username) : null;
    const all = this.getAllOrders();
    let targetUser = safeUsername;
    let updatedOrder = null;
    let previousStatus = null;

    all.forEach(o => {
      if (String(o.id) !== String(orderId)) return;
      const orderUser = this._safeUsername(o.username || '');
      if (safeUsername && orderUser !== safeUsername) return;
      if (!targetUser && orderUser) targetUser = orderUser;

      previousStatus = o.status;

      const extra = {};
      const isCancelling = String(newStatus || '').toLowerCase() === 'cancelled';
      const wasCancelled = String(o.status || '').toLowerCase() === 'cancelled';
      const isCashOrder = String(o.method || '').toLowerCase() === 'cash';
      const refundAmount = Number(o.total) || 0;

      if (isCancelling && !wasCancelled && !o.refunded && !isCashOrder && refundAmount > 0 && targetUser) {
        if (this.creditWalletToUser(targetUser, refundAmount)) {
          extra.refunded = true;
          extra.refundAmount = refundAmount;
          extra.refundedAt = new Date().toISOString();
          extra.refundTarget = 'wallet';
          extra.refundReason = 'admin_cancelled';
        }
      }

      Object.assign(o, { status: newStatus }, extra);
      updatedOrder = { ...o };
    });

    if (!updatedOrder) return { ok: false };
    this._set(this.K.ALL_ORDERS, all);
    if (targetUser) {
      this.syncUserOrderStatus(targetUser, orderId, newStatus, {
        refunded: !!updatedOrder.refunded,
        refundAmount: Number(updatedOrder.refundAmount) || 0,
        refundedAt: updatedOrder.refundedAt || null,
        refundTarget: updatedOrder.refundTarget || null,
        refundReason: updatedOrder.refundReason || null,
      });
    }

    return {
      ok: true,
      order: updatedOrder,
      username: updatedOrder.username || targetUser,
      refunded: !!(updatedOrder.refunded && String(previousStatus || '').toLowerCase() !== 'cancelled' && String(newStatus || '').toLowerCase() === 'cancelled'),
      refundAmount: Number(updatedOrder.refundAmount) || 0,
      refundTarget: updatedOrder.refundTarget || null,
    };
  },

  /* ── User sub-fields ── */
  _mu(fn) { const u = this.getUser(); if (!u) return; fn(u); this.setUser(u); },

  _ensureVoucherState(user) {
    if (!user) return false;
    let changed = false;
    if (!Array.isArray(user.vouchers)) {
      user.vouchers = [];
      changed = true;
    }
    if (!Array.isArray(user.appliedVoucherIds)) {
      user.appliedVoucherIds = [];
      changed = true;
    }

    user.vouchers = user.vouchers.map((voucher) => {
      const normalised = buildVoucherPayload(voucher || {});
      const keys = new Set([...Object.keys(voucher || {}), ...Object.keys(normalised)]);
      for (const key of keys) {
        if (JSON.stringify((voucher || {})[key]) !== JSON.stringify(normalised[key])) {
          changed = true;
          break;
        }
      }
      return normalised;
    });

    const now = Date.now();
    const beforeInventory = user.vouchers.length;
    user.vouchers = user.vouchers.filter((voucher) => {
      if (voucher.id === 'BIRTHDAY_BURGER' && voucher.expiresAt) {
        const expiryMs = new Date(voucher.expiresAt).getTime();
        if (expiryMs && expiryMs < now) {
          changed = true;
          return false;
        }
      }
      return true;
    });
    if (beforeInventory !== user.vouchers.length) changed = true;

    const validIds = new Set(user.vouchers.map((voucher) => voucher.uid));
    const filteredApplied = user.appliedVoucherIds.filter((uid) => validIds.has(uid));
    if (filteredApplied.length !== user.appliedVoucherIds.length) changed = true;
    user.appliedVoucherIds = filteredApplied;
    return changed;
  },

  getPoints()    { return (this.getUser() || {}).points   || 0; },
  getWallet()    { return (this.getUser() || {}).wallet   || 0; },
  getVoucherInventory() {
    const user = this.getUser();
    if (!user) return [];
    this._ensureVoucherState(user);
    return Array.isArray(user.vouchers) ? user.vouchers : [];
  },
  getVouchers()  {
    const user = this.getUser();
    if (!user) return [];
    this._ensureVoucherState(user);
    const inventory = Array.isArray(user.vouchers) ? user.vouchers : [];
    const appliedIds = Array.isArray(user.appliedVoucherIds) ? user.appliedVoucherIds : [];
    return appliedIds.map((uid) => inventory.find((voucher) => voucher.uid === uid)).filter(Boolean);
  },
  getDefaultAddress() { return ((this.getUser() || {}).defaultAddress || '').trim(); },
  getSavedAddress() { return this.getDefaultAddress(); },

  addPoints(n)   {
    const delta = Math.floor(Number(n));
    if (!Number.isFinite(delta) || delta <= 0) return false;
    this._mu(u => { u.points = Math.max(0, Math.floor(Number(u.points) || 0) + delta); });
    return true;
  },
  addWallet(n)   {
    const delta = Number(n);
    if (!Number.isFinite(delta) || delta <= 0) return false;
    this._mu(u => { u.wallet = Number(((Number(u.wallet) || 0) + delta).toFixed(2)); });
    return true;
  },
  saveDefaultAddress(address) {
    const cleaned = String(address || '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
    this._mu(u => { u.defaultAddress = cleaned; });
  },
  setSavedAddress(address) {
    this.saveDefaultAddress(address);
  },
  clearSavedAddress() {
    this._mu(u => { delete u.defaultAddress; });
  },
  validateMalaysiaAddress(raw) {
    const cleaned = String(raw || '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
    if (!cleaned) return { ok: false, msg: 'Please enter your delivery address.' };
    if (cleaned.length < 15) return { ok: false, msg: 'Address is too short.' };
    if (!/malaysia$/i.test(cleaned)) return { ok: false, msg: 'Address must end with Malaysia.' };
    if (!/\b\d{5}\b/.test(cleaned)) return { ok: false, msg: 'Address must include a valid 5-digit Malaysian postcode.' };
    const hasState = /(kuala lumpur|selangor|johor|pulau pinang|penang|perak|kedah|kelantan|terengganu|pahang|negeri sembilan|melaka|sabah|sarawak|perlis|putrajaya|labuan|wilayah persekutuan)/i.test(cleaned);
    if (!hasState) return { ok: false, msg: 'Address must include a Malaysian state or federal territory.' };
    const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length < 4) {
      return { ok: false, msg: 'Use full format, for example: street, area, postcode city, state, Malaysia.' };
    }
    return { ok: true, normalised: cleaned };
  },

  deductPoints(n) {
    const amount = Math.floor(Number(n));
    if (!Number.isFinite(amount)) return false;
    if (amount <= 0) return true;
    const u = this.getUser();
    const current = Math.floor(Number(u && u.points) || 0);
    if (!u || current < amount) return false;
    u.points = Math.max(0, current - amount);
    this.setUser(u);
    return true;
  },
  deductWallet(n) {
    const amount = Number(n);
    if (!Number.isFinite(amount)) return false;
    if (amount <= 0) return true;
    const u = this.getUser();
    const current = Number((u && u.wallet) || 0);
    const charge = Number(amount.toFixed(2));
    if (!u || current + 1e-9 < charge) return false;
    u.wallet = Number(Math.max(0, current - charge).toFixed(2));
    this.setUser(u);
    return true;
  },

  /* ── Birthday reward state (once per calendar year) ── */
  getBdayClaimedYear() {
    const u = this.getUser() || {};
    if (typeof u.bdayClaimedYear === 'number') return u.bdayClaimedYear;
    if (u.bdayClaimed === true) return new Date().getFullYear();
    return null;
  },
  isBdayClaimed() {
    return this.getBdayClaimedYear() === new Date().getFullYear();
  },
  setBdayClaimed(year = new Date().getFullYear()) {
    this._mu(u => {
      u.bdayClaimedYear = year;
      delete u.bdayClaimed; // migrate away from the legacy boolean flag
    });
  },

  /* ── Multi-voucher management ── */
  addVoucher(v) {
    this._mu((u) => {
      this._ensureVoucherState(u);
      u.vouchers.push(buildVoucherPayload(v));
    });
  },
  clearVouchers() {
    this._mu((u) => {
      this._ensureVoucherState(u);
      u.appliedVoucherIds = [];
    });
  },
  removeVoucherByIndex(idx) {
    this._mu((u) => {
      this._ensureVoucherState(u);
      if (Array.isArray(u.appliedVoucherIds)) u.appliedVoucherIds.splice(idx, 1);
    });
  },
  applyVoucher(uid) {
    const user = this.getUser();
    if (!user) return { ok: false, reason: 'Please log in first.' };
    this._ensureVoucherState(user);
    const voucher = (user.vouchers || []).find((entry) => entry.uid === uid);
    if (!voucher) return { ok: false, reason: 'Voucher not found in your account.' };
    if ((user.appliedVoucherIds || []).includes(uid)) {
      return { ok: false, reason: `"${voucher.label}" is already applied.` };
    }
    const check = this.canAddVoucher(voucher.id);
    if (!check.ok) return check;
    user.appliedVoucherIds.push(uid);
    this.setUser(user);
    return { ok: true, voucher };
  },
  unapplyVoucher(uid) {
    const user = this.getUser();
    if (!user) return false;
    this._ensureVoucherState(user);
    const before = user.appliedVoucherIds.length;
    user.appliedVoucherIds = user.appliedVoucherIds.filter((entryUid) => entryUid !== uid);
    if (before === user.appliedVoucherIds.length) return false;
    this.setUser(user);
    return true;
  },
  consumeAppliedVouchers() {
    const user = this.getUser();
    if (!user) return [];
    this._ensureVoucherState(user);
    const appliedIds = new Set(user.appliedVoucherIds || []);
    const consumed = (user.vouchers || []).filter((voucher) => appliedIds.has(voucher.uid));
    user.vouchers = (user.vouchers || []).filter((voucher) => !appliedIds.has(voucher.uid));
    user.appliedVoucherIds = [];
    this.setUser(user);
    return consumed;
  },

  canAddVoucher(newVid) {
    const existing = this.getVouchers().map(v => v.id);
    const def = VOUCHER_RULES[newVid];
    if (!def) return { ok: false, reason: 'Unknown voucher type.' };
    const sameType = existing.filter(id => id === newVid).length;
    if (sameType >= (def.maxPerOrder || 1)) {
      return { ok: false, reason: `You already have a "${def.label}" voucher applied.` };
    }
    if (!voucherCompatible(newVid, existing)) {
      const conflicts = (def.conflictsWith || []).filter(c => existing.includes(c));
      const names = conflicts.map(c => VOUCHER_RULES[c] ? VOUCHER_RULES[c].label : c).join(', ');
      return { ok: false, reason: `Conflicts with applied voucher: ${names}.` };
    }
    return { ok: true };
  },

  getDiscountBreakdown(subtotal, items = null, vouchers = null) {
    const safeSubtotal = Math.max(0, Number(subtotal) || 0);
    const cartItems = Array.isArray(items) && items.length ? items : this.getCartItems();
    const appliedVouchers = Array.isArray(vouchers) ? vouchers : this.getVouchers();
    if (!appliedVouchers.length) return { total: 0, details: [] };

    const bestSingleItemByCategory = cartItems.reduce((acc, item) => {
      const category = String(item.cat || '').toLowerCase();
      const unitPrice = Math.max(0, Number(item.price) || 0);
      acc[category] = Math.max(Number(acc[category] || 0), unitPrice);
      return acc;
    }, {});

    const priority = {
      DRINK_FREE: 1,
      BURGER_FREE: 1,
      BIRTHDAY_BURGER: 1,
      DISC_10: 2,
      RM5_OFF: 2,
      MYSTERY: 2,
      DBL_PTS: 3,
    };

    const orderedVouchers = [...appliedVouchers].sort((a, b) => {
      const aRank = priority[String((a || {}).id || '').toUpperCase()] || 99;
      const bRank = priority[String((b || {}).id || '').toUpperCase()] || 99;
      return aRank - bRank;
    });

    let total = 0;
    let pctApplied = false;
    const details = [];

    for (const voucher of orderedVouchers) {
      const remaining = Math.max(0, safeSubtotal - total);
      let amount = 0;
      let reason = '';
      let eligibleValue = 0;

      if (voucher.id === 'DRINK_FREE') {
        eligibleValue = Number(bestSingleItemByCategory.drinks || 0);
        amount = Math.min(remaining, eligibleValue, 8.9);
        reason = amount > 0 ? 'Applied to one drink item only.' : 'Add a drink item to use this voucher.';
      } else if (voucher.id === 'BURGER_FREE' || voucher.id === 'BIRTHDAY_BURGER') {
        eligibleValue = Number(bestSingleItemByCategory['fast food'] || 0);
        amount = Math.min(remaining, eligibleValue, 13.9);
        reason = amount > 0 ? 'Applied to one fast-food item only.' : 'Add a fast-food item to use this voucher.';
      } else if (voucher.id === 'DISC_10' && !pctApplied) {
        amount = Math.min(remaining * 0.1, 6);
        pctApplied = amount > 0;
        reason = '10% off applied after free-item vouchers, capped at RM 6.';
      } else if (voucher.id === 'RM5_OFF') {
        amount = safeSubtotal >= 10 ? Math.min(remaining, 5) : 0;
        reason = amount > 0 ? 'Flat RM 5 off applied.' : 'Requires a subtotal of at least RM 10.';
      } else if (voucher.id === 'MYSTERY') {
        const mysteryPct = Number(voucher.mysteryPct || 0.1);
        amount = Math.min(remaining * mysteryPct, 12);
        reason = `${Math.round(mysteryPct * 100)}% mystery discount applied, capped at RM 12.`;
      } else if (voucher.id === 'DBL_PTS') {
        reason = 'No price discount. This voucher doubles points after delivery.';
      }

      amount = Number(Math.max(0, amount).toFixed(2));
      total += amount;
      details.push({
        voucher,
        amount,
        reason,
        eligibleValue: Number(eligibleValue.toFixed ? eligibleValue.toFixed(2) : eligibleValue) || 0,
      });
    }

    return {
      total: Number(Math.min(total, safeSubtotal).toFixed(2)),
      details,
    };
  },

  /* ── Multi-voucher discount calculation ── */
  getDiscount(subtotal, items = null) {
    return this.getDiscountBreakdown(subtotal, items).total;
  },

  isDoublePoints() { return this.getVouchers().some(v => v.id === 'DBL_PTS'); },

  /* ── Cart (user-scoped with legacy fallback) ── */
  getCart() {
    const key = this._userKey(this.K.CART);
    const scoped = this._get(key);
    const cart = scoped && typeof scoped === 'object' ? scoped : {};
    let changed = false;
    Object.values(cart).forEach((item) => {
      changed = this._normalizeRecordImages(item) || changed;
    });
    if (changed) this._set(key, cart);
    return cart;
  },
  setCart(c) {
    const key = this._userKey(this.K.CART);
    const cart = c && typeof c === 'object' ? c : {};
    Object.values(cart).forEach((item) => this._normalizeRecordImages(item));
    this._set(key, cart);
  },
  clearCart() {
    const key = this._userKey(this.K.CART);
    this._set(key, {});
  },
  addToCart(food, qty = 1) {
    const cart = this.getCart();
    if (!cart[food.id]) cart[food.id] = { ...food, qty: 0 };
    cart[food.id].qty += qty;
    this.setCart(cart);
  },
  updateQty(id, qty) {
    const cart = this.getCart();
    if (!cart[id]) return;
    if (qty <= 0) delete cart[id];
    else cart[id].qty = qty;
    this.setCart(cart);
  },
  removeItem(id)  { const cart = this.getCart(); delete cart[id]; this.setCart(cart); },
  getCartItems()  { return Object.values(this.getCart()).filter(i => i && (Number(i.qty) || 0) > 0); },
  getCartCount()  { return this.getCartItems().reduce((s, i) => s + Math.max(0, Math.floor(Number(i.qty) || 0)), 0); },
  getCartSubtotal() { return Number(this.getCartItems().reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0).toFixed(2)); },

  /* ── Orders (user-scoped with legacy fallback) ── */
  getOrders() {
    const username = this._safeUsername();
    const key = this._userKey(this.K.ORDERS, username);
    const scoped = this._get(key);
    const globalForUser = this.getAllOrders().filter(o => this._safeUsername(o.username) === username);
    if (globalForUser.length) {
      if (JSON.stringify(scoped || []) !== JSON.stringify(globalForUser)) {
        this._set(key, globalForUser);
      }
      return globalForUser;
    }
    return Array.isArray(scoped) ? scoped : [];
  },
  addOrder(order) {
    const username = this._safeUsername();
    const os = Array.isArray(this._get(this._userKey(this.K.ORDERS, username))) ? this._get(this._userKey(this.K.ORDERS, username)) : [];
    const fallbackId = `ORD-${String(username || 'guest').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'GUEST'}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const userOrder = {
      refunded: false,
      refundAmount: 0,
      refundedAt: null,
      refundTarget: null,
      refundReason: null,
      ...order,
      id: order && order.id ? order.id : fallbackId,
      username,
    };
    os.unshift(userOrder);
    this._set(this._userKey(this.K.ORDERS, username), os);
    this._saveOrderGlobal(userOrder, username);
  },

  /* ── Contact messages ── */
  getMessages() {
    return this._get(this.K.MESSAGES) || [];
  },
  addMessage(payload) {
    const messages = this.getMessages();
    const currentUser = this.getUser();
    const activePlan = this.getActiveMembershipPlan(currentUser);
    const supportPriority = this.getSupportPriority(currentUser);
    const msg = {
      id: 'MSG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      username: this._safeUsername((payload || {}).username),
      name: String((payload || {}).name || '').trim(),
      phone: String((payload || {}).phone || '').trim(),
      email: String((payload || {}).email || '').trim().toLowerCase(),
      message: String((payload || {}).message || '').trim(),
      createdAt: new Date().toISOString(),
      read: false,
      supportPriority,
      membershipPlanId: activePlan.id,
      membershipPlanName: activePlan.name,
      accountType: this.getEffectiveAccountType(currentUser),
    };
    messages.unshift(msg);
    this._set(this.K.MESSAGES, messages);
    return msg;
  },
  markMessageRead(id, read = true) {
    const messages = this.getMessages();
    let updated = false;
    messages.forEach(m => {
      if (String(m.id) === String(id)) {
        m.read = !!read;
        updated = true;
      }
    });
    if (updated) this._set(this.K.MESSAGES, messages);
    return updated;
  },
  deleteMessage(id) {
    const messages = this.getMessages();
    const filtered = messages.filter(m => String(m.id) !== String(id));
    if (filtered.length === messages.length) return false;
    this._set(this.K.MESSAGES, filtered);
    return true;
  },
  getUnreadMessageCount() {
    return this.getMessages().filter(m => !m.read).length;
  },

  /* ── Toast ── */
  _ntTimer: null,
  notify(msg, ms = 3200) {
    const el = document.getElementById('notif');
    if (!el) return;
    el.textContent = String(msg == null ? '' : msg);
    el.classList.add('show');
    clearTimeout(this._ntTimer);
    this._ntTimer = setTimeout(() => el.classList.remove('show'), ms);
  },
};

const __SGF_ORIGINAL_UPDATE_ORDER_STATUS = State.updateOrderStatus.bind(State);

// ============================================================
//  Extended platform helpers for restaurant management,
//  delivery assignments, recommendations, reviews and
//  product customisation.
// ============================================================


State.K.REVIEWS = 'sgf_reviews';
State.K.BRANDS_DATA = 'sgf_brands_data';
State.K.FOODS_DATA = 'sgf_foods_data';
State.K.SETTINGS = 'sgf_settings';
State.K.ADMIN_ALERTS = 'sgf_admin_alerts';

const MEMBERSHIP_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const MEMBERSHIP_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    billing: 'No payment',
    description: 'Basic student ordering with rewards and standard support.',
    perks: ['Budget menu access', 'Regular checkout and live tracking', 'Voucher redemption and birthday rewards'],
    features: {
      supportPriority: 'standard',
      pointsMultiplier: 1,
      etaReductionMin: 0,
      dealLabel: 'No paid student deal',
    },
  },
  plus: {
    id: 'plus',
    name: 'Student Saver',
    price: 6.9,
    billing: '30 days access',
    description: 'Best for MMU Melaka students who order a few times a week.',
    perks: [
      'Priority support for class-break orders',
      'Student deal: 5% off each order (cap RM 3)',
      'Priority order handling and +20% points',
    ],
    features: {
      supportPriority: 'priority',
      memberDiscountPct: 0.05,
      memberDiscountCap: 3,
      pointsMultiplier: 1.2,
      etaReductionMin: 3,
      dealLabel: 'Student Saver deal',
      trackingLabel: 'Student priority tracking',
    },
  },
  office: {
    id: 'office',
    name: 'Study Group',
    price: 12.9,
    billing: '30 days access',
    description: 'Built for housemates, clubs, and assignment nights.',
    perks: [
      'Campus-group label while the plan is active',
      'Group order deal: 10% off orders with 4+ items (cap RM 8)',
      'Priority group assistance and +35% points',
    ],
    features: {
      supportPriority: 'office-priority',
      bulkDiscountPct: 0.10,
      bulkDiscountCap: 8,
      bulkOrderMinQty: 4,
      pointsMultiplier: 1.35,
      etaReductionMin: 6,
      forceAccountType: 'corporate',
      dealLabel: 'Study Group deal',
      trackingLabel: 'Study group priority tracking',
    },
  },
};

Object.assign(State, {
  _clone(value) {
    return JSON.parse(JSON.stringify(value));
  },

  _mutateUserEverywhere(username, mutator) {
    const target = this._safeUsername(username);
    if (!target || target === 'guest' || typeof mutator !== 'function') return false;

    let changed = false;
    const all = this.getAllUsers ? this.getAllUsers() : {};
    const registryKey = this._findUserRegistryKey ? this._findUserRegistryKey(target, all) : target;
    if (registryKey && all[registryKey]) {
      mutator(all[registryKey]);
      all[registryKey].updatedAt = new Date().toISOString();
      this._set(this.K.ALL_USERS, all);
      changed = true;
    }

    const current = this.getUser ? this.getUser() : null;
    if (current && this._safeUsername(current.username) === target) {
      mutator(current);
      current.updatedAt = new Date().toISOString();
      this._set(this.K.USER, current);
      this._syncUserToAll(current);
      changed = true;
    }

    return changed;
  },

  _catalogClampNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER, decimals = null) {
    const numeric = Number(value);
    const baseFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : min;
    const raw = Number.isFinite(numeric) ? numeric : baseFallback;
    const safeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
    const safeMax = Number.isFinite(Number(max)) ? Number(max) : Number.MAX_SAFE_INTEGER;
    const bounded = Math.min(safeMax, Math.max(safeMin, raw));
    return decimals == null ? bounded : Number(bounded.toFixed(decimals));
  },

  _catalogNormalizePriceLevel(value, fallback = '$$') {
    const raw = String(value == null ? '' : value).trim();
    if (['$', '$$', '$$$'].includes(raw)) return raw;
    const dollars = raw.match(/\$+/g);
    if (dollars && dollars[0]) {
      return '$'.repeat(Math.min(3, Math.max(1, dollars[0].length)));
    }
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) {
      return '$'.repeat(Math.min(3, Math.max(1, Math.round(numeric))));
    }
    return ['$', '$$', '$$$'].includes(fallback) ? fallback : '$$';
  },

  _catalogParseEtaRange(value, fallbackMin = 20, fallbackMax = 30) {
    let min = Number(fallbackMin);
    let max = Number(fallbackMax);
    if (!Number.isFinite(min)) min = 20;
    if (!Number.isFinite(max)) max = 30;

    const numbers = String(value == null ? '' : value).match(/\d+/g);
    if (numbers && numbers.length) {
      min = Number(numbers[0]);
      max = Number(numbers[1] || numbers[0]);
    }

    min = Math.round(this._catalogClampNumber(min, 20, 5, 180, 0));
    max = Math.round(this._catalogClampNumber(max, Math.max(min, 30), 5, 180, 0));
    if (max < min) max = min;
    return {
      min,
      max,
      text: `${min}${max !== min ? `-${max}` : ''} min`,
    };
  },

  _normalizeBrandCatalogRecord(brand = {}) {
    const eta = this._catalogParseEtaRange(brand.eta, 20, 30);
    const rawId = String(brand.id || brand.name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    const id = rawId || `brand-${Math.random().toString(36).slice(2, 8)}`;
    const name = String(brand.name || id).trim().slice(0, 80) || id;
    return {
      ...brand,
      id,
      name,
      tag: String(brand.tag || brand.cuisine || 'Restaurant').trim().slice(0, 60) || 'Restaurant',
      special: String(brand.special || '').trim().slice(0, 140),
      logo: this._normalizeAssetPath(brand.logo, `images/${id}.webp`),
      location: String(brand.location || '').trim().slice(0, 220),
      cuisine: String(brand.cuisine || brand.tag || 'Restaurant').trim().slice(0, 60) || 'Restaurant',
      rating: this._catalogClampNumber(brand.rating, 4.5, 0, 5, 1),
      priceLevel: this._catalogNormalizePriceLevel(brand.priceLevel, '$$'),
      eta: eta.text,
      minOrder: Math.round(this._catalogClampNumber(brand.minOrder, 0, 0, 9999, 0)),
    };
  },

  _normalizeFoodCatalogRecord(food = {}) {
    const price = this._catalogClampNumber(food.price, 0, 0, 9999, 2);
    const derivedPriceLevel = price >= 20 ? '$$$' : (price >= 10 ? '$$' : '$');
    const allowedCategories = ['fast food', 'pizza', 'drinks', 'dessert'];
    const rawCat = String(food.cat || 'fast food').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const catAliases = { fastfood: 'fast food', burger: 'fast food', burgers: 'fast food', beverage: 'drinks', beverages: 'drinks', drink: 'drinks', desserts: 'dessert', pizzas: 'pizza' };
    const cat = allowedCategories.includes(rawCat) ? rawCat : (catAliases[rawCat] || 'fast food');
    const rawId = Number(food.id);
    const id = Number.isFinite(rawId) && rawId > 0 ? Math.floor(rawId) : Date.now() + Math.floor(Math.random() * 1000);
    const brand = String(food.brand || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'custom';
    const name = String(food.name || 'Menu item').trim().slice(0, 90) || 'Menu item';
    const brandRecord = this.getBrandById && brand !== 'custom' ? this.getBrandById(brand) : null;
    return {
      ...food,
      id,
      brand,
      bName: String(food.bName || (brandRecord && brandRecord.name) || brand).trim().slice(0, 80),
      name,
      cat,
      img: this._normalizeAssetPath(food.img, 'images/food-burger.webp'),
      bLogo: this._normalizeAssetPath(food.bLogo || (brandRecord && brandRecord.logo), 'images/logo.webp'),
      price,
      popularity: Math.round(this._catalogClampNumber(food.popularity, 50, 0, 100, 0)),
      rating: this._catalogClampNumber(food.rating, 4.5, 0, 5, 1),
      priceLevel: derivedPriceLevel,
      pts: Math.round(this._catalogClampNumber(food.pts, Math.max(1, price), 0, 9999, 0)),
      badge: food.badge == null ? null : String(food.badge).trim().slice(0, 24),
      isActive: food.isActive !== false,
      customization: food.customization && typeof food.customization === 'object' ? food.customization : ((typeof CUSTOMIZATION_LIBRARY !== 'undefined' && CUSTOMIZATION_LIBRARY[cat]) || null),
    };
  },

  getBrandsData() {
    const stored = this._get(this.K.BRANDS_DATA);
    if (Array.isArray(stored) && stored.length) {
      const normalized = stored.map((brand) => this._normalizeBrandCatalogRecord(brand));
      if (JSON.stringify(normalized) !== JSON.stringify(stored)) this._set(this.K.BRANDS_DATA, normalized);
      return normalized;
    }
    const seededSource = Array.isArray(typeof BRANDS !== 'undefined' ? BRANDS : []) ? BRANDS : [];
    const seeded = this._clone(seededSource).map((brand) => this._normalizeBrandCatalogRecord(brand));
    this._set(this.K.BRANDS_DATA, seeded);
    return seeded;
  },

  setBrandsData(brands) {
    const safeBrands = (Array.isArray(brands) ? brands : []).map((brand) => this._normalizeBrandCatalogRecord(brand));
    this._set(this.K.BRANDS_DATA, safeBrands);
  },

  getFoodsData() {
    const stored = this._get(this.K.FOODS_DATA);
    if (Array.isArray(stored) && stored.length) {
      const normalized = stored.map((food) => this._normalizeFoodCatalogRecord(food));
      if (JSON.stringify(normalized) !== JSON.stringify(stored)) this._set(this.K.FOODS_DATA, normalized);
      return normalized;
    }
    const seededSource = Array.isArray(typeof FOODS !== 'undefined' ? FOODS : []) ? FOODS : [];
    const seeded = this._clone(seededSource).map((food) => this._normalizeFoodCatalogRecord(food));
    this._set(this.K.FOODS_DATA, seeded);
    return seeded;
  },

  setFoodsData(foods) {
    const safeFoods = (Array.isArray(foods) ? foods : []).map((food) => this._normalizeFoodCatalogRecord(food));
    this._set(this.K.FOODS_DATA, safeFoods);
  },

  resetCatalog() {
    this.setBrandsData(this._clone(typeof BRANDS !== 'undefined' ? BRANDS : []));
    this.setFoodsData(this._clone(typeof FOODS !== 'undefined' ? FOODS : []));
  },

  getBrandById(id) {
    return this.getBrandsData().find((brand) => String(brand.id) === String(id));
  },

  getFoodById(id) {
    return this.getFoodsData().find((food) => String(food.id) === String(id));
  },

  updateBrandByAdmin(id, changes) {
    const brands = this.getBrandsData();
    const brand = brands.find((b) => String(b.id) === String(id));
    if (!brand) return false;
    Object.assign(brand, changes || {});
    this.setBrandsData(brands);
    return true;
  },

  updateFoodByAdmin(id, changes) {
    const foods = this.getFoodsData();
    const food = foods.find((f) => String(f.id) === String(id));
    if (!food) return false;
    Object.assign(food, changes || {});
    this.setFoodsData(foods);
    return true;
  },

  getAvailableDrivers() {
    return this._clone(typeof DEFAULT_DRIVERS !== 'undefined' ? DEFAULT_DRIVERS : []);
  },

  getFaqs() {
    return this._clone(typeof DEFAULT_FAQS !== 'undefined' ? DEFAULT_FAQS : []);
  },

  setUserAvatar(dataUrl) {
    const cleaned = String(dataUrl || '').trim();
    this._mu((u) => {
      if (cleaned) u.avatar = cleaned;
      else delete u.avatar;
    });
    this.syncReviewAuthorProfile(null, {
      avatar: cleaned || 'images/user-avatar.webp',
      name: ((this.getUser() || {}).name || '').trim(),
    });
    return true;
  },

  syncReviewAuthorProfile(username = null, profile = {}) {
    const target = this._safeUsername(username);
    if (!target || target === 'guest') return [];
    const reviews = this._get(this.K.REVIEWS) || [];
    if (!Array.isArray(reviews) || !reviews.length) return [];

    const hasAvatar = Object.prototype.hasOwnProperty.call(profile || {}, 'avatar');
    const cleanAvatar = this._normalizeAssetPath((profile || {}).avatar, 'images/user-avatar.webp');
    const cleanName = String((profile || {}).name || '').trim();
    let changed = false;
    const updated = [];

    const nextReviews = reviews.map((review) => {
      if (!review || typeof review !== 'object' || this._safeUsername(review.username) !== target) return review;
      const next = { ...review };
      if (hasAvatar && next.img !== cleanAvatar) {
        next.img = cleanAvatar;
        changed = true;
      }
      if (cleanName && next.name !== cleanName) {
        next.name = cleanName;
        changed = true;
      }
      updated.push(next);
      return next;
    });

    if (changed) this._set(this.K.REVIEWS, nextReviews);
    return updated;
  },

  getUserAvatar() {
    return this._normalizeAssetPath((this.getUser() || {}).avatar, 'images/user-avatar.webp');
  },

  getMembershipPlans() {
    return Object.values(MEMBERSHIP_PLANS).map((plan) => ({ ...plan, features: { ...(plan.features || {}) } }));
  },

  getMembershipPlan(planId) {
    return MEMBERSHIP_PLANS[String(planId || 'free').toLowerCase()] || MEMBERSHIP_PLANS.free;
  },

  _sortMembershipEntries(entries = []) {
    return [...entries].sort((a, b) => {
      const rank = { active: 0, queued: 1, expired: 2 };
      const statusDiff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (statusDiff) return statusDiff;
      if (a.status === 'queued') {
        const priceDiff = (Number(b.price) || 0) - (Number(a.price) || 0);
        if (priceDiff) return priceDiff;
      }
      if (a.status === 'expired') {
        return new Date(b.endedAt || b.expiresAt || 0).getTime() - new Date(a.endedAt || a.expiresAt || 0).getTime();
      }
      return new Date(a.purchasedAt || 0).getTime() - new Date(b.purchasedAt || 0).getTime();
    });
  },

  _syncLegacyMembershipFields(user) {
    const activeEntry = Array.isArray(user.memberships) ? user.memberships.find((entry) => entry.status === 'active') : null;
    const queuedEntries = Array.isArray(user.memberships) ? this._sortMembershipEntries(user.memberships.filter((entry) => entry.status === 'queued')) : [];
    user.plan = activeEntry ? activeEntry.planId : 'free';
    if (activeEntry) {
      user.membershipStatus = 'active';
      user.membershipPaidAt = activeEntry.activatedAt || activeEntry.purchasedAt || new Date().toISOString();
      user.membershipExpiresAt = activeEntry.expiresAt || null;
    } else {
      delete user.membershipStatus;
      delete user.membershipPaidAt;
      delete user.membershipExpiresAt;
    }
    user.membershipQueue = queuedEntries.map((entry) => ({
      id: entry.id,
      planId: entry.planId,
      purchasedAt: entry.purchasedAt,
      remainingMs: Math.max(0, Number(entry.remainingMs) || 0),
      price: Number(entry.price) || 0,
    }));
  },

  _refreshMembershipForUser(user, nowMs = Date.now()) {
    if (!user) return { changed: false, activeEntry: null, queuedEntries: [], entries: [] };
    let changed = false;

    if (!Array.isArray(user.memberships)) {
      user.memberships = [];
      if (user.plan && user.plan !== 'free') {
        const legacyPlan = this.getMembershipPlan(user.plan);
        const legacyExpiresMs = new Date(user.membershipExpiresAt || 0).getTime();
        const legacyRemaining = Math.max(0, legacyExpiresMs - nowMs);
        if (legacyPlan.id !== 'free' && legacyRemaining > 0) {
          user.memberships.push({
            id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            planId: legacyPlan.id,
            status: 'active',
            purchasedAt: user.membershipPaidAt || new Date(nowMs).toISOString(),
            activatedAt: user.membershipPaidAt || new Date(nowMs).toISOString(),
            expiresAt: new Date(nowMs + legacyRemaining).toISOString(),
            remainingMs: legacyRemaining,
            durationMs: MEMBERSHIP_DURATION_MS,
            price: legacyPlan.price,
          });
        }
      }
      changed = true;
    }

    const entries = Array.isArray(user.memberships) ? user.memberships : [];
    entries.forEach((entry) => {
      const plan = this.getMembershipPlan(entry.planId);
      if (!plan || plan.id === 'free') {
        entry.status = 'expired';
        entry.remainingMs = 0;
        changed = true;
        return;
      }
      if (!entry.id) { entry.id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; changed = true; }
      if (!entry.purchasedAt) { entry.purchasedAt = new Date(nowMs).toISOString(); changed = true; }
      entry.planId = plan.id;
      entry.price = plan.price;
      entry.durationMs = Number(entry.durationMs) || MEMBERSHIP_DURATION_MS;

      if (entry.status === 'active') {
        const expiresMs = new Date(entry.expiresAt || 0).getTime();
        const remainingMs = Math.max(0, expiresMs - nowMs);
        entry.remainingMs = remainingMs;
        if (remainingMs <= 0) {
          entry.status = 'expired';
          entry.remainingMs = 0;
          entry.endedAt = entry.expiresAt || new Date(nowMs).toISOString();
          delete entry.expiresAt;
          changed = true;
        }
      } else if (entry.status === 'queued') {
        const remainingMs = Math.max(1, Number(entry.remainingMs) || entry.durationMs || MEMBERSHIP_DURATION_MS);
        if (entry.remainingMs !== remainingMs) changed = true;
        entry.remainingMs = remainingMs;
        delete entry.expiresAt;
        delete entry.activatedAt;
      } else if (entry.status !== 'expired') {
        entry.status = 'queued';
        entry.remainingMs = Math.max(1, Number(entry.remainingMs) || entry.durationMs || MEMBERSHIP_DURATION_MS);
        delete entry.expiresAt;
        delete entry.activatedAt;
        changed = true;
      }
    });

    let activeEntry = entries.find((entry) => entry.status === 'active') || null;
    let queuedEntries = this._sortMembershipEntries(entries.filter((entry) => entry.status === 'queued'));
    const strongestQueued = queuedEntries[0] || null;

    if (activeEntry && strongestQueued && (Number(strongestQueued.price) || 0) > (Number(activeEntry.price) || 0)) {
      const remainingMs = Math.max(1, new Date(activeEntry.expiresAt || 0).getTime() - nowMs);
      activeEntry.status = 'queued';
      activeEntry.remainingMs = remainingMs;
      delete activeEntry.expiresAt;
      delete activeEntry.activatedAt;
      activeEntry = null;
      queuedEntries = this._sortMembershipEntries(entries.filter((entry) => entry.status === 'queued'));
      changed = true;
    }

    if (!activeEntry && queuedEntries.length) {
      const next = queuedEntries[0];
      const remainingMs = Math.max(1, Number(next.remainingMs) || next.durationMs || MEMBERSHIP_DURATION_MS);
      next.status = 'active';
      next.activatedAt = new Date(nowMs).toISOString();
      next.expiresAt = new Date(nowMs + remainingMs).toISOString();
      next.remainingMs = remainingMs;
      activeEntry = next;
      changed = true;
    }

    user.memberships = this._sortMembershipEntries(entries);
    this._syncLegacyMembershipFields(user);
    return {
      changed,
      activeEntry: activeEntry || null,
      queuedEntries: this._sortMembershipEntries(user.memberships.filter((entry) => entry.status === 'queued')),
      entries: user.memberships,
    };
  },

  refreshMembershipState() {
    const user = this._get(this.K.USER);
    if (!user) return null;
    const result = this._refreshMembershipForUser(user);
    if (result && result.changed) this.setUser(user);
    return this.getMembershipOverview(user);
  },

  getMembershipOverview(user = null) {
    const targetUser = user || this.getUser();
    if (!targetUser) {
      return {
        activePlan: this.getMembershipPlan('free'),
        activeEntry: null,
        queuedPlans: [],
        paidEntries: [],
        accountType: 'personal',
        supportPriority: 'standard',
      };
    }
    const state = this._refreshMembershipForUser(targetUser);
    const activeEntry = state.activeEntry || null;
    const activePlan = activeEntry ? this.getMembershipPlan(activeEntry.planId) : this.getMembershipPlan('free');
    const queuedPlans = (state.queuedEntries || []).map((entry) => ({
      ...entry,
      plan: this.getMembershipPlan(entry.planId),
      remainingDays: Math.ceil(Math.max(0, Number(entry.remainingMs) || 0) / 86400000),
    }));
    const paidEntries = (state.entries || []).filter((entry) => ['active', 'queued'].includes(entry.status)).map((entry) => ({
      ...entry,
      plan: this.getMembershipPlan(entry.planId),
    }));
    return {
      activePlan,
      activeEntry,
      queuedPlans,
      paidEntries,
      accountType: this.getEffectiveAccountType(targetUser),
      supportPriority: this.getSupportPriority(targetUser),
    };
  },

  getActiveMembershipEntry(user = null) {
    return this.getMembershipOverview(user).activeEntry || null;
  },

  getActiveMembershipPlan(user = null) {
    return this.getMembershipOverview(user).activePlan || this.getMembershipPlan('free');
  },

  hasMembershipPlan(planId, statuses = ['active', 'queued'], user = null) {
    const targetUser = user || this.getUser();
    if (!targetUser) return false;
    this._refreshMembershipForUser(targetUser);
    return (targetUser.memberships || []).some((entry) => statuses.includes(entry.status) && String(entry.planId) === String(planId));
  },

  getMembershipCountdown(user = null) {
    const activeEntry = this.getActiveMembershipEntry(user);
    if (!activeEntry || !activeEntry.expiresAt) {
      return { active: false, remainingMs: 0, remainingDays: 0, label: 'No paid membership running' };
    }
    const remainingMs = Math.max(0, new Date(activeEntry.expiresAt).getTime() - Date.now());
    const days = Math.floor(remainingMs / 86400000);
    const hours = Math.floor((remainingMs % 86400000) / 3600000);
    return {
      active: true,
      remainingMs,
      remainingDays: Math.ceil(remainingMs / 86400000),
      label: `${days}d ${hours}h left`,
    };
  },

  getEffectiveAccountType(user = null) {
    const targetUser = user || this.getUser();
    if (!targetUser) return 'personal';
    const membershipState = this._refreshMembershipForUser(targetUser);
    const activeEntry = membershipState.activeEntry || null;
    const activePlan = activeEntry ? this.getMembershipPlan(activeEntry.planId) : this.getMembershipPlan('free');
    return activePlan.features && activePlan.features.forceAccountType ? activePlan.features.forceAccountType : (targetUser.accountType || 'personal');
  },

  getSupportPriority(user = null) {
    const targetUser = user || this.getUser();
    if (!targetUser) return 'standard';
    const membershipState = this._refreshMembershipForUser(targetUser);
    const activeEntry = membershipState.activeEntry || null;
    const activePlan = activeEntry ? this.getMembershipPlan(activeEntry.planId) : this.getMembershipPlan('free');
    return (activePlan.features && activePlan.features.supportPriority) || 'standard';
  },

  getMembershipDeal(subtotal = 0, items = [], user = null) {
    const targetUser = user || this.getUser();
    const plan = this.getActiveMembershipPlan(targetUser);
    const features = plan.features || {};
    const safeSubtotal = Math.max(0, Number(subtotal) || 0);
    const totalQty = (Array.isArray(items) ? items : []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    let amount = 0;
    let label = '';
    let desc = '';

    if (features.memberDiscountPct) {
      amount = Math.min(safeSubtotal * Number(features.memberDiscountPct || 0), Number(features.memberDiscountCap) || safeSubtotal);
      label = features.dealLabel || `${plan.name} deal`;
      desc = `${Math.round(Number(features.memberDiscountPct || 0) * 100)}% off member deal`;
    } else if (features.bulkDiscountPct && totalQty >= (Number(features.bulkOrderMinQty) || 0)) {
      amount = Math.min(safeSubtotal * Number(features.bulkDiscountPct || 0), Number(features.bulkDiscountCap) || safeSubtotal);
      label = features.dealLabel || `${plan.name} deal`;
      desc = `${Math.round(Number(features.bulkDiscountPct || 0) * 100)}% off bulk order`;
    }

    return {
      plan,
      amount: Number(amount.toFixed(2)),
      label,
      desc,
      eligible: amount > 0,
      requirement: features.bulkDiscountPct && totalQty < (Number(features.bulkOrderMinQty) || 0)
        ? `Add ${Math.max(0, (Number(features.bulkOrderMinQty) || 0) - totalQty)} more item(s) to unlock the bulk-order deal.`
        : '',
    };
  },

  getMembershipPointsMultiplier(user = null) {
    const plan = this.getActiveMembershipPlan(user);
    return Number((plan.features && plan.features.pointsMultiplier) || 1);
  },

  getMembershipEtaReduction(user = null) {
    const plan = this.getActiveMembershipPlan(user);
    return Number((plan.features && plan.features.etaReductionMin) || 0);
  },

  getMembershipEta(baseEta, user = null) {
    return Math.max(10, Math.round((Number(baseEta) || 0) - this.getMembershipEtaReduction(user)));
  },

  purchaseMembershipPlan(planId) {
    const plan = this.getMembershipPlan(planId);
    const user = this.getUser();
    if (!user) return { ok: false, msg: 'Please log in first.' };
    if (!plan || plan.id === 'free') {
      return { ok: false, msg: 'Free plan is already included by default.' };
    }

    const membershipState = this.getMembershipOverview(user);
    if (membershipState.paidEntries.some((entry) => entry.plan.id === plan.id)) {
      const sameEntry = membershipState.paidEntries.find((entry) => entry.plan.id === plan.id);
      return { ok: false, msg: sameEntry && sameEntry.status === 'active' ? `${plan.name} is already active.` : `${plan.name} is already queued.` };
    }

    const wallet = Number(user.wallet) || 0;
    if (wallet < plan.price) {
      return { ok: false, msg: `Need RM ${plan.price.toFixed(2)} in your wallet to buy ${plan.name}.` };
    }

    user.wallet = Number((wallet - plan.price).toFixed(2));
    if (!Array.isArray(user.memberships)) user.memberships = [];
    const now = Date.now();
    user.memberships.push({
      id: `mem-${now}-${Math.random().toString(36).slice(2, 8)}`,
      planId: plan.id,
      status: 'queued',
      purchasedAt: new Date(now).toISOString(),
      remainingMs: MEMBERSHIP_DURATION_MS,
      durationMs: MEMBERSHIP_DURATION_MS,
      price: plan.price,
    });

    const refreshed = this._refreshMembershipForUser(user, now);
    this.setUser(user);
    const activeEntry = refreshed.activeEntry || null;
    const activePlan = activeEntry ? this.getMembershipPlan(activeEntry.planId) : this.getMembershipPlan('free');
    const queued = activePlan.id !== plan.id;
    return {
      ok: true,
      plan,
      charged: plan.price,
      queued,
      activePlan,
      activeEntry,
      expiresAt: activeEntry && activeEntry.planId === plan.id ? activeEntry.expiresAt : null,
      queue: this.getMembershipOverview(user).queuedPlans,
    };
  },

  getCart() {
    const raw = this._get(this._userKey(this.K.CART)) || {};
    const migrated = {};
    let changed = false;
    Object.keys(raw || {}).forEach((oldKey) => {
      const item = raw[oldKey];
      if (!item || typeof item !== 'object' || item.id == null) { changed = true; return; }
      const liveFood = this.getFoodById(item.id) || item;
      if (!liveFood || liveFood.isActive === false) { changed = true; return; }
      const rawQty = Math.floor(Number(item.qty));
      if (!Number.isFinite(rawQty) || rawQty <= 0) { changed = true; return; }
      const qty = Math.min(99, rawQty);
      const options = item.options ? this._normaliseOptions(liveFood, item.options) : this._normaliseOptions(liveFood, {});
      const key = item.cartKey && String(item.cartKey).includes('::') ? String(item.cartKey) : this._buildCartKey(liveFood.id, options);
      if (key !== oldKey || qty !== Number(item.qty) || Number(item.price) !== options.unitPrice) changed = true;
      if (!migrated[key]) {
        migrated[key] = {
          ...liveFood,
          id: liveFood.id,
          cartKey: key,
          qty: 0,
          basePrice: Number(liveFood.price) || 0,
          options,
          price: options.unitPrice,
        };
      }
      migrated[key].qty = Math.min(99, migrated[key].qty + qty);
    });
    if (Object.keys(migrated).length !== Object.keys(raw || {}).length) changed = true;
    if (changed) this.setCart(migrated);
    return migrated;
  },

  getCartItems() {
    return Object.values(this.getCart()).filter((item) => item && Number(item.qty) > 0 && Number(item.price) >= 0);
  },

  _buildCartKey(foodId, options = {}) {
    const size = options.size || '';
    const spice = options.spice || '';
    const addons = Array.isArray(options.addons) ? [...options.addons].sort() : [];
    return `${foodId}::${size}::${spice}::${addons.join('|')}`;
  },

  _normaliseOptions(food, options = {}) {
    const cfg = (food || {}).customization || {};
    const sizes = Array.isArray(cfg.sizes) ? cfg.sizes : [];
    const addonsCfg = Array.isArray(cfg.addons) ? cfg.addons : [];
    const spiceCfg = Array.isArray(cfg.spice) ? cfg.spice.map((v) => String(v || '').trim()).filter(Boolean) : [];
    const requestedSize = String((options || {}).size || '').trim();
    const sizeObj = sizes.find((s) => String(s.label) === requestedSize) || sizes[0] || { label: 'Regular', price: 0 };
    const requestedSpice = String((options || {}).spice || '').trim();
    const spice = spiceCfg.includes(requestedSpice) ? requestedSpice : (spiceCfg[0] || 'Original');
    const allowedAddons = new Map(addonsCfg.map((addon) => [String(addon.label || '').trim(), addon]));
    const addons = [];
    (Array.isArray((options || {}).addons) ? options.addons : []).forEach((label) => {
      const clean = String(label || '').trim();
      if (clean && allowedAddons.has(clean) && !addons.includes(clean)) addons.push(clean);
    });
    const addonTotal = addons.reduce((sum, label) => {
      const found = allowedAddons.get(label);
      return sum + (found ? Number(found.price) || 0 : 0);
    }, 0);
    const sizePrice = Number(sizeObj.price) || 0;
    const unitPrice = Number(((Number(food.price) || 0) + sizePrice + addonTotal).toFixed(2));
    return {
      size: String(sizeObj.label || 'Regular'),
      spice,
      addons,
      addonTotal: Number(addonTotal.toFixed(2)),
      sizePrice: Number(sizePrice.toFixed(2)),
      unitPrice,
      summary: [sizeObj.label, spice, ...addons].filter(Boolean).join(' · '),
    };
  },

  addToCart(food, qty = 1, options = null) {
    if (!food || typeof food !== 'object' || food.id == null) return false;
    const liveFood = this.getFoodById(food.id) || food;
    if (!liveFood || liveFood.isActive === false) return false;
    const amount = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
    const normalised = this._normaliseOptions(liveFood, options || {});
    const cart = this.getCart();
    const cartKey = this._buildCartKey(liveFood.id, normalised);
    if (!cart[cartKey]) {
      cart[cartKey] = {
        ...liveFood,
        id: liveFood.id,
        cartKey,
        qty: 0,
        basePrice: Number(liveFood.price) || 0,
        options: normalised,
        price: normalised.unitPrice,
      };
    }
    cart[cartKey].qty = Math.min(99, Math.max(0, Math.floor(Number(cart[cartKey].qty) || 0)) + amount);
    cart[cartKey].price = normalised.unitPrice;
    cart[cartKey].options = normalised;
    this.setCart(cart);
    return true;
  },

  _resolveCartKey(cart, id) {
    if (!cart || typeof cart !== 'object') return '';
    const raw = String(id == null ? '' : id);
    if (Object.prototype.hasOwnProperty.call(cart, raw)) return raw;
    return Object.keys(cart).find((key) => {
      const item = cart[key];
      return item && String(item.id) === raw;
    }) || '';
  },

  updateQty(id, qty) {
    const cart = this.getCart();
    const key = this._resolveCartKey(cart, id);
    if (!key || !cart[key]) return false;
    const cleanQty = Math.floor(Number(qty));
    if (!Number.isFinite(cleanQty)) return false;
    if (cleanQty <= 0) delete cart[key];
    else cart[key].qty = Math.min(99, cleanQty);
    this.setCart(cart);
    return true;
  },

  removeItem(id) {
    const cart = this.getCart();
    const key = this._resolveCartKey(cart, id);
    if (!key) return false;
    delete cart[key];
    this.setCart(cart);
    return true;
  },

  getCartSubtotal() {
    return Number(this.getCartItems().reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0).toFixed(2));
  },

  _mutateOrder(orderId, username, mutator) {
    const safeUsername = username ? this._safeUsername(username) : null;
    const orders = this.getAllOrders();
    let found = null;
    orders.forEach((order) => {
      if (String(order.id) !== String(orderId)) return;
      if (safeUsername && this._safeUsername(order.username) !== safeUsername) return;
      mutator(order);
      found = this._clone(order);
    });
    if (!found) return null;
    this._set(this.K.ALL_ORDERS, orders);
    const key = this._userKey(this.K.ORDERS, found.username);
    const scoped = this._get(key) || [];
    let matchedScoped = false;
    const synced = scoped.map((order) => {
      if (String(order.id) !== String(orderId)) return order;
      matchedScoped = true;
      return this._clone(found);
    });
    if (!matchedScoped) synced.unshift(this._clone(found));
    this._set(key, synced);
    return found;
  },

  addOrder(order = {}) {
    const rawOrder = order && typeof order === 'object' ? order : {};
    const username = this._safeUsername();
    const allowedStatuses = ['pending', 'preparing', 'on the way', 'delivered', 'cancelled'];
    const requestedStatus = String(rawOrder.status || 'pending').trim().toLowerCase();
    const status = allowedStatuses.includes(requestedStatus) ? requestedStatus : 'pending';
    const cleanEta = Math.round(Number(rawOrder.etaMin));
    const etaMin = Math.min(120, Math.max(10, Number.isFinite(cleanEta) && cleanEta > 0 ? cleanEta : (22 + Math.floor(Math.random() * 18))));
    const placedAtMs = new Date(rawOrder.placedAt || '').getTime();
    const placedAt = Number.isFinite(placedAtMs) ? new Date(placedAtMs).toISOString() : new Date().toISOString();
    const rawId = String(rawOrder.id || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    const orderId = rawId || `ORD-${String(username || 'guest').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'GUEST'}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const displayDate = String(rawOrder.date || new Date(placedAt).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }));
    const cleanItems = Array.isArray(rawOrder.items) ? rawOrder.items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: item.id,
        name: String(item.name || 'Menu item').trim().slice(0, 90) || 'Menu item',
        brand: String(item.brand || '').trim().slice(0, 40),
        bName: String(item.bName || item.brand || '').trim().slice(0, 80),
        cat: String(item.cat || '').trim().slice(0, 40),
        options: item.options && typeof item.options === 'object' ? {
          size: String(item.options.size || '').trim().slice(0, 40),
          spice: String(item.options.spice || '').trim().slice(0, 40),
          addons: Array.isArray(item.options.addons) ? item.options.addons.map((addon) => String(addon || '').trim()).filter(Boolean).slice(0, 8) : [],
          summary: String(item.options.summary || '').trim().slice(0, 180),
        } : null,
        qty: Math.min(99, Math.max(1, Math.floor(Number(item.qty) || 1))),
        price: Math.max(0, Number(Number(item.price) || 0).toFixed(2)),
        pts: Math.max(0, Math.floor(Number(item.pts) || 0)),
      })) : [];
    const computedSubtotal = Number(cleanItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0).toFixed(2));
    // Always derive financial totals from the sanitized line items so imported,
    // edited, or malicious order payloads cannot create impossible totals.
    const cleanSubtotal = computedSubtotal;
    const cleanDiscount = Math.min(cleanSubtotal, Math.max(0, Number(Number(rawOrder.discount) || 0).toFixed(2)));
    const cleanTotal = Math.max(0, Number((cleanSubtotal - cleanDiscount).toFixed(2)));
    const cleanMethod = ['wallet', 'cash', 'card', 'online-banking'].includes(String(rawOrder.method || '').trim().toLowerCase()) ? String(rawOrder.method).trim().toLowerCase() : 'wallet';
    const cleanAddress = String(rawOrder.address || 'Campus pickup point').trim().slice(0, 240) || 'Campus pickup point';
    const computedPoints = cleanItems.reduce((sum, item) => sum + (Number(item.pts) || 0) * (Number(item.qty) || 0), 0);
    const cleanPointsToAward = Math.max(0, Math.min(9999, Math.floor(Number(rawOrder.pointsToAward) || computedPoints || 0)));
    const cleanHistory = Array.isArray(rawOrder.statusHistory) && rawOrder.statusHistory.length
      ? rawOrder.statusHistory.filter(Boolean).map((entry) => ({
          status: allowedStatuses.includes(String(entry.status || '').trim().toLowerCase()) ? String(entry.status || '').trim().toLowerCase() : status,
          note: String(entry.note || ''),
          at: Number.isFinite(new Date(entry.at || '').getTime()) ? new Date(entry.at).toISOString() : placedAt,
        }))
      : [{ status, note: status === 'pending' ? 'Order placed successfully.' : `Order imported as ${status}.`, at: placedAt }];
    const userOrder = {
      refunded: false,
      refundAmount: 0,
      refundedAt: null,
      refundTarget: null,
      refundReason: null,
      etaMin,
      driver: null,
      deliveryNote: 'Kitchen has received your order.',
      rating: 0,
      reviewText: '',
      ratedAt: null,
      reviewPromptPending: false,
      vouchersRestored: false,
      pointsAwarded: false,
      pointsStatus: 'pending',
      pointsToAward: cleanPointsToAward,
      delayedAlertSent: false,
      delayedAlertAt: null,
      customerWaitNotifiedAt: null,
      placedAt,
      date: displayDate,
      method: cleanMethod,
      address: cleanAddress,
      statusHistory: cleanHistory,
      ...rawOrder,
      id: orderId,
      username,
      status,
      etaMin,
      placedAt,
      date: displayDate,
      items: cleanItems,
      subtotal: cleanSubtotal,
      total: cleanTotal,
      discount: cleanDiscount,
      method: cleanMethod,
      address: cleanAddress,
      pointsToAward: cleanPointsToAward,
      statusHistory: cleanHistory,
    };
    const key = this._userKey(this.K.ORDERS, username);
    const scoped = Array.isArray(this._get(key)) ? this._get(key) : [];
    const existingIdx = scoped.findIndex((entry) => entry && String(entry.id) === String(userOrder.id));
    if (existingIdx >= 0) scoped.splice(existingIdx, 1);
    scoped.unshift(userOrder);
    this._set(key, scoped);
    this._saveOrderGlobal(userOrder, username);
    return userOrder;
  },

  _pushStatusHistory(order, status, note) {
    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    order.statusHistory.unshift({ status, note: note || '', at: new Date().toISOString() });
  },

  getOrderCountdown(order) {
    if (!order || !order.etaMin) {
      return { active: false, remainingMs: 0, remainingSeconds: 0, overdue: false, label: 'ETA unavailable' };
    }
    const status = String(order.status || '').toLowerCase();
    const startIso = status === 'on the way' && order.deliveryStartedAt ? order.deliveryStartedAt : order.placedAt;
    const start = new Date(startIso || '').getTime();
    const eta = Number(order.etaMin || 0);
    if (!Number.isFinite(start) || !Number.isFinite(eta) || eta <= 0) {
      return { active: false, remainingMs: 0, remainingSeconds: 0, overdue: false, label: 'ETA unavailable' };
    }
    const target = start + eta * 60 * 1000;
    const remainingMs = target - Date.now();
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const overdue = remainingMs <= 0;
    const abs = Math.max(0, remainingSeconds);
    const mins = String(Math.floor(abs / 60)).padStart(2, '0');
    const secs = String(abs % 60).padStart(2, '0');
    return {
      active: true,
      remainingMs,
      remainingSeconds,
      overdue,
      label: overdue ? 'Delayed — please wait a little longer' : `${mins}:${secs}`,
    };
  },

  getAdminAlerts() {
    return this._get(this.K.ADMIN_ALERTS) || [];
  },

  addAdminAlert(alert) {
    const alerts = this.getAdminAlerts();
    const payload = {
      id: `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...alert,
    };
    alerts.unshift(payload);
    this._set(this.K.ADMIN_ALERTS, alerts);
    return payload;
  },

  markAdminAlertRead(id, read = true) {
    const alerts = this.getAdminAlerts();
    let changed = false;
    alerts.forEach((alert) => {
      if (String(alert.id) === String(id)) {
        alert.read = !!read;
        changed = true;
      }
    });
    if (changed) this._set(this.K.ADMIN_ALERTS, alerts);
    return changed;
  },

  getUnreadAdminAlertCount() {
    return this.getAdminAlerts().filter((alert) => !alert.read).length;
  },

  processDeliveryCountdowns() {
    const orders = this.getAllOrders();
    let changed = false;
    orders.forEach((order) => {
      const status = String(order.status || '').toLowerCase();
      if (!['pending', 'preparing', 'on the way'].includes(status)) return;
      const countdown = this.getOrderCountdown(order);
      if (!countdown || !countdown.active || !countdown.overdue || order.delayedAlertSent) return;
      order.delayedAlertSent = true;
      order.delayedAlertAt = new Date().toISOString();
      order.customerWaitNotifiedAt = order.delayedAlertAt;
      order.deliveryNote = 'We are sorry, your delivery is taking longer than expected. Please wait a little longer while admin follows up with the rider.';
      this._pushStatusHistory(order, order.status, 'Delivery is taking longer than expected. Admin has been alerted to follow up with the rider.');
      this.addAdminAlert({
        type: 'delivery_delay',
        orderId: order.id,
        username: order.username,
        message: `Order #${order.id} is overdue. Please contact the rider and speed up the delivery.`,
      });
      changed = true;
    });
    if (changed) {
      this._set(this.K.ALL_ORDERS, orders);
      const grouped = {};
      orders.forEach((order) => {
        const key = this._safeUsername(order.username);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(order);
      });
      Object.entries(grouped).forEach(([username, userOrders]) => {
        this._set(this._userKey(this.K.ORDERS, username), userOrders);
      });
    }
    return changed;
  },

  updateOrderStatus(orderId, newStatus, username = null, extraMeta = {}) {
    const allowedStatuses = ['pending', 'preparing', 'on the way', 'delivered', 'cancelled'];
    const normalizedStatus = String(newStatus || '').trim().toLowerCase();
    if (!allowedStatuses.includes(normalizedStatus)) {
      return { ok: false, reason: 'invalid_status' };
    }

    let result = __SGF_ORIGINAL_UPDATE_ORDER_STATUS.call(this, orderId, normalizedStatus, username);
    if (!result || !result.ok) return result;

    const statusNotes = {
      pending: 'Order received by the system.',
      preparing: 'Restaurant is preparing your food.',
      'on the way': 'Delivery partner is heading to you.',
      delivered: 'Order delivered successfully.',
      cancelled: 'Order cancelled by admin.',
    };

    const safeUser = result.username || username || (result.order && result.order.username) || null;
    const finalMeta = { ...(extraMeta && typeof extraMeta === 'object' ? extraMeta : {}) };
    const nextStatus = normalizedStatus;
    const targetOrder = safeUser
      ? this.getAllOrders().find((order) => String(order.id) === String(orderId) && (!safeUser || this._safeUsername(order.username) === this._safeUsername(safeUser)))
      : null;
    result.pointsJustAwardedValue = 0;
    result.pointsJustReversedValue = 0;

    if (nextStatus === 'cancelled' && safeUser && targetOrder) {
      if (targetOrder.pointsAwarded && String(targetOrder.pointsStatus || 'awarded') !== 'reversed') {
        const pts = Number(targetOrder.pointsToAward) || 0;
        if (pts > 0) {
          const reversed = this._mutateUserEverywhere(targetOrder.username, (user) => {
            user.points = Math.max(0, (Number(user.points) || 0) - pts);
          });
          if (reversed) {
            result.pointsJustReversedValue = pts;
            finalMeta.pointsAwarded = false;
            finalMeta.pointsStatus = 'reversed';
            finalMeta.pointsReversedAt = new Date().toISOString();
          }
        } else {
          finalMeta.pointsAwarded = false;
          finalMeta.pointsStatus = 'reversed';
          finalMeta.pointsReversedAt = new Date().toISOString();
        }
      }

      if (!targetOrder.vouchersRestored && Array.isArray(targetOrder.appliedVouchers) && targetOrder.appliedVouchers.length) {
        const restored = targetOrder.appliedVouchers.map((voucher) => buildVoucherPayload({
          id: voucher.id,
          label: voucher.label,
          icon: voucher.icon,
          mysteryPct: voucher.mysteryPct || undefined,
        }));
        const restoredToUser = this._mutateUserEverywhere(targetOrder.username, (user) => {
          if (!Array.isArray(user.vouchers)) user.vouchers = [];
          if (!Array.isArray(user.appliedVoucherIds)) user.appliedVoucherIds = [];
          user.vouchers.push(...restored.map((voucher) => ({ ...voucher })));
          this._ensureVoucherState(user);
        });
        if (restoredToUser) {
          finalMeta.vouchersRestored = true;
          finalMeta.vouchersRestoredAt = new Date().toISOString();
        }
      }
      finalMeta.reviewPromptPending = false;
    }

    if (nextStatus === 'on the way' && targetOrder) {
      const existingDriver = targetOrder.driver && typeof targetOrder.driver === 'object' ? targetOrder.driver : null;
      const fallbackEta = Math.max(10, Number(finalMeta.etaMin || targetOrder.etaMin || targetOrder.baseEtaMin) || 25);
      if (!finalMeta.driver && existingDriver) {
        finalMeta.driver = existingDriver;
      }
      if (!finalMeta.etaMin) {
        finalMeta.etaMin = fallbackEta;
      }
      if (!finalMeta.deliveryStartedAt) {
        finalMeta.deliveryStartedAt = new Date().toISOString();
      }
      if (!finalMeta.deliveryNote) {
        const driverName = finalMeta.driver && finalMeta.driver.name ? finalMeta.driver.name : 'Delivery Team';
        finalMeta.deliveryNote = `${driverName} is on the way with your order.`;
      }
      if (!finalMeta.note) {
        finalMeta.note = `Order marked as on the way. ETA ${fallbackEta} min.`;
      }
      finalMeta.delayedAlertSent = false;
      finalMeta.delayedAlertAt = null;
      finalMeta.customerWaitNotifiedAt = null;
    }

    if (nextStatus === 'delivered' && safeUser && targetOrder) {
      if (!targetOrder.pointsAwarded) {
        const pts = Number(targetOrder.pointsToAward) || 0;
        if (pts > 0) {
          const awarded = this._mutateUserEverywhere(targetOrder.username, (user) => {
            user.points = (Number(user.points) || 0) + pts;
          });
          if (awarded) {
            result.pointsJustAwardedValue = pts;
            finalMeta.pointsAwarded = true;
            finalMeta.pointsStatus = 'awarded';
            finalMeta.pointsAwardedAt = new Date().toISOString();
          }
        } else {
          finalMeta.pointsAwarded = true;
          finalMeta.pointsStatus = 'awarded';
          finalMeta.pointsAwardedAt = new Date().toISOString();
        }
      }
      finalMeta.reviewPromptPending = !targetOrder.rating;
      if (!finalMeta.deliveryNote) {
        finalMeta.deliveryNote = 'Your order has arrived. Thanks for waiting and enjoy your food!';
      }
    }

    const changed = this._mutateOrder(orderId, safeUser, (order) => {
      order.status = normalizedStatus;
      if (finalMeta && typeof finalMeta === 'object') Object.assign(order, finalMeta);
      this._pushStatusHistory(order, normalizedStatus, (finalMeta && finalMeta.note) || statusNotes[normalizedStatus] || 'Status updated.');
    });

    if (changed) {
      result.username = changed.username;
      result.order = changed;
      result.pointsAwarded = !!changed.pointsAwarded;
      result.pointsAwardedValue = Number(changed.pointsToAward) || 0;
      result.pointsStatus = changed.pointsStatus || (changed.pointsAwarded ? 'awarded' : 'pending');
    }
    return result;
  },

  assignDriver(orderId, username, driverPayload = {}) {
    const etaMin = Math.max(10, Number(driverPayload.etaMin) || 25);
    const driver = {
      name: String(driverPayload.name || 'Rider Team').trim(),
      phone: String(driverPayload.phone || '').trim(),
      vehicle: String(driverPayload.vehicle || '').trim(),
      zone: String(driverPayload.zone || '').trim(),
    };
    return this.updateOrderStatus(orderId, 'on the way', username, {
      driver,
      etaMin,
      deliveryStartedAt: new Date().toISOString(),
      delayedAlertSent: false,
      delayedAlertAt: null,
      customerWaitNotifiedAt: null,
      deliveryNote: driver.name ? `${driver.name} has been assigned and is on the way with your order.` : 'Driver assigned and heading to you.',
      note: driver.name ? `Driver ${driver.name} assigned. ETA ${etaMin} min.` : `Driver assigned. ETA ${etaMin} min.`,
    });
  },

  addReview(orderId, rating, reviewText) {
    const ratingNumber = Number(rating);
    if (!Number.isFinite(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) return false;
    const cleanRating = Math.max(1, Math.min(5, Math.round(ratingNumber)));
    const scopedOrder = this.getOrders().find((entry) => String(entry.id) === String(orderId));
    const orderStatus = String((scopedOrder || {}).status || '').toLowerCase();
    const canReview = !!scopedOrder && (orderStatus === 'delivered' || !!scopedOrder.reviewPromptPending || !!scopedOrder.rating);
    if (!canReview) return false;
    const cleanText = String(reviewText || '').trim();
    const order = this._mutateOrder(orderId, this._safeUsername(), (entry) => {
      entry.rating = cleanRating;
      entry.reviewText = cleanText;
      entry.ratedAt = new Date().toISOString();
      entry.reviewPromptPending = false;
    });
    if (!order) return false;

    const user = this.getUser() || {};
    const reviews = this._get(this.K.REVIEWS) || [];
    const itemNames = Array.isArray(order.items) ? order.items.map((item) => item.name).filter(Boolean) : [];
    const foodIds = Array.isArray(order.items) ? order.items.map((item) => String(item.id)).filter(Boolean) : [];
    const firstItem = itemNames[0] || 'Recent Order';
    const existingIdx = reviews.findIndex((r) => String(r.orderId) === String(orderId) && String(r.username) === String(order.username));
    const review = {
      orderId: order.id,
      username: order.username,
      name: user.name || order.username,
      stars: cleanRating,
      text: cleanText || `Ordered ${firstItem} and rated it ${cleanRating}/5.`,
      img: this.getUserAvatar ? this.getUserAvatar() : this._normalizeAssetPath(user.avatar, 'images/user-avatar.webp'),
      itemNames,
      foodIds,
      createdAt: existingIdx >= 0 ? reviews[existingIdx].createdAt || new Date().toISOString() : new Date().toISOString(),
      published: true,
      publishedAt: new Date().toISOString(),
      hiddenByAdmin: false,
    };
    if (existingIdx >= 0) reviews.splice(existingIdx, 1, review);
    else reviews.unshift(review);
    this._set(this.K.REVIEWS, reviews);
    return true;
  },

  getStoredReviews() {
    const reviews = this._get(this.K.REVIEWS) || [];
    let changed = false;
    const normalized = reviews.map((review) => {
      if (!review || typeof review !== 'object') return review;
      if (review.hiddenByAdmin === true) return review;
      const next = { ...review };
      if (next.img) {
        const cleanImg = this._normalizeAssetPath(next.img, 'images/user-avatar.webp');
        if (cleanImg !== next.img) {
          next.img = cleanImg;
          changed = true;
        }
      }
      if (next.published !== true) {
        next.published = true;
        next.publishedAt = next.publishedAt || next.createdAt || new Date().toISOString();
        next.hiddenByAdmin = false;
        changed = true;
      }
      if (next.hiddenByAdmin !== false) {
        next.hiddenByAdmin = false;
        changed = true;
      }
      return next;
    });
    if (changed) this._set(this.K.REVIEWS, normalized);
    return normalized;
  },

  setReviewPublished(orderId, username, published = true) {
    const reviews = this.getStoredReviews();
    let changed = false;
    reviews.forEach((review) => {
      if (String(review.orderId) === String(orderId) && this._safeUsername(review.username) === this._safeUsername(username)) {
        review.published = !!published;
        review.hiddenByAdmin = !published;
        review.publishedAt = published ? new Date().toISOString() : null;
        changed = true;
      }
    });
    if (changed) this._set(this.K.REVIEWS, reviews);
    return changed;
  },

  getPublicReviews() {
    return this.getStoredReviews().filter((review) => review.published);
  },

  getFoodReviews(foodId, includeHidden = false) {
    const target = String(foodId);
    const source = includeHidden ? this.getStoredReviews() : this.getPublicReviews();
    return source.filter((review) => {
      const ids = Array.isArray(review.foodIds) && review.foodIds.length
        ? review.foodIds.map(String)
        : (() => {
            const order = this.getAllOrders().find((entry) => String(entry.id) === String(review.orderId) && this._safeUsername(entry.username) === this._safeUsername(review.username));
            return Array.isArray(order?.items) ? order.items.map((item) => String(item.id)) : [];
          })();
      return ids.includes(target);
    });
  },

  getFoodReviewSummary(foodId) {
    const reviews = this.getFoodReviews(foodId, false);
    const food = this.getFoodById ? this.getFoodById(foodId) : null;
    if (!reviews.length) {
      const fallback = Number.isFinite(Number(food?.rating)) ? Number(food.rating) : 4.5;
      return { count: 0, avg: Number(fallback.toFixed(1)) };
    }
    const avg = reviews.reduce((sum, review) => sum + (Number(review.stars) || 0), 0) / reviews.length;
    return { count: reviews.length, avg: Number(avg.toFixed(1)) };
  },

  getRecentFoodReviews(foodId, limit = 2) {
    return this.getFoodReviews(foodId, false).slice(0, limit);
  },

  getAllReviews() {
    const dynamic = this.getPublicReviews();
    const seeded = Array.isArray(typeof REVIEWS !== 'undefined' ? REVIEWS : []) ? REVIEWS : [];
    return [...dynamic, ...seeded];
  },

  getRecommendedFoods(limit = 4) {
    const foods = this.getFoodsData().filter((food) => food.isActive !== false);
    const orders = this.getOrders();
    const categoryScores = {};
    const brandScores = {};
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (item.cat) categoryScores[item.cat] = (categoryScores[item.cat] || 0) + (item.qty || 1);
        if (item.brand) brandScores[item.brand] = (brandScores[item.brand] || 0) + (item.qty || 1);
      });
    });
    return [...foods]
      .sort((a, b) => {
        const scoreA = (categoryScores[a.cat] || 0) * 4 + (brandScores[a.brand] || 0) * 3 + (a.popularity || 0) + (a.rating || 0) * 10;
        const scoreB = (categoryScores[b.cat] || 0) * 4 + (brandScores[b.brand] || 0) * 3 + (b.popularity || 0) + (b.rating || 0) * 10;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  },

  getRestaurantAnalytics() {
    const foods = this.getFoodsData();
    const orders = this.getAllOrders();
    const byBrand = {};
    foods.forEach((food) => {
      if (!byBrand[food.brand]) byBrand[food.brand] = { brandId: food.brand, brandName: food.bName, totalOrders: 0, revenue: 0, topItems: {} };
    });
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!byBrand[item.brand]) byBrand[item.brand] = { brandId: item.brand, brandName: item.bName || item.brand, totalOrders: 0, revenue: 0, topItems: {} };
        byBrand[item.brand].totalOrders += item.qty || 1;
        byBrand[item.brand].revenue += (item.price || 0) * (item.qty || 1);
        byBrand[item.brand].topItems[item.name] = (byBrand[item.brand].topItems[item.name] || 0) + (item.qty || 1);
      });
    });
    return Object.values(byBrand).map((entry) => ({
      ...entry,
      revenue: Number(entry.revenue.toFixed(2)),
      bestItem: Object.entries(entry.topItems).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
    }));
  },
});

window.State = State;
