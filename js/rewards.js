// ============================================================
//  rewards.js — Rewards grid + birthday bonus + page summary
// ============================================================

function rwT(key, vars) {
  return window.I18N ? I18N.t(key, vars) : key;
}

function rwStatic(en) { return en; }

function rewardEsc(value) {
  if (typeof sgfEscapeHtml === 'function') return sgfEscapeHtml(value);
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function getRewardCopy(reward) {
  return {
    title: rwT(`rewards.reward.${reward.vid}.title`),
    desc: rwT(`rewards.reward.${reward.vid}.desc`),
  };
}

function rewardVoucherLabel(vid, fallback = '') {
  return window.I18N && I18N.localizeVoucherLabel ? I18N.localizeVoucherLabel(vid, fallback) : (fallback || vid);
}

function rewardVoucherRules(vid, fallback = []) {
  return window.I18N && I18N.localizeVoucherRules ? I18N.localizeVoucherRules(vid, fallback) : fallback;
}

function rewardVoucherNameForText(label) {
  const raw = String(label || '').trim();
  if (!raw) return raw;
  const match = Object.entries(VOUCHER_RULES).find(([, def]) => String(def.label || '').trim() === raw);
  return match ? rewardVoucherLabel(match[0], raw) : raw;
}

function rewardVoucherStateReason(text) {
  const raw = String(text || '');
  if (!raw) return '';
  const conflictMatch = raw.match(/^Conflicts with applied voucher: (.+)\.$/);
  if (conflictMatch) {
    const localNames = conflictMatch[1].split(',').map((name) => rewardVoucherNameForText(name)).join(', ');
    return `Conflicts with applied voucher: ${localNames}.`;
  }
  const alreadyHaveMatch = raw.match(/^You already have a "(.+)" voucher applied\.$/);
  if (alreadyHaveMatch) {
    const localName = rewardVoucherNameForText(alreadyHaveMatch[1]);
    return `You already have a "${localName}" voucher applied.`;
  }
  const map = {
    'Unknown voucher type.': 'Unknown voucher type.',
  };
  return map[raw] || raw;
}

function rewardTypeMeta(vid) {
  switch (vid) {
    case 'DRINK_FREE':
    case 'BURGER_FREE':
      return {
        badge: rwStatic('Free item'),
        helper: rwStatic('Best for single-item orders and quick meals.'),
      };
    case 'DISC_10':
    case 'RM5_OFF':
      return {
        badge: rwStatic('Discount'),
        helper: rwStatic('Useful when you already have a full cart ready.'),
      };
    case 'DBL_PTS':
      return {
        badge: rwStatic('Booster'),
        helper: rwStatic('Use it before a bigger order to earn back points faster.'),
      };
    case 'MYSTERY':
      return {
        badge: rwStatic('Surprise'),
        helper: rwStatic('Good when you are comfortable with a random reward.'),
      };
    default:
      return {
        badge: rwStatic('Reward'),
        helper: '',
      };
  }
}

function escapeInlineJs(text) {
  return String(text == null ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');
}


function rewardDetailUseCase(vid) {
  const map = {
    DRINK_FREE: 'Best when your cart already includes a drink. It removes the drink price up to the voucher value.',
    BURGER_FREE: 'Best for a fast-food item or burger order. It helps most when the item is close to the value cap.',
    DISC_10: 'Best for a bigger cart because the discount is percentage-based but capped.',
    RM5_OFF: 'Best for a small meal above the minimum order value because the saving is fixed.',
    DBL_PTS: 'Best before a bigger order because it increases points earned instead of reducing the price.',
    MYSTERY: 'Best when you are comfortable with a random discount that is revealed during checkout.',
    BIRTHDAY_BURGER: 'Best during your birthday window for a fast-food item up to the birthday reward cap.',
  };
  return map[vid] || 'Use this voucher on a matching checkout order before placing payment.';
}

function rewardDetailCategory(def) {
  if (!def || !def.category) return 'Any eligible cart';
  return String(def.category).replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function rewardDetailStackText(def) {
  if (!def) return 'Voucher rules unavailable';
  const conflicts = Array.isArray(def.conflictsWith) && def.conflictsWith.length
    ? def.conflictsWith.map((id) => rewardVoucherLabel(id, VOUCHER_RULES[id] ? VOUCHER_RULES[id].label : id)).join(', ')
    : 'None listed';
  return `${def.stackable ? 'Stackable with compatible vouchers' : 'Not stackable'} · Conflicts: ${conflicts}`;
}

function openVoucherInfo(vid) {
  const modal = document.getElementById('voucher-info-modal');
  const content = document.getElementById('voucher-info-content');
  if (!modal || !content) return;

  const reward = (Array.isArray(REWARDS_DATA) ? REWARDS_DATA : []).find((item) => item.vid === vid) || { vid, pts: 0, icon: '🎟️', vlabel: vid };
  const def = VOUCHER_RULES[vid] || {};
  const copy = getRewardCopy(reward);
  const label = rewardVoucherLabel(vid, reward.vlabel || def.label || vid);
  const desc = def.desc || copy.desc || '';
  const rules = rewardVoucherRules(vid, def.rules || []);
  const currentPoints = State.getPoints ? State.getPoints() : 0;
  const cost = Number(reward.pts) || 0;
  const canRedeemNow = currentPoints >= cost;
  const needed = Math.max(0, cost - Number(currentPoints || 0));

  content.innerHTML = `
    <div class="voucher-info-hero">
      <div class="voucher-info-icon">${rewardEsc(def.icon || reward.icon || '🎟️')}</div>
      <div>
        <p class="voucher-info-kicker">Voucher information</p>
        <h3 id="voucher-info-title">${rewardEsc(label)}</h3>
        <p>${rewardEsc(desc)}</p>
      </div>
    </div>
    <div class="voucher-info-grid">
      <div class="voucher-info-stat"><span>Cost</span><strong>${rewardEsc(`${cost} pts`)}</strong></div>
      <div class="voucher-info-stat"><span>Your points</span><strong>${rewardEsc(`${currentPoints} pts`)}</strong></div>
      <div class="voucher-info-stat"><span>Status</span><strong>${rewardEsc(canRedeemNow ? 'Ready to redeem' : `Need ${needed} pts`)}</strong></div>
      <div class="voucher-info-stat"><span>Eligible items</span><strong>${rewardEsc(rewardDetailCategory(def))}</strong></div>
    </div>
    <div class="voucher-info-section">
      <h4><i class="fas fa-lightbulb"></i> Best use</h4>
      <p>${rewardEsc(rewardDetailUseCase(vid))}</p>
    </div>
    <div class="voucher-info-section">
      <h4><i class="fas fa-layer-group"></i> Stacking and limits</h4>
      <p>${rewardEsc(rewardDetailStackText(def))}</p>
      <p>${rewardEsc(`Maximum per order: ${def.maxPerOrder || 1}`)}</p>
    </div>
    ${rules.length ? `<div class="voucher-info-section"><h4><i class="fas fa-list-check"></i> Full rules</h4><ul>${rules.map((rule) => `<li>${rewardEsc(rule)}</li>`).join('')}</ul></div>` : ''}
    <div class="voucher-info-actions">
      <button class="btn btn-sm" ${canRedeemNow ? '' : 'disabled'} onclick="redeemVoucher('${escapeInlineJs(vid)}','${escapeInlineJs(label)}',${cost}); closeVoucherInfo();">
        <i class="fas fa-gift"></i> ${rewardEsc(canRedeemNow ? rwT('rewards.redeem') : 'Locked')}
      </button>
      <button class="delete-btn" type="button" onclick="closeVoucherInfo()">Close</button>
    </div>`;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-top-layer');
}

function closeVoucherInfo() {
  const modal = document.getElementById('voucher-info-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-bg.open')) document.body.classList.remove('has-top-layer');
}

window.openVoucherInfo = openVoucherInfo;
window.closeVoucherInfo = closeVoucherInfo;

function updateRewardsSummary() {
  const points = window.State && State.getPoints ? State.getPoints() : 0;
  const rewards = Array.isArray(REWARDS_DATA) ? REWARDS_DATA.slice().sort((a, b) => Number(a.pts) - Number(b.pts)) : [];
  const unlocked = rewards.filter((reward) => Number(points || 0) >= Number(reward.pts || 0));
  const locked = rewards.filter((reward) => Number(points || 0) < Number(reward.pts || 0));
  const nextReward = locked.length ? locked[0] : null;
  const nextNeeded = nextReward ? Math.max(0, Number(nextReward.pts || 0) - Number(points || 0)) : 0;

  const overviewPoints = document.getElementById('overviewPoints');
  const overviewRedeemableCount = document.getElementById('overviewRedeemableCount');
  const overviewNextUnlock = document.getElementById('overviewNextUnlock');
  const overviewNextUnlockNote = document.getElementById('overviewNextUnlockNote');
  const overviewSpinCost = document.getElementById('overviewSpinCost');
  const summaryReadyCount = document.getElementById('summaryReadyCount');
  const summaryLockedCount = document.getElementById('summaryLockedCount');
  const summaryNextReward = document.getElementById('summaryNextReward');
  const summaryNextRewardHint = document.getElementById('summaryNextRewardHint');
  const readyGroupCount = document.getElementById('readyGroupCount');
  const lockedGroupCount = document.getElementById('lockedGroupCount');

  if (overviewPoints) overviewPoints.textContent = String(points || 0);
  if (overviewRedeemableCount) overviewRedeemableCount.textContent = String(unlocked.length);
  if (overviewNextUnlock) overviewNextUnlock.textContent = nextReward ? rewardVoucherLabel(nextReward.vid, nextReward.vlabel) : 'All unlocked';
  if (overviewNextUnlockNote) overviewNextUnlockNote.textContent = nextReward
    ? rwStatic(`Need ${nextNeeded} more pts to unlock this reward.`)
    : rwStatic('You already have enough points for every listed reward.');
  if (overviewSpinCost) {
    const spinCost = typeof window.SPIN_COST === 'number' ? window.SPIN_COST : (typeof SPIN_COST === 'number' ? SPIN_COST : 30);
    overviewSpinCost.textContent = rwStatic(`${spinCost} pts`);
  }

  if (summaryReadyCount) summaryReadyCount.textContent = String(unlocked.length);
  if (summaryLockedCount) summaryLockedCount.textContent = String(locked.length);
  if (readyGroupCount) readyGroupCount.textContent = String(unlocked.length);
  if (lockedGroupCount) lockedGroupCount.textContent = String(locked.length);
  if (summaryNextReward) summaryNextReward.textContent = nextReward ? rewardVoucherLabel(nextReward.vid, nextReward.vlabel) : 'All rewards unlocked';
  if (summaryNextRewardHint) summaryNextRewardHint.textContent = nextReward
    ? rwStatic(`Need ${nextNeeded} more pts to unlock this reward.`)
    : rwStatic('You already have enough points for every listed reward.');
}

function renderRewards() {
  const readyGrid = document.getElementById('rewards-grid-ready');
  const lockedGrid = document.getElementById('rewards-grid-locked');
  if (!readyGrid || !lockedGrid) return;

  const currentPoints = State.getPoints ? State.getPoints() : 0;
  const rewards = Array.isArray(REWARDS_DATA) ? REWARDS_DATA.slice().sort((a, b) => Number(a.pts) - Number(b.pts)) : [];

  function renderRewardCard(reward, index) {
    const def = VOUCHER_RULES[reward.vid];
    const copy = getRewardCopy(reward);
    const rewardLabel = rewardVoucherLabel(reward.vid, reward.vlabel);
    const rewardMeta = rewardTypeMeta(reward.vid);
    const canRedeemNow = currentPoints >= reward.pts;
    const needed = Math.max(0, Number(reward.pts) - Number(currentPoints || 0));
    const buttonLabel = canRedeemNow ? rwT('rewards.redeem') : rwStatic('Locked');
    const statusText = canRedeemNow ? rwStatic('Available now') : rwStatic(`Need ${needed} more pts`);
    const readinessText = canRedeemNow
      ? rwStatic('You already have enough points for this reward.')
      : rwStatic(`Earn ${needed} more points to redeem this.`);
    const progressPct = Math.max(0, Math.min(100, Number(reward.pts) > 0 ? (Number(currentPoints || 0) / Number(reward.pts)) * 100 : 100));

    return `
      <article class="reward-card">
        <div class="reward-card__topline">
          <span class="reward-badge">${rewardEsc(rewardMeta.badge)}</span>
          <span class="reward-status ${canRedeemNow ? 'is-ready' : 'is-locked'}">${rewardEsc(statusText)}</span>
        </div>

        <div class="reward-card__main">
          <div class="reward-card__icon-wrap">
            <span class="r-icon">${rewardEsc(reward.icon)}</span>
          </div>
          <div class="reward-card__copy">
            <h3>${rewardEsc(copy.title)}</h3>
            <p>${rewardEsc(copy.desc)}</p>
          </div>
        </div>

        <div class="reward-progress">
          <div class="reward-progress__meta">
            <span>${rewardEsc(`${Math.min(Number(currentPoints || 0), Number(reward.pts || 0))} / ${Number(reward.pts || 0)} pts`)}</span>
            <span>${rewardEsc(canRedeemNow ? 'Ready to redeem' : `${needed} pts to go`)}</span>
          </div>
          <div class="reward-progress__track"><span style="width:${progressPct.toFixed(2)}%"></span></div>
        </div>

        <div class="reward-card__need">${rewardEsc(rewardMeta.helper ? `${rewardMeta.helper} ` : '')}${rewardEsc(readinessText)}</div>

        <button class="reward-detail-btn" type="button" onclick="openVoucherInfo('${escapeInlineJs(reward.vid)}')">
          <i class="fas fa-circle-info"></i> ${rewardEsc(rwStatic('More voucher details'))}
        </button>

        <div class="reward-card__footer">
          <div class="pts-pill">${rewardEsc(rwT('rewards.pointsToRedeem', { pts: reward.pts }))}</div>
          <button class="btn btn-sm" ${canRedeemNow ? '' : 'disabled'} onclick="redeemVoucher('${escapeInlineJs(reward.vid)}','${escapeInlineJs(rewardLabel)}',${Number(reward.pts) || 0})">
            ${rewardEsc(buttonLabel)}
          </button>
        </div>
      </article>`;
  }

  const unlockedRewards = rewards.filter((reward) => Number(currentPoints || 0) >= Number(reward.pts || 0));
  const lockedRewards = rewards.filter((reward) => Number(currentPoints || 0) < Number(reward.pts || 0));

  readyGrid.innerHTML = unlockedRewards.length
    ? unlockedRewards.map((reward, index) => renderRewardCard(reward, index)).join('')
    : `<div class="reward-empty-state">You do not have enough points for a reward yet. Keep ordering meals to unlock your first voucher.</div>`;

  lockedGrid.innerHTML = lockedRewards.length
    ? lockedRewards.map((reward, index) => renderRewardCard(reward, index + unlockedRewards.length)).join('')
    : `<div class="reward-empty-state">Great job — you already have enough points for every reward listed on this page.</div>`;

  updateRewardsSummary();
}

function refreshRewardsPage() {
  updateRewardsSummary();
  renderRewards();
}

function redeemVoucher(vid, vlabel, cost) {
  const check = State.canAddVoucher(vid);
  if (!check.ok) {
    State.notify('⚠️ ' + rewardVoucherStateReason(check.reason));
    return;
  }

  if (!State.deductPoints(cost)) {
    State.notify(rwT('rewards.notify.needRedeemPoints', { cost, points: State.getPoints() }));
    return;
  }

  const def = VOUCHER_RULES[vid];
  const localizedLabel = rewardVoucherLabel(vid, vlabel);
  State.addVoucher({ id: vid, label: localizedLabel, icon: def ? def.icon : '🎟️' });
  updateHeader();
  refreshRewardsPage();
  State.notify(rwT('rewards.notify.voucherRedeemed', { label: localizedLabel }));
}

function getBirthdayEligibility(user = State.getUser()) {
  if (!user || !user.birthday) {
    return { ok: false, reason: 'birthday-missing', birthday: null, today: null, isToday: false };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const birthday = new Date(user.birthday);
  birthday.setHours(0, 0, 0, 0);
  if (Number.isNaN(birthday.getTime())) {
    return { ok: false, reason: 'birthday-invalid', birthday, today, isToday: false };
  }
  const isToday = today.getMonth() === birthday.getMonth() && today.getDate() === birthday.getDate();
  return { ok: isToday, reason: isToday ? '' : 'not-today', birthday, today, isToday };
}

function checkBirthday() {
  const user = State.getUser();
  const textEl = document.getElementById('bday-text');
  const btnEl = document.getElementById('bday-btn');
  const titleEl = document.getElementById('bday-title');
  const btnLabelEl = document.getElementById('bday-btn-label');
  const statusEl = document.getElementById('bday-status');
  if (!textEl || !btnEl) return;

  if (titleEl) titleEl.textContent = rwStatic('Birthday Special');
  if (btnLabelEl) btnLabelEl.textContent = rwStatic('Claim Birthday Gift');
  if (statusEl) {
    statusEl.className = 'birthday-status-pill';
    statusEl.textContent = 'Checking eligibility';
  }

  if (!user || !user.birthday) {
    textEl.textContent = rwT('rewards.birthdayLoading');
    btnEl.style.display = 'none';
    if (statusEl) {
      statusEl.classList.add('is-upcoming');
      statusEl.textContent = 'Birthday not set yet';
    }
    return;
  }

  const eligibility = getBirthdayEligibility(user);
  const today = eligibility.today;
  const birthday = eligibility.birthday;
  if (!birthday || Number.isNaN(birthday.getTime())) {
    textEl.textContent = rwT('rewards.birthdayLoading');
    btnEl.style.display = 'none';
    if (statusEl) {
      statusEl.classList.add('is-upcoming');
      statusEl.textContent = 'Birthday unavailable';
    }
    return;
  }

  const isToday = eligibility.isToday;
  const displayName = user.firstName || user.username || rwStatic('friend');

  if (isToday && !State.isBdayClaimed()) {
    textEl.textContent = rwT('rewards.bday.todayClaim', { name: displayName });
    btnEl.style.display = '';
    if (statusEl) {
      statusEl.classList.add('is-today');
      statusEl.textContent = 'Available today';
    }
  } else if (isToday && State.isBdayClaimed()) {
    textEl.textContent = rwT('rewards.bday.todayClaimed', { name: displayName });
    btnEl.style.display = 'none';
    if (statusEl) {
      statusEl.classList.add('is-claimed');
      statusEl.textContent = 'Already claimed';
    }
  } else {
    const next = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    const days = Math.max(0, Math.round((next - today) / 86400000));
    textEl.textContent = rwT('rewards.bday.future', {
      days,
      plural: days !== 1 ? 's' : ''
    });
    btnEl.style.display = 'none';
    if (statusEl) {
      statusEl.classList.add('is-upcoming');
      statusEl.textContent = `${days} day${days !== 1 ? 's' : ''} left`;
    }
  }
}

async function claimBirthday() {
  if (window.__sgfClaimingBirthday) return;
  const initialEligibility = getBirthdayEligibility();
  if (!initialEligibility.ok) {
    State.notify(initialEligibility.reason === 'not-today'
      ? rwStatic('🎂 Birthday gifts can only be claimed on your birthday.')
      : rwStatic('🎂 Please save a valid birthday before claiming this gift.'));
    checkBirthday();
    return;
  }
  if (State.isBdayClaimed()) {
    State.notify(rwT('rewards.notify.bdayClaimed'));
    return;
  }

  window.__sgfClaimingBirthday = true;
  try {
    const currentUser = State.getUser();
    if (window.SGFBackend && window.SGFBackend.enabled && currentUser && currentUser.username) {
      await window.SGFBackend.loadCurrentUser(currentUser.username);
      const refreshedEligibility = getBirthdayEligibility();
      if (!refreshedEligibility.ok) {
        State.notify(refreshedEligibility.reason === 'not-today'
          ? rwStatic('🎂 Birthday gifts can only be claimed on your birthday.')
          : rwStatic('🎂 Please save a valid birthday before claiming this gift.'));
        return;
      }
      if (State.isBdayClaimed()) {
        State.notify(rwT('rewards.notify.bdayClaimed'));
        return;
      }
    }

    State.setBdayClaimed();
    State.addPoints(500);
    const check = State.canAddVoucher('BIRTHDAY_BURGER');
    const birthdayLabel = rewardVoucherLabel('BIRTHDAY_BURGER', 'Birthday Free Burger');
    if (check.ok) {
      State.addVoucher({ id: 'BIRTHDAY_BURGER', label: birthdayLabel, icon: '🎂' });
    }

    if (window.SGFBackend && window.SGFBackend.enabled) {
      await window.SGFBackend.syncCurrentUserNow(State.getUser() && State.getUser().username);
      await window.SGFBackend.loadCurrentUser(State.getUser() && State.getUser().username);
    }

    updateHeader();
    refreshRewardsPage();
    State.notify(rwT('rewards.notify.bdaySuccess', {
      extra: check.ok ? ` + "${birthdayLabel}" voucher added!` : ' added!'
    }));
  } catch (err) {
    console.error('[SGF Rewards] birthday sync failed', err);
    State.notify('❌ Birthday reward could not be saved. Please try again.');
  } finally {
    window.__sgfClaimingBirthday = false;
    refreshRewardsPage();
    checkBirthday();
  }
}

function renderSpinPrizes() {
  return;
}

window.refreshRewardsPage = refreshRewardsPage;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof requireAuth === 'function' && requireAuth() === false) return;
  refreshRewardsPage();
  renderSpinPrizes();
  checkBirthday();
  const voucherInfoModal = document.getElementById('voucher-info-modal');
  if (voucherInfoModal) {
    const voucherInfoClose = voucherInfoModal.querySelector('.voucher-info-close');
    if (voucherInfoClose && voucherInfoClose.dataset.boundClose !== '1') {
      voucherInfoClose.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeVoucherInfo();
      });
      voucherInfoClose.dataset.boundClose = '1';
    }
    voucherInfoModal.addEventListener('click', (event) => {
      if (event.target === voucherInfoModal) closeVoucherInfo();
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && voucherInfoModal && voucherInfoModal.classList.contains('open')) closeVoucherInfo();
  });
});

window.addEventListener('sgf:langchange', () => {
  refreshRewardsPage();
  checkBirthday();
});
