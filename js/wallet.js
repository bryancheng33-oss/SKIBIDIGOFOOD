// ============================================================
//  wallet.js — Wallet top-up modal
// ============================================================

let _selectedAmt = 0;

function walletLang(en) { return en; }

function walletEl(id) { return document.getElementById(id); }

function getWalletCurrentBalance() {
  return window.State && typeof State.getWallet === 'function' ? Number(State.getWallet() || 0) : 0;
}

function getWalletSelectedAmount() {
  const customEl = walletEl('wallet-custom');
  const custom = customEl ? parseFloat(customEl.value) : 0;
  return custom > 0 ? custom : Number(_selectedAmt || 0);
}

function clearWalletTopup() {
  _selectedAmt = 0;
  document.querySelectorAll('.amt-pill').forEach((pill) => pill.classList.remove('sel', 'active'));
  const customEl = walletEl('wallet-custom');
  if (customEl) customEl.value = '';
  refreshWalletDisplay();
}

function openWallet() {
  if (!window.State || !State.isLoggedIn || !State.isLoggedIn()) {
    if (window.State && typeof State.notify === 'function') State.notify(walletLang('Please log in before using the wallet.'));
    return;
  }
  clearWalletTopup();
  const modal = walletEl('wallet-modal');
  if (!modal) {
    if (window.State && typeof State.notify === 'function') {
      State.notify(walletLang('Wallet top-up is available on pages with the wallet modal.'));
    }
    return;
  }
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-top-layer');
}

function closeWallet() {
  const modal = walletEl('wallet-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (!document.querySelector('.modal-bg.open')) document.body.classList.remove('has-top-layer');
}

window.openWallet = openWallet;
window.closeWallet = closeWallet;

function selectAmt(el, amt) {
  document.querySelectorAll('.amt-pill').forEach((pill) => pill.classList.remove('sel', 'active'));
  if (el) el.classList.add('sel', 'active');
  _selectedAmt = Number(amt || 0);
  const customEl = walletEl('wallet-custom');
  if (customEl) customEl.value = '';
  refreshWalletDisplay();
}

function refreshWalletDisplay() {
  const currentBalance = getWalletCurrentBalance();
  const selectedAmount = getWalletSelectedAmount();
  const afterBalance = currentBalance + (selectedAmount > 0 ? selectedAmount : 0);

  const balanceEl = walletEl('wallet-bal-display');
  if (balanceEl) balanceEl.textContent = currentBalance.toFixed(2);

  const selectedEl = walletEl('wallet-selected-amount');
  if (selectedEl) selectedEl.textContent = selectedAmount > 0 ? selectedAmount.toFixed(2) : '0.00';

  const afterEl = walletEl('wallet-balance-after');
  if (afterEl) afterEl.textContent = afterBalance.toFixed(2);

  const statusEl = walletEl('wallet-topup-status');
  const previewTextEl = walletEl('wallet-selection-preview-text');
  const submitBtn = walletEl('wallet-topup-submit');

  let helper = 'Select an amount to preview your new wallet balance.';
  let enabled = false;

  if (selectedAmount > 0 && selectedAmount < 1) {
    helper = 'Please enter at least RM 1.00.';
  } else if (selectedAmount > 10000) {
    helper = 'Maximum top up is RM 10,000.00 per transaction.';
  } else if (selectedAmount > 0) {
    helper = `You will add RM ${selectedAmount.toFixed(2)}. Your balance will become RM ${afterBalance.toFixed(2)}.`;
    enabled = true;
  }

  if (statusEl) statusEl.textContent = helper;
  if (previewTextEl) previewTextEl.textContent = helper;
  if (submitBtn) {
    submitBtn.disabled = !enabled;
    submitBtn.innerHTML = `<i class="fas fa-plus"></i> ${enabled ? `Top Up RM ${selectedAmount.toFixed(2)}` : 'Top Up'}`;
  }

  const profWal = walletEl('prof-wallet');
  if (profWal) profWal.textContent = 'RM ' + currentBalance.toFixed(2);
}

function doTopUp() {
  if (!window.State || !State.isLoggedIn || !State.isLoggedIn()) {
    if (window.State && typeof State.notify === 'function') State.notify(walletLang('Please log in before topping up your wallet.'));
    closeWallet();
    return;
  }

  const amt = getWalletSelectedAmount();

  if (!(amt > 0)) { State.notify(walletLang('⚠️ Please select or enter an amount.')); return; }
  if (amt < 1) { State.notify(walletLang('⚠️ Minimum top-up is RM 1.00.')); return; }
  if (amt > 10000) { State.notify(walletLang('⚠️ Maximum top-up is RM 10,000 per transaction.')); return; }

  State.addWallet(amt);
  if (typeof updateHeader === 'function') updateHeader();
  refreshWalletDisplay();
  closeWallet();
  clearWalletTopup();
  State.notify(walletLang(`💳 Wallet topped up successfully! +RM ${amt.toFixed(2)}`));
}

function bindWalletModalInteractions() {
  const customEl = walletEl('wallet-custom');
  if (customEl && customEl.dataset.walletBound !== '1') {
    customEl.addEventListener('input', function () {
      document.querySelectorAll('.amt-pill').forEach((pill) => pill.classList.remove('sel', 'active'));
      _selectedAmt = 0;
      refreshWalletDisplay();
    });
    customEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') doTopUp();
    });
    customEl.dataset.walletBound = '1';
  }

  const modal = walletEl('wallet-modal');
  if (modal && modal.dataset.walletBound !== '1') {
    const walletClose = modal.querySelector('.wallet-topup-close');
    if (walletClose) {
      walletClose.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeWallet();
      });
    }
    modal.addEventListener('click', (event) => { if (event.target === modal) closeWallet(); });
    modal.dataset.walletBound = '1';
  }
}

window.clearWalletTopup = clearWalletTopup;

document.addEventListener('DOMContentLoaded', () => {
  bindWalletModalInteractions();
  refreshWalletDisplay();
  document.addEventListener('keydown', (event) => {
    const modal = walletEl('wallet-modal');
    if (event.key === 'Escape' && modal && modal.classList.contains('open')) closeWallet();
  });
});
