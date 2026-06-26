requireAuth();

  function profileLang(en) { return en; }
  function profileEsc(value) {
    if (typeof sgfEscapeHtml === 'function') return sgfEscapeHtml(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function profileInlineArg(value) {
    return profileEsc(String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n]+/g, ' '));
  }
  function accountTypeLabel(value) { const v = String(value || 'personal'); const labels = { personal: profileLang('Student'), corporate: profileLang('Campus Group') }; return labels[v] || v.replace(/-/g, ' '); }
  function voucherLabel(voucher) { return window.I18N && I18N.localizeVoucherLabel ? I18N.localizeVoucherLabel(voucher.id, voucher.label) : voucher.label; }
  function addressMsg(text) {
    const map = {
      'Please enter your delivery address.': profileLang('Please enter your delivery address.'),
      'Address is too short.': profileLang('Address is too short.'),
      'Address must end with Malaysia.': profileLang('Address must end with Malaysia.'),
      'Address must include a valid 5-digit Malaysian postcode.': profileLang('Address must include a valid 5-digit Malaysian postcode.'),
      'Address must include a Malaysian state or federal territory.': profileLang('Address must include a Malaysian state or federal territory.'),
      'Use full format, for example: street, area, postcode city, state, Malaysia.': profileLang('Use full format, for example: street, area, postcode city, state, Malaysia.')
    };
    return map[text] || text;
  }
  function applyProfileAvatar() {
    const img = document.getElementById('prof-avatar-img');
    const avatar = (State.getUser() || {}).avatar || 'images/user-avatar.webp';
    if (!img) return;
    img.onerror = function () {
      this.onerror = null;
      this.src = 'images/user-avatar.webp';
    };
    img.src = avatar;
  }

  function syncProfileAvatarEverywhere() {
    const currentUser = State.getUser ? State.getUser() : null;
    if (!currentUser || !currentUser.username || !window.SGFBackend || !window.SGFBackend.enabled) return;
    if (typeof window.SGFBackend.syncCurrentUserNow === 'function') {
      window.SGFBackend.syncCurrentUserNow(currentUser.username).catch((err) => console.error('[SGF Profile] avatar user sync failed', err));
    }
    if (typeof window.SGFBackend.syncReviewsByUsername === 'function') {
      window.SGFBackend.syncReviewsByUsername(currentUser.username).catch((err) => console.error('[SGF Profile] avatar review sync failed', err));
    }
  }

  function saveProfileAvatar(dataUrl) {
    if (!State.setUserAvatar || !dataUrl) return;
    State.setUserAvatar(dataUrl);
    applyProfileAvatar();
    syncProfileAvatarEverywhere();
    State.notify(profileLang('✅ Profile image updated.'));
  }

  function handleProfileImageUpload(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    if (!/^image\//i.test(file.type)) {
      State.notify(profileLang('⚠️ Please choose an image file.'));
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const side = 256;
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          State.notify(profileLang('⚠️ Unable to process that image.'));
          event.target.value = '';
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, side, side);
        const scale = Math.max(side / img.width, side / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (side - w) / 2;
        const y = (side - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        saveProfileAvatar(canvas.toDataURL('image/webp', 0.86));
        event.target.value = '';
      };
      img.onerror = function () {
        State.notify(profileLang('⚠️ Unable to read that image.'));
        event.target.value = '';
      };
      img.src = e.target.result;
    };
    reader.onerror = function () {
      State.notify(profileLang('⚠️ Unable to read that image.'));
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  function clearProfileImage() {
    if (!confirm(profileLang('Remove your profile image?'))) return;
    if (State.setUserAvatar) State.setUserAvatar('');
    applyProfileAvatar();
    syncProfileAvatarEverywhere();
    State.notify(profileLang('🗑️ Profile image removed.'));
  }

  function refreshProfileAddress() {
    const savedAddress = State.getSavedAddress() || State.getDefaultAddress();
    const addressText = savedAddress || '—';
    const input = document.getElementById('prof-address-input');
    document.getElementById('prof-address').textContent = addressText;
    const shortAddress = document.getElementById('prof-address-short');
    if (shortAddress) shortAddress.textContent = savedAddress || 'No detailed delivery address saved yet.';
    if (input) input.value = savedAddress || '';
  }

  function saveProfileAddress() {
    const input = document.getElementById('prof-address-input');
    if (!input) return;
    const raw = input.value.trim();
    const checked = State.validateMalaysiaAddress(raw);
    if (!checked.ok) {
      State.notify('⚠️ ' + addressMsg(checked.msg));
      input.focus();
      return;
    }
    State.setSavedAddress(checked.normalised);
    State.saveDefaultAddress(checked.normalised);
    refreshProfileAddress();
    State.notify(profileLang('✅ Delivery address saved successfully.'));
  }

  function clearProfileAddress() {
    if (!confirm(profileLang('Remove your saved delivery address?'))) return;
    State.clearSavedAddress();
    refreshProfileAddress();
    State.notify(profileLang('🗑️ Saved address removed.'));
  }

  function renderProfilePage() {
    const u = State.getUser();
    if (!u) return;

    document.getElementById('prof-name').textContent = u.name || '—';
    document.getElementById('prof-username').textContent = '@' + (u.username || '—');
    document.getElementById('prof-email').textContent = u.email || '—';
    document.getElementById('prof-phone').textContent = u.phone || '—';
    document.getElementById('prof-bday').textContent = u.birthday || '—';
    document.getElementById('prof-points').textContent = u.points || 0;
    document.getElementById('prof-wallet').textContent = (u.wallet || 0).toFixed(2);
    const heroName = document.getElementById('prof-name-hero');
    if (heroName) heroName.textContent = u.name || '—';
    const heroUser = document.getElementById('prof-username-hero');
    if (heroUser) heroUser.textContent = '@' + (u.username || '—');
    const miniEmail = document.getElementById('prof-mini-email');
    if (miniEmail) miniEmail.textContent = u.email || '—';
    const miniPhone = document.getElementById('prof-mini-phone');
    if (miniPhone) miniPhone.textContent = u.phone || '—';
    const miniBday = document.getElementById('prof-mini-bday');
    if (miniBday) miniBday.textContent = u.birthday || '—';
    applyProfileAvatar();
    refreshProfileAddress();
    const effectiveAccountType = (State.getEffectiveAccountType ? State.getEffectiveAccountType(u) : (u.accountType || 'personal'));
    const acct = document.getElementById('prof-account-type');
    if (acct) acct.value = effectiveAccountType;
    const accountChip = document.getElementById('prof-account-chip');
    if (accountChip) accountChip.textContent = accountTypeLabel(effectiveAccountType);
    const inlineAccount = document.getElementById('prof-inline-account');
    if (inlineAccount) inlineAccount.textContent = accountTypeLabel(effectiveAccountType);
    const sideAccount = document.getElementById('prof-side-account');
    if (sideAccount) sideAccount.textContent = accountTypeLabel(effectiveAccountType);
    const allVouchers = State.getVoucherInventory ? State.getVoucherInventory() : State.getVouchers();
    const voucherCount = document.getElementById('prof-voucher-count');
    if (voucherCount) voucherCount.textContent = allVouchers.length;
    const voucherCountInline = document.getElementById('prof-voucher-count-inline');
    if (voucherCountInline) voucherCountInline.textContent = allVouchers.length;
    const walletInline = document.getElementById('prof-wallet-inline');
    if (walletInline) walletInline.textContent = (u.wallet || 0).toFixed(2);
    const pointsInline = document.getElementById('prof-points-inline');
    if (pointsInline) pointsInline.textContent = u.points || 0;
    const addressShort = document.getElementById('prof-address-short');
    const savedAddressText = State.getSavedAddress ? (State.getSavedAddress() || State.getDefaultAddress() || u.savedAddress || '') : (u.savedAddress || '');
    const hasSavedAddress = !!(savedAddressText && savedAddressText.trim());
    if (addressShort) addressShort.textContent = hasSavedAddress ? savedAddressText : 'No detailed delivery address saved yet.';
    const checkAddress = document.getElementById('prof-check-address');
    if (checkAddress) checkAddress.textContent = hasSavedAddress ? 'Saved and ready' : 'Add an address';
    const avatarStatus = document.getElementById('prof-check-avatar');
    if (avatarStatus) {
      const avatar = (u.avatar || '').trim();
      avatarStatus.textContent = (avatar && !/user-avatar\.webp$/i.test(avatar)) ? 'Uploaded' : 'Default image';
    }
    const vEl = document.getElementById('prof-voucher');
    const voucherStatus = document.getElementById('prof-check-vouchers');
    if (allVouchers.length) {
      const labels = allVouchers.slice(0, 3).map((voucher) => voucherLabel(voucher)).join(', ');
      const extraCount = Math.max(0, allVouchers.length - 3);
      vEl.style.display = 'block';
      document.getElementById('prof-voucher-label').textContent = labels + (extraCount ? profileLang(` +${extraCount} more`) : '');
      if (voucherStatus) voucherStatus.textContent = `${allVouchers.length} saved`;
    } else if (vEl) {
      vEl.style.display = 'none';
      if (voucherStatus) voucherStatus.textContent = 'No saved vouchers';
    }
  }

  document.addEventListener('DOMContentLoaded', renderProfilePage);
