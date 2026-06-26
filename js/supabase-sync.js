(function () {
  var StateRef = window.State || (typeof State !== 'undefined' ? State : null);
  if (!StateRef) return;

  var State = StateRef;
  var CONFIG = window.SGF_SUPABASE_CONFIG || {};
  var TABLES = CONFIG.tables || {};
  var APP_META_KEYS = CONFIG.appMetaKeys || {};
  function normalisePageName(pathname) {
    var last = String(pathname || '').split('/').pop() || '';
    last = last.toLowerCase().replace(/\.html?$/i, '');
    if (!last || last === '.' || last === 'index') return 'index';
    return last;
  }

  var FILE_NAME = normalisePageName(window.location.pathname);
  var SPIN_PREFIX = 'sgf_spin_history_';
  var SAVE_QUEUES = {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function readJson(key, fallback) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function removeKey(key) {
    localStorage.removeItem(key);
  }

  function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function isTextEntryActive() {
    try {
      if (window.SGFStudentAI && typeof window.SGFStudentAI.isInteracting === 'function' && window.SGFStudentAI.isInteracting()) {
        return true;
      }
    } catch (err) {}

    var active = document.activeElement;
    if (!active) return false;
    if (active.isContentEditable) return true;

    var tag = String(active.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'select') return true;
    if (tag !== 'input') return false;

    var type = String(active.type || 'text').toLowerCase();
    return ['text', 'search', 'email', 'tel', 'url', 'password', 'number'].indexOf(type) !== -1;
  }

  function currentSessionUser() {
    return readJson(State.K.USER, null);
  }

  function safeUsername(username) {
    var sessionUser = currentSessionUser() || {};
    return String(username || sessionUser.username || 'guest').trim() || 'guest';
  }

  function cartKey(username) {
    return State._userKey(State.K.CART, safeUsername(username));
  }

  function ordersKey(username) {
    return State._userKey(State.K.ORDERS, safeUsername(username));
  }

  function spinKey(username) {
    return SPIN_PREFIX + safeUsername(username);
  }

  function enqueueSave(key, worker) {
    var queueKey = String(key || 'default');
    var previous = SAVE_QUEUES[queueKey] || Promise.resolve();
    var next = previous.catch(function () {}).then(worker);
    SAVE_QUEUES[queueKey] = next.finally(function () {
      if (SAVE_QUEUES[queueKey] === next) delete SAVE_QUEUES[queueKey];
    });
    return next;
  }

  function mergeUserIntoRegistry(user) {
    if (!user || !user.username) return;
    var allUsers = readJson(State.K.ALL_USERS, {}) || {};
    allUsers[user.username] = user;
    writeJson(State.K.ALL_USERS, allUsers);
  }

  function deleteUserFromRegistry(username) {
    var allUsers = readJson(State.K.ALL_USERS, {}) || {};
    delete allUsers[safeUsername(username)];
    writeJson(State.K.ALL_USERS, allUsers);
  }

  function setCurrentSessionUser(user) {
    if (!user) {
      removeKey(State.K.USER);
      return;
    }
    writeJson(State.K.USER, user);
    mergeUserIntoRegistry(user);
  }

  function userRowToProfile(row) {
    if (!row) return null;
    var profile = clone(row.profile || {});
    delete profile.password;
    delete profile.passwordHash;
    delete profile.password_hash;
    profile.username = profile.username || row.username || '';
    profile.email = profile.email || row.email || '';
    if (row.password_hash) profile.passwordHash = row.password_hash;
    return profile;
  }

  function orderRowToPayload(row) {
    var payload = clone((row && row.payload) || {});
    payload.id = payload.id || (row && row.id) || '';
    payload.username = payload.username || (row && row.username) || '';
    payload.status = payload.status || (row && row.status) || 'pending';
    if (typeof payload.total === 'undefined' || payload.total === null) {
      payload.total = Number((row && row.total) || 0);
    }
    if (typeof payload.pointsToAward === 'undefined' || payload.pointsToAward === null) {
      payload.pointsToAward = Number((row && row.points_to_award) || 0);
    }
    return payload;
  }

  function messageRowToPayload(row) {
    var payload = clone((row && row.payload) || {});
    payload.id = payload.id || (row && row.id) || '';
    payload.username = payload.username || (row && row.username) || '';
    payload.read = typeof payload.read === 'boolean' ? payload.read : !!(row && row.read);
    payload.supportPriority = payload.supportPriority || (row && row.support_priority) || 'standard';
    return payload;
  }

  function reviewRowToPayload(row) {
    var payload = clone((row && row.payload) || {});
    payload.orderId = payload.orderId || (row && row.order_id) || '';
    payload.username = payload.username || (row && row.username) || '';
    payload.published = typeof payload.published === 'boolean' ? payload.published : !!(row && row.published);
    return payload;
  }

  function isConfigured() {
    var urlOk = typeof CONFIG.url === 'string' && /^https:\/\/.+\.supabase\.co$/i.test(CONFIG.url.trim());
    var key = String(CONFIG.anonKey || '').trim();
    var keyOk = !!key && key.indexOf('PASTE_') !== 0 && key.indexOf('YOUR_') !== 0;
    return urlOk && keyOk;
  }

  function buildUrl(table, query) {
    var url = CONFIG.url.replace(/\/$/, '') + '/rest/v1/' + table;
    var params = new URLSearchParams();
    var source = query || {};
    Object.keys(source).forEach(function (key) {
      if (typeof source[key] === 'undefined' || source[key] === null || source[key] === '') return;
      params.set(key, source[key]);
    });
    var qs = params.toString();
    return qs ? url + '?' + qs : url;
  }

  async function request(method, table, opts) {
    opts = opts || {};
    if (!Backend.enabled) return null;
    var headers = Object.assign({
      apikey: CONFIG.anonKey,
      Authorization: 'Bearer ' + CONFIG.anonKey,
      'Content-Type': 'application/json'
    }, opts.headers || {});
    if (opts.prefer) headers.Prefer = opts.prefer;

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutMs = Math.max(2500, Number(opts.timeoutMs || CONFIG.requestTimeoutMs || 7000));
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

    var res;
    try {
      res = await fetch(buildUrl(table, opts.query), {
        method: method,
        headers: headers,
        body: typeof opts.body === 'undefined' ? undefined : JSON.stringify(opts.body),
        signal: controller ? controller.signal : undefined
      });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new Error(method + ' ' + table + ' timed out after ' + timeoutMs + 'ms');
      }
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (!res.ok) {
      var errText = '';
      try {
        errText = await res.text();
      } catch (readErr) {
        errText = '';
      }
      throw new Error(method + ' ' + table + ' failed (' + res.status + '): ' + errText);
    }

    if (res.status === 204) return null;
    var text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  }

  function rerenderKnownUi() {
    var fnNames = [
      'updateHeader',
      'refreshWalletDisplay',
      'renderCart',
      'renderVoucherAddBox',
      'renderCheckoutPage',
      'renderOrders',
      'renderProfilePage',
      'refreshProfileAddress',
      'renderMembershipPlans',
      'renderRewards',
      'renderSpinPrizes',
      'renderHistory',
      'renderSupportLane',
      'renderContactFaqs',
      'loadDashboard',
      'renderAdminMessages',
      'renderAdminUsers',
      'renderAdminCatalog',
      'renderAdminBrands',
      'renderAdminFoods',
      'renderAdminReviews',
      'renderVoucherManagement',
      'renderRestaurantGrid',
      'renderBrandFilter',
      'renderCatFilter',
      'renderFiltered'
    ];
    var deferWhileTyping = {
      renderCart: true,
      renderVoucherAddBox: true,
      renderCheckoutPage: true,
      renderOrders: true,
      renderProfilePage: true,
      refreshProfileAddress: true,
      renderMembershipPlans: true,
      renderRewards: true,
      renderSpinPrizes: true,
      renderHistory: true,
      renderSupportLane: true,
      renderContactFaqs: true,
      loadDashboard: true,
      renderAdminMessages: true,
      renderAdminUsers: true,
      renderAdminCatalog: true,
      renderAdminBrands: true,
      renderAdminFoods: true,
      renderAdminReviews: true,
      renderVoucherManagement: true,
      renderRestaurantGrid: true,
      renderBrandFilter: true,
      renderCatFilter: true,
      renderFiltered: true
    };
    var typingActive = isTextEntryActive();

    fnNames.forEach(function (name) {
      try {
        if (typeof window[name] === 'function') {
          if (typingActive && deferWhileTyping[name]) return;
          if (name === 'renderCheckoutPage') {
            var active = document.activeElement;
            if (active && active.id === 'co-address') return;
          }
          if (name === 'renderAdminUsers') window[name](document.getElementById('adm-user-search') ? document.getElementById('adm-user-search').value : '');
          else window[name]();
        }
      } catch (err) {
        Backend.debug('rerender skipped for ' + name, err);
      }
    });

    document.dispatchEvent(new CustomEvent('sgf:remote-synced', {
      detail: {
        page: FILE_NAME,
        at: nowIso()
      }
    }));
  }

  function installSpinStateMethods() {
    if (typeof State.getSpinHistory !== 'function') {
      State.getSpinHistory = function (username) {
        var data = readJson(spinKey(username), []);
        return Array.isArray(data) ? data : [];
      };
    }

    if (typeof State.addSpinHistoryEntry !== 'function') {
      State.addSpinHistoryEntry = function (entry, username) {
        var key = spinKey(username);
        var history = State.getSpinHistory(username);
        history.unshift(Object.assign({ createdAt: nowIso() }, entry || {}));
        if (history.length > 25) history.length = 25;
        writeJson(key, history);
        Backend.saveUserByUsername(safeUsername(username)).catch(Backend.logError);
        return history;
      };
    }

    if (typeof State.clearSpinHistory !== 'function') {
      State.clearSpinHistory = function (username) {
        removeKey(spinKey(username));
        Backend.saveUserByUsername(safeUsername(username)).catch(Backend.logError);
        return [];
      };
    }
  }

  var Backend = {
    enabled: isConfigured(),
    ready: false,
    initPromise: null,
    pollTimer: null,
    hooksInstalled: false,
    warnedLocalMode: false,

    debug: function () {
      if (!CONFIG.debug) return;
      try {
        console.log.apply(console, ['[SGF Supabase]'].concat([].slice.call(arguments)));
      } catch (err) {
        console.log('[SGF Supabase]', arguments[0]);
      }
    },

    logError: function (err) {
      console.error('[SGF Supabase]', err);
    },

    onAuthPage: function () {
      return FILE_NAME === 'index';
    },

    onAdminPage: function () {
      return FILE_NAME === 'admin';
    },

    onAdminLoginPage: function () {
      return FILE_NAME === 'admin-login';
    },

    onCatalogPage: function () {
      return FILE_NAME === 'home' || FILE_NAME === 'menu' || FILE_NAME === 'how-it-works';
    },

    notifyLocalFallbackOnce: function () {
      if (this.enabled || this.warnedLocalMode) return;
      this.warnedLocalMode = true;
      this.debug('Supabase anon key is not configured yet. Running in local fallback mode until you fill js/supabase-config.js.');
    },

    async init() {
      if (this.initPromise) return this.initPromise;
      var self = this;
      this.notifyLocalFallbackOnce();
      this.initPromise = (async function () {
        if (!self.enabled) {
          self.ready = true;
          installSpinStateMethods();
          return { mode: 'local-fallback' };
        }

        installSpinStateMethods();
        await self.loadCatalog();
        await self.loadReviews({ admin: self.onAdminPage() });

        if (self.onAuthPage()) {
          self.loadUsersDirectory({ minimal: true }).catch(self.logError);
        }

        if (self.onAdminPage()) {
          await self.loadUsersDirectory();
          await self.loadOrders({ all: true });
          await self.loadMessages({ all: true });
        } else {
          var sessionUser = currentSessionUser();
          if (sessionUser && sessionUser.username) {
            await self.loadCurrentUser(sessionUser.username);
            await self.loadOrders({ username: sessionUser.username });
          }
        }

        self.ready = true;
        rerenderKnownUi();
        return { mode: 'supabase' };
      })().catch(function (err) {
        self.logError(err);
        self.ready = true;
        return { mode: 'error', error: err };
      }).finally(function () {
        self.initPromise = null;
      });

      return this.initPromise;
    },

    startPolling: function () {
      var self = this;
      if (!self.enabled || self.pollTimer) return;
      self.pollTimer = setInterval(function () {
        if (document.hidden) return;
        self.refreshQuietly().catch(self.logError);
      }, Math.max(4000, Number(CONFIG.pollMs) || 5000));

      if (!self._visibilityHookInstalled) {
        self._visibilityHookInstalled = true;
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) self.refreshQuietly().catch(self.logError);
        });
        window.addEventListener('focus', function () {
          self.refreshQuietly().catch(self.logError);
        });
      }
    },

    async refreshQuietly() {
      if (!this.enabled) return;
      if (this.onAuthPage()) return;
      if (this.onAdminPage()) {
        await this.loadCatalog();
        await this.loadUsersDirectory();
        await this.loadOrders({ all: true });
        await this.loadMessages({ all: true });
        await this.loadReviews({ admin: true });
      } else {
        await this.loadCatalog();
        await this.loadReviews({ admin: false });
        var sessionUser = currentSessionUser();
        if (sessionUser && sessionUser.username) {
          await this.loadCurrentUser(sessionUser.username);
          await this.loadOrders({ username: sessionUser.username });
        }
      }
      rerenderKnownUi();
    },

    async loadUsersDirectory(options) {
      if (!this.enabled) return [];
      options = options || {};
      var selectFields = options.minimal ? 'username,email,profile,updated_at' : 'username,email,password_hash,profile,cart,spin_history,updated_at';
      var rows = await request('GET', TABLES.users, {
        query: {
          select: selectFields,
          order: 'updated_at.desc'
        },
        timeoutMs: options.minimal ? 4500 : 7000
      }) || [];

      var users = readJson(State.K.ALL_USERS, {}) || {};
      rows.forEach(function (row) {
        var profile = userRowToProfile(row);
        if (!profile || !profile.username) return;
        users[profile.username] = profile;
      });
      writeJson(State.K.ALL_USERS, users);
      return rows;
    },

    async findUserByIdentifier(identifier) {
      if (!this.enabled || !identifier) return null;
      var raw = String(identifier).trim();
      var needle = raw.toLowerCase();
      var exactQuery = {
        select: 'username,email,password_hash,profile,cart,spin_history,updated_at'
      };

      function emailLocalPart(email) {
        var value = String(email || '').trim().toLowerCase();
        var at = value.indexOf('@');
        return at > 0 ? value.slice(0, at) : '';
      }

      function userMatchesIdentifier(user) {
        if (!user) return false;
        var profile = user.profile && typeof user.profile === 'object' ? user.profile : {};
        var candidates = [
          user.username, user.email, emailLocalPart(user.email),
          user.studentId, user.studentID, user.student_id,
          user.mmuId, user.mmuID, user.mmu_id,
          user.matricId, user.matricID, user.matric_id,
          profile.username, profile.email, emailLocalPart(profile.email),
          profile.studentId, profile.studentID, profile.student_id,
          profile.mmuId, profile.mmuID, profile.mmu_id,
          profile.matricId, profile.matricID, profile.matric_id
        ];
        return candidates.some(function (value) {
          return String(value || '').trim().toLowerCase() === needle;
        });
      }

      var usernameCandidates = [raw, needle].filter(function (value, index, arr) {
        return value && arr.indexOf(value) === index;
      });

      var emailCandidates = [];
      if (needle.indexOf('@') >= 0) {
        emailCandidates.push(needle);
      } else {
        emailCandidates.push(needle + '@student.mmu.edu.my');
        emailCandidates.push(needle + '@mmu.edu.my');
      }

      var rows = [];
      for (var i = 0; i < usernameCandidates.length && !rows.length; i++) {
        rows = await request('GET', TABLES.users, {
          query: Object.assign({}, exactQuery, { username: 'eq.' + usernameCandidates[i] }),
          timeoutMs: 4500
        }).catch(function () { return []; }) || [];
      }

      for (var j = 0; j < emailCandidates.length && !rows.length; j++) {
        rows = await request('GET', TABLES.users, {
          query: Object.assign({}, exactQuery, { email: 'eq.' + emailCandidates[j] }),
          timeoutMs: 4500
        }).catch(function () { return []; }) || [];
      }

      var row = Array.isArray(rows) ? rows[0] : null;
      if (!row) {
        // Cross-browser fix: a fresh browser may not have the users directory in
        // localStorage, so student ID/profile lookups could fail or show different
        // warnings. Load the directory once, then match username/email/student ID
        // against the merged profiles.
        try {
          if (typeof this.loadUsersDirectory === 'function') {
            await this.loadUsersDirectory({ minimal: false });
          }
        } catch (directoryErr) {
          console.warn('[SGF Backend] directory lookup skipped', directoryErr);
        }
        var allUsers = readJson(State.K.ALL_USERS, {}) || {};
        var localMatch = Object.keys(allUsers).map(function (key) { return allUsers[key]; }).find(userMatchesIdentifier);
        return localMatch || null;
      }

      var profile = userRowToProfile(row);
      if (profile && profile.username) {
        mergeUserIntoRegistry(profile);
        return profile;
      }
      return null;
    },

    async loadCurrentUser(username) {
      if (!this.enabled || !username) return null;
      var rows = await request('GET', TABLES.users, {
        query: {
          select: 'username,email,password_hash,profile,cart,spin_history,updated_at',
          username: 'eq.' + String(username)
        }
      }) || [];

      var row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return null;
      var profile = userRowToProfile(row);
      if (!profile || !profile.username) return null;

      setCurrentSessionUser(profile);
      writeJson(cartKey(profile.username), ensureObject(row.cart));
      writeJson(spinKey(profile.username), ensureArray(row.spin_history));
      return row;
    },

    async loadOrders(options) {
      if (!this.enabled) return [];
      options = options || {};
      var query = {
        select: 'id,username,status,total,points_to_award,payload,updated_at',
        order: 'updated_at.desc'
      };
      if (!options.all && options.username) {
        query.username = 'eq.' + String(options.username);
      }
      var rows = await request('GET', TABLES.orders, { query: query }) || [];
      var orders = rows.map(orderRowToPayload);

      if (options.all) {
        writeJson(State.K.ALL_ORDERS, orders);
        var grouped = {};
        orders.forEach(function (order) {
          var uname = safeUsername(order.username);
          if (!grouped[uname]) grouped[uname] = [];
          grouped[uname].push(order);
        });
        Object.keys(grouped).forEach(function (uname) {
          writeJson(ordersKey(uname), grouped[uname]);
        });
      } else if (options.username) {
        var uname = safeUsername(options.username);
        writeJson(ordersKey(uname), orders);
        var existing = readJson(State.K.ALL_ORDERS, []) || [];
        var others = existing.filter(function (order) {
          return safeUsername(order.username) !== uname;
        });
        writeJson(State.K.ALL_ORDERS, others.concat(orders));
      }
      return orders;
    },

    async loadMessages(options) {
      if (!this.enabled) return [];
      options = options || {};
      var query = {
        select: 'id,username,read,support_priority,payload,updated_at',
        order: 'updated_at.desc'
      };
      if (!options.all) {
        var sessionUser = currentSessionUser();
        if (sessionUser && sessionUser.username) {
          query.username = 'eq.' + String(sessionUser.username);
        }
      }
      var rows = await request('GET', TABLES.messages, { query: query }) || [];
      writeJson(State.K.MESSAGES, rows.map(messageRowToPayload));
      return rows;
    },

    async loadReviews(options) {
      if (!this.enabled) return [];
      options = options || {};
      var query = {
        select: 'id,order_id,username,published,payload,updated_at',
        order: 'updated_at.desc'
      };
      if (!options.admin) query.published = 'eq.true';
      var rows = await request('GET', TABLES.reviews, { query: query }) || [];
      writeJson(State.K.REVIEWS, rows.map(reviewRowToPayload));
      return rows;
    },

    async loadCatalog() {
      if (!this.enabled) return [];
      var rows = await request('GET', TABLES.appMeta, {
        query: {
          select: 'key,value,updated_at',
          key: 'in.(' + [APP_META_KEYS.brands, APP_META_KEYS.foods, APP_META_KEYS.settings].filter(Boolean).join(',') + ')'
        }
      }) || [];

      var seen = {};
      rows.forEach(function (row) {
        seen[row.key] = true;
        if (row.key === APP_META_KEYS.brands && Array.isArray(row.value)) writeJson(State.K.BRANDS_DATA, row.value);
        if (row.key === APP_META_KEYS.foods && Array.isArray(row.value)) writeJson(State.K.FOODS_DATA, row.value);
        if (row.key === APP_META_KEYS.settings && row.value && typeof row.value === 'object') writeJson(State.K.SETTINGS, row.value);
      });

      var seedTasks = [];
      if (!seen[APP_META_KEYS.brands]) {
        seedTasks.push(this.saveAppMeta(APP_META_KEYS.brands, State.getBrandsData ? State.getBrandsData() : []));
      }
      if (!seen[APP_META_KEYS.foods]) {
        seedTasks.push(this.saveAppMeta(APP_META_KEYS.foods, State.getFoodsData ? State.getFoodsData() : []));
      }
      if (seedTasks.length) await Promise.all(seedTasks);
      return rows;
    },

    sanitizeUserProfile: function (user) {
      if (typeof sgfSanitizeProfile === 'function') return sgfSanitizeProfile(user);
      var payload = clone(user || {});
      delete payload.password;
      delete payload.passwordHash;
      delete payload.password_hash;
      delete payload.cart;
      delete payload.spin_history;
      delete payload.spinHistory;
      return payload;
    },

    async saveUserByUsername(username) {
      if (!this.enabled || !username || safeUsername(username) === 'guest') return null;
      var self = this;
      var uname = safeUsername(username);
      return enqueueSave('user:' + uname, async function () {
        var allUsers = readJson(State.K.ALL_USERS, {}) || {};
        var sessionUser = currentSessionUser();
        var user = allUsers[uname] || ((sessionUser && safeUsername(sessionUser.username) === uname) ? sessionUser : null);
        if (!user || !user.username) return null;

        var storedCart = readJson(cartKey(user.username), null);
        var storedSpinHistory = readJson(spinKey(user.username), null);
        if (storedCart === null && user && typeof user.cart !== 'undefined') storedCart = user.cart;
        if (storedSpinHistory === null && user && typeof user.spin_history !== 'undefined') storedSpinHistory = user.spin_history;
        if (storedSpinHistory === null && user && typeof user.spinHistory !== 'undefined') storedSpinHistory = user.spinHistory;

        var payload = {
          username: user.username,
          email: String(user.email || '').trim().toLowerCase(),
          profile: self.sanitizeUserProfile(user),
          cart: ensureObject(storedCart),
          spin_history: ensureArray(storedSpinHistory)
        };
        var passwordHash = String(user.passwordHash || '').trim();
        if (passwordHash) payload.password_hash = passwordHash;

        var rows = await request('POST', TABLES.users, {
          query: { on_conflict: 'username', select: 'username,email,password_hash,profile,cart,spin_history' },
          body: payload,
          prefer: 'resolution=merge-duplicates,return=representation'
        }) || [];

        var row = Array.isArray(rows) ? rows[0] : null;
        if (row) {
          var profile = userRowToProfile(row);
          mergeUserIntoRegistry(profile);
          var current = currentSessionUser();
          if (current && safeUsername(current.username) === safeUsername(profile.username)) {
            setCurrentSessionUser(profile);
            writeJson(cartKey(profile.username), ensureObject(row.cart));
            writeJson(spinKey(profile.username), ensureArray(row.spin_history));
          }
        }
        return row;
      });
    },

    async deleteUserByUsername(username) {
      if (!this.enabled || !username || safeUsername(username) === 'guest') return null;
      var uname = safeUsername(username);
      await Promise.all([
        request('DELETE', TABLES.users, { query: { username: 'eq.' + uname } }),
        request('DELETE', TABLES.orders, { query: { username: 'eq.' + uname } }),
        request('DELETE', TABLES.messages, { query: { username: 'eq.' + uname } }),
        request('DELETE', TABLES.reviews, { query: { username: 'eq.' + uname } })
      ]);
      deleteUserFromRegistry(uname);
      removeKey(cartKey(uname));
      removeKey(ordersKey(uname));
      removeKey(spinKey(uname));
      return true;
    },

    async saveOrder(order) {
      if (!this.enabled || !order || !order.id) return null;
      return enqueueSave('order:' + String(order.id), async function () {
        var payload = {
          id: String(order.id),
          username: safeUsername(order.username),
          status: String(order.status || 'pending'),
          total: Number(order.total || 0),
          points_to_award: Number(order.pointsToAward || 0),
          payload: clone(order)
        };
        return request('POST', TABLES.orders, {
          query: { on_conflict: 'id' },
          body: payload,
          prefer: 'resolution=merge-duplicates,return=minimal'
        });
      });
    },

    async saveMessage(message) {
      if (!this.enabled || !message || !message.id) return null;
      var payload = {
        id: String(message.id),
        username: safeUsername(message.username),
        read: !!message.read,
        support_priority: String(message.supportPriority || 'standard'),
        payload: clone(message)
      };
      return request('POST', TABLES.messages, {
        query: { on_conflict: 'id' },
        body: payload,
        prefer: 'resolution=merge-duplicates,return=minimal'
      });
    },

    async deleteMessage(messageId) {
      if (!this.enabled || !messageId) return null;
      return request('DELETE', TABLES.messages, {
        query: { id: 'eq.' + String(messageId) }
      });
    },

    reviewPrimaryKey: function (review) {
      return String((review && review.orderId) || '') + '__' + String((review && review.username) || '');
    },

    async saveReview(review) {
      if (!this.enabled || !review || !review.orderId || !review.username) return null;
      var payload = {
        id: this.reviewPrimaryKey(review),
        order_id: String(review.orderId),
        username: safeUsername(review.username),
        published: review.published !== false,
        payload: clone(review)
      };
      return request('POST', TABLES.reviews, {
        query: { on_conflict: 'id' },
        body: payload,
        prefer: 'resolution=merge-duplicates,return=minimal'
      });
    },

    async saveAppMeta(key, value) {
      if (!this.enabled || !key) return null;
      return request('POST', TABLES.appMeta, {
        query: { on_conflict: 'key' },
        body: { key: key, value: clone(value) },
        prefer: 'resolution=merge-duplicates,return=minimal'
      });
    },

    wrapStateMethod: function (name, handler) {
      var self = this;
      var original = State[name];
      if (typeof original !== 'function' || original.__sgfWrapped) return;
      State[name] = function () {
        var args = [].slice.call(arguments);
        var result = original.apply(this, args);
        Promise.resolve(handler.call(this, result, args)).catch(self.logError);
        return result;
      };
      State[name].__sgfWrapped = true;
    },

    wrapGlobalFunction: function (name, handler) {
      var self = this;
      var original = window[name];
      if (typeof original !== 'function' || original.__sgfWrapped) return;
      window[name] = function () {
        var args = [].slice.call(arguments);
        var out = original.apply(this, args);
        Promise.resolve(handler.call(this, out, args)).catch(self.logError);
        return out;
      };
      window[name].__sgfWrapped = true;
    },

    installHooks: function () {
      var self = this;
      if (self.hooksInstalled) return;
      self.hooksInstalled = true;

      self.wrapStateMethod('setUser', function () {
        var user = currentSessionUser();
        if (user && user.username) return self.saveUserByUsername(user.username);
        return null;
      });

      self.wrapStateMethod('setCart', function () {
        var user = currentSessionUser();
        if (user && user.username) return self.saveUserByUsername(user.username);
        return null;
      });

      self.wrapStateMethod('clearCart', function () {
        var user = currentSessionUser();
        if (user && user.username) return self.saveUserByUsername(user.username);
        return null;
      });

      self.wrapStateMethod('updateUserByAdmin', function (result, args) {
        if (!result) return null;
        return self.saveUserByUsername(args[0]);
      });

      self.wrapStateMethod('creditWalletToUser', function (result, args) {
        if (!result) return null;
        return self.saveUserByUsername(args[0]);
      });

      self.wrapStateMethod('addVoucherToUser', function (result, args) {
        if (!result) return null;
        return self.saveUserByUsername(args[0]);
      });

      self.wrapStateMethod('deleteUserByAdmin', function (result, args) {
        return self.deleteUserByUsername(args[0]);
      });

      self.wrapStateMethod('addOrder', function (result, args) {
        var originalOrder = args[0] || {};
        var match = (State.getAllOrders() || []).find(function (order) {
          return String(order.id) === String(originalOrder.id);
        }) || (State.getOrders() || [])[0];
        if (!match) return null;
        return Promise.all([
          self.saveOrder(match),
          self.saveUserByUsername(match.username)
        ]);
      });

      self.wrapStateMethod('updateOrderStatus', function (result) {
        if (!result || !result.order) return null;
        return Promise.all([
          self.saveOrder(result.order),
          self.saveUserByUsername(result.username || result.order.username)
        ]);
      });

      self.wrapStateMethod('addMessage', function (result) {
        if (!result) return null;
        return self.saveMessage(result);
      });

      self.wrapStateMethod('markMessageRead', function (result, args) {
        if (!result) return null;
        var message = (State.getMessages() || []).find(function (entry) {
          return String(entry.id) === String(args[0]);
        });
        return message ? self.saveMessage(message) : null;
      });

      self.wrapStateMethod('deleteMessage', function (result, args) {
        if (!result) return null;
        return self.deleteMessage(args[0]);
      });

      self.wrapStateMethod('addReview', function (result, args) {
        if (!result) return null;
        var orderId = args[0];
        var review = (State.getStoredReviews() || []).find(function (entry) {
          return String(entry.orderId) === String(orderId) && safeUsername(entry.username) === safeUsername();
        });
        var order = (State.getOrders() || []).find(function (entry) {
          return String(entry.id) === String(orderId) && safeUsername(entry.username) === safeUsername();
        });
        return Promise.all([
          review ? self.saveReview(review) : null,
          order ? self.saveOrder(order) : null,
          order ? self.saveUserByUsername(order.username) : null
        ]);
      });

      self.wrapStateMethod('setReviewPublished', function (result, args) {
        if (!result) return null;
        var review = (State.getStoredReviews() || []).find(function (entry) {
          return String(entry.orderId) === String(args[0]) && safeUsername(entry.username) === safeUsername(args[1]);
        });
        return review ? self.saveReview(review) : null;
      });

      self.wrapStateMethod('setBrandsData', function () {
        return self.saveAppMeta(APP_META_KEYS.brands, State.getBrandsData ? State.getBrandsData() : []);
      });

      self.wrapStateMethod('setFoodsData', function () {
        return self.saveAppMeta(APP_META_KEYS.foods, State.getFoodsData ? State.getFoodsData() : []);
      });

      function installLateWrappers() {
        self.wrapGlobalFunction('adminRemoveVoucher', function (result, args) {
          return self.saveUserByUsername(args[0]);
        });

        var registerFn = window.doRegister;
        if (typeof registerFn === 'function' && !registerFn.__sgfWrapped) {
          window.doRegister = function () {
            return registerFn.apply(this, arguments);
          };
          window.doRegister.__sgfWrapped = true;
        }

        var loginFn = window.doLogin;
        if (typeof loginFn === 'function' && !loginFn.__sgfWrapped) {
          window.doLogin = function () {
            return loginFn.apply(this, arguments);
          };
          window.doLogin.__sgfWrapped = true;
        }
      }

      installLateWrappers();
      document.addEventListener('DOMContentLoaded', installLateWrappers);
      window.addEventListener('load', installLateWrappers);
    }
  };

  Backend.syncCurrentUserNow = async function (username) {
    var target = safeUsername(username);
    if (!this.enabled || !target || target === 'guest') return null;
    return this.saveUserByUsername(target);
  };

  Backend.syncReviewsByUsername = async function (username) {
    var target = safeUsername(username);
    if (!this.enabled || !target || target === 'guest') return [];
    var reviews = (State.getStoredReviews ? State.getStoredReviews() : []).filter(function (entry) {
      return safeUsername(entry && entry.username) === target;
    });
    if (!reviews.length) return [];
    return Promise.all(reviews.map(function (review) {
      return Backend.saveReview(review);
    }));
  };

  Backend.syncOrderNow = async function (order) {
    if (!this.enabled || !order || !order.id) return null;
    return this.saveOrder(order);
  };

  installSpinStateMethods();
  Backend.installHooks();
  window.SGFBackend = Backend;

  function boot() {
    Backend.init().finally(function () {
      Backend.startPolling();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
