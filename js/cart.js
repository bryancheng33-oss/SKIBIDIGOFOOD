// ============================================================
//  cart.js — Cart page rendering and interactions
//  Enhanced: multi-voucher display + voucher add-with-rules panel
// ============================================================

function cLang(en) { return en; }

function voucherLabel(voucher) {
  const id = voucher && voucher.id ? voucher.id : '';
  const label = voucher && voucher.label ? voucher.label : id;
  return window.I18N && I18N.localizeVoucherLabel ? I18N.localizeVoucherLabel(id, label) : label;
}

function voucherDesc(voucher) {
  const id = voucher && voucher.id ? voucher.id : '';
  const desc = voucher && voucher.desc ? voucher.desc : '';
  return window.I18N && I18N.localizeVoucherDesc ? I18N.localizeVoucherDesc(id, desc) : desc;
}

function voucherRules(voucher) {
  const id = voucher && voucher.id ? voucher.id : '';
  const rules = voucher && Array.isArray(voucher.rules) ? voucher.rules : [];
  return window.I18N && I18N.localizeVoucherRules ? I18N.localizeVoucherRules(id, rules) : rules;
}

function supportPriorityLabel(value) {
  return window.I18N && I18N.localizeSupportPriority ? I18N.localizeSupportPriority(value) : String(value || '').replace(/-/g, ' ');
}

function voucherNameForText(label) {
  const raw = String(label || '').trim();
  if (!raw) return raw;
  const match = Object.entries(VOUCHER_RULES).find(([, def]) => String(def.label || '').trim() === raw);
  return match ? voucherLabel({ id: match[0], label: raw }) : raw;
}

function voucherStateReasonText(text) {
  const raw = String(text || '');
  if (!raw) return '';
  const conflictMatch = raw.match(/^Conflicts with applied voucher: (.+)\.$/);
  if (conflictMatch) {
    const localNames = conflictMatch[1].split(',').map((name) => voucherNameForText(name)).join(', ');
    return cLang(`Conflicts with applied voucher: ${localNames}.`);
  }
  const alreadyHaveMatch = raw.match(/^You already have a "(.+)" voucher applied\.$/);
  if (alreadyHaveMatch) {
    const localName = voucherNameForText(alreadyHaveMatch[1]);
    return cLang(`You already have a "${localName}" voucher applied.`);
  }
  const alreadyAppliedMatch = raw.match(/^"(.+)" is already applied\.$/);
  if (alreadyAppliedMatch) {
    const localName = voucherNameForText(alreadyAppliedMatch[1]);
    return cLang(`"${localName}" is already applied.`);
  }
  const map = {
    'Unknown voucher type.': cLang('Unknown voucher type.'),
    'Please log in first.': cLang('Please log in first.'),
    'Voucher not found in your account.': cLang('Voucher not found in your account.'),
  };
  return map[raw] || raw;
}

function voucherReasonText(text) {
  const map = {
    'Applied to one drink item only.': cLang('Applied to one drink item only.'),
    'Add a drink item to use this voucher.': cLang('Add a drink item to use this voucher.'),
    'Applied to one fast-food item only.': cLang('Applied to one fast-food item only.'),
    'Add a fast-food item to use this voucher.': cLang('Add a fast-food item to use this voucher.'),
    '10% off applied after free-item vouchers, capped at RM 6.': cLang('10% off applied after free-item vouchers, capped at RM 6.'),
    'Requires a subtotal of at least RM 10.': cLang('Requires a subtotal of at least RM 10.'),
    'Flat RM 5 off applied.': cLang('Flat RM 5 off applied.'),
    'No price discount. This voucher doubles points after delivery.': cLang('No price discount. This voucher doubles points after delivery.')
  };
  if (map[text]) return map[text];
  const mysteryMatch = String(text || '').match(/^(\d+)% mystery discount applied, capped at RM 12\.$/);
  if (mysteryMatch) return cLang(`${mysteryMatch[1]}% mystery discount applied, capped at RM 12.`);
  return text || '';
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof requireAuth === 'function' && requireAuth() === false) return;
  renderCart();
  renderVoucherAddBox();
});


function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
  return escapeAttr(value);
}

function safeImageUrl(value, fallback = 'images/food-burger.webp') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (/^(?:javascript|data):/i.test(raw) && !/^data:image\//i.test(raw)) return fallback;
  return escapeAttr(raw);
}

function getVoucherManagerSnapshot() {
  const inventory = State.getVoucherInventory ? State.getVoucherInventory() : [];
  const applied = State.getVouchers();
  const appliedIds = new Set(applied.map((voucher) => voucher.uid));

  const appliedEntries = applied.map((voucher) => ({
    kind: 'applied',
    id: voucher.id,
    uid: voucher.uid,
    voucher,
    reason: cLang('Already active in this cart. Remove it here without losing it from your account.')
  }));

  const readyEntries = inventory
    .filter((voucher) => voucher && voucher.uid && !appliedIds.has(voucher.uid))
    .map((voucher) => ({ voucher, check: State.canAddVoucher(voucher.id) }))
    .filter((entry) => entry.check && entry.check.ok)
    .reduce((acc, entry) => {
      if (!acc.some((item) => item.voucher.id === entry.voucher.id)) acc.push(entry);
      return acc;
    }, [])
    .map((entry) => ({
      kind: 'ready',
      id: entry.voucher.id,
      uid: entry.voucher.uid,
      voucher: entry.voucher,
      reason: cLang('Ready to apply to this cart right now.')
    }));

  return { inventory, applied, quickEntries: [...appliedEntries, ...readyEntries] };
}

function openVoucherManager() {
  const modal = document.getElementById('voucher-manager-modal');
  if (!modal) return;
  renderVoucherAddBox();
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-top-layer');
}

function closeVoucherManager() {
  const modal = document.getElementById('voucher-manager-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-bg.open')) document.body.classList.remove('has-top-layer');
}

function openWalletFromVoucherLayer() {
  closeVoucherManager();
  window.setTimeout(() => {
    if (typeof openWallet === 'function') openWallet();
  }, 20);
}

function focusVoucherManager() {
  openVoucherManager();
}

function updateFloatingCheckout(totalQty, final) {
  const bar = document.getElementById('cart-floating-checkout');
  const countEl = document.getElementById('floating-summary-count');
  const totalEl = document.getElementById('floating-summary-total');
  if (!bar || !countEl || !totalEl) return;
  if (!totalQty) {
    countEl.textContent = cLang('0 items ready');
    totalEl.textContent = 'RM 0.00';
    bar.style.display = 'none';
    return;
  }
  countEl.textContent = cLang(`${totalQty} item${totalQty === 1 ? '' : 's'} ready`);
  totalEl.textContent = 'RM ' + Number(final || 0).toFixed(2);
  bar.style.display = 'flex';
}

/* ── Main cart render ── */
function renderCart() {
  const items = State.getCartItems();
  const listEl = document.getElementById('cart-list');
  const totalEl = document.getElementById('cart-total-bar');
  const actionsEl = document.getElementById('cart-actions');
  const vBarEl = document.getElementById('voucher-bar');
  const titleEl = document.getElementById('cart-title-count');
  const summaryCountEl = document.getElementById('summary-item-count');

  const lineCount = items.length;
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  if (titleEl) titleEl.textContent = cLang(`Your Cart (${lineCount} item${lineCount === 1 ? '' : 's'})`);
  if (summaryCountEl) summaryCountEl.textContent = cLang(`${totalQty} total item${totalQty === 1 ? '' : 's'}`);

  const vs = State.getVouchers();
  // v6: remove every cart-page rewards launcher and bar.
  if (vBarEl) {
    vBarEl.innerHTML = '';
    vBarEl.style.display = 'none';
  }

  if (!items.length) {
    listEl.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon"><i class="fas fa-basket-shopping"></i></div>
        <h3>${cLang('Your tray is empty')}</h3>
        <p>${cLang('Browse the menu, customise a meal, and it will show up here with the new cart layout.')}</p>
        <a href="menu" class="btn"><i class="fas fa-utensils"></i> ${cLang('Browse Menu')}</a>
      </div>`;
    const subtotalAmt = document.getElementById('subtotal-amt');
    const discountAmt = document.getElementById('discount-amt');
    const finalAmt = document.getElementById('final-amt');
    const discEl = document.getElementById('discount-row');
    const breakEl = document.getElementById('discount-breakdown');
    if (subtotalAmt) subtotalAmt.textContent = 'RM 0.00';
    if (discountAmt) discountAmt.textContent = '− RM 0.00';
    if (finalAmt) finalAmt.textContent = 'RM 0.00';
    if (discEl) discEl.style.display = 'none';
    if (breakEl) {
      breakEl.innerHTML = '';
      breakEl.style.display = 'none';
    }
    if (totalEl) {
      totalEl.style.display = 'block';
      const checkoutBtn = totalEl.querySelector('.cart-checkout-btn');
      if (checkoutBtn) checkoutBtn.style.display = 'none';
      const voucherPanel = totalEl.querySelector('#voucher-add-box');
      if (voucherPanel) { voucherPanel.innerHTML = ''; voucherPanel.style.display = 'none'; }
    }
    if (actionsEl) actionsEl.style.display = 'none';
    updateFloatingCheckout(0, 0);
    if (typeof updateHeader === 'function') updateHeader();
    renderVoucherAddBox();
    return;
  }

  const subtotal = State.getCartSubtotal();
  const voucherBreakdown = State.getDiscountBreakdown ? State.getDiscountBreakdown(subtotal, items) : { total: State.getDiscount(subtotal, items), details: [] };
  const voucherDiscount = Number(voucherBreakdown.total || 0);
  const activePlan = State.getActiveMembershipPlan ? State.getActiveMembershipPlan() : { id: 'free', name: 'Free' };
  const memberDeal = State.getMembershipDeal ? State.getMembershipDeal(Math.max(0, subtotal - voucherDiscount), items) : { amount: 0, label: '', desc: '', requirement: '' };
  const discount = voucherDiscount + Number(memberDeal.amount || 0);
  const final = Math.max(0, subtotal - discount);

  listEl.innerHTML = items.map((item) => {
    const price = Number(item.price) || 0;
    const qty = Math.max(1, Number(item.qty) || 1);
    const sub = price * qty;
    const cartKey = String(item.cartKey || item.id || '');
    const cartKeyAttr = encodeURIComponent(cartKey);
    const optionHtml = item.options
      ? `<div class="cart-option-pills">
          ${item.options.size ? `<span class="cart-meta-pill">${escapeHtml(item.options.size)}</span>` : ''}
          ${item.options.spice ? `<span class="cart-meta-pill">${escapeHtml(item.options.spice)}</span>` : ''}
        </div>
        <div class="cart-option-note">${item.options.addons && item.options.addons.length ? item.options.addons.map(escapeHtml).join(', ') : cLang('No extra add-ons selected')}</div>`
      : '';
    return `
      <article class="cart-row" id="ci-${cartKey.replace(/[^a-z0-9_-]/gi, '_')}">
        <div class="cart-col cart-col-item">
          <div class="cart-thumb">
            <img loading="lazy" decoding="async" src="${safeImageUrl(item.img)}" alt="${escapeAttr(item.name)}" onerror="this.src='images/food-burger.webp'">
          </div>
          <div class="cart-copy">
            <div class="cart-brand-line">${escapeHtml(item.bName)}</div>
            <h3 class="ci-name">${escapeHtml(item.name)}</h3>
            <div class="cart-price-mobile"><span>${cLang('Price')}</span> RM ${price.toFixed(2)}</div>
            ${optionHtml}
            <button class="cart-remove-link" data-cart-key="${cartKeyAttr}" onclick="removeItem(decodeURIComponent(this.dataset.cartKey || ''))">
              <i class="fas fa-trash"></i> ${cLang('Remove')}
            </button>
          </div>
        </div>

        <div class="cart-col cart-col-price">
          <span class="cart-mobile-label">${cLang('Price')}</span>
          <strong>RM ${price.toFixed(2)}</strong>
          <small>${cLang('per item')}</small>
        </div>

        <div class="cart-col cart-col-qty">
          <span class="cart-mobile-label">${cLang('Quantity')}</span>
          <div class="qty-controls cart-qty-pill">
            <button class="qty-btn" type="button" data-cart-key="${cartKeyAttr}" onclick="changeQty(decodeURIComponent(this.dataset.cartKey || ''),${qty - 1})" aria-label="${cLang('Decrease quantity')}">−</button>
            <span class="qty-num">${qty}</span>
            <button class="qty-btn" type="button" data-cart-key="${cartKeyAttr}" onclick="changeQty(decodeURIComponent(this.dataset.cartKey || ''),${qty + 1})" aria-label="${cLang('Increase quantity')}">+</button>
          </div>
        </div>

        <div class="cart-col cart-col-total">
          <span class="cart-mobile-label">${cLang('Total')}</span>
          <strong>RM ${sub.toFixed(2)}</strong>
          <small>${cLang('Includes customisations')}</small>
        </div>
      </article>`;
  }).join('');

  if (totalEl) {
    totalEl.style.display = 'block';
    const checkoutBtn = totalEl.querySelector('.cart-checkout-btn');
    if (checkoutBtn) checkoutBtn.style.display = '';
    const voucherPanel = totalEl.querySelector('#voucher-add-box');
    if (voucherPanel) { voucherPanel.innerHTML = ''; voucherPanel.style.display = 'none'; }
    document.getElementById('subtotal-amt').textContent = 'RM ' + subtotal.toFixed(2);
    document.getElementById('discount-amt').textContent = '− RM ' + discount.toFixed(2);
    document.getElementById('final-amt').textContent = 'RM ' + final.toFixed(2);

    const discEl = document.getElementById('discount-row');
    if (discEl) discEl.style.display = discount > 0 || !!memberDeal.requirement ? 'flex' : 'none';

    const breakEl = document.getElementById('discount-breakdown');
    if (breakEl) {
      const lines = [];
      if (vs.length > 0) {
        lines.push(...(voucherBreakdown.details || []).map((detail) => {
          const amountText = detail.amount > 0
            ? `${cLang('saved RM')} ${detail.amount.toFixed(2)}`
            : cLang('not eligible yet');
          return `<div class="discount-detail ${detail.amount > 0 ? 'positive' : ''}"><span>${escapeHtml(detail.voucher.icon || '🎟️')} ${escapeHtml(voucherLabel(detail.voucher))}</span><strong>${escapeHtml(amountText)}</strong><small>${escapeHtml(voucherReasonText(detail.reason))}</small></div>`;
        }));
      }
      if (memberDeal.amount > 0) {
        lines.push(`<div class="discount-detail positive"><span><i class="fas fa-crown"></i> ${escapeHtml(memberDeal.label)}</span><strong>${cLang('saved RM')} ${Number(memberDeal.amount || 0).toFixed(2)}</strong></div>`);
      } else if (memberDeal.requirement) {
        lines.push(`<div class="discount-detail"><span><i class="fas fa-building"></i> ${escapeHtml(activePlan.name)}</span><small>${escapeHtml(memberDeal.requirement)}</small></div>`);
      } else if (activePlan.id !== 'free') {
        lines.push(`<div class="discount-detail"><span><i class="fas fa-id-card"></i> ${escapeHtml(activePlan.name)}</span><small>${cLang('Support priority')}: ${escapeHtml(supportPriorityLabel(State.getSupportPriority ? State.getSupportPriority() : 'priority'))}</small></div>`);
      }
      breakEl.innerHTML = lines.join('');
      breakEl.style.display = lines.length ? 'grid' : 'none';
    }
  }
  if (actionsEl) actionsEl.style.display = 'flex';
  updateFloatingCheckout(totalQty, final);
  updateHeader();
  renderVoucherAddBox();
}

/* ── Voucher Add Box (with rules display) ── */
function buildVoucherLauncherMarkup() {
  return '';
}

function buildVoucherManagerContent() {
  return '';
}

function renderVoucherAddBox() {
  // v6: Cart voucher/deals panels were removed by request.
  const box = document.getElementById('voucher-add-box');
  const modalBox = document.getElementById('voucher-add-box-modal');
  if (box) {
    box.innerHTML = '';
    box.style.display = 'none';
  }
  if (modalBox) {
    modalBox.innerHTML = '';
    modalBox.style.display = 'none';
  }
}

function toggleVoucherDetails(button, id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpening = el.hasAttribute('hidden');
  document.querySelectorAll('.vsc-rules').forEach((panel) => panel.setAttribute('hidden', 'hidden'));
  document.querySelectorAll('.voucher-more-toggle').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
    const symbol = btn.querySelector('.toggle-symbol');
    if (symbol) symbol.textContent = 'v';
  });
  if (isOpening) {
    el.removeAttribute('hidden');
    button.setAttribute('aria-expanded', 'true');
    const symbol = button.querySelector('.toggle-symbol');
    if (symbol) symbol.textContent = '^';
  }
}

function applyVoucherFromBox(uid) {
  const result = State.applyVoucher ? State.applyVoucher(uid) : { ok: false, reason: cLang('Voucher apply is unavailable.') };
  if (!result.ok) {
    State.notify('⚠️ ' + voucherStateReasonText(result.reason));
    return;
  }
  State.notify(`🎟️ "${voucherLabel(result.voucher)}" ${cLang('applied to this cart.')}`);
  renderVoucherAddBox();
  renderCart();
}

function removeVoucherAt(idx) {
  State.removeVoucherByIndex(idx);
  State.notify(cLang('↩️ Voucher removed from this cart and saved for later.'));
  renderCart();
  renderVoucherAddBox();
}

function removeVoucherById(vid) {
  const vs = State.getVouchers();
  const target = vs.find((v) => v.id === vid);
  if (target && State.unapplyVoucher && State.unapplyVoucher(target.uid)) {
    State.notify(cLang('↩️ Voucher removed from this cart. It stays saved in your account for a future order.'));
    renderCart();
    renderVoucherAddBox();
  }
}

function removeVoucher() {
  State.clearVouchers();
  State.notify(cLang('↩️ All vouchers were removed from this cart and kept in your account for later.'));
  renderCart();
  renderVoucherAddBox();
}

function ensureCartIsFullyZeroed() {
  if (!State.getCartItems || !State.clearCart) return;
  if (State.getCartItems().length === 0) State.clearCart();
}
function changeQty(id, newQty) {
  State.updateQty(id, newQty);
  ensureCartIsFullyZeroed();
  renderCart();
}
function removeItem(id) {
  State.removeItem(id);
  ensureCartIsFullyZeroed();
  State.notify(cLang('🗑️ Item removed from cart.'));
  renderCart();
}
function clearCart() {
  if (!confirm(cLang('Remove all items from cart?'))) return;
  State.clearCart();
  ensureCartIsFullyZeroed();
  State.notify(cLang('🗑️ Cart cleared.'));
  renderCart();
}


document.addEventListener('DOMContentLoaded', () => {
  const voucherModal = document.getElementById('voucher-manager-modal');
  if (voucherModal) {
    voucherModal.addEventListener('click', (e) => {
      if (e.target === voucherModal) closeVoucherManager();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && voucherModal && voucherModal.classList.contains('open')) {
      closeVoucherManager();
    }
  });
});
