requireAuth();

  function checkoutLang(en) { return en; }
  function createOrderId(username) {
    const userPart = String(username || 'guest').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'GUEST';
    return `ORD-${userPart}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
  function paymentLabel(method) { return window.I18N && I18N.localizePaymentMethod ? I18N.localizePaymentMethod(method) : method; }
  function supportPriorityLabel(value) { return window.I18N && I18N.localizeSupportPriority ? I18N.localizeSupportPriority(value) : String(value || 'standard').replace(/-/g, ' '); }
  function accountTypeLabel(value) { const v = String(value || 'personal'); const labels = { personal: checkoutLang('Student'), corporate: checkoutLang('Campus Group') }; return labels[v] || v.replace(/-/g, ' '); }
  function coEsc(value) { return typeof sgfEscapeHtml === 'function' ? sgfEscapeHtml(value) : String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function voucherLabel(voucher) { return window.I18N && I18N.localizeVoucherLabel ? I18N.localizeVoucherLabel(voucher.id, voucher.label) : voucher.label; }
  function voucherReasonText(text) {
    const map = {
      'Applied to one drink item only.': checkoutLang('Applied to one drink item only.'),
      'Add a drink item to use this voucher.': checkoutLang('Add a drink item to use this voucher.'),
      'Applied to one fast-food item only.': checkoutLang('Applied to one fast-food item only.'),
      'Add a fast-food item to use this voucher.': checkoutLang('Add a fast-food item to use this voucher.'),
      '10% off applied after free-item vouchers, capped at RM 6.': checkoutLang('10% off applied after free-item vouchers, capped at RM 6.'),
      'Requires a subtotal of at least RM 10.': checkoutLang('Requires a subtotal of at least RM 10.'),
      'Flat RM 5 off applied.': checkoutLang('Flat RM 5 off applied.'),
      'No price discount. This voucher doubles points after delivery.': checkoutLang('No price discount. This voucher doubles points after delivery.')
    };
    if (map[text]) return map[text];
    const mysteryMatch = String(text || '').match(/^(\d+)% mystery discount applied, capped at RM 12\.$/);
    if (mysteryMatch) {
      return checkoutLang(`${mysteryMatch[1]}% mystery discount applied, capped at RM 12.`);
    }
    return text || '';
  }
  function addressMsg(text) {
    const map = {
      'Please enter your delivery address.': checkoutLang('Please enter your delivery address.'),
      'Address is too short.': checkoutLang('Address is too short.'),
      'Address must end with Malaysia.': checkoutLang('Address must end with Malaysia.'),
      'Address must include a valid 5-digit Malaysian postcode.': checkoutLang('Address must include a valid 5-digit Malaysian postcode.'),
      'Address must include a Malaysian state or federal territory.': checkoutLang('Address must include a Malaysian state or federal territory.'),
      'Use full format, for example: street, area, postcode city, state, Malaysia.': checkoutLang('Use full format, for example: street, area, postcode city, state, Malaysia.')
    };
    return map[text] || text;
  }

  function getCheckoutAddressDraft() {
    try { return sessionStorage.getItem('sgf_checkout_address_draft') || ''; } catch (e) { return ''; }
  }

  function setCheckoutAddressDraft(value) {
    try {
      if (String(value || '').trim()) sessionStorage.setItem('sgf_checkout_address_draft', String(value));
      else sessionStorage.removeItem('sgf_checkout_address_draft');
    } catch (e) {}
  }

  function bindCheckoutAddressDraft() {
    const addrEl = document.getElementById('co-address');
    if (!addrEl || addrEl.dataset.boundDraft === '1') return;
    addrEl.dataset.boundDraft = '1';
    addrEl.addEventListener('input', () => setCheckoutAddressDraft(addrEl.value));
    addrEl.addEventListener('blur', () => setCheckoutAddressDraft(addrEl.value));
  }

  function renderCheckoutPage() {
    const items = State.getCartItems();
    const u = State.getUser();
    const subtotal = State.getCartSubtotal();
    const voucherBreakdown = State.getDiscountBreakdown ? State.getDiscountBreakdown(subtotal, items) : { total: State.getDiscount(subtotal, items), details: [] };
    const voucherDiscount = Number(voucherBreakdown.total || 0);
    const memberDeal = State.getMembershipDeal ? State.getMembershipDeal(Math.max(0, subtotal - voucherDiscount), items, u) : { amount: 0, label: '', desc: '', requirement: '' };
    const discount = voucherDiscount + Number(memberDeal.amount || 0);
    const final = Math.max(0, subtotal - discount);
    const vs = State.getVouchers();
    const activePlan = State.getActiveMembershipPlan ? State.getActiveMembershipPlan(u) : { id: 'free', name: 'Free' };
    const pointsMultiplier = State.getMembershipPointsMultiplier ? State.getMembershipPointsMultiplier(u) : 1;

    if (!items.length) {
      const coItems = document.getElementById('co-items');
      if (coItems) {
        coItems.innerHTML = `<div class="co-grand"><span>${checkoutLang('Grand Total')}</span><span class="cp" style="color:var(--red)">RM 0.00</span></div>`;
      }
      State.notify(checkoutLang('⚠️ Your tray is empty!'));
      window.location.href = 'cart';
      return;
    }

    let rows = items.map((i) => `
      <div class="co-item">
        <span class="cn">${coEsc(i.name)} ×${Number(i.qty) || 0}${i.options ? `<div style="font-size:1.2rem;color:var(--light)">${coEsc(i.options.summary || '')}</div>` : ''}</span>
        <span class="cp">RM ${(Number(i.price || 0) * Number(i.qty || 0)).toFixed(2)}</span>
      </div>`).join('');

    if (vs.length) {
      rows += (voucherBreakdown.details || []).map((detail) => `
          <div class="co-discount">
            <span>${coEsc(detail.voucher.icon || '🎟️')} ${coEsc(voucherLabel(detail.voucher))}</span>
            <span style="font-size:1.2rem;color:${detail.amount > 0 ? '#27ae60' : 'var(--light)'}">${detail.amount > 0 ? `− RM ${detail.amount.toFixed(2)}` : coEsc(voucherReasonText(detail.reason))}</span>
          </div>`).join('');
      rows += `
        <div class="co-discount" style="border-top:1px dashed #eee;margin-top:.5rem;padding-top:.5rem">
          <span><i class="fas fa-tags"></i> ${checkoutLang('Voucher Discount')} (${vs.length} ${checkoutLang(vs.length > 1 ? 'vouchers' : 'voucher')})</span>
          <span style="color:#27ae60;font-weight:700">− RM ${voucherDiscount.toFixed(2)}</span>
        </div>`;
    }

    if (memberDeal.amount > 0) {
      rows += `
        <div class="co-discount">
          <span><i class="fas fa-crown"></i> ${coEsc(memberDeal.label)}</span>
          <span style="color:#27ae60;font-weight:700">− RM ${Number(memberDeal.amount || 0).toFixed(2)}</span>
        </div>`;
    } else if (memberDeal.requirement) {
      rows += `
        <div class="co-discount">
          <span><i class="fas fa-building"></i> ${coEsc(activePlan.name)}</span>
          <span style="font-size:1.2rem;color:var(--light)">${coEsc(memberDeal.requirement)}</span>
        </div>`;
    }

    rows += `
      <div class="co-grand" style="border-top:var(--border);margin-top:1rem;padding-top:1rem">
        <span>${checkoutLang('Grand Total')}</span>
        <span class="cp" style="color:var(--red)">RM ${final.toFixed(2)}</span>
      </div>`;
    document.getElementById('co-items').innerHTML = rows;

    const basePoints = items.reduce((s, i) => s + i.pts * i.qty, 0);
    const voucherPointsMultiplier = State.isDoublePoints() ? 2 : 1;
    const totalPointsToEarn = Math.round(basePoints * voucherPointsMultiplier * pointsMultiplier);
    document.getElementById('co-user-info').innerHTML = `
      <div class="info-row"><i class="fas fa-user"></i><span class="label">${checkoutLang('Name')}</span><span class="value">${coEsc(u.name)}</span></div>
      <div class="info-row"><i class="fas fa-phone"></i><span class="label">${checkoutLang('Phone')}</span><span class="value">${coEsc(u.phone || checkoutLang('Not set'))}</span></div>
      <div class="info-row"><i class="fas fa-envelope"></i><span class="label">${checkoutLang('Email')}</span><span class="value">${coEsc(u.email)}</span></div>
      <div class="info-row"><i class="fas fa-id-card"></i><span class="label">${checkoutLang('Membership')}</span><span class="value">${coEsc(activePlan.name)}${activePlan.id !== 'free' ? ` · ${coEsc(supportPriorityLabel(State.getSupportPriority ? State.getSupportPriority(u) : 'member'))}` : ''}</span></div>
      <div class="info-row"><i class="fas fa-ticket-alt"></i><span class="label">${checkoutLang('Applied Vouchers')}</span><span class="value">${vs.length ? `${vs.length} ${checkoutLang('selected')}` : checkoutLang('None selected')}</span></div>
      <div class="info-row"><i class="fas fa-star"></i><span class="label">${checkoutLang('Points')}</span><span class="value">${Number(u.points) || 0} ${checkoutLang('pts')} (${checkoutLang('earn')} +${totalPointsToEarn} ${checkoutLang('after successful delivery')})</span></div>`;

    const addrEl = document.getElementById('co-address');
    if (addrEl) {
      const draftAddress = getCheckoutAddressDraft();
      const isEditing = document.activeElement === addrEl && String(addrEl.value || '').trim();
      if (!isEditing) {
        const preferred = String(draftAddress || addrEl.value || State.getSavedAddress() || State.getDefaultAddress() || '');
        addrEl.value = preferred;
      }
      bindCheckoutAddressDraft();
    }

    const wEl = document.getElementById('co-wallet-bal');
    if (wEl) wEl.textContent = State.getWallet().toFixed(2);

    const balanceWrap = document.querySelector('#co-wallet-bal')?.closest('div');
    if (balanceWrap) balanceWrap.innerHTML = `${checkoutLang('Wallet balance')}: <strong>RM <span id="co-wallet-bal">${State.getWallet().toFixed(2)}</span></strong>`;

    const methodEl = document.getElementById('co-method');
    const syncWalletWarning = (value) => {
      const ww = document.getElementById('wallet-warning');
      if (!ww) return;
      ww.style.display = value === 'wallet' && State.getWallet() < final ? 'block' : 'none';
    };
    if (methodEl && methodEl.dataset.walletBound !== '1') {
      methodEl.addEventListener('change', (e) => syncWalletWarning(e.target.value));
      methodEl.dataset.walletBound = '1';
    }
    syncWalletWarning(methodEl ? methodEl.value : '');
  }

  async function placeOrder() {
    const items = State.getCartItems();
    const addrInput = document.getElementById('co-address');
    const methodEl = document.getElementById('co-method');
    const method = methodEl ? methodEl.value : '';
    const addr = addrInput ? addrInput.value.trim() : '';

    if (!items.length) {
      const coItems = document.getElementById('co-items');
      if (coItems) {
        coItems.innerHTML = `<div class="co-grand"><span>${checkoutLang('Grand Total')}</span><span class="cp" style="color:var(--red)">RM 0.00</span></div>`;
      }
      State.notify(checkoutLang('⚠️ Your tray is empty!'));
      window.location.href = 'cart';
      return;
    }
    if (!addr) {
      State.notify(checkoutLang('⚠️ Please enter a delivery address!'));
      if (addrInput) addrInput.focus();
      return;
    }
    if (!method) {
      State.notify(checkoutLang('⚠️ Please select a payment method!'));
      return;
    }

    const addressCheck = State.validateMalaysiaAddress(addr);
    if (!addressCheck.ok) {
      State.notify('⚠️ ' + addressMsg(addressCheck.msg));
      if (addrInput) addrInput.focus();
      return;
    }

    const subtotal = State.getCartSubtotal();
    const voucherBreakdown = State.getDiscountBreakdown ? State.getDiscountBreakdown(subtotal, items) : { total: State.getDiscount(subtotal, items), details: [] };
    const voucherDiscount = Number(voucherBreakdown.total || 0);
    const activePlan = State.getActiveMembershipPlan ? State.getActiveMembershipPlan() : { id: 'free', name: 'Free' };
    const memberDeal = State.getMembershipDeal ? State.getMembershipDeal(Math.max(0, subtotal - voucherDiscount), items) : { amount: 0, label: '', desc: '' };
    const discount = voucherDiscount + Number(memberDeal.amount || 0);
    const final = Math.max(0, subtotal - discount);

    if (method === 'wallet' && State.getWallet() < final) {
      State.notify(checkoutLang(`❌ Insufficient wallet balance. Need RM ${final.toFixed(2)}, have RM ${State.getWallet().toFixed(2)}`));
      return;
    }

    const basePoints = items.reduce((s, i) => s + (Number(i.pts) || 0) * (Number(i.qty) || 0), 0);
    const voucherPointsMultiplier = State.isDoublePoints() ? 2 : 1;
    const membershipPointsMultiplier = State.getMembershipPointsMultiplier ? State.getMembershipPointsMultiplier() : 1;
    const pts = Math.round(basePoints * voucherPointsMultiplier * membershipPointsMultiplier);
    const baseEta = 22 + Math.floor(Math.random() * 18);
    const finalEta = State.getMembershipEta ? State.getMembershipEta(baseEta) : baseEta;
    const currentUser = State.getUser() || {};
    const orderBtn = document.querySelector('button[onclick="placeOrder()"]');
    if (orderBtn) orderBtn.disabled = true;

    let walletCharged = false;
    let consumedVouchers = [];
    let order = null;

    try {
      if (method === 'wallet') {
        const charged = State.deductWallet(final);
        if (!charged) throw new Error('Wallet balance changed before checkout completed.');
        walletCharged = true;
      }

      consumedVouchers = State.consumeAppliedVouchers ? State.consumeAppliedVouchers() : (State.clearVouchers(), []);

      order = {
        id: createOrderId(currentUser.username),
        username: currentUser.username || '',
        items: items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, brand: i.brand, bName: i.bName, cat: i.cat, options: i.options || null })),
        total: final,
        discount: discount,
        voucherDiscount: voucherDiscount,
        membershipDiscount: Number(memberDeal.amount || 0),
        membershipDiscountLabel: memberDeal.label || '',
        membershipPlanId: activePlan.id,
        membershipPlanName: activePlan.name,
        membershipSupportPriority: State.getSupportPriority ? State.getSupportPriority() : 'standard',
        membershipAccountType: State.getEffectiveAccountType ? State.getEffectiveAccountType() : 'personal',
        appliedVouchers: consumedVouchers.map((v) => ({ id: v.id, label: voucherLabel(v), icon: v.icon, mysteryPct: v.mysteryPct || null })),
        method: method,
        address: addressCheck.normalised,
        date: new Date().toLocaleString('en-MY'),
        status: 'pending',
        etaMin: finalEta,
        baseEtaMin: baseEta,
        pointsMultiplier: voucherPointsMultiplier * membershipPointsMultiplier,
        voucherPointsMultiplier,
        membershipPointsMultiplier,
        pointsToAward: pts,
        pointsAwarded: false,
        pointsStatus: 'pending',
        pointsAwardedAt: null,
        reviewPromptPending: false,
      };

      State.setSavedAddress(addressCheck.normalised);
      State.saveDefaultAddress(addressCheck.normalised);
      setCheckoutAddressDraft(addressCheck.normalised);
      order = State.addOrder(order);

      let cloudWarning = false;
      if (window.SGFBackend && window.SGFBackend.enabled) {
        try {
          await window.SGFBackend.syncOrderNow(order);
          await window.SGFBackend.syncCurrentUserNow(State.getUser() && State.getUser().username);
          await window.SGFBackend.loadOrders({ username: currentUser.username || (State.getUser() && State.getUser().username) });
        } catch (syncErr) {
          cloudWarning = true;
          console.error('[SGF Checkout] cloud sync failed after local save', syncErr);
        }
      }

      try { sessionStorage.setItem('sgf_review_prompt_order_id', String(order.id)); } catch (e) {}
      setCheckoutAddressDraft('');
      State.clearCart();
      if (typeof updateHeader === 'function') updateHeader();
      const dealNote = memberDeal.amount > 0 ? checkoutLang(` ${memberDeal.label} applied.`) : '';
      const voucherNote = consumedVouchers.length ? checkoutLang(` ${consumedVouchers.length} voucher${consumedVouchers.length === 1 ? '' : 's'} used.`) : '';
      const syncNote = cloudWarning ? checkoutLang(' Saved locally; cloud sync is currently unavailable.') : '';
      State.notify(checkoutLang(`🎉 Order placed! ${pts} pts will be added after successful delivery.${dealNote}${voucherNote}${syncNote}`));
      setTimeout(() => { window.location.href = 'menu#orders-panel'; }, 900);
    } catch (err) {
      console.error('[SGF Checkout] order placement failed', err);
      if (walletCharged && method === 'wallet' && typeof State.addWallet === 'function') State.addWallet(final);
      if (consumedVouchers.length && typeof State.addVoucher === 'function') consumedVouchers.forEach((voucher) => State.addVoucher(voucher));
      State.notify(checkoutLang('❌ Order could not be completed. Your wallet and vouchers were restored. Please try again.'));
      if (orderBtn) orderBtn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', renderCheckoutPage);
