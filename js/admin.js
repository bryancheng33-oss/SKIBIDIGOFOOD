// ============================================================
//  admin.js — Admin Panel logic
// ============================================================

function requireAdmin() {
  if (!State.isAdmin()) window.location.href = 'admin-login';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAdmDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
}

let __admCurrentTab = 'dashboard';

function refreshAdminBadges() {
  setText('adm-msg-badge', State.getUnreadMessageCount ? State.getUnreadMessageCount() : 0);
  setText('adm-alert-badge', State.getUnreadAdminAlertCount ? State.getUnreadAdminAlertCount() : 0);
}

function setGaugePercent(id, percent) {
  const el = document.getElementById(id);
  if (!el) return;
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  el.style.setProperty('--gauge', safe + '%');
}

function formatActiveTabLabel(tab) {
  const map = {
    dashboard: 'Dashboard',
    users: 'Users',
    orders: 'Orders',
    catalog: 'Catalog',
    reviews: 'Reviews',
    vouchers: 'Vouchers',
    messages: 'Messages'
  };
  return map[tab] || 'Dashboard';
}

function refreshAdminChrome(activeTab = 'dashboard') {
  const users = Object.values(State.getAllUsers ? State.getAllUsers() : {});
  const orders = State.getAllOrders ? State.getAllOrders() : [];
  const messages = State.getMessages ? State.getMessages() : [];
  const unreadMessages = messages.filter((m) => !m.read).length;
  const alerts = State.getAdminAlerts ? State.getAdminAlerts() : [];
  const openAlerts = alerts.filter((a) => !a.read).length;
  const revenue = orders.reduce((sum, order) => sum + (String(order.status || '').toLowerCase() === 'cancelled' ? 0 : (Number(order.total) || 0)), 0);
  const points = users.reduce((sum, user) => sum + (Number(user.points) || 0), 0);
  const totalMessages = messages.length || 1;
  const unreadPercent = Math.round((unreadMessages / totalMessages) * 100);
  const activeLabel = formatActiveTabLabel(activeTab);

  setText('adm-side-users', users.length);
  setText('adm-side-orders', orders.length);
  setText('adm-side-messages', messages.length);
  setText('adm-top-msg-badge', unreadMessages);
  setText('adm-top-alert-badge', openAlerts);
  setText('adm-unread-messages', unreadMessages);
  setText('adm-open-alerts', openAlerts);
  setText('adm-msg-ring-value', unreadPercent + '%');
  setText('adm-alert-summary', `${openAlerts} active delivery delay${openAlerts === 1 ? '' : 's'} need review.`);
  setText('adm-dashboard-date', new Date().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }));
  const adminName = (State.getAdminUsername && State.getAdminUsername()) || 'Admin User';
  setText('adm-dashboard-admin', adminName);
  setText('adm-profile-name', adminName);
  setText('adm-active-tab-label', activeLabel);
  setText('adm-active-tab-mini', activeLabel);
  setText('adm-rev-mini', 'RM ' + revenue.toFixed(2));
  setText('adm-pts-mini', points + ' pts');
  setGaugePercent('adm-msg-ring', unreadPercent);

  document.querySelectorAll('.adm-chip-btn').forEach((btn) => btn.classList.remove('active'));
  document.getElementById('adm-quick-' + activeTab)?.classList.add('active');
}

function adminGlobalSearch() {
  const input = document.getElementById('adm-global-search');
  const query = String(input?.value || '').trim();
  if (!query) {
    admTab('dashboard');
    return;
  }

  const orders = State.getAllOrders ? State.getAllOrders() : [];
  const orderMatches = orders.filter((o) => {
    const items = Array.isArray(o.items) ? o.items.map((item) => item.name || item.title || '').join(' ') : '';
    return [o.id, o.username, o.status, o.method, o.paymentMethod, o.address, items].some((v) => String(v || '').toLowerCase().includes(query.toLowerCase()));
  });

  if (orderMatches.length) {
    admTab('orders');
    const orderSearch = document.getElementById('adm-order-search');
    const orderStatusFilter = document.getElementById('adm-order-status-filter');
    if (orderSearch) orderSearch.value = query;
    if (orderStatusFilter) orderStatusFilter.value = 'all';
    renderAdminOrders(State.getAllOrders ? State.getAllOrders() : []);
    return;
  }

  admTab('users');
  const searchInput = document.getElementById('adm-user-search');
  if (searchInput) searchInput.value = query;
  renderAdminUsers(query);
}

function renderAdminAlerts() {
  const wrap = document.getElementById('adm-alert-list');
  if (!wrap) return;
  const alerts = State.getAdminAlerts ? State.getAdminAlerts() : [];
  refreshAdminBadges();

  if (!alerts.length) {
    wrap.innerHTML = '<div style="text-align:center;color:var(--light);font-size:1.4rem;padding:1.6rem">No delivery delay alerts right now.</div>';
    return;
  }

  wrap.innerHTML = alerts.map((alert) => `
    <div class="adm-alert-card ${alert.read ? '' : 'unread'}">
      <div class="adm-alert-head">
        <div>
          <div class="adm-alert-title">${alert.type === 'delivery_delay' ? 'Delayed delivery alert' : 'Admin alert'}</div>
          <div class="adm-alert-meta">Order #${esc(alert.orderId || '—')} · ${esc(alert.username || '—')} · ${formatAdmDate(alert.createdAt)}</div>
        </div>
        <button class="adm-btn-sm ${alert.read ? '' : 'adm-green'}" onclick="adminToggleAlertRead('${alert.id}', ${alert.read ? 'false' : 'true'})">
          ${alert.read ? 'Mark Unread' : 'Mark Read'}
        </button>
      </div>
      <div style="font-size:1.35rem;line-height:1.6">${esc(alert.message || '')}</div>
    </div>
  `).join('');
}

function adminToggleAlertRead(id, read) {
  if (!State.markAdminAlertRead || !State.markAdminAlertRead(id, read)) return;
  renderAdminAlerts();
}

function loadDashboard() {
  if (State.processDeliveryCountdowns) State.processDeliveryCountdowns();
  const users = Object.values(State.getAllUsers ? State.getAllUsers() : {});
  const orders = State.getAllOrders ? State.getAllOrders() : [];
  const totalRev = orders.reduce((sum, order) => sum + (String(order.status || '').toLowerCase() === 'cancelled' ? 0 : (Number(order.total) || 0)), 0);
  const totalPts = users.reduce((sum, user) => sum + (Number(user.points) || 0), 0);

  setText('adm-total-users', users.length);
  setText('adm-total-orders', orders.length);
  setText('adm-total-rev', 'RM ' + totalRev.toFixed(2));
  setText('adm-total-pts', totalPts + ' pts');
  refreshAdminBadges();
  refreshAdminChrome(__admCurrentTab);
  renderAdminAlerts();
  renderAdminRecentOrders(orders.slice(0, 20));
}

/* ── Contact messages ── */
function renderAdminMessages() {
  const wrap = document.getElementById('adm-message-list');
  if (!wrap) return;
  const messages = State.getMessages ? State.getMessages() : [];
  refreshAdminBadges();

  if (!messages.length) {
    wrap.innerHTML = '<div style="text-align:center;color:var(--light);font-size:1.5rem;padding:2rem">No report messages yet.</div>';
    return;
  }

  wrap.innerHTML = messages.map((m) => `
    <div class="adm-message-card ${m.read ? '' : 'unread'}">
      <div class="adm-message-top">
        <div>
          <div class="adm-message-name">${esc(m.name || m.username || 'Unknown User')}</div>
          <div class="adm-message-meta">
            <div><strong>Username:</strong> ${esc(m.username || '—')}</div>
            <div><strong>Email:</strong> ${esc(m.email || '—')}</div>
            <div><strong>Phone:</strong> ${esc(m.phone || '—')}</div>
            <div><strong>Sent:</strong> ${esc(formatAdmDate(m.createdAt))}</div>
            <div><strong>Support lane:</strong> ${esc((m.supportPriority || 'standard').replace(/-/g, ' '))}</div>
            <div><strong>Membership:</strong> ${esc(m.membershipPlanName || 'Free')}</div>
            <div><strong>Account type:</strong> ${esc(m.accountType || 'personal')}</div>
          </div>
        </div>
        <span class="adm-message-status ${m.read ? 'read' : 'unread'}">${m.read ? 'Read' : 'Unread'}</span>
      </div>
      <div class="adm-message-body">${esc(m.message || '')}</div>
      <div class="adm-message-actions">
        <button class="adm-btn-sm adm-green" onclick="adminToggleMessageRead('${m.id}', ${m.read ? 'false' : 'true'})">
          <i class="fas ${m.read ? 'fa-envelope-open' : 'fa-check'}"></i> ${m.read ? 'Mark Unread' : 'Mark Read'}
        </button>
        <button class="adm-btn-sm adm-red" onclick="adminDeleteMessage('${m.id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('');
}

function adminToggleMessageRead(id, shouldRead) {
  if (!State.markMessageRead || !State.markMessageRead(id, shouldRead)) return;
  renderAdminMessages();
  loadDashboard();
  State.notify(shouldRead ? '✅ Message marked as read.' : '↩️ Message marked as unread.');
}

function adminDeleteMessage(id) {
  if (!confirm('Delete this message?')) return;
  if (!State.deleteMessage || !State.deleteMessage(id)) return;
  renderAdminMessages();
  loadDashboard();
  State.notify('🗑️ Message deleted.');
}

/* ── Users ── */
let __admExpandedVoucherUser = null;

function formatAdmDateOnly(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-MY', { dateStyle: 'medium' });
}

function encodeAdmValue(v) {
  return encodeURIComponent(String(v ?? ''));
}

function decodeAdmValue(v) {
  try {
    return decodeURIComponent(String(v ?? ''));
  } catch (err) {
    return String(v ?? '');
  }
}

function findAdminUserInput(username, field) {
  const target = String(username || '');
  return Array.from(document.querySelectorAll('[data-adm-user-input]')).find((input) => {
    return input.dataset.username === target && input.dataset.admUserInput === field;
  }) || null;
}

function isAdminUserEditActive() {
  const active = document.activeElement;
  if (!active || !active.closest) return false;
  return !!active.closest('#adm-users-list') && /^(input|textarea|select)$/i.test(active.tagName || '');
}

function renderAdminUsersSafely(filter = '') {
  if (isAdminUserEditActive()) return false;
  renderAdminUsers(filter);
  return true;
}

function adminCommitUserAdjustment(event, encodedUsername, field) {
  if (!event || event.key !== 'Enter') return;
  event.preventDefault();
  if (field === 'points') adminSetPoints(encodedUsername);
  if (field === 'wallet') adminSetWallet(encodedUsername);
}

function getUserVoucherGroupKey(voucher = {}) {
  return [voucher.id || '', voucher.label || '', voucher.icon || ''].join('||');
}

function getUserVoucherGroups(vouchers = []) {
  const map = new Map();
  (Array.isArray(vouchers) ? vouchers : []).forEach((voucher, index) => {
    const key = getUserVoucherGroupKey(voucher);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: voucher.label || 'Voucher',
        icon: voucher.icon || '🎟️',
        count: 0,
        firstIndex: index,
      });
    }
    const group = map.get(key);
    group.count += 1;
  });
  return Array.from(map.values()).sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
}

function getAdminUsersView(filter = '') {
  const needle = String(filter || '').trim().toLowerCase();
  const voucherFilter = document.getElementById('adm-user-voucher-filter')?.value || 'all';
  const sortBy = document.getElementById('adm-user-sort')?.value || 'recent';

  const users = Object.values(State.getAllUsers ? State.getAllUsers() : {})
    .filter((u) => !needle || [u.username, u.name, u.email].some((v) => String(v || '').toLowerCase().includes(needle)))
    .filter((u) => {
      const voucherCount = Array.isArray(u.vouchers) ? u.vouchers.length : 0;
      if (voucherFilter === 'with-vouchers') return voucherCount > 0;
      if (voucherFilter === 'heavy') return voucherCount >= 5;
      if (voucherFilter === 'light') return voucherCount > 0 && voucherCount < 5;
      if (voucherFilter === 'no-vouchers') return voucherCount === 0;
      return true;
    });

  users.sort((a, b) => {
    if (sortBy === 'vouchers-desc') {
      return (Number(b.vouchers?.length || 0) - Number(a.vouchers?.length || 0))
        || (new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));
    }
    if (sortBy === 'points-desc') {
      return (Number(b.points) || 0) - (Number(a.points) || 0)
        || (Number(b.vouchers?.length || 0) - Number(a.vouchers?.length || 0));
    }
    if (sortBy === 'wallet-desc') {
      return (Number(b.wallet) || 0) - (Number(a.wallet) || 0)
        || (Number(b.points) || 0) - (Number(a.points) || 0);
    }
    if (sortBy === 'name-asc') {
      return String(a.name || a.username || '').localeCompare(String(b.name || b.username || ''), 'en', { sensitivity: 'base' });
    }
    return new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0);
  });

  return users;
}

function renderAdminUserInsights(users) {
  const wrap = document.getElementById('adm-user-insights');
  if (!wrap) return;
  const visibleUsers = users.length;
  const voucherTotal = users.reduce((sum, user) => sum + ((Array.isArray(user.vouchers) ? user.vouchers.length : 0)), 0);
  const heavyUsers = users.filter((user) => (Array.isArray(user.vouchers) ? user.vouchers.length : 0) >= 5).length;
  const averageLoad = visibleUsers ? (voucherTotal / visibleUsers).toFixed(1) : '0.0';

  wrap.innerHTML = `
    <div class="adm-user-insight">
      <div class="adm-user-insight-label"><i class="fas fa-users"></i> Visible users</div>
      <strong>${visibleUsers}</strong>
      <span>Filtered from the current search and sort controls</span>
    </div>
    <div class="adm-user-insight">
      <div class="adm-user-insight-label"><i class="fas fa-ticket-alt"></i> Voucher inventory</div>
      <strong>${voucherTotal}</strong>
      <span>Total vouchers currently visible in this view</span>
    </div>
    <div class="adm-user-insight">
      <div class="adm-user-insight-label"><i class="fas fa-layer-group"></i> Heavy accounts</div>
      <strong>${heavyUsers}</strong>
      <span>Users carrying 5 or more vouchers</span>
    </div>
    <div class="adm-user-insight">
      <div class="adm-user-insight-label"><i class="fas fa-chart-line"></i> Average load</div>
      <strong>${averageLoad}</strong>
      <span>Average vouchers per visible user</span>
    </div>
  `;
}

function getAdminUserInitial(user) {
  const source = String(user?.name || user?.username || '?').trim();
  return source ? source.charAt(0).toUpperCase() : '?';
}

function renderAdminUserCard(user) {
  const username = String(user.username || 'unknown');
  const name = user.name || username;
  const vouchers = Array.isArray(user.vouchers) ? user.vouchers : [];
  const groups = getUserVoucherGroups(vouchers);
  const previewGroups = groups.slice(0, 3);
  const hiddenGroupCount = Math.max(0, groups.length - previewGroups.length);
  const voucherCount = vouchers.length;
  const uniqueVoucherCount = groups.length;
  const expanded = __admExpandedVoucherUser === username;

  return `
    <article class="adm-user-card">
      <div class="adm-user-card-top">
        <div class="adm-user-identity">
          <div class="adm-user-avatar">${esc(getAdminUserInitial(user))}</div>
          <div style="min-width:0">
            <div class="adm-user-name-row">
              <div class="adm-user-name">${esc(name)}</div>
              <span class="adm-user-username">@${esc(username)}</span>
            </div>
            <div class="adm-user-meta">
              <span><i class="fas fa-envelope"></i> ${esc(user.email || 'No email')}</span>
              <span><i class="fas fa-phone"></i> ${esc(user.phone || 'No phone')}</span>
            </div>
            <div class="adm-user-registered">Joined ${formatAdmDateOnly(user.registeredAt)}</div>
          </div>
        </div>
        <div class="adm-user-stats">
          <div class="adm-user-stat">
            <div class="adm-user-stat-label">Points</div>
            <strong>${Number(user.points) || 0}</strong>
          </div>
          <div class="adm-user-stat">
            <div class="adm-user-stat-label">Wallet</div>
            <strong>RM ${(Number(user.wallet) || 0).toFixed(2)}</strong>
          </div>
          <div class="adm-user-stat">
            <div class="adm-user-stat-label">Voucher load</div>
            <strong>${voucherCount}</strong>
          </div>
        </div>
      </div>

      <div class="adm-user-card-grid">
        <div class="adm-user-edit-card">
          <div class="adm-user-box-label"><i class="fas fa-coins"></i> Adjust points</div>
          <div class="adm-user-edit-row">
            <input type="number" class="adm-inp" data-adm-user-input="points" data-username="${esc(username)}" value="${Number(user.points) || 0}" min="0" step="1" inputmode="numeric" onkeydown="adminCommitUserAdjustment(event, '${encodeAdmValue(username)}', 'points')">
            <button class="adm-btn-sm adm-green" type="button" onclick="adminSetPoints('${encodeAdmValue(username)}')">Set</button>
          </div>
          <div class="adm-user-help">Update reward points without cluttering the rest of the user card.</div>
        </div>

        <div class="adm-user-edit-card">
          <div class="adm-user-box-label"><i class="fas fa-wallet"></i> Adjust wallet</div>
          <div class="adm-user-edit-row">
            <input type="number" class="adm-inp" data-adm-user-input="wallet" data-username="${esc(username)}" value="${(Number(user.wallet) || 0).toFixed(2)}" min="0" step="0.01" inputmode="decimal" onkeydown="adminCommitUserAdjustment(event, '${encodeAdmValue(username)}', 'wallet')">
            <button class="adm-btn-sm adm-green" type="button" onclick="adminSetWallet('${encodeAdmValue(username)}')">Set</button>
          </div>
          <div class="adm-user-help">Balance edits stay separate from the voucher inventory for easier scanning.</div>
        </div>

        <div class="adm-user-voucher-box">
          <div class="adm-user-box-label"><i class="fas fa-ticket-alt"></i> Voucher inventory</div>
          <div class="adm-user-voucher-summary">
            <span><i class="fas fa-tags"></i> ${voucherCount} total</span>
            <span><i class="fas fa-layer-group"></i> ${uniqueVoucherCount} unique type${uniqueVoucherCount === 1 ? '' : 's'}</span>
            <span><i class="fas fa-eye"></i> ${voucherCount >= 5 ? 'Needs compact view' : 'Easy to scan'}</span>
          </div>
          <div class="adm-user-voucher-preview">
            ${previewGroups.length ? previewGroups.map((group) => `
              <span class="adm-voucher-chip">${group.icon || '🎟️'} ${esc(group.label)}${group.count > 1 ? ` ×${group.count}` : ''}</span>
            `).join('') : '<div class="adm-user-voucher-empty">No vouchers assigned yet.</div>'}
            ${hiddenGroupCount ? `<span class="adm-user-voucher-more">+${hiddenGroupCount} more type${hiddenGroupCount === 1 ? '' : 's'}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="adm-user-card-actions">
        <div class="adm-user-help">Open the grouped voucher drawer to remove duplicates faster without stretching the page layout.</div>
        <div style="display:flex;gap:.7rem;flex-wrap:wrap">
          <button class="adm-btn-sm" onclick="adminToggleVoucherPanel('${encodeAdmValue(username)}')">
            <i class="fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i> ${expanded ? 'Hide vouchers' : 'Manage vouchers'}
          </button>
          <button class="adm-btn-sm adm-green" onclick="adminOpenVoucherIssuer('${encodeAdmValue(username)}')"><i class="fas fa-plus"></i> Issue voucher</button>
          <button class="adm-btn-sm adm-red" onclick="adminDeleteUser('${encodeAdmValue(username)}')"><i class="fas fa-trash"></i> Delete user</button>
        </div>
      </div>

      ${expanded ? `
        <div class="adm-user-voucher-panel">
          <div class="adm-user-voucher-panel-title">
            <strong>${esc(name)}'s voucher groups</strong>
            <span>${voucherCount} voucher${voucherCount === 1 ? '' : 's'} · grouped for faster cleanup</span>
          </div>
          <div class="adm-user-voucher-group-list">
            ${groups.length ? groups.map((group) => `
              <div class="adm-user-voucher-group">
                <div class="adm-user-voucher-group-main">
                  <div class="adm-user-voucher-icon">${group.icon || '🎟️'}</div>
                  <div>
                    <div class="adm-user-voucher-group-title">${esc(group.label)}</div>
                    <div class="adm-user-voucher-group-meta">Voucher type grouped together to keep large accounts readable.</div>
                  </div>
                </div>
                <div class="adm-user-voucher-group-actions">
                  <span class="adm-voucher-count-pill">×${group.count}</span>
                  <button class="adm-btn-sm" onclick="adminRemoveVoucher('${encodeAdmValue(username)}', ${group.firstIndex})">Remove one</button>
                  ${group.count > 1 ? `<button class="adm-btn-sm adm-red" onclick="adminRemoveVoucherGroup('${encodeAdmValue(username)}', '${encodeAdmValue(group.key)}')">Remove all</button>` : ''}
                </div>
              </div>
            `).join('') : '<div class="adm-user-voucher-empty">No vouchers to manage.</div>'}
          </div>
        </div>
      ` : ''}
    </article>
  `;
}

function renderAdminUsers(filter = '') {
  const list = document.getElementById('adm-users-list');
  if (!list) return;
  const users = getAdminUsersView(filter);
  if (__admExpandedVoucherUser && !users.some((user) => String(user.username || '') === __admExpandedVoucherUser)) {
    __admExpandedVoucherUser = null;
  }
  renderAdminUserInsights(users);

  if (!users.length) {
    list.innerHTML = `
      <div class="adm-user-empty">
        <strong>No users found</strong>
        Try clearing the search, changing the voucher filter, or switching the sort order.
      </div>
    `;
    return;
  }

  list.innerHTML = users.map((user) => renderAdminUserCard(user)).join('');
}

function adminToggleVoucherPanel(encodedUsername) {
  const username = decodeAdmValue(encodedUsername);
  __admExpandedVoucherUser = __admExpandedVoucherUser === username ? null : username;
  renderAdminUsers(document.getElementById('adm-user-search')?.value || '');
}

function adminOpenVoucherIssuer(encodedUsername) {
  openAddVoucherModal(decodeAdmValue(encodedUsername));
}

function resolveAdminUserKey(username, allUsers = null) {
  const all = allUsers || (State.getAllUsers ? State.getAllUsers() : {});
  const raw = String(username || '').trim();
  if (raw && Object.prototype.hasOwnProperty.call(all, raw)) return raw;
  const target = State._safeUsername ? State._safeUsername(raw) : raw;
  return Object.keys(all).find((candidate) => {
    const safeCandidate = State._safeUsername ? State._safeUsername(candidate) : String(candidate || '').trim();
    return safeCandidate === target || String(candidate || '').trim() === raw;
  }) || '';
}

function persistAdminUserVouchers(username, vouchers) {
  const all = State.getAllUsers ? State.getAllUsers() : {};
  const key = resolveAdminUserKey(username, all);
  if (!key || !all[key]) return false;
  all[key].vouchers = Array.isArray(vouchers) ? vouchers : [];
  localStorage.setItem('sgf_all_users', JSON.stringify(all));
  const currentUser = State.getUser ? State.getUser() : null;
  if (currentUser && (currentUser.username === key || (State._safeUsername && State._safeUsername(currentUser.username) === State._safeUsername(key)))) {
    currentUser.vouchers = all[key].vouchers;
    localStorage.setItem('sgf_user', JSON.stringify(currentUser));
  }
  if (window.SGFBackend && window.SGFBackend.enabled && typeof window.SGFBackend.syncCurrentUserNow === 'function') {
    window.SGFBackend.syncCurrentUserNow(key).catch((err) => console.error('[Admin] voucher sync failed', err));
  }
  return true;
}


function adminRemoveVoucherGroup(encodedUsername, encodedGroupKey) {
  const username = decodeAdmValue(encodedUsername);
  const groupKey = decodeAdmValue(encodedGroupKey);
  const all = State.getAllUsers ? State.getAllUsers() : {};
  const user = all[username];
  if (!user) return;
  const vouchers = Array.isArray(user.vouchers) ? user.vouchers : [];
  const nextVouchers = vouchers.filter((voucher) => getUserVoucherGroupKey(voucher) !== groupKey);
  const removedCount = vouchers.length - nextVouchers.length;
  if (!removedCount) return;
  if (!persistAdminUserVouchers(username, nextVouchers)) return;
  State.notify(`🧹 Removed ${removedCount} voucher${removedCount === 1 ? '' : 's'} from ${username}.`);
  renderAdminUsers(document.getElementById('adm-user-search')?.value || '');
}

function adminSetPoints(encodedUsername) {
  const username = decodeAdmValue(encodedUsername);
  const input = findAdminUserInput(username, 'points');
  const rawValue = input ? input.value : '';
  const val = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(val) || val < 0) return State.notify('⚠️ Invalid points value.');
  if (!State.updateUserByAdmin || !State.updateUserByAdmin(username, { points: val, updatedAt: new Date().toISOString() })) {
    return State.notify(`⚠️ Could not update ${username}. User was not found.`);
  }
  if (input) input.value = String(val);
  State.notify(`✅ ${username}'s points set to ${val}.`);
  if (window.SGFBackend && window.SGFBackend.enabled && typeof window.SGFBackend.syncCurrentUserNow === 'function') {
    window.SGFBackend.syncCurrentUserNow(username).catch((err) => console.error('[Admin] points sync failed', err));
  }
  renderAdminUsers(document.getElementById('adm-user-search')?.value || '');
  loadDashboard();
}

function adminSetWallet(encodedUsername) {
  const username = decodeAdmValue(encodedUsername);
  const input = findAdminUserInput(username, 'wallet');
  const rawValue = input ? input.value : '';
  const val = Number.parseFloat(rawValue);
  if (!Number.isFinite(val) || val < 0) return State.notify('⚠️ Invalid wallet value.');
  const wallet = Number(val.toFixed(2));
  if (!State.updateUserByAdmin || !State.updateUserByAdmin(username, { wallet, updatedAt: new Date().toISOString() })) {
    return State.notify(`⚠️ Could not update ${username}. User was not found.`);
  }
  if (input) input.value = wallet.toFixed(2);
  State.notify(`✅ ${username}'s wallet set to RM ${wallet.toFixed(2)}.`);
  if (window.SGFBackend && window.SGFBackend.enabled && typeof window.SGFBackend.syncCurrentUserNow === 'function') {
    window.SGFBackend.syncCurrentUserNow(username).catch((err) => console.error('[Admin] wallet sync failed', err));
  }
  renderAdminUsers(document.getElementById('adm-user-search')?.value || '');
  loadDashboard();
}

function adminDeleteUser(encodedUsername) {
  const username = decodeAdmValue(encodedUsername);
  if (!username) return State.notify('⚠️ Unable to identify that user.');
  if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
  if (!State.deleteUserByAdmin || !State.deleteUserByAdmin(username)) {
    return State.notify(`⚠️ Could not delete ${username}. User was not found.`);
  }
  State.notify(`🗑️ User "${username}" deleted.`);
  renderAdminUsers(document.getElementById('adm-user-search')?.value || '');
  loadDashboard();
}

function adminRemoveVoucher(encodedUsername, idx) {
  const username = decodeAdmValue(encodedUsername);
  const all = State.getAllUsers ? State.getAllUsers() : {};
  const key = resolveAdminUserKey(username, all);
  if (!key || !all[key]) return State.notify(`⚠️ Could not find ${username}.`);
  const vouchers = Array.isArray(all[key].vouchers) ? [...all[key].vouchers] : [];
  const removeIndex = Number.parseInt(idx, 10);
  if (!Number.isFinite(removeIndex) || removeIndex < 0 || removeIndex >= vouchers.length) {
    return State.notify('⚠️ Voucher selection is no longer valid.');
  }
  vouchers.splice(removeIndex, 1);
  if (!persistAdminUserVouchers(key, vouchers)) return;
  State.notify(`🗑️ Voucher removed from ${key}.`);
  renderAdminUsers(document.getElementById('adm-user-search')?.value || '');
}


/* ── Voucher Modal ── */
let _addVoucherTarget = null;
function openAddVoucherModal(username) {
  _addVoucherTarget = username;
  const modal = document.getElementById('adm-voucher-modal');
  const list = document.getElementById('adm-voucher-list');
  if (!modal || !list) return;
  list.innerHTML = Object.entries(VOUCHER_RULES).map(([vid, def]) => `
    <div class="adm-voucher-item" onclick="adminIssueVoucher('${encodeAdmValue(vid)}','${encodeAdmValue(def.label)}','${encodeAdmValue(def.icon || '🎟️')}')">
      <span style="font-size:2rem">${def.icon || '🎟️'}</span>
      <div style="flex:1">
        <div style="font-weight:600">${esc(def.label)}</div>
        <div style="font-size:1.3rem;color:var(--light)">${esc(def.desc)}</div>
        <ul style="font-size:1.2rem;color:var(--light);margin:.3rem 0 0 1.5rem">
          ${(def.rules || []).map((rule) => `<li>${esc(rule)}</li>`).join('')}
        </ul>
      </div>
      <button class="adm-btn-sm adm-green">Issue</button>
    </div>
  `).join('');
  document.getElementById('adm-voucher-modal-title').textContent = `Issue Voucher to: ${username}`;
  modal.classList.add('active');
}

function adminIssueVoucher(vid, label, icon) {
  vid = decodeAdmValue(vid);
  label = decodeAdmValue(label);
  icon = decodeAdmValue(icon);
  if (!_addVoucherTarget) return;
  if (State.addVoucherToUser && State.addVoucherToUser(_addVoucherTarget, { id: vid, label, icon })) {
    State.notify(`🎟️ Voucher "${label}" issued to ${_addVoucherTarget}.`);
    closeAdmVoucherModal();
    renderAdminUsers(document.getElementById('adm-user-search')?.value || '');
  }
}

function closeAdmVoucherModal() {
  document.getElementById('adm-voucher-modal')?.classList.remove('active');
  _addVoucherTarget = null;
}

/* ── Orders ── */
const __adminDriverTimers = {};
const __adminOrderDrafts = {};
let __adminOrderInteractionLockUntil = 0;

function formatAdmMoney(value) {
  return 'RM ' + (Number(value) || 0).toFixed(2);
}

function formatOrderStatusLabel(status = '') {
  return String(status || 'pending')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Pending';
}

function getOrderStatusClass(status = '') {
  return 'is-' + String(status || 'pending').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
}

function getOrderPrimaryDate(order = {}) {
  return order.placedAt || order.createdAt || order.updatedAt || order.date || null;
}

function sanitizeOrderEta(value, fallback = 25) {
  if (String(value ?? '').trim() === '') return '';
  const numeric = Number(value);
  const safeFallback = Math.max(10, Math.min(90, Number(fallback) || 25));
  if (!Number.isFinite(numeric)) return safeFallback;
  return Math.max(10, Math.min(90, Math.round(numeric)));
}

function getOrderEtaValue(order = {}) {
  return sanitizeOrderEta(order.etaMin, 25) || 25;
}

function getOrderItemCount(order = {}) {
  return (Array.isArray(order.items) ? order.items : []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

function sortOrderHistory(history = [], direction = 'desc') {
  const list = Array.isArray(history) ? history.filter(Boolean) : [];
  return list.slice().sort((a, b) => {
    const ta = new Date(a.at || 0).getTime() || 0;
    const tb = new Date(b.at || 0).getTime() || 0;
    return direction === 'asc' ? ta - tb : tb - ta;
  });
}

function getOrderLatestNote(order = {}) {
  const latest = sortOrderHistory(order.statusHistory, 'desc')[0] || null;
  return String((latest && latest.note) || order.deliveryNote || '').trim();
}

function getOrderById(orderId) {
  return (State.getAllOrders ? State.getAllOrders() : []).find((order) => String(order.id) === String(orderId)) || null;
}

function getDriverOptions(selectedDriver = null) {
  const drivers = State.getAvailableDrivers ? State.getAvailableDrivers() : [];
  const selectedObj = selectedDriver && typeof selectedDriver === 'object' ? selectedDriver : null;
  const selectedName = String(selectedObj ? (selectedObj.name || '') : (selectedDriver || '')).trim();
  const pool = drivers.map((driver) => ({ ...(driver || {}) }));
  if (selectedName && !pool.some((driver) => String(driver.name || '').trim() === selectedName)) {
    pool.unshift({
      ...(selectedObj || {}),
      name: selectedName,
      zone: (selectedObj && selectedObj.zone) || 'Assigned route',
      phone: (selectedObj && selectedObj.phone) || '',
      vehicle: (selectedObj && selectedObj.vehicle) || ''
    });
  }
  const base = `<option value="">Select driver</option>`;
  const opts = pool.map((driver) => {
    const payload = encodeURIComponent(JSON.stringify(driver));
    const driverName = String(driver.name || '').trim();
    const selected = driverName && driverName === selectedName;
    return `<option value="${payload}" ${selected ? 'selected' : ''}>${esc(driverName || 'Driver')} • ${esc(driver.zone || 'Zone')}</option>`;
  }).join('');
  return base + opts;
}

function getSelectedOrderDriver(order, draft) {
  if (draft && draft.driverValue) {
    try {
      return JSON.parse(decodeURIComponent(draft.driverValue));
    } catch {
      return draft.driverName ? { name: draft.driverName } : (order.driver || null);
    }
  }
  if (order && order.driver && order.driver.name) return order.driver;
  if (draft && draft.driverName) return { name: draft.driverName };
  return null;
}

function createAdminOrderDraft(order = {}) {
  return {
    status: String(order.status || 'pending'),
    driverValue: '',
    driverName: order.driver && order.driver.name ? String(order.driver.name) : '',
    etaMin: getOrderEtaValue(order)
  };
}

function syncAdminOrderDraft(order) {
  if (!order || typeof order !== 'object') return null;
  const next = createAdminOrderDraft(order);
  __adminOrderDrafts[String(order.id)] = next;
  return next;
}

function getAdminOrderDraft(order = {}) {
  const id = String(order.id || '');
  if (!id) return createAdminOrderDraft(order);
  if (!__adminOrderDrafts[id]) {
    return syncAdminOrderDraft(order);
  }
  const draft = __adminOrderDrafts[id];
  if (draft.status == null) draft.status = String(order.status || 'pending');
  if (draft.driverName == null) draft.driverName = order.driver && order.driver.name ? String(order.driver.name) : '';
  if (draft.driverValue == null) draft.driverValue = '';
  if (draft.etaMin == null) draft.etaMin = getOrderEtaValue(order);
  return draft;
}

function adminTouchOrderControls(orderId = '', ms = 6500) {
  __adminOrderInteractionLockUntil = Date.now() + ms;
  if (!orderId) return;
  const order = getOrderById(orderId);
  if (order && !__adminOrderDrafts[String(orderId)]) {
    syncAdminOrderDraft(order);
  }
}

function adminIsOrderEditorBusy() {
  const ordersVisible = document.getElementById('adm-panel-orders')?.style.display === 'block';
  if (!ordersVisible) return false;
  const active = document.activeElement;
  if (active && active.closest('.adm-order-interactive')) return true;
  return Date.now() < __adminOrderInteractionLockUntil;
}

function setDriverMetaMessage(orderId, message, color = '#64748b') {
  const meta = document.getElementById('driver-meta-' + orderId);
  if (!meta) return;
  meta.textContent = message;
  meta.style.color = color;
}

function setStatusMetaMessage(orderId, message, color = '#64748b') {
  const meta = document.getElementById('status-meta-' + orderId);
  if (!meta) return;
  meta.textContent = message;
  meta.style.color = color;
}

function getAdminOrdersView(sourceOrders = null) {
  const query = String(document.getElementById('adm-order-search')?.value || '').trim().toLowerCase();
  const statusFilter = String(document.getElementById('adm-order-status-filter')?.value || 'all').trim().toLowerCase();
  const sortBy = String(document.getElementById('adm-order-sort')?.value || 'newest').trim().toLowerCase();
  const orders = Array.isArray(sourceOrders) ? [...sourceOrders] : (State.getAllOrders ? [...State.getAllOrders()] : []);

  const filtered = orders.filter((order) => {
    const driverName = order.driver && order.driver.name ? order.driver.name : '';
    const itemsText = Array.isArray(order.items)
      ? order.items.map((item) => [item.name || item.title || '', item.options?.summary || ''].join(' ')).join(' ')
      : '';
    const haystack = [order.id, order.username, order.status, order.method, order.paymentMethod, driverName, order.deliveryNote, itemsText]
      .join(' ')
      .toLowerCase();
    if (query && !haystack.includes(query)) return false;

    const cleanStatus = String(order.status || '').toLowerCase();
    const delayed = !!order.delayedAlertSent && ['pending', 'preparing', 'on the way'].includes(cleanStatus);
    const hasDriver = !!(order.driver && order.driver.name);
    if (statusFilter === 'active') return ['pending', 'preparing', 'on the way'].includes(cleanStatus);
    if (statusFilter === 'delayed') return delayed;
    if (statusFilter === 'assigned') return hasDriver;
    if (statusFilter === 'unassigned') return !hasDriver;
    if (statusFilter !== 'all') return cleanStatus === statusFilter;
    return true;
  });

  filtered.sort((a, b) => {
    const dateA = new Date(getOrderPrimaryDate(a) || 0).getTime();
    const dateB = new Date(getOrderPrimaryDate(b) || 0).getTime();
    if (sortBy === 'oldest') return dateA - dateB;
    if (sortBy === 'total-desc') return (Number(b.total) || 0) - (Number(a.total) || 0) || (dateB - dateA);
    if (sortBy === 'total-asc') return (Number(a.total) || 0) - (Number(b.total) || 0) || (dateB - dateA);
    if (sortBy === 'eta-asc') return getOrderEtaValue(a) - getOrderEtaValue(b) || (dateB - dateA);
    if (sortBy === 'user-asc') return String(a.username || '').localeCompare(String(b.username || ''), 'en', { sensitivity: 'base' }) || (dateB - dateA);
    return dateB - dateA;
  });

  return filtered;
}

function renderAdminOrderInsights(visibleOrders, sourceOrders = null) {
  const wrap = document.getElementById('adm-order-insights');
  if (!wrap) return;
  const allOrders = Array.isArray(sourceOrders) ? sourceOrders : (State.getAllOrders ? State.getAllOrders() : []);
  const activeVisible = visibleOrders.filter((order) => ['pending', 'preparing', 'on the way'].includes(String(order.status || '').toLowerCase())).length;
  const delayedVisible = visibleOrders.filter((order) => !!order.delayedAlertSent && ['pending', 'preparing', 'on the way'].includes(String(order.status || '').toLowerCase())).length;
  const assignedVisible = visibleOrders.filter((order) => order.driver && order.driver.name).length;
  const visibleRevenue = visibleOrders.reduce((sum, order) => sum + (String(order.status || '').toLowerCase() === 'cancelled' ? 0 : (Number(order.total) || 0)), 0);
  wrap.innerHTML = `
    <div class="adm-order-insight">
      <div class="adm-order-insight-label"><i class="fas fa-receipt"></i> Visible orders</div>
      <strong>${visibleOrders.length}</strong>
      <span>Filtered from ${allOrders.length} total orders in the system</span>
    </div>
    <div class="adm-order-insight">
      <div class="adm-order-insight-label"><i class="fas fa-bolt"></i> Active now</div>
      <strong>${activeVisible}</strong>
      <span>Pending, preparing, and on-the-way orders in this view</span>
    </div>
    <div class="adm-order-insight">
      <div class="adm-order-insight-label"><i class="fas fa-motorcycle"></i> Driver assigned</div>
      <strong>${assignedVisible}</strong>
      <span>${Math.max(0, visibleOrders.length - assignedVisible)} still need delivery assignment</span>
    </div>
    <div class="adm-order-insight">
      <div class="adm-order-insight-label"><i class="fas fa-chart-line"></i> Visible revenue</div>
      <strong>${formatAdmMoney(visibleRevenue)}</strong>
      <span>${delayedVisible} delayed order${delayedVisible === 1 ? '' : 's'} currently need attention</span>
    </div>
  `;
}

function getRecentOrderItemSummary(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return 'No items';
  const count = getOrderItemCount(order);
  const names = items.slice(0, 2).map((item) => item.name || item.title || 'Item').join(', ');
  return `${count} item${count === 1 ? '' : 's'} · ${names}${items.length > 2 ? ' +' + (items.length - 2) + ' more' : ''}`;
}

function renderAdminRecentOrders(orders) {
  const tbody = document.getElementById('adm-recent-orders-tbody');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--light)">No orders yet.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map((order) => {
    const delayed = !!order.delayedAlertSent && ['pending', 'preparing', 'on the way'].includes(String(order.status || '').toLowerCase());
    return `
      <tr>
        <td>
          <strong>#${esc(order.id)}</strong>
          <div style="font-size:1.15rem;color:var(--light);margin-top:.3rem">${esc(order.username || '—')}</div>
        </td>
        <td style="font-size:1.15rem">${esc(formatAdmDate(getOrderPrimaryDate(order) || order.date))}</td>
        <td style="font-size:1.15rem;line-height:1.55">${esc(getRecentOrderItemSummary(order))}</td>
        <td style="color:var(--red);font-weight:700">${formatAdmMoney(order.total)}</td>
        <td>
          <span class="adm-order-status-badge ${getOrderStatusClass(order.status)}">${esc(formatOrderStatusLabel(order.status))}</span>
          ${delayed ? '<div style="font-size:1.1rem;color:#c2410c;margin-top:.45rem;font-weight:700">Delayed attention</div>' : ''}
        </td>
        <td><button class="adm-btn-sm" type="button" onclick="adminOpenOrdersTab('${esc(order.id)}')">Manage</button></td>
      </tr>`;
  }).join('');
}

function getOrderStatusMeta(order, draft) {
  const current = formatOrderStatusLabel(order.status);
  const chosen = formatOrderStatusLabel(draft.status);
  if (String(draft.status || '').toLowerCase() === String(order.status || '').toLowerCase()) {
    return `Current status: ${current}. Choose a different option, then click Update status.`;
  }
  return `Ready to change from ${current} to ${chosen}. Nothing will save until you click Update status.`;
}

function getOrderDriverMeta(order, draft) {
  const cleanEta = sanitizeOrderEta(draft.etaMin, order.etaMin || 25);
  const etaText = cleanEta === '' ? 'enter ETA' : `${cleanEta} min`;
  if (draft.driverName) {
    return `${draft.driverName} selected • ETA ${etaText}. Click Apply delivery to save.`;
  }
  if (order.driver && order.driver.name) {
    return `${order.driver.name} currently assigned • ETA ${getOrderEtaValue(order)} min. You can change rider or time, then click Apply delivery.`;
  }
  return `Choose a driver and ETA, then click Apply delivery. The form will stay open while you adjust it.`;
}

function renderAdminOrderCard(order) {
  const draft = getAdminOrderDraft(order);
  const delayed = !!order.delayedAlertSent && ['pending', 'preparing', 'on the way'].includes(String(order.status || '').toLowerCase());
  const pointText = order.pointsStatus === 'reversed'
    ? `Points reversed: ${Number(order.pointsToAward || 0)} pts`
    : (order.pointsAwarded ? `Points added: ${Number(order.pointsToAward || 0)} pts` : `Pending points: ${Number(order.pointsToAward || 0)} pts`);
  const membershipText = order.membershipPlanName && order.membershipPlanName !== 'Free'
    ? `${order.membershipPlanName} • ${String(order.membershipSupportPriority || 'standard').replace(/-/g, ' ')}`
    : 'Free plan';
  const currentEta = sanitizeOrderEta(draft.etaMin, order.etaMin || 25);
  const history = sortOrderHistory(order.statusHistory, 'desc').slice(0, 3);
  return `
    <article class="adm-order-card" id="adm-order-card-${encodeAdmValue(order.id)}" data-adm-order-card="${esc(order.id)}">
      <div class="adm-order-card-head">
        <div>
          <div class="adm-order-title">
            <span>Order #${esc(order.id)}</span>
            <span class="adm-order-tag"><i class="fas fa-user"></i> ${esc(order.username || '—')}</span>
          </div>
          <div class="adm-order-submeta">
            <span><i class="fas fa-calendar-alt"></i> ${esc(formatAdmDate(getOrderPrimaryDate(order) || order.date))}</span>
            <span><i class="fas fa-bag-shopping"></i> ${getOrderItemCount(order)} item${getOrderItemCount(order) === 1 ? '' : 's'}</span>
            <span><i class="fas fa-credit-card"></i> ${esc(order.method || order.paymentMethod || '—')}</span>
          </div>
        </div>
        <div class="adm-order-top-tags">
          <span class="adm-order-status-badge ${getOrderStatusClass(order.status)}">${esc(formatOrderStatusLabel(order.status))}</span>
          ${delayed ? '<span class="adm-order-status-badge is-delayed"><i class="fas fa-triangle-exclamation"></i> Delayed</span>' : ''}
          ${order.refunded ? `<span class="adm-order-tag adm-order-refund"><i class="fas fa-wallet"></i> Refunded ${formatAdmMoney(order.refundAmount)}</span>` : ''}
        </div>
      </div>

      <div class="adm-order-body">
        <div class="adm-order-main">
          <div class="adm-order-stat-grid">
            <div class="adm-order-stat">
              <div class="adm-order-stat-label"><i class="fas fa-wallet"></i> Total</div>
              <strong>${formatAdmMoney(order.total)}</strong>
              <small>${esc(order.method || order.paymentMethod || 'Payment method unavailable')}</small>
            </div>
            <div class="adm-order-stat">
              <div class="adm-order-stat-label"><i class="fas fa-motorcycle"></i> Delivery</div>
              <strong>${esc(order.driver?.name || 'Not assigned yet')}</strong>
              <small>${order.driver?.zone ? esc(order.driver.zone) + ' • ' : ''}ETA ${getOrderEtaValue(order)} min</small>
            </div>
            <div class="adm-order-stat">
              <div class="adm-order-stat-label"><i class="fas fa-coins"></i> Reward points</div>
              <strong>${Number(order.pointsToAward || 0)} pts</strong>
              <small class="${order.pointsAwarded || order.pointsStatus === 'reversed' ? 'adm-order-highlight' : ''}">${esc(pointText)}</small>
            </div>
            <div class="adm-order-stat">
              <div class="adm-order-stat-label"><i class="fas fa-star"></i> Membership</div>
              <strong>${esc(order.membershipPlanName || 'Free')}</strong>
              <small>${esc(membershipText)}</small>
            </div>
          </div>

          <div class="adm-order-items">
            <div class="adm-order-section-title"><i class="fas fa-burger"></i> Items ordered</div>
            <div class="adm-order-items-list">
              ${(Array.isArray(order.items) ? order.items : []).map((item) => `
                <div class="adm-order-item">
                  <div>
                    <div class="adm-order-item-title">${esc(item.name || item.title || 'Item')}</div>
                    <div class="adm-order-item-note">${esc(item.options?.summary || 'Standard preparation')}</div>
                  </div>
                  <div class="adm-order-item-qty">×${Number(item.qty) || 0}</div>
                </div>
              `).join('') || '<div class="adm-order-history-copy">No item details available.</div>'}
            </div>
          </div>

          <div class="adm-order-history">
            <div class="adm-order-section-title"><i class="fas fa-route"></i> Latest order note</div>
            <div class="adm-order-history-copy">${esc(getOrderLatestNote(order) || 'No delivery note yet.')}</div>
            <div class="adm-order-history-timeline">
              ${history.map((entry) => `
                <div class="adm-order-history-entry">
                  <div>
                    <strong>${esc(formatOrderStatusLabel(entry.status))}</strong>
                    <div>${esc(entry.note || 'Status updated.')}</div>
                  </div>
                  <div>${esc(formatAdmDate(entry.at))}</div>
                </div>
              `).join('') || '<div class="adm-order-history-copy">No status history recorded yet.</div>'}
            </div>
          </div>
        </div>

        <div class="adm-order-editor">
          <div class="adm-order-editor-section adm-order-interactive">
            <div class="adm-order-editor-title"><i class="fas fa-flag"></i> Update order status</div>
            <div class="adm-order-editor-help">Pick the correct status first, then save it when you are ready. The dropdown will not auto-close by forcing a refresh anymore.</div>
            <div class="adm-order-editor-row">
              <select class="adm-inp" id="status-${order.id}" onfocus="adminTouchOrderControls('${order.id}')" onclick="adminTouchOrderControls('${order.id}')" onchange="adminSetOrderStatusDraft('${order.id}', this.value)">
                ${['pending', 'preparing', 'on the way', 'delivered', 'cancelled'].map((status) => `<option value="${status}" ${String(draft.status || '').toLowerCase() === status ? 'selected' : ''}>${formatOrderStatusLabel(status)}</option>`).join('')}
              </select>
            </div>
            <div class="adm-order-editor-meta" id="status-meta-${order.id}">${esc(getOrderStatusMeta(order, draft))}</div>
            <div class="adm-order-editor-actions">
              <button class="adm-btn-sm adm-green" type="button" onclick="adminApplyOrderStatus('${order.id}', '${encodeAdmValue(order.username || '')}')">Update status</button>
              <button class="adm-btn-sm" type="button" onclick="adminResetOrderStatusDraft('${order.id}')">Reset</button>
            </div>
          </div>

          <div class="adm-order-editor-section adm-order-interactive">
            <div class="adm-order-editor-title"><i class="fas fa-truck"></i> Driver & ETA</div>
            <div class="adm-order-editor-help">Choose the rider and type the delivery minutes first. This section now waits for your Apply click, so you can adjust the exact value without the field snapping shut.</div>
            <div class="adm-order-editor-row">
              <select class="adm-inp" id="driver-${order.id}" onfocus="adminTouchOrderControls('${order.id}')" onclick="adminTouchOrderControls('${order.id}')" onchange="adminUpdateOrderDriverDraft('${order.id}', this.value)">
                ${getDriverOptions(getSelectedOrderDriver(order, draft))}
              </select>
              <input type="number" class="adm-inp adm-order-eta-input" id="eta-${order.id}" value="${esc(currentEta === '' ? '' : currentEta)}" min="10" max="90" placeholder="Min" onfocus="adminTouchOrderControls('${order.id}')" onclick="adminTouchOrderControls('${order.id}')" oninput="adminPreviewEtaInput('${order.id}')" onkeydown="adminHandleEtaKey(event, '${order.id}', '${encodeAdmValue(order.username || '')}')">
            </div>
            <div class="adm-order-editor-meta" id="driver-meta-${order.id}">${esc(getOrderDriverMeta(order, draft))}</div>
            <div class="adm-order-editor-actions">
              <button class="adm-btn-sm adm-green" type="button" onclick="adminAssignDriver('${order.id}', '${encodeAdmValue(order.username || '')}')">Apply delivery</button>
              <button class="adm-btn-sm" type="button" onclick="adminResetOrderDeliveryDraft('${order.id}')">Reset</button>
            </div>
          </div>
        </div>
      </div>
    </article>`;
}

function renderAdminOrders(sourceOrders = null, targetId = 'adm-orders-list') {
  if (State.processDeliveryCountdowns) State.processDeliveryCountdowns();
  const list = document.getElementById('adm-orders-list') || document.getElementById(targetId);
  if (!list) return;
  const baseOrders = Array.isArray(sourceOrders) ? sourceOrders : (State.getAllOrders ? State.getAllOrders() : []);
  const orders = getAdminOrdersView(baseOrders);
  renderAdminOrderInsights(orders, baseOrders);

  if (!orders.length) {
    list.innerHTML = `
      <div class="adm-order-empty">
        <strong>No orders match this view</strong>
        Try clearing the search, changing the status filter, or switching the sort order.
      </div>
    `;
    refreshAdminBadges();
    return;
  }

  list.innerHTML = orders.map((order) => renderAdminOrderCard(order)).join('');
  refreshAdminBadges();
}

function adminOpenOrdersTab(orderId = '') {
  admTab('orders');
  const search = document.getElementById('adm-order-search');
  if (search) search.value = String(orderId || '');
  renderAdminOrders(State.getAllOrders ? State.getAllOrders() : []);
  if (!orderId) return;
  window.requestAnimationFrame(() => {
    const card = document.getElementById('adm-order-card-' + encodeAdmValue(orderId));
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function adminRefreshOrdersView(force = false) {
  if (force) __adminOrderInteractionLockUntil = 0;
  renderAdminOrders(State.getAllOrders ? State.getAllOrders() : []);
}

function adminSetOrderStatusDraft(orderId, value) {
  adminTouchOrderControls(orderId);
  const order = getOrderById(orderId);
  if (!order) return;
  const draft = getAdminOrderDraft(order);
  draft.status = String(value || order.status || 'pending');
  __adminOrderDrafts[String(orderId)] = draft;
  setStatusMetaMessage(orderId, getOrderStatusMeta(order, draft), String(draft.status || '').toLowerCase() === String(order.status || '').toLowerCase() ? '#64748b' : '#8a5a00');
}

function adminResetOrderStatusDraft(orderId) {
  const order = getOrderById(orderId);
  if (!order) return;
  const draft = getAdminOrderDraft(order);
  draft.status = String(order.status || 'pending');
  __adminOrderDrafts[String(orderId)] = draft;
  const select = document.getElementById('status-' + orderId);
  if (select) select.value = draft.status;
  setStatusMetaMessage(orderId, getOrderStatusMeta(order, draft));
}

function adminUpdateOrderDriverDraft(orderId, rawValue) {
  adminTouchOrderControls(orderId);
  const order = getOrderById(orderId);
  if (!order) return;
  const draft = getAdminOrderDraft(order);
  draft.driverValue = String(rawValue || '');
  draft.driverName = '';
  if (draft.driverValue) {
    try {
      draft.driverName = String(JSON.parse(decodeURIComponent(draft.driverValue)).name || '').trim();
    } catch {
      draft.driverName = '';
    }
  }
  __adminOrderDrafts[String(orderId)] = draft;
  setDriverMetaMessage(orderId, getOrderDriverMeta(order, draft), draft.driverName ? '#8a5a00' : '#64748b');
}

function adminResetOrderDeliveryDraft(orderId) {
  const order = getOrderById(orderId);
  if (!order) return;
  const draft = getAdminOrderDraft(order);
  draft.driverValue = '';
  draft.driverName = order.driver && order.driver.name ? String(order.driver.name) : '';
  draft.etaMin = getOrderEtaValue(order);
  __adminOrderDrafts[String(orderId)] = draft;
  renderAdminOrders(State.getAllOrders ? State.getAllOrders() : []);
}

function adminPreviewEtaInput(orderId) {
  adminTouchOrderControls(orderId);
  const order = getOrderById(orderId);
  const etaInput = document.getElementById('eta-' + orderId);
  if (!order || !etaInput) return;
  const draft = getAdminOrderDraft(order);
  draft.etaMin = String(etaInput.value || '').trim() === '' ? '' : sanitizeOrderEta(etaInput.value, order.etaMin || 25);
  __adminOrderDrafts[String(orderId)] = draft;
  setDriverMetaMessage(orderId, getOrderDriverMeta(order, draft), draft.driverName || draft.etaMin !== '' ? '#8a5a00' : '#64748b');
}

function adminHandleEtaKey(event, orderId, username) {
  username = decodeAdmValue(username);
  adminTouchOrderControls(orderId);
  if (!event || event.key !== 'Enter') return;
  event.preventDefault();
  adminAssignDriver(orderId, username);
}

function adminQueueDriverRefresh(orderId) {
  adminTouchOrderControls(orderId);
  const select = document.getElementById('driver-' + orderId);
  if (select) adminUpdateOrderDriverDraft(orderId, select.value);
}

function adminRefreshPanels(force = false) {
  const all = State.getAllOrders ? State.getAllOrders() : [];
  const shouldRefreshOrders = force || !adminIsOrderEditorBusy();
  if (shouldRefreshOrders) {
    renderAdminOrders(all, 'adm-orders-list');
  }
  loadDashboard();
}

function adminApplyOrderStatus(orderId, username = '') {
  username = decodeAdmValue(username);
  const order = getOrderById(orderId);
  if (!order) return;
  const draft = getAdminOrderDraft(order);
  adminUpdateOrderStatus(orderId, draft.status, order.status, username || order.username || '');
}

function adminUpdateOrderStatus(orderId, newStatus = null, previousStatus = '', username = '') {
  const order = getOrderById(orderId);
  if (!order) {
    State.notify('⚠️ Unable to find that order. Please refresh the page.');
    return;
  }
  const oldStatus = String(previousStatus || order.status || '').trim().toLowerCase();
  const draft = getAdminOrderDraft(order);
  const nextStatus = String(newStatus || draft.status || order.status || 'pending').trim().toLowerCase();

  if (!nextStatus) {
    State.notify('⚠️ Please choose a valid status first.');
    return;
  }
  if (nextStatus === oldStatus) {
    setStatusMetaMessage(orderId, `Order #${orderId} is already ${formatOrderStatusLabel(oldStatus)}.`, '#64748b');
    State.notify(`ℹ️ Order #${orderId} is already "${formatOrderStatusLabel(oldStatus)}".`);
    return;
  }
  if (nextStatus === 'cancelled' && oldStatus !== 'cancelled') {
    const ok = confirm('Cancel this order? If it was prepaid, the amount will be automatically refunded to the user wallet.');
    if (!ok) {
      adminResetOrderStatusDraft(orderId);
      return;
    }
  }

  let result = null;
  if (nextStatus === 'on the way') {
    const etaInput = document.getElementById('eta-' + orderId);
    const etaValue = etaInput ? etaInput.value : draft.etaMin;
    const etaMin = sanitizeOrderEta(etaValue, order.etaMin || 25) || getOrderEtaValue(order);
    const driverSelect = document.getElementById('driver-' + orderId);
    const rawDriver = String(driverSelect?.value || draft.driverValue || '').trim();

    if (rawDriver && State.assignDriver) {
      let driver = {};
      try { driver = JSON.parse(decodeURIComponent(rawDriver)); } catch { driver = {}; }
      driver.etaMin = etaMin;
      result = State.assignDriver(orderId, username || order.username || null, driver);
    } else {
      const fallbackDriver = order.driver || { name: 'Delivery Team', phone: '', vehicle: '', zone: '' };
      result = State.updateOrderStatus
        ? State.updateOrderStatus(orderId, 'on the way', username || order.username || null, {
            driver: fallbackDriver,
            etaMin,
            delayedAlertSent: false,
            delayedAlertAt: null,
            customerWaitNotifiedAt: null,
            deliveryStartedAt: new Date().toISOString(),
            deliveryNote: `${fallbackDriver.name || 'Delivery Team'} is on the way with your order.`,
            note: `${fallbackDriver.name || 'Delivery Team'} marked this order as on the way. ETA ${etaMin} min.`,
          })
        : null;
    }
  } else {
    result = State.updateOrderStatus ? State.updateOrderStatus(orderId, nextStatus, username || order.username || null) : null;
  }

  if (!result || !result.ok) {
    State.notify('⚠️ Unable to update the order status. Please try again.');
    return;
  }

  syncAdminOrderDraft(result.order || getOrderById(orderId));
  __adminOrderInteractionLockUntil = Date.now() + 1000;
  renderAdminOrders(State.getAllOrders ? State.getAllOrders() : []);
  loadDashboard();

  if (result.refunded) {
    State.notify(`✅ Order #${orderId} cancelled. Refunded RM ${result.refundAmount.toFixed(2)} to user wallet.`);
    return;
  }
  if (nextStatus === 'delivered' && result.pointsJustAwardedValue) {
    State.notify(`✅ Order #${orderId} delivered. ${result.pointsJustAwardedValue} pts added after successful delivery.`);
    return;
  }
  if (nextStatus === 'cancelled' && result.pointsJustReversedValue) {
    State.notify(`✅ Order #${orderId} cancelled. ${result.pointsJustReversedValue} pts were reversed for this order.`);
    return;
  }
  if (nextStatus === 'on the way') {
    const driverName = result.order?.driver?.name || 'Delivery Team';
    const etaMin = Number(result.order?.etaMin) || getOrderEtaValue(result.order || order);
    State.notify(`✅ Order #${orderId} is now on the way. ${driverName} • ETA ${etaMin} min.`);
    return;
  }
  State.notify(`✅ Order #${orderId} status → "${formatOrderStatusLabel(nextStatus)}"`);
}

function adminAssignDriver(orderId, username = '', options = {}) {
  username = decodeAdmValue(username);
  const order = getOrderById(orderId);
  const select = document.getElementById('driver-' + orderId);
  const etaInput = document.getElementById('eta-' + orderId);
  if (!order || !select || !etaInput) return;
  adminTouchOrderControls(orderId);

  const draft = getAdminOrderDraft(order);
  const raw = String(select.value || draft.driverValue || '').trim();
  const etaRaw = String(etaInput.value || draft.etaMin || '').trim();
  if (!etaRaw) {
    setDriverMetaMessage(orderId, 'Please enter the delivery minutes first.', '#c0392b');
    if (!options.silent) State.notify('⚠️ Please enter the delivery ETA in minutes first.');
    etaInput.focus();
    return;
  }
  const etaMin = sanitizeOrderEta(etaRaw, order.etaMin || 25) || getOrderEtaValue(order);
  etaInput.value = etaMin;
  draft.etaMin = etaMin;

  if (!raw) {
    setDriverMetaMessage(orderId, 'Please choose a driver first.', '#c0392b');
    if (!options.silent) State.notify('⚠️ Please choose a driver first.');
    select.focus();
    return;
  }

  let driver = {};
  try { driver = JSON.parse(decodeURIComponent(raw)); } catch { driver = {}; }
  driver.etaMin = etaMin;
  setDriverMetaMessage(orderId, `Saving ${driver.name || 'driver'} • ETA ${etaMin} min...`, '#8a5a00');
  const result = State.assignDriver ? State.assignDriver(orderId, username || order.username || null, driver) : null;
  if (!result || !result.ok) {
    setDriverMetaMessage(orderId, 'Unable to save driver details. Please try again.', '#c0392b');
    if (!options.silent) State.notify('⚠️ Unable to assign the selected driver.');
    return;
  }

  syncAdminOrderDraft(result.order || getOrderById(orderId));
  __adminOrderInteractionLockUntil = Date.now() + 1000;
  renderAdminOrders(State.getAllOrders ? State.getAllOrders() : []);
  loadDashboard();
  if (!options.silent) {
    State.notify(`🏍️ ${driver.name || 'Driver'} assigned to order #${orderId}. ETA ${etaMin} min.`);
  }
}

/* ── Catalog ── */
const __admCatalogDrafts = {
  brands: {},
  foods: {},
};

function clampCatalogNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER, decimals = null) {
  const numeric = Number(value);
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : min;
  const raw = Number.isFinite(numeric) ? numeric : safeFallback;
  const bounded = Math.min(max, Math.max(min, raw));
  return decimals == null ? bounded : Number(bounded.toFixed(decimals));
}

function clampCatalogRating(value, fallback = 4.5) {
  return clampCatalogNumber(value, fallback, 0, 5, 1);
}

function clampCatalogPrice(value, fallback = 0) {
  return clampCatalogNumber(value, fallback, 0, 9999, 2);
}

function clampCatalogPopularity(value, fallback = 50) {
  return Math.round(clampCatalogNumber(value, fallback, 0, 100, 0));
}

function clampCatalogMinOrder(value, fallback = 0) {
  return Math.round(clampCatalogNumber(value, fallback, 0, 9999, 0));
}

function normalizeCatalogPriceLevel(value, fallback = '$$') {
  const raw = String(value == null ? '' : value).trim();
  if (['$', '$$', '$$$'].includes(raw)) return raw;
  const dollars = raw.match(/\$+/g);
  if (dollars && dollars[0]) return '$'.repeat(Math.min(3, Math.max(1, dollars[0].length)));
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return '$'.repeat(Math.min(3, Math.max(1, Math.round(numeric))));
  return ['$', '$$', '$$$'].includes(fallback) ? fallback : '$$';
}

function parseCatalogEtaRange(value, fallbackMin = 20, fallbackMax = 30) {
  let min = Number(fallbackMin);
  let max = Number(fallbackMax);
  if (!Number.isFinite(min)) min = 20;
  if (!Number.isFinite(max)) max = 30;

  const numbers = String(value == null ? '' : value).match(/\d+/g);
  if (numbers && numbers.length) {
    min = Number(numbers[0]);
    max = Number(numbers[1] || numbers[0]);
  }

  min = Math.round(clampCatalogNumber(min, 20, 5, 180, 0));
  max = Math.round(clampCatalogNumber(max, Math.max(min, 30), 5, 180, 0));
  if (max < min) max = min;
  return { min, max, text: `${min}${max !== min ? `-${max}` : ''} min` };
}

function formatCatalogEta(min, max) {
  const safeMin = Math.round(clampCatalogNumber(min, 20, 5, 180, 0));
  let safeMax = Math.round(clampCatalogNumber(max, Math.max(safeMin, 30), 5, 180, 0));
  if (safeMax < safeMin) safeMax = safeMin;
  return `${safeMin}${safeMax !== safeMin ? `-${safeMax}` : ''} min`;
}

function catalogPriceLevelWeight(value) {
  return { '$': 1, '$$': 2, '$$$': 3 }[normalizeCatalogPriceLevel(value, '$$')] || 2;
}

function setCatalogDraftMeta(kind, id, message, color = '#64748b') {
  const bucket = kind === 'brand' ? __admCatalogDrafts.brands : __admCatalogDrafts.foods;
  const key = String(id);
  if (!bucket[key]) bucket[key] = {};
  bucket[key].meta = String(message || '');
  bucket[key].metaColor = color;
  const el = document.getElementById(`${kind}-meta-${id}`);
  if (el) {
    el.textContent = String(message || '');
    el.style.color = color;
  }
}

function createAdminBrandDraft(brand = {}) {
  const eta = parseCatalogEtaRange(brand.eta, 20, 30);
  return {
    location: String(brand.location || ''),
    rating: String(clampCatalogRating(brand.rating, 4.5).toFixed(1)),
    priceLevel: normalizeCatalogPriceLevel(brand.priceLevel, '$$'),
    etaMin: String(eta.min),
    etaMax: String(eta.max),
    minOrder: String(clampCatalogMinOrder(brand.minOrder, 0)),
    meta: 'Saved values are shown. Edit any field, then press Save.',
    metaColor: '#64748b',
    dirty: false,
  };
}

function createAdminFoodDraft(food = {}) {
  return {
    price: String(clampCatalogPrice(food.price, 0).toFixed(2)),
    popularity: String(clampCatalogPopularity(food.popularity, 50)),
    rating: String(clampCatalogRating(food.rating, 4.5).toFixed(1)),
    isActive: food.isActive === false ? 'false' : 'true',
    meta: 'Saved values are shown. Edit any field, then press Save.',
    metaColor: '#64748b',
    dirty: false,
  };
}

function syncAdminCatalogBrandDraft(brand) {
  const key = String(brand?.id || '');
  if (!key) return createAdminBrandDraft(brand || {});
  const previous = __admCatalogDrafts.brands[key] || {};
  const next = createAdminBrandDraft(brand || {});
  __admCatalogDrafts.brands[key] = {
    ...next,
    meta: previous.meta || next.meta,
    metaColor: previous.metaColor || next.metaColor,
    dirty: false,
  };
  return __admCatalogDrafts.brands[key];
}

function syncAdminCatalogFoodDraft(food) {
  const key = String(food?.id || '');
  if (!key) return createAdminFoodDraft(food || {});
  const previous = __admCatalogDrafts.foods[key] || {};
  const next = createAdminFoodDraft(food || {});
  __admCatalogDrafts.foods[key] = {
    ...next,
    meta: previous.meta || next.meta,
    metaColor: previous.metaColor || next.metaColor,
    dirty: false,
  };
  return __admCatalogDrafts.foods[key];
}

function getAdminCatalogBrandDraft(brand = {}) {
  const key = String(brand?.id || '');
  if (!key || !__admCatalogDrafts.brands[key]) return syncAdminCatalogBrandDraft(brand);
  const base = createAdminBrandDraft(brand);
  __admCatalogDrafts.brands[key] = { ...base, ...__admCatalogDrafts.brands[key] };
  return __admCatalogDrafts.brands[key];
}

function getAdminCatalogFoodDraft(food = {}) {
  const key = String(food?.id || '');
  if (!key || !__admCatalogDrafts.foods[key]) return syncAdminCatalogFoodDraft(food);
  const base = createAdminFoodDraft(food);
  __admCatalogDrafts.foods[key] = { ...base, ...__admCatalogDrafts.foods[key] };
  return __admCatalogDrafts.foods[key];
}

function hasDirtyCatalogDrafts() {
  return Object.values(__admCatalogDrafts.brands).some((draft) => draft && draft.dirty)
    || Object.values(__admCatalogDrafts.foods).some((draft) => draft && draft.dirty);
}

function adminUpdateBrandDraft(id, field, value) {
  const brand = State.getBrandById ? State.getBrandById(id) : null;
  if (!brand) return;
  const draft = getAdminCatalogBrandDraft(brand);
  draft[field] = String(value == null ? '' : value);
  draft.dirty = true;
  __admCatalogDrafts.brands[String(id)] = draft;
  setCatalogDraftMeta('brand', id, 'Unsaved restaurant changes. Save when you are ready.', '#8a5a00');
}

function adminUpdateFoodDraft(id, field, value) {
  const food = State.getFoodById ? State.getFoodById(id) : null;
  if (!food) return;
  const draft = getAdminCatalogFoodDraft(food);
  draft[field] = String(value == null ? '' : value);
  draft.dirty = true;
  __admCatalogDrafts.foods[String(id)] = draft;
  setCatalogDraftMeta('food', id, 'Unsaved item changes. Save when you are ready.', '#8a5a00');
}

function adminResetBrandDraft(id) {
  const brand = State.getBrandById ? State.getBrandById(id) : null;
  if (!brand) return;
  __admCatalogDrafts.brands[String(id)] = createAdminBrandDraft(brand);
  setCatalogDraftMeta('brand', id, 'Restaurant fields reset to the current saved values.', '#64748b');
  renderAdminCatalog();
}

function adminResetFoodDraft(id) {
  const food = State.getFoodById ? State.getFoodById(id) : null;
  if (!food) return;
  __admCatalogDrafts.foods[String(id)] = createAdminFoodDraft(food);
  setCatalogDraftMeta('food', id, 'Menu item fields reset to the current saved values.', '#64748b');
  renderAdminCatalog();
}

function ensureAdminCatalogBrandOptions(brands) {
  const select = document.getElementById('adm-catalog-brand-filter');
  if (!select) return;
  const currentValue = String(select.value || 'all');
  const options = ['<option value="all">All restaurants</option>']
    .concat((Array.isArray(brands) ? brands : []).map((brand) => `<option value="${esc(brand.id)}">${esc(brand.name || brand.id)}</option>`));
  select.innerHTML = options.join('');
  const hasCurrent = Array.from(select.options).some((option) => option.value === currentValue);
  select.value = hasCurrent ? currentValue : 'all';
}

function getAdminCatalogFilters() {
  return {
    search: String(document.getElementById('adm-catalog-search')?.value || '').trim().toLowerCase(),
    brand: String(document.getElementById('adm-catalog-brand-filter')?.value || 'all').trim() || 'all',
    availability: String(document.getElementById('adm-catalog-availability-filter')?.value || 'all').trim() || 'all',
    sort: String(document.getElementById('adm-catalog-sort')?.value || 'featured').trim() || 'featured',
  };
}

function getCatalogBrandSearchHaystack(brand, foodsForBrand = []) {
  return [
    brand?.name || '',
    brand?.id || '',
    brand?.tag || '',
    brand?.cuisine || '',
    brand?.location || '',
    brand?.special || '',
    (foodsForBrand || []).map((food) => `${food.name || ''} ${food.cat || ''} ${food.badge || ''}`).join(' '),
  ].join(' ').toLowerCase();
}

function getCatalogFoodSearchHaystack(food, brand = {}) {
  return [
    food?.name || '',
    food?.bName || '',
    brand?.name || '',
    food?.cat || '',
    food?.badge || '',
    brand?.tag || '',
    brand?.location || '',
  ].join(' ').toLowerCase();
}

function sortAdminCatalogBrands(brands, analyticsMap, sortBy = 'featured') {
  return [...(Array.isArray(brands) ? brands : [])].sort((a, b) => {
    const statA = analyticsMap.get(String(a.id)) || {};
    const statB = analyticsMap.get(String(b.id)) || {};
    if (sortBy === 'rating-desc') return (Number(b.rating) || 0) - (Number(a.rating) || 0) || String(a.name || '').localeCompare(String(b.name || ''));
    if (sortBy === 'price-asc') return catalogPriceLevelWeight(a.priceLevel) - catalogPriceLevelWeight(b.priceLevel) || String(a.name || '').localeCompare(String(b.name || ''));
    if (sortBy === 'price-desc') return catalogPriceLevelWeight(b.priceLevel) - catalogPriceLevelWeight(a.priceLevel) || String(a.name || '').localeCompare(String(b.name || ''));
    if (sortBy === 'name-asc') return String(a.name || '').localeCompare(String(b.name || ''));
    if (sortBy === 'popular-desc') return (Number(statB.totalOrders) || 0) - (Number(statA.totalOrders) || 0) || (Number(b.rating) || 0) - (Number(a.rating) || 0);
    return (Number(statB.revenue) || 0) - (Number(statA.revenue) || 0)
      || (Number(statB.totalOrders) || 0) - (Number(statA.totalOrders) || 0)
      || (Number(b.rating) || 0) - (Number(a.rating) || 0)
      || String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function sortAdminCatalogFoods(foods, sortBy = 'featured') {
  return [...(Array.isArray(foods) ? foods : [])].sort((a, b) => {
    if (sortBy === 'rating-desc') return (Number(b.rating) || 0) - (Number(a.rating) || 0) || (Number(b.popularity) || 0) - (Number(a.popularity) || 0);
    if (sortBy === 'price-asc') return (Number(a.price) || 0) - (Number(b.price) || 0) || String(a.name || '').localeCompare(String(b.name || ''));
    if (sortBy === 'price-desc') return (Number(b.price) || 0) - (Number(a.price) || 0) || String(a.name || '').localeCompare(String(b.name || ''));
    if (sortBy === 'popular-desc') return (Number(b.popularity) || 0) - (Number(a.popularity) || 0) || (Number(b.rating) || 0) - (Number(a.rating) || 0);
    if (sortBy === 'name-asc') return String(a.name || '').localeCompare(String(b.name || ''));
    return Number(b.isActive !== false) - Number(a.isActive !== false)
      || (Number(b.popularity) || 0) - (Number(a.popularity) || 0)
      || (Number(b.rating) || 0) - (Number(a.rating) || 0)
      || String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function getAdminCatalogView() {
  const allBrands = State.getBrandsData ? State.getBrandsData() : [];
  const allFoods = State.getFoodsData ? State.getFoodsData() : [];
  const analytics = State.getRestaurantAnalytics ? State.getRestaurantAnalytics() : [];
  ensureAdminCatalogBrandOptions(allBrands);

  const filters = getAdminCatalogFilters();
  const brandMap = new Map(allBrands.map((brand) => [String(brand.id), brand]));
  const analyticsMap = new Map(analytics.map((entry) => [String(entry.brandId), entry]));
  const foodsByBrand = new Map();
  const itemStatsByBrand = new Map();

  allFoods.forEach((food) => {
    const key = String(food.brand || '');
    if (!foodsByBrand.has(key)) foodsByBrand.set(key, []);
    foodsByBrand.get(key).push(food);
    if (!itemStatsByBrand.has(key)) itemStatsByBrand.set(key, { total: 0, active: 0, hidden: 0 });
    const stats = itemStatsByBrand.get(key);
    stats.total += 1;
    if (food.isActive === false) stats.hidden += 1;
    else stats.active += 1;
  });

  const filteredFoods = sortAdminCatalogFoods(allFoods.filter((food) => {
    const brand = brandMap.get(String(food.brand || '')) || {};
    const brandMatch = filters.brand === 'all' || String(food.brand || '') === filters.brand;
    const visibilityMatch = filters.availability === 'all'
      || (filters.availability === 'active' && food.isActive !== false)
      || (filters.availability === 'hidden' && food.isActive === false);
    const searchMatch = !filters.search || getCatalogFoodSearchHaystack(food, brand).includes(filters.search);
    return brandMatch && visibilityMatch && searchMatch;
  }), filters.sort);

  const filteredFoodBrandIds = new Set(filteredFoods.map((food) => String(food.brand || '')));

  const filteredBrands = sortAdminCatalogBrands(allBrands.filter((brand) => {
    const brandId = String(brand.id || '');
    const brandMatch = filters.brand === 'all' || brandId === filters.brand;
    if (!brandMatch) return false;
    const brandFoods = foodsByBrand.get(brandId) || [];
    const searchMatch = !filters.search || getCatalogBrandSearchHaystack(brand, brandFoods).includes(filters.search);
    if (filters.search && (searchMatch || filteredFoodBrandIds.has(brandId))) return true;
    if (filters.search) return false;
    if (filters.availability === 'all') return true;
    return filteredFoodBrandIds.has(brandId);
  }), analyticsMap, filters.sort);

  return {
    filters,
    allBrands,
    allFoods,
    brands: filteredBrands,
    foods: filteredFoods,
    brandMap,
    analyticsMap,
    foodsByBrand,
    itemStatsByBrand,
  };
}

function renderAdminCatalogInsights(view) {
  const container = document.getElementById('adm-catalog-insights');
  if (!container) return;
  const totalBrands = Array.isArray(view.allBrands) ? view.allBrands.length : 0;
  const totalFoods = Array.isArray(view.allFoods) ? view.allFoods.length : 0;
  const activeFoods = (view.allFoods || []).filter((food) => food.isActive !== false).length;
  const hiddenFoods = totalFoods - activeFoods;
  const avgRating = totalFoods
    ? ((view.allFoods || []).reduce((sum, food) => sum + (Number(food.rating) || 0), 0) / totalFoods).toFixed(1)
    : '0.0';
  const topRestaurant = [...view.analyticsMap.values()].sort((a, b) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0))[0] || {};
  container.innerHTML = `
    <div class="adm-catalog-insight">
      <div class="adm-catalog-insight-label"><i class="fas fa-store"></i> Restaurants in view</div>
      <strong>${view.brands.length}</strong>
      <span>${totalBrands} total partner restaurants in the catalog.</span>
    </div>
    <div class="adm-catalog-insight">
      <div class="adm-catalog-insight-label"><i class="fas fa-burger"></i> Menu items in view</div>
      <strong>${view.foods.length}</strong>
      <span>${activeFoods} active and ${hiddenFoods} hidden items across the full catalog.</span>
    </div>
    <div class="adm-catalog-insight">
      <div class="adm-catalog-insight-label"><i class="fas fa-star"></i> Average item rating</div>
      <strong>${avgRating} / 5.0</strong>
      <span>All stored food ratings are clamped so they can never exceed the 5.0 maximum.</span>
    </div>
    <div class="adm-catalog-insight">
      <div class="adm-catalog-insight-label"><i class="fas fa-chart-line"></i> Top revenue restaurant</div>
      <strong>${esc(topRestaurant.brandName || '—')}</strong>
      <span>${Number(topRestaurant.totalOrders || 0)} orders • RM ${(Number(topRestaurant.revenue) || 0).toFixed(2)}</span>
    </div>
  `;
}

function renderAdminBrandCard(brand, stat = {}, itemStats = { total: 0, active: 0, hidden: 0 }) {
  const draft = getAdminCatalogBrandDraft(brand);
  const etaPreview = formatCatalogEta(draft.etaMin, draft.etaMax);
  return `
    <article class="adm-catalog-card">
      <div class="adm-catalog-card-top">
        <div class="adm-catalog-brand-main">
          <div class="adm-catalog-brand-logo">${brand.logo ? `<img loading="lazy" decoding="async" src="${esc(brand.logo)}" alt="${esc(brand.name || brand.id)}">` : '<i class="fas fa-store"></i>'}</div>
          <div style="min-width:0;flex:1 1 auto">
            <div class="adm-catalog-title-row">
              <div class="adm-catalog-title">${esc(brand.name || brand.id)}</div>
              <span class="adm-catalog-tag"><i class="fas fa-star"></i> ${Number(brand.rating || 0).toFixed(1)} / 5.0</span>
            </div>
            <div class="adm-catalog-subtitle">${esc(brand.cuisine || brand.tag || 'Partner restaurant')}</div>
            <div class="adm-catalog-meta">
              <span class="adm-catalog-tag"><i class="fas fa-wallet"></i> ${esc(brand.priceLevel || '$$')}</span>
              <span class="adm-catalog-tag"><i class="fas fa-clock"></i> ${esc(brand.eta || '20-30 min')}</span>
              <span class="adm-catalog-tag"><i class="fas fa-shopping-bag"></i> ${itemStats.active || 0} active items</span>
              ${itemStats.hidden ? `<span class="adm-catalog-tag"><i class="fas fa-eye-slash"></i> ${itemStats.hidden} hidden</span>` : ''}
            </div>
          </div>
        </div>
        <div class="adm-catalog-stats">
          <div class="adm-catalog-stat">
            <div class="adm-catalog-stat-label">Orders</div>
            <strong>${Number(stat.totalOrders || 0)}</strong>
            <small>Across all time</small>
          </div>
          <div class="adm-catalog-stat">
            <div class="adm-catalog-stat-label">Revenue</div>
            <strong>RM ${(Number(stat.revenue) || 0).toFixed(2)}</strong>
            <small>Restaurant sales</small>
          </div>
          <div class="adm-catalog-stat">
            <div class="adm-catalog-stat-label">Best item</div>
            <strong>${esc(stat.bestItem || '—')}</strong>
            <small>${itemStats.total || 0} total menu items</small>
          </div>
        </div>
      </div>
      <div class="adm-catalog-grid">
        <div class="adm-catalog-field" style="grid-column: 1 / -1;">
          <span>Location / delivery coverage</span>
          <textarea class="adm-inp" id="brand-location-${brand.id}" oninput="adminUpdateBrandDraft('${brand.id}', 'location', this.value)">${esc(draft.location)}</textarea>
        </div>
        <label class="adm-catalog-field">
          <span>Rating</span>
          <input class="adm-inp" id="brand-rating-${brand.id}" type="number" min="0" max="5" step="0.1" value="${esc(draft.rating)}" oninput="adminUpdateBrandDraft('${brand.id}', 'rating', this.value)">
        </label>
        <label class="adm-catalog-field">
          <span>Price level</span>
          <select class="adm-inp" id="brand-price-${brand.id}" onchange="adminUpdateBrandDraft('${brand.id}', 'priceLevel', this.value)">
            <option value="$" ${normalizeCatalogPriceLevel(draft.priceLevel, '$$') === '$' ? 'selected' : ''}>$ · Budget</option>
            <option value="$$" ${normalizeCatalogPriceLevel(draft.priceLevel, '$$') === '$$' ? 'selected' : ''}>$$ · Mid-range</option>
            <option value="$$$" ${normalizeCatalogPriceLevel(draft.priceLevel, '$$') === '$$$' ? 'selected' : ''}>$$$ · Premium</option>
          </select>
        </label>
        <div class="adm-catalog-field">
          <span>ETA range (minutes)</span>
          <div class="adm-catalog-field-inline">
            <input class="adm-inp" id="brand-eta-min-${brand.id}" type="number" min="5" max="180" value="${esc(draft.etaMin)}" placeholder="Min" oninput="adminUpdateBrandDraft('${brand.id}', 'etaMin', this.value)">
            <input class="adm-inp" id="brand-eta-max-${brand.id}" type="number" min="5" max="180" value="${esc(draft.etaMax)}" placeholder="Max" oninput="adminUpdateBrandDraft('${brand.id}', 'etaMax', this.value)">
          </div>
        </div>
        <label class="adm-catalog-field">
          <span>Minimum order (RM)</span>
          <input class="adm-inp" id="brand-min-order-${brand.id}" type="number" min="0" max="9999" step="1" value="${esc(draft.minOrder)}" oninput="adminUpdateBrandDraft('${brand.id}', 'minOrder', this.value)">
        </label>
      </div>
      <div class="adm-catalog-meta-line" id="brand-meta-${brand.id}" style="color:${esc(draft.metaColor || '#64748b')}">
        ${esc(draft.meta || `ETA preview: ${etaPreview}`)}
      </div>
      <div class="adm-catalog-card-actions">
        <button class="adm-btn-sm adm-green" type="button" onclick="adminSaveBrand('${brand.id}')">Save restaurant</button>
        <button class="adm-btn-sm" type="button" onclick="adminResetBrandDraft('${brand.id}')">Reset</button>
      </div>
    </article>
  `;
}

function renderAdminFoodCard(food, brand = {}) {
  const draft = getAdminCatalogFoodDraft(food);
  const reviewSummary = State.getFoodReviewSummary ? State.getFoodReviewSummary(food.id) : { count: 0, avg: Number(food.rating || 0) };
  return `
    <article class="adm-catalog-card">
      <div class="adm-catalog-card-top">
        <div class="adm-catalog-food-main">
          <div class="adm-catalog-food-thumb">${food.img ? `<img loading="lazy" decoding="async" src="${esc(food.img)}" alt="${esc(food.name)}">` : '<i class="fas fa-burger"></i>'}</div>
          <div style="min-width:0;flex:1 1 auto">
            <div class="adm-catalog-title-row">
              <div class="adm-catalog-title">${esc(food.name || 'Menu item')}</div>
              <span class="adm-catalog-visibility ${food.isActive === false ? 'hidden' : 'active'}"><i class="fas ${food.isActive === false ? 'fa-eye-slash' : 'fa-check-circle'}"></i> ${food.isActive === false ? 'Hidden' : 'Active'}</span>
            </div>
            <div class="adm-catalog-subtitle">${esc(brand.name || food.bName || food.brand || 'Unknown restaurant')} · ${esc(food.cat || 'Uncategorized')}</div>
            <div class="adm-catalog-meta">
              <span class="adm-catalog-tag"><i class="fas fa-fire"></i> ${Number(food.popularity || 0)} popularity</span>
              <span class="adm-catalog-tag"><i class="fas fa-coins"></i> ${Number(food.pts || 0)} pts</span>
              <span class="adm-catalog-tag"><i class="fas fa-wallet"></i> ${esc(food.priceLevel || '$$')}</span>
              ${food.badge ? `<span class="adm-catalog-tag"><i class="fas fa-tag"></i> ${esc(food.badge)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="adm-catalog-stats">
          <div class="adm-catalog-stat">
            <div class="adm-catalog-stat-label">Price</div>
            <strong>RM ${Number(food.price || 0).toFixed(2)}</strong>
            <small>Current selling price</small>
          </div>
          <div class="adm-catalog-stat">
            <div class="adm-catalog-stat-label">Rating</div>
            <strong>${Number(food.rating || 0).toFixed(1)} / 5.0</strong>
            <small>${reviewSummary.count || 0} public reviews</small>
          </div>
          <div class="adm-catalog-stat">
            <div class="adm-catalog-stat-label">Latest review avg</div>
            <strong>${Number(reviewSummary.avg || food.rating || 0).toFixed(1)}</strong>
            <small>Customer-facing score</small>
          </div>
        </div>
      </div>
      <div class="adm-catalog-grid">
        <label class="adm-catalog-field">
          <span>Price (RM)</span>
          <input class="adm-inp" id="food-price-${food.id}" type="number" min="0" max="9999" step="0.1" value="${esc(draft.price)}" oninput="adminUpdateFoodDraft('${food.id}', 'price', this.value)">
        </label>
        <label class="adm-catalog-field">
          <span>Popularity (0–100)</span>
          <input class="adm-inp" id="food-pop-${food.id}" type="number" min="0" max="100" step="1" value="${esc(draft.popularity)}" oninput="adminUpdateFoodDraft('${food.id}', 'popularity', this.value)">
        </label>
        <label class="adm-catalog-field">
          <span>Rating</span>
          <input class="adm-inp" id="food-rating-${food.id}" type="number" min="0" max="5" step="0.1" value="${esc(draft.rating)}" oninput="adminUpdateFoodDraft('${food.id}', 'rating', this.value)">
        </label>
        <label class="adm-catalog-field">
          <span>Availability</span>
          <select class="adm-inp" id="food-active-${food.id}" onchange="adminUpdateFoodDraft('${food.id}', 'isActive', this.value)">
            <option value="true" ${String(draft.isActive) === 'true' ? 'selected' : ''}>Active</option>
            <option value="false" ${String(draft.isActive) === 'false' ? 'selected' : ''}>Hidden</option>
          </select>
        </label>
      </div>
      <div class="adm-catalog-meta-line" id="food-meta-${food.id}" style="color:${esc(draft.metaColor || '#64748b')}">
        ${esc(draft.meta || 'Ratings are capped at 5.0, and hidden items disappear from the public menu.')}
      </div>
      <div class="adm-catalog-card-actions">
        <button class="adm-btn-sm adm-green" type="button" onclick="adminSaveFood('${food.id}')">Save item</button>
        <button class="adm-btn-sm" type="button" onclick="adminResetFoodDraft('${food.id}')">Reset</button>
      </div>
    </article>
  `;
}

function renderAdminBrands(view) {
  const list = document.getElementById('adm-brands-list');
  const count = document.getElementById('adm-catalog-brand-count');
  if (count) count.textContent = `${view.brands.length} restaurant${view.brands.length === 1 ? '' : 's'}`;
  if (!list) return;
  if (!view.brands.length) {
    list.innerHTML = `
      <div class="adm-catalog-empty">
        <strong>No restaurants match this view</strong>
        Try clearing the search, changing the restaurant filter, or switching the sort order.
      </div>
    `;
    return;
  }
  list.innerHTML = view.brands.map((brand) => renderAdminBrandCard(
    brand,
    view.analyticsMap.get(String(brand.id)) || {},
    view.itemStatsByBrand.get(String(brand.id)) || { total: 0, active: 0, hidden: 0 }
  )).join('');
}

function renderAdminFoods(view) {
  const list = document.getElementById('adm-foods-list');
  const count = document.getElementById('adm-catalog-food-count');
  if (count) count.textContent = `${view.foods.length} item${view.foods.length === 1 ? '' : 's'}`;
  if (!list) return;
  if (!view.foods.length) {
    list.innerHTML = `
      <div class="adm-catalog-empty">
        <strong>No menu items match this view</strong>
        Try clearing the search, changing the visibility filter, or switching the sort order.
      </div>
    `;
    return;
  }
  list.innerHTML = view.foods.map((food) => renderAdminFoodCard(food, view.brandMap.get(String(food.brand || '')) || {})).join('');
}

function renderAdminCatalog() {
  const view = getAdminCatalogView();
  renderAdminCatalogInsights(view);
  renderAdminBrands(view);
  renderAdminFoods(view);
  refreshAdminBadges();
}

function adminRefreshCatalogView() {
  renderAdminCatalog();
}

function adminSaveBrand(id) {
  const brand = State.getBrandById ? State.getBrandById(id) : null;
  if (!brand) return;

  const rawLocation = document.getElementById('brand-location-' + id)?.value ?? '';
  const rawRating = document.getElementById('brand-rating-' + id)?.value;
  const rawPriceLevel = document.getElementById('brand-price-' + id)?.value;
  const rawEtaMin = document.getElementById('brand-eta-min-' + id)?.value;
  const rawEtaMax = document.getElementById('brand-eta-max-' + id)?.value;
  const rawMinOrder = document.getElementById('brand-min-order-' + id)?.value;

  const fallbackEta = parseCatalogEtaRange(brand.eta, 20, 30);
  const safeLocation = String(rawLocation || '').trim() || String(brand.location || '').trim();
  const safeRating = clampCatalogRating(rawRating, brand.rating ?? 4.5);
  const safePriceLevel = normalizeCatalogPriceLevel(rawPriceLevel, brand.priceLevel || '$$');
  const safeEtaMin = Math.round(clampCatalogNumber(rawEtaMin, fallbackEta.min, 5, 180, 0));
  let safeEtaMax = Math.round(clampCatalogNumber(rawEtaMax, fallbackEta.max, 5, 180, 0));
  const etaAdjusted = safeEtaMax < safeEtaMin || !Number.isFinite(Number(rawEtaMin)) || !Number.isFinite(Number(rawEtaMax));
  if (safeEtaMax < safeEtaMin) safeEtaMax = safeEtaMin;
  const safeMinOrder = clampCatalogMinOrder(rawMinOrder, brand.minOrder || 0);

  const adjustments = [];
  if (!String(rawLocation || '').trim()) adjustments.push('Blank location was restored.');
  if (!Number.isFinite(Number(rawRating)) || Math.abs(Number(rawRating) - safeRating) > 0.0001) adjustments.push('Rating was capped inside 0.0–5.0.');
  if (String(rawPriceLevel || '') !== safePriceLevel) adjustments.push('Price level was normalized.');
  if (etaAdjusted) adjustments.push('ETA range was corrected.');
  if (!Number.isFinite(Number(rawMinOrder)) || Number(rawMinOrder) !== safeMinOrder) adjustments.push('Minimum order was corrected.');

  const ok = State.updateBrandByAdmin && State.updateBrandByAdmin(id, {
    location: safeLocation,
    rating: safeRating,
    priceLevel: safePriceLevel,
    eta: formatCatalogEta(safeEtaMin, safeEtaMax),
    minOrder: safeMinOrder,
  });
  if (!ok) return;

  const updated = State.getBrandById ? State.getBrandById(id) : { ...brand, location: safeLocation, rating: safeRating, priceLevel: safePriceLevel, eta: formatCatalogEta(safeEtaMin, safeEtaMax), minOrder: safeMinOrder };
  syncAdminCatalogBrandDraft(updated);
  setCatalogDraftMeta('brand', id, adjustments.length ? adjustments.join(' ') : 'Restaurant info updated successfully.', '#15803d');
  renderAdminCatalog();
  State.notify(adjustments.length ? `✅ Restaurant updated. ${adjustments.join(' ')}` : '✅ Restaurant info updated.');
}

function adminSaveFood(id) {
  const food = State.getFoodById ? State.getFoodById(id) : null;
  if (!food) return;

  const rawPrice = document.getElementById('food-price-' + id)?.value;
  const rawPopularity = document.getElementById('food-pop-' + id)?.value;
  const rawRating = document.getElementById('food-rating-' + id)?.value;
  const rawActive = document.getElementById('food-active-' + id)?.value;

  const safePrice = clampCatalogPrice(rawPrice, food.price ?? 0);
  const safePopularity = clampCatalogPopularity(rawPopularity, food.popularity ?? 50);
  const safeRating = clampCatalogRating(rawRating, food.rating ?? 4.5);
  const safeActive = String(rawActive || 'true') === 'true';
  const derivedPriceLevel = safePrice >= 20 ? '$$$' : (safePrice >= 10 ? '$$' : '$');

  const adjustments = [];
  if (!Number.isFinite(Number(rawPrice)) || Math.abs(Number(rawPrice) - safePrice) > 0.0001) adjustments.push('Price was corrected to a non-negative value.');
  if (!Number.isFinite(Number(rawPopularity)) || Number(rawPopularity) !== safePopularity) adjustments.push('Popularity was clamped to 0–100.');
  if (!Number.isFinite(Number(rawRating)) || Math.abs(Number(rawRating) - safeRating) > 0.0001) adjustments.push('Rating was capped inside 0.0–5.0.');

  const ok = State.updateFoodByAdmin && State.updateFoodByAdmin(id, {
    price: safePrice,
    popularity: safePopularity,
    rating: safeRating,
    isActive: safeActive,
    priceLevel: derivedPriceLevel,
  });
  if (!ok) return;

  const updated = State.getFoodById ? State.getFoodById(id) : { ...food, price: safePrice, popularity: safePopularity, rating: safeRating, isActive: safeActive, priceLevel: derivedPriceLevel };
  syncAdminCatalogFoodDraft(updated);
  setCatalogDraftMeta('food', id, adjustments.length ? adjustments.join(' ') : 'Menu item updated successfully.', '#15803d');
  renderAdminCatalog();
  State.notify(adjustments.length ? `✅ Menu item updated. ${adjustments.join(' ')}` : '✅ Menu item updated.');
}

/* ── Reviews moderation ── */
function renderAdminReviews() {
  const tbody = document.getElementById('adm-reviews-tbody');
  if (!tbody) return;
  const reviews = State.getStoredReviews ? State.getStoredReviews() : [];
  if (!reviews.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--light)">No customer reviews submitted yet.</td></tr>';
    return;
  }
  tbody.innerHTML = reviews.map((review) => `
    <tr>
      <td>${formatAdmDate(review.createdAt)}</td>
      <td><strong>${esc(review.name || review.username || 'Customer')}</strong><div style="font-size:1.2rem;color:var(--light)">${esc(review.username || '—')}</div></td>
      <td>#${esc(review.orderId || '—')}</td>
      <td>${Array.isArray(review.itemNames) && review.itemNames.length ? review.itemNames.map((item) => esc(item)).join('<br>') : '—'}</td>
      <td><span style="color:#f59e0b;font-weight:700">${'★'.repeat(Math.max(1, Number(review.stars) || 0))}</span></td>
      <td style="max-width:34rem">${esc(review.text || '—')}</td>
      <td><span class="adm-review-status ${review.published ? 'live' : 'pending'}">${review.published ? 'Posted to menu' : 'Pending admin'}</span></td>
      <td>
        <button class="adm-btn-sm ${review.published ? '' : 'adm-green'}" onclick="adminToggleReviewPublished('${encodeAdmValue(review.orderId)}','${encodeAdmValue(review.username || '')}', ${review.published ? 'false' : 'true'})">
          ${review.published ? 'Hide' : 'Post'}
        </button>
      </td>
    </tr>
  `).join('');
}

function adminToggleReviewPublished(orderId, username, shouldPublish) {
  orderId = decodeAdmValue(orderId);
  username = decodeAdmValue(username);
  if (!State.setReviewPublished || !State.setReviewPublished(orderId, username, shouldPublish)) return;
  renderAdminReviews();
  State.notify(shouldPublish ? '✅ Review posted to menu quick view.' : '🙈 Review hidden from public menu view.');
}

/* ── Voucher management ── */
function renderVoucherManagement() {
  const container = document.getElementById('adm-voucher-overview');
  if (!container) return;
  container.innerHTML = Object.entries(VOUCHER_RULES).map(([vid, def]) => `
    <div class="adm-voucher-card">
      <div class="adm-vc-header">
        <span style="font-size:3rem">${def.icon || '🎟️'}</span>
        <div>
          <div class="adm-vc-title">${esc(def.label)}</div>
          <div class="adm-vc-desc">${esc(def.desc)}</div>
        </div>
        <span class="adm-vc-badge">${esc(vid)}</span>
      </div>
      <div class="adm-vc-rules">
        <strong>📋 Rules & Conditions</strong>
        <ul>${(def.rules || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        <div class="adm-vc-compat">
          <strong>🔗 Stackability: </strong>
          ${def.stackable ? '<span style="color:#27ae60">Stackable</span>' : '<span style="color:#e74c3c">Not stackable</span>'}
          | Max per order: <strong>${def.maxPerOrder || 1}</strong>
          ${def.category ? ` | 📦 Category: <strong>${esc(def.category)}</strong>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

/* ── Navigation ── */
function admTab(tab) {
  __admCurrentTab = tab;
  document.querySelectorAll('.adm-tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.adm-panel').forEach((p) => { p.style.display = 'none'; });
  document.getElementById('adm-tab-' + tab)?.classList.add('active');
  const panel = document.getElementById('adm-panel-' + tab);
  if (panel) panel.style.display = 'block';

  refreshAdminChrome(tab);

  if (tab === 'dashboard') loadDashboard();
  if (tab === 'users') renderAdminUsers();
  if (tab === 'orders') renderAdminOrders(State.getAllOrders ? State.getAllOrders() : [], 'adm-orders-tbody');
  if (tab === 'catalog') renderAdminCatalog();
  if (tab === 'reviews') renderAdminReviews();
  if (tab === 'vouchers') renderVoucherManagement();
  if (tab === 'messages') renderAdminMessages();
}

function adminLogout() {
  if (!confirm('Logout from Admin Panel?')) return;
  State.logoutAdmin();
  window.location.href = 'admin-login';
}

document.addEventListener('DOMContentLoaded', () => {
  requireAdmin();
  loadDashboard();
  const initialTab = new URLSearchParams(window.location.search).get('tab') || 'dashboard';
  admTab(initialTab);

  const searchInput = document.getElementById('adm-user-search');
  if (searchInput) searchInput.addEventListener('input', () => renderAdminUsers(searchInput.value));

  const voucherFilter = document.getElementById('adm-user-voucher-filter');
  if (voucherFilter) voucherFilter.addEventListener('change', () => renderAdminUsers(searchInput?.value || ''));

  const userSort = document.getElementById('adm-user-sort');
  if (userSort) userSort.addEventListener('change', () => renderAdminUsers(searchInput?.value || ''));

  const orderSearch = document.getElementById('adm-order-search');
  if (orderSearch) {
    orderSearch.addEventListener('focus', () => adminTouchOrderControls('', 4000));
    orderSearch.addEventListener('input', () => {
      adminTouchOrderControls('', 2000);
      renderAdminOrders(State.getAllOrders ? State.getAllOrders() : []);
    });
  }

  const orderStatusFilter = document.getElementById('adm-order-status-filter');
  if (orderStatusFilter) {
    orderStatusFilter.addEventListener('focus', () => adminTouchOrderControls('', 4000));
    orderStatusFilter.addEventListener('change', () => renderAdminOrders(State.getAllOrders ? State.getAllOrders() : []));
  }

  const orderSort = document.getElementById('adm-order-sort');
  if (orderSort) {
    orderSort.addEventListener('focus', () => adminTouchOrderControls('', 4000));
    orderSort.addEventListener('change', () => renderAdminOrders(State.getAllOrders ? State.getAllOrders() : []));
  }

  const catalogSearch = document.getElementById('adm-catalog-search');
  if (catalogSearch) catalogSearch.addEventListener('input', () => renderAdminCatalog());

  const catalogBrandFilter = document.getElementById('adm-catalog-brand-filter');
  if (catalogBrandFilter) catalogBrandFilter.addEventListener('change', () => renderAdminCatalog());

  const catalogAvailabilityFilter = document.getElementById('adm-catalog-availability-filter');
  if (catalogAvailabilityFilter) catalogAvailabilityFilter.addEventListener('change', () => renderAdminCatalog());

  const catalogSort = document.getElementById('adm-catalog-sort');
  if (catalogSort) catalogSort.addEventListener('change', () => renderAdminCatalog());

  const globalSearch = document.getElementById('adm-global-search');
  if (globalSearch) {
    globalSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        adminGlobalSearch();
      }
    });
  }

  window.addEventListener('storage', () => {
    const ordersPanelVisible = document.getElementById('adm-panel-orders')?.style.display === 'block';
    const dashboardVisible = document.getElementById('adm-panel-dashboard')?.style.display === 'block';
    const usersPanelVisible = document.getElementById('adm-panel-users')?.style.display === 'block';
    const catalogPanelVisible = document.getElementById('adm-panel-catalog')?.style.display === 'block';
    if (ordersPanelVisible || dashboardVisible) adminRefreshPanels();
    if (usersPanelVisible) renderAdminUsersSafely(document.getElementById('adm-user-search')?.value || '');
    if (catalogPanelVisible && !hasDirtyCatalogDrafts()) renderAdminCatalog();
    refreshAdminBadges();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    adminRefreshPanels();
    if (document.getElementById('adm-panel-users')?.style.display === 'block') {
      renderAdminUsersSafely(document.getElementById('adm-user-search')?.value || '');
    }
    if (document.getElementById('adm-panel-catalog')?.style.display === 'block' && !hasDirtyCatalogDrafts()) {
      renderAdminCatalog();
    }
  });

  window.setInterval(() => {
    if (State.processDeliveryCountdowns) State.processDeliveryCountdowns();
    refreshAdminBadges();
    const ordersPanelVisible = document.getElementById('adm-panel-orders')?.style.display === 'block';
    const dashboardVisible = document.getElementById('adm-panel-dashboard')?.style.display === 'block';
    const usersPanelVisible = document.getElementById('adm-panel-users')?.style.display === 'block';
    const catalogPanelVisible = document.getElementById('adm-panel-catalog')?.style.display === 'block';
    if (ordersPanelVisible || dashboardVisible) adminRefreshPanels();
    if (usersPanelVisible) renderAdminUsersSafely(document.getElementById('adm-user-search')?.value || '');
    if (catalogPanelVisible && !hasDirtyCatalogDrafts()) renderAdminCatalog();
  }, 3000);
});
