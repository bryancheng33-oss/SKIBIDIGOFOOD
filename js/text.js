// English-first localization helper with concrete fallback copy.
(function () {
  function interpolate(text, vars) {
    return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g, function (_, a, b) {
      var key = a || b;
      return vars && Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : '';
    });
  }

  function titleCase(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function rewardDataById() {
    var map = {};
    var source = typeof REWARDS_DATA !== 'undefined' ? REWARDS_DATA : window.REWARDS_DATA;
    if (Array.isArray(source)) {
      source.forEach(function (item) {
        if (item && item.vid) map[String(item.vid).trim()] = item;
      });
    }
    return map;
  }

  function voucherRuleDefs() {
    if (typeof VOUCHER_RULES !== 'undefined' && VOUCHER_RULES && typeof VOUCHER_RULES === 'object') return VOUCHER_RULES;
    return window.VOUCHER_RULES && typeof window.VOUCHER_RULES === 'object' ? window.VOUCHER_RULES : {};
  }

  var rewardMap = rewardDataById();

  var voucherLabels = {
    DRINK_FREE: 'Free Drink',
    BURGER_FREE: 'Free Burger',
    DISC_10: '10% Discount',
    RM5_OFF: 'RM 5 Off',
    DBL_PTS: '2x Points',
    MYSTERY: 'Mystery Gift',
    BIRTHDAY_BURGER: 'Birthday Free Burger'
  };

  var voucherDescs = {
    DRINK_FREE: 'Get any drink item FREE (up to RM 8.90 value).',
    BURGER_FREE: 'Get any fast-food item FREE (up to RM 13.90 value).',
    DISC_10: '10% off your entire cart total. Maximum saving: RM 6.',
    RM5_OFF: 'Flat RM 5 off your total bill. Valid on orders RM 10+.',
    DBL_PTS: 'Earn double loyalty points on your next order.',
    MYSTERY: 'A mystery discount between 5% and 12% off (max RM 12).',
    BIRTHDAY_BURGER: 'Happy Birthday! One free fast-food item on us (up to RM 13.90).'
  };

  var voucherRules = {
    DRINK_FREE: [
      'Deducts up to RM 8.90 from your cart total.',
      'Applies to items in the "Drinks" category only.',
      'Only 1 Free Drink voucher can be active per order.',
      'Cannot be stacked with a second Free Drink voucher.',
      'Remaining value is non-transferable and non-cashable.'
    ],
    BURGER_FREE: [
      'Deducts up to RM 13.90 from your cart total.',
      'Applicable to any fast-food or burger item.',
      'Cannot be stacked with Birthday Free Burger voucher.',
      'Only 1 Free Burger voucher can be active per order.',
      'Remaining value is non-transferable.'
    ],
    DISC_10: [
      'Applies 10% discount to the cart subtotal.',
      'Maximum discount capped at RM 6.',
      'Cannot be stacked with RM 5 Off or Mystery voucher.',
      'Can be combined with Free Drink or Free Burger vouchers.',
      'Percentage is calculated after item-level discounts are applied.'
    ],
    RM5_OFF: [
      'Deducts exactly RM 5 from the final cart total.',
      'Minimum order value of RM 10 is required.',
      'Cannot be combined with the 10% Discount or Mystery voucher.',
      'Stackable with Free Drink or Free Burger vouchers.',
      'Only 1 RM 5 Off voucher can be active per order.'
    ],
    DBL_PTS: [
      'Doubles all loyalty points earned from this order.',
      'Points are credited after the order is delivered successfully.',
      'Can be stacked with any discount or free-item voucher.',
      'Cannot be combined with a second 2x Points voucher.',
      'Applies to the single next order only and does not carry over.'
    ],
    MYSTERY: [
      'Applies a hidden discount between 5% and 12% on your cart total.',
      'Maximum mystery discount capped at RM 12.',
      'Exact discount is revealed at checkout summary.',
      'Cannot be stacked with 10% Discount or RM 5 Off voucher.',
      'Only 1 Mystery voucher can be active per order.'
    ],
    BIRTHDAY_BURGER: [
      'Granted once per year on your registered birthday.',
      'Deducts up to RM 13.90 from your cart total.',
      'Cannot be combined with a regular Free Burger voucher.',
      'Stackable with discount vouchers (10% Off or RM 5 Off).',
      'Expires 7 days after your birthday if unused.'
    ]
  };

  var translations = {
    'common.clear': 'Clear',
    'rewards.voucherRules': 'Voucher rules',
    'rewards.pointsToRedeem': '{pts} pts to redeem',
    'rewards.redeem': 'Redeem',
    'rewards.notify.needRedeemPoints': 'You need {cost} points to redeem this reward. You currently have {points} points.',
    'rewards.notify.voucherRedeemed': 'Voucher "{label}" redeemed successfully!',
    'rewards.birthdayLoading': 'Add your birthday in Profile to unlock your birthday reward.',
    'rewards.bday.todayClaim': 'Happy birthday, {name}! Claim your birthday reward today.',
    'rewards.bday.todayClaimed': 'Happy birthday, {name}! Your birthday reward has already been claimed.',
    'rewards.bday.future': 'Your birthday reward unlocks in {days} day{plural}.',
    'rewards.notify.bdayClaimed': 'You have already claimed your birthday reward.',
    'rewards.notify.bdaySuccess': 'Birthday reward claimed{extra}',
    'rewards.birthdaySpecial': 'Birthday Special',
    'rewards.claimBirthday': 'Claim Birthday Reward',
    'rewards.wheelTitle': 'Lucky Spin',
    'rewards.wheelSubtitle': 'Spin for {cost} points. Total win rate: {winRate}.',
    'rewards.statCost': '{cost} pts per spin',
    'rewards.statJackpot': '{winRate} total win chance',
    'rewards.statRare': '{rareRate} mystery chance',
    'rewards.hubSpin': 'Spin',
    'rewards.hubCost': '{cost} pts',
    'rewards.spinning': 'Spinning...',
    'rewards.spinButton': 'Spin the Wheel',
    'rewards.spinCostNote': '{cost} pts',
    'rewards.spinHint': 'Most spins miss, but rare rewards can pay off.',
    'rewards.balanceTitle': 'Spin Balance',
    'rewards.balanceLabel': 'Your points',
    'rewards.probabilities': 'Prize probabilities',
    'rewards.resultIdle': 'Spend {cost} points to try your luck.',
    'rewards.recentSpins': 'Recent Spins',
    'rewards.legend.nothing': 'Nothing',
    'rewards.legend.points': 'Points',
    'rewards.legend.mystery': 'Mystery',
    'rewards.legend.mysteryPrize': '120 to 220 pts',
    'rewards.notify.needSpinPoints': 'You need {cost} points to spin. You currently have {points} points.',
    'rewards.notify.winPoints': 'Nice! You won {pts} points.',
    'rewards.notify.winMystery': 'Lucky hit! You won a mystery reward worth {pts} points.',
    'rewards.notify.nothing': 'No reward this time. Save up and try again later.',
    'rewards.resultBadge.points': 'Points Win',
    'rewards.resultHeadline.points': 'You won {pts} points!',
    'rewards.resultSub.points': 'The bonus points have already been added to your balance.',
    'rewards.resultBadge.mystery': 'Mystery Win',
    'rewards.resultHeadline.mystery': 'Mystery prize: {pts} points!',
    'rewards.resultSub.mystery': 'Rare pull. The mystery bonus has been added to your balance.',
    'rewards.resultBadge.nothing': 'No Prize',
    'rewards.resultHeadline.nothing': 'No reward this spin',
    'rewards.resultSub.nothing': 'You only spent the spin cost. Come back after earning more points.',
    'rewards.noSpins': 'No spin history yet.',
    'rewards.history.nothing': 'No prize',
    'rewards.history.points': '+{pts} pts',
    'rewards.history.mystery': 'Mystery +{pts} pts'
  };

  function dynamicRewardCopy(key) {
    var match = String(key || '').match(/^rewards\.reward\.([A-Z0-9_]+)\.(title|desc)$/);
    if (!match) return null;
    var vid = match[1];
    var field = match[2];
    var fromData = rewardMap[vid];
    if (fromData && fromData[field]) return String(fromData[field]);
    var defs = voucherRuleDefs();
    var fromDefs = defs[vid] && defs[vid][field];
    if (fromDefs) return String(fromDefs);
    return null;
  }

  var api = {
    choose: function (en) { return en; },
    t: function (key, vars) {
      var raw = translations[key];
      if (raw == null) raw = dynamicRewardCopy(key);
      if (raw == null) raw = key;
      return interpolate(raw, vars);
    },
    applyTranslations: function () { document.documentElement.lang = 'en'; },
    localizeVoucherLabel: function (vid, fallback) {
      return voucherLabels[String(vid || '').trim()] || fallback || vid;
    },
    localizeVoucherDesc: function (vid, fallback) {
      var id = String(vid || '').trim();
      return voucherDescs[id] || fallback || ((voucherRuleDefs()[id] || {}).desc) || '';
    },
    localizeVoucherRules: function (vid, fallback) {
      var id = String(vid || '').trim();
      if (voucherRules[id]) return voucherRules[id].slice();
      if (Array.isArray(fallback)) return fallback;
      var def = voucherRuleDefs()[id];
      return def && Array.isArray(def.rules) ? def.rules.slice() : [];
    },
    localizeCategory: function (value) { return titleCase(value); },
    localizeCuisine: function (value) { return titleCase(value); },
    localizeBadge: function (value) { return String(value || '').toUpperCase(); },
    localizeOrderStatus: function (value) { return titleCase(value); },
    localizePaymentMethod: function (value) {
      var map = { cod: 'Cash on Delivery', wallet: 'Wallet', card: 'Card' };
      var key = String(value || '').toLowerCase();
      return map[key] || titleCase(value);
    },
    localizeSupportPriority: function (value) {
      var map = { standard: 'Standard', student: 'Student', express: 'Express', vip: 'VIP' };
      var key = String(value || '').toLowerCase();
      return map[key] || titleCase(value);
    },
    formatDateTime: function (value) {
      if (!value) return '';
      var d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString('en-MY', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    }
  };

  window.I18N = api;
  document.addEventListener('DOMContentLoaded', function () {
    api.applyTranslations();
  });
})();
