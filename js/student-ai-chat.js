(function () {
  var ALLOWED_PAGES = ['home', 'menu', 'cart', 'menu#orders-panel', 'rewards', 'profile', 'contact', 'how-it-works', 'checkout'];

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    return 'RM ' + (Number(value) || 0).toFixed(2);
  }

  function currentPage() {
    var raw = (window.location.pathname || '').split('/').pop();
    return raw || './';
  }

  var AI_DRAFT_KEY_PREFIX = 'sgf_ai_chat_draft_';
  var AI_OPEN_KEY_PREFIX = 'sgf_ai_chat_open_';
  var AI_HISTORY_KEY_PREFIX = 'sgf_ai_chat_history_';
  var AI_QUICK_REPLIES_KEY_PREFIX = 'sgf_ai_quick_replies_';
  var lastAiInteractionAt = 0;

  function currentPageName() {
    var page = currentPage();
    var map = {
      'home': 'Home',
      'menu': 'Menu',
      'cart': 'Cart',
      'menu#orders-panel': 'Orders',
      'rewards': 'Rewards',
      'profile': 'Profile',
      'contact': 'Support',
      'how-it-works': 'How It Works',
      'checkout': 'Checkout'
    };
    return map[page] || 'Page';
  }

  function sessionRead(key) {
    try {
      return sessionStorage.getItem(key) || '';
    } catch (err) {
      return '';
    }
  }

  function sessionWrite(key, value) {
    try {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch (err) {}
  }

  function localRead(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (err) {
      return '';
    }
  }

  function localWrite(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch (err) {}
  }

  function storageToken(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'guest';
  }

  function currentUserScope() {
    var user = getUser();
    if (!user || typeof user !== 'object') return 'guest';
    return storageToken(user.username || user.email || user.id || user.name || 'guest');
  }

  function scopedStorageKey(prefix) {
    return prefix + currentUserScope();
  }

  function legacyPageStorageKey(prefix) {
    return prefix + currentPage();
  }

  function aiDraftKey() {
    return scopedStorageKey(AI_DRAFT_KEY_PREFIX);
  }

  function aiOpenKey() {
    return scopedStorageKey(AI_OPEN_KEY_PREFIX);
  }

  function aiHistoryKey() {
    return scopedStorageKey(AI_HISTORY_KEY_PREFIX);
  }

  function aiQuickRepliesKey() {
    return scopedStorageKey(AI_QUICK_REPLIES_KEY_PREFIX);
  }

  function migrateLegacyChatState() {
    try {
      var nextDraftKey = aiDraftKey();
      var nextHistoryKey = aiHistoryKey();
      var nextOpenKey = aiOpenKey();
      var legacyDraft = sessionRead(legacyPageStorageKey(AI_DRAFT_KEY_PREFIX));
      var legacyHistory = sessionRead(legacyPageStorageKey(AI_HISTORY_KEY_PREFIX));
      var legacyOpen = sessionRead(legacyPageStorageKey(AI_OPEN_KEY_PREFIX));

      if (!localRead(nextDraftKey) && legacyDraft) {
        localWrite(nextDraftKey, legacyDraft);
      }
      if (!localRead(nextHistoryKey) && legacyHistory) {
        localWrite(nextHistoryKey, legacyHistory);
      }
      if (legacyOpen === '1' && sessionRead(nextOpenKey) !== '1') {
        sessionWrite(nextOpenKey, '1');
      }
    } catch (err) {}
  }

  function getDraftValue() {
    migrateLegacyChatState();
    return localRead(aiDraftKey());
  }

  function setDraftValue(value) {
    localWrite(aiDraftKey(), String(value || ''));
  }

  function getHistoryValue() {
    migrateLegacyChatState();
    try {
      var raw = localRead(aiHistoryKey());
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function setHistoryValue(items) {
    try {
      if (Array.isArray(items) && items.length) localWrite(aiHistoryKey(), JSON.stringify(items));
      else localWrite(aiHistoryKey(), '');
    } catch (err) {}
  }

  function getQuickRepliesCollapsed() {
    return true;
  }

  function setQuickRepliesCollapsed(collapsed) {
    try {
      sessionStorage.removeItem(aiQuickRepliesKey());
    } catch (err) {}
  }

  function rememberOpenState(isOpen) {
    sessionWrite(aiOpenKey(), isOpen ? '1' : '');
  }

  function shouldRestoreOpenState() {
    migrateLegacyChatState();
    return sessionRead(aiOpenKey()) === '1';
  }

  function markAiInteraction() {
    lastAiInteractionAt = Date.now();
  }

  function hasRecentAiInteraction(windowMs) {
    return Date.now() - lastAiInteractionAt < Math.max(300, Number(windowMs) || 1800);
  }

  function isSuitablePage() {
    return ALLOWED_PAGES.indexOf(currentPage()) !== -1;
  }

  function getUser() {
    return window.State && State.getUser ? State.getUser() : null;
  }

  function getFoods() {
    if (window.State && State.getFoodsData) return State.getFoodsData() || [];
    if (typeof FOODS !== 'undefined') return FOODS || [];
    return [];
  }

  function getBrands() {
    if (window.State && State.getBrandsData) return State.getBrandsData() || [];
    if (typeof BRANDS !== 'undefined') return BRANDS || [];
    return [];
  }

  function getRewardsData() {
    if (typeof REWARDS_DATA !== 'undefined' && Array.isArray(REWARDS_DATA)) return REWARDS_DATA;
    return [];
  }

  function getFaqs() {
    if (window.State && State.getFaqs) return State.getFaqs() || [];
    if (typeof DEFAULT_FAQS !== 'undefined' && Array.isArray(DEFAULT_FAQS)) return DEFAULT_FAQS;
    return [];
  }

  function getCartItems() {
    return window.State && State.getCartItems ? State.getCartItems() || [] : [];
  }

  function getCartSubtotal() {
    return window.State && State.getCartSubtotal ? Number(State.getCartSubtotal()) || 0 : 0;
  }

  function uniqueBy(items, key) {
    var seen = {};
    return (items || []).filter(function (item) {
      var value = item && item[key];
      if (seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function tokenise(value) {
    return normalize(value).split(/\s+/).filter(Boolean);
  }

  function parseBudget(text) {
    var value = String(text || '');
    var match = value.match(/rm\s*(\d+(?:\.\d+)?)/i) || value.match(/\b(\d+(?:\.\d+)?)\s*ringgit\b/i) || value.match(/under\s*(\d+(?:\.\d+)?)/i) || value.match(/below\s*(\d+(?:\.\d+)?)/i);
    return match ? Number(match[1]) : null;
  }

  function parseCount(text, fallback, max) {
    var match = String(text || '').match(/\b(\d+)\b/);
    var value = match ? Number(match[1]) : fallback;
    if (!Number.isFinite(value) || value <= 0) value = fallback;
    return Math.min(value, max || value);
  }



  function injectStyles() {
    if (document.getElementById('student-ai-runtime-styles')) return;
    var style = document.createElement('style');
    style.id = 'student-ai-runtime-styles';
    style.textContent = `
body.student-ai-open{overflow:auto !important;}
#student-ai-shell,#student-ai-shell *{box-sizing:border-box;}
#student-ai-shell.student-ai-shell{position:fixed;right:1.25rem;bottom:1.25rem;z-index:2147483000;font-family:var(--font-body,"Inter",Arial,sans-serif);pointer-events:none;}
#student-ai-shell .student-ai-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.14);opacity:0;pointer-events:none;transition:opacity .2s ease;}
body.student-ai-open #student-ai-shell .student-ai-backdrop{opacity:1;pointer-events:auto;}
#student-ai-shell .student-ai-toggle,
#student-ai-shell .student-ai-panel{pointer-events:auto;}

#student-ai-shell .student-ai-toggle{
  position:fixed;right:1.25rem;bottom:1.25rem;
  appearance:none;-webkit-appearance:none;
  display:inline-flex;align-items:center;gap:.72rem;
  min-height:3.85rem;padding:.68rem 1.12rem .68rem .72rem;
  border:none;border-radius:999px;
  background:linear-gradient(135deg,#fff7d4 0%,#ffe184 100%);
  color:#111827;
  box-shadow:0 10px 24px rgba(15,23,42,.18),inset 0 0 0 1.5px rgba(170,120,0,.18);
  cursor:pointer;
  transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease;
  white-space:nowrap;
}
#student-ai-shell .student-ai-toggle:hover{transform:translateY(-3px);box-shadow:0 16px 32px rgba(15,23,42,.22),inset 0 0 0 1.5px rgba(170,120,0,.2);}
body.student-ai-open #student-ai-shell .student-ai-toggle{opacity:0;transform:translateY(6px);pointer-events:none;}
#student-ai-shell .student-ai-toggle-icon{
  width:2.9rem;height:2.9rem;flex:0 0 auto;
  border-radius:999px;display:inline-flex;align-items:center;justify-content:center;
  background:#111827;color:#fed330;font-size:1.05rem;
  box-shadow:0 4px 12px rgba(15,23,42,.22);
}
#student-ai-shell .student-ai-toggle-copy{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1;text-align:left;}
#student-ai-shell .student-ai-toggle-copy strong{font-family:var(--font-head,"Dapifer","ITC Tiffany",Georgia,serif);font-size:1.08rem;font-weight:800;color:#111827;}
#student-ai-shell .student-ai-toggle-copy small{font-size:.76rem;font-weight:700;color:#825800;letter-spacing:.01em;}

#student-ai-shell .student-ai-toggle:focus-visible,
#student-ai-shell .student-ai-icon-btn:focus-visible,
#student-ai-shell .student-ai-submit:focus-visible,
#student-ai-shell .student-ai-chip:focus-visible,
#student-ai-shell .student-ai-suggest:focus-visible,
#student-ai-shell .student-ai-input:focus-visible,
#student-ai-shell .student-ai-tool:focus-visible,
#student-ai-shell .student-ai-emoji-btn:focus-visible,
#student-ai-shell .student-ai-attach-item:focus-visible{
  outline:none;
  box-shadow:0 0 0 3px rgba(254,211,48,.35),0 8px 24px rgba(15,23,42,.1);
}

#student-ai-shell .student-ai-panel{
  position:fixed;right:.8rem;bottom:5.15rem;
  width:clamp(31rem,44vw,38rem);
  height:min(88vh,58rem);
  max-height:calc(100vh - .7rem);
  min-height:0;
  display:flex;flex-direction:column;
  background:linear-gradient(180deg,#fffefb 0%,#fffaf1 100%);
  border:1.5px solid #e8d99a;
  border-radius:1.95rem;
  box-shadow:0 26px 72px rgba(15,23,42,.22),0 8px 20px rgba(15,23,42,.08);
  overflow:hidden;
}
#student-ai-shell .student-ai-panel[hidden],
#student-ai-shell .student-ai-pop[hidden],
#student-ai-shell .student-ai-quick-content[hidden]{display:none !important;}

#student-ai-shell .student-ai-head{
  display:flex;align-items:center;justify-content:space-between;gap:1rem;
  padding:1.08rem 1.22rem 1rem;
  background:linear-gradient(180deg,#fff8e6 0%,#fff2cb 100%);
  border-bottom:1px solid #f0dfad;
  flex-shrink:0;
}
#student-ai-shell .student-ai-brand{display:flex;align-items:center;gap:.9rem;min-width:0;flex:1 1 auto;}
#student-ai-shell .student-ai-avatar{
  width:3rem;height:3rem;flex:0 0 auto;
  border-radius:999px;display:inline-flex;align-items:center;justify-content:center;
  background:#111827;color:#fed330;font-size:1.02rem;font-weight:900;
  box-shadow:0 5px 14px rgba(15,23,42,.18);
}
#student-ai-shell .student-ai-brand-copy{min-width:0;display:flex;flex-direction:column;gap:.22rem;}
#student-ai-shell .student-ai-brand-copy strong{
  display:block;font-family:var(--font-head,"Dapifer","ITC Tiffany",Georgia,serif);
  font-size:1.24rem;line-height:1.08;color:#111827;font-weight:800;
}
#student-ai-shell .student-ai-online{display:inline-flex;align-items:center;gap:.34rem;font-size:.8rem;font-weight:600;color:#526173;}
#student-ai-shell .student-ai-online i{font-size:.48rem;color:#22c55e;}
#student-ai-shell .student-ai-actions{display:flex;align-items:center;gap:.46rem;flex:0 0 auto;}
#student-ai-shell .student-ai-icon-btn{
  appearance:none;-webkit-appearance:none;
  width:2.45rem;height:2.45rem;border-radius:999px;
  border:1.5px solid rgba(170,120,0,.32);
  background:#fff9ea;color:#7a5200;
  cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  font-size:.9rem;transition:background .15s ease,border-color .15s ease,transform .15s ease;
}
#student-ai-shell .student-ai-icon-btn:hover{background:#fff2c6;border-color:rgba(170,120,0,.46);transform:translateY(-1px);}

#student-ai-shell .student-ai-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;background:transparent;}
#student-ai-shell .student-ai-messages{
  flex:1 1 auto;min-height:0;
  padding:1.08rem 1.22rem .86rem;
  overflow-y:auto;overflow-x:hidden;
  display:flex;flex-direction:column;gap:.9rem;
  scrollbar-gutter:stable;
  scrollbar-width:thin;scrollbar-color:#d4b96e #f5edd6;
  background:linear-gradient(180deg,#fffefd 0%,#fffaf2 100%);
}
#student-ai-shell .student-ai-messages::-webkit-scrollbar{width:6px;}
#student-ai-shell .student-ai-messages::-webkit-scrollbar-track{background:#f5edd6;border-radius:999px;}
#student-ai-shell .student-ai-messages::-webkit-scrollbar-thumb{background:#d4b96e;border-radius:999px;}
#student-ai-shell .student-ai-day-stamp{
  align-self:center;padding:.26rem .78rem;border-radius:999px;
  background:#f0e6c8;color:#7a5c00;font-size:.67rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  margin:.06rem 0;
}
#student-ai-shell .student-ai-msg-row{display:flex;max-width:100%;}
#student-ai-shell .student-ai-msg-row-ai{justify-content:flex-start;}
#student-ai-shell .student-ai-msg-row-user{justify-content:flex-end;}
#student-ai-shell .student-ai-msg-wrap{display:flex;align-items:flex-end;gap:.56rem;max-width:100%;}
#student-ai-shell .student-ai-msg-avatar{
  width:2rem;height:2rem;flex:0 0 auto;
  border-radius:999px;display:inline-flex;align-items:center;justify-content:center;
  background:#111827;color:#fed330;font-size:.74rem;font-weight:900;
  box-shadow:0 3px 10px rgba(0,0,0,.12);
}
#student-ai-shell .student-ai-msg{
  display:block;max-width:min(94%,29rem);
  padding:.94rem 1.08rem;border-radius:1.15rem;
  font-size:1rem;line-height:1.64;
  box-shadow:0 3px 12px rgba(15,23,42,.06);
  word-break:break-word;overflow-wrap:anywhere;
}
#student-ai-shell .student-ai-msg p{margin:0;}
#student-ai-shell .student-ai-msg p + p{margin-top:.55rem;}
#student-ai-shell .student-ai-msg ul{margin:.55rem 0 0 1.05rem;padding:0;}
#student-ai-shell .student-ai-msg li + li{margin-top:.2rem;}
#student-ai-shell .student-ai-food-list{display:grid;gap:.58rem;margin-top:.64rem;}
#student-ai-shell .student-ai-food-item{padding:.74rem .84rem;border:1px solid #f0deaa;border-radius:1rem;background:#fffdf6;}
#student-ai-shell .student-ai-food-item strong{display:block;line-height:1.36;}
#student-ai-shell .student-ai-food-meta{display:flex;flex-wrap:wrap;gap:.34rem .56rem;margin-top:.32rem;font-size:.84rem;color:#6b7280;}
#student-ai-shell .student-ai-msg-user{background:#7d4f00;color:#fff;border-bottom-right-radius:.42rem;margin-left:auto;}
#student-ai-shell .student-ai-msg-ai{background:#fff;border:1.5px solid #f0deaa;color:#111827;border-bottom-left-radius:.42rem;}
#student-ai-shell .student-ai-msg-ai a{color:#9a6700;font-weight:800;text-decoration:underline;}

#student-ai-shell .student-ai-quick-wrap{
  padding:.56rem 1.02rem .64rem;
  background:#fffdf8;
  border-top:1px solid #f0e6c8;
  display:grid;gap:.48rem;
  flex-shrink:0;
}
#student-ai-shell .student-ai-quick-head{display:flex;align-items:center;justify-content:space-between;gap:.7rem;}
#student-ai-shell .student-ai-quick-title{font-size:.66rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#a88c3a;}
#student-ai-shell .student-ai-quick-toggle{
  appearance:none;-webkit-appearance:none;
  width:1.9rem;height:1.9rem;flex:0 0 auto;
  border-radius:999px;border:1.5px solid #e6c84a;background:#fffaf0;color:#7a5200;
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
  font-size:.95rem;font-weight:900;line-height:1;
  position:relative;z-index:1;touch-action:manipulation;
  transition:transform .16s ease,background .14s ease,box-shadow .14s ease;
}
#student-ai-shell .student-ai-quick-toggle:hover{background:#fff3cb;box-shadow:0 4px 12px rgba(180,130,0,.12);}
#student-ai-shell .student-ai-quick-toggle .student-ai-quick-caret{display:inline-block;transition:transform .16s ease;transform-origin:center;}
#student-ai-shell .student-ai-quick-toggle[aria-expanded="true"] .student-ai-quick-caret{transform:rotate(180deg);}
#student-ai-shell .student-ai-quick-content{display:grid;gap:.48rem;}
#student-ai-shell .student-ai-quick{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(9.6rem,1fr));
  gap:.56rem;
  overflow:visible;
  padding-bottom:0;
}
#student-ai-shell .student-ai-chip{
  appearance:none;-webkit-appearance:none;
  display:flex;align-items:center;justify-content:center;
  width:100%;min-height:2.5rem;
  padding:.56rem .82rem;border-radius:999px;
  border:1.5px solid #e6c84a;background:#fffaf0;color:#7a5200;
  font-size:.8rem;font-weight:700;line-height:1.3;cursor:pointer;
  transition:background .14s,transform .14s,box-shadow .14s;
  white-space:normal;text-align:center;
}
#student-ai-shell .student-ai-chip:hover{background:#fff3cb;transform:translateY(-1px);box-shadow:0 4px 12px rgba(180,130,0,.12);}
#student-ai-shell .student-ai-suggest{
  appearance:none;-webkit-appearance:none;
  display:flex;flex-direction:column;align-items:flex-start;gap:.12rem;
  width:100%;padding:.66rem .82rem;
  border-radius:.96rem;border:1.5px solid #e8d99a;
  background:#fffdf3;color:#111827;text-align:left;cursor:pointer;
  transition:background .14s,box-shadow .14s;
}
#student-ai-shell .student-ai-suggest:hover{background:#fff7d7;box-shadow:0 4px 14px rgba(180,130,0,.1);}
#student-ai-shell .student-ai-suggest span{font-size:.62rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8a5a00;}
#student-ai-shell .student-ai-suggest strong{font-size:.84rem;line-height:1.34;color:#374151;font-weight:700;white-space:normal;}

#student-ai-shell .student-ai-foot{position:relative;padding:.58rem 1.02rem .7rem;border-top:1px solid #f0e6c8;background:#fff;flex-shrink:0;}
#student-ai-shell .student-ai-pop{
  position:absolute;left:1.12rem;right:1.12rem;bottom:6.8rem;
  padding:.82rem;border-radius:1.05rem;border:1.5px solid #e8d99a;
  background:#fffef8;box-shadow:0 12px 36px rgba(15,23,42,.16);z-index:2;
}
#student-ai-shell .student-ai-pop-title{font-size:.68rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8a5a00;margin-bottom:.5rem;}
#student-ai-shell .student-ai-emoji-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.4rem;}
#student-ai-shell .student-ai-emoji-btn{appearance:none;-webkit-appearance:none;min-height:2.2rem;border-radius:.82rem;border:1.5px solid #f0deaa;background:#fff;color:#111827;cursor:pointer;font-size:1rem;}
#student-ai-shell .student-ai-attach-list{display:grid;gap:.38rem;}
#student-ai-shell .student-ai-attach-item{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:space-between;gap:.6rem;width:100%;padding:.62rem .74rem;border-radius:.9rem;border:1.5px solid #f0deaa;background:#fff;color:#111827;cursor:pointer;text-align:left;font-size:.84rem;font-weight:700;transition:background .13s;}
#student-ai-shell .student-ai-attach-item:hover{background:#fffdf0;}
#student-ai-shell .student-ai-attach-item small{display:block;font-size:.73rem;font-weight:600;color:#7b8798;}
#student-ai-shell .student-ai-form{display:grid;gap:.42rem;}
#student-ai-shell .student-ai-composer{position:relative;min-width:0;}
#student-ai-shell .student-ai-input{
  appearance:none;-webkit-appearance:none;display:block;width:100%;min-width:0;
  min-height:3rem;max-height:7rem;resize:none;
  border-radius:1.3rem;border:1.5px solid #dce3ed;background:#fffdf8;color:#111827;
  font-size:1rem;line-height:1.5;padding:.76rem 3.9rem .76rem .98rem;overflow-y:auto;
  transition:border-color .15s,background .15s,box-shadow .15s;
}
#student-ai-shell .student-ai-input:focus{border-color:#e6c84a;background:#fff;outline:none;}
#student-ai-shell .student-ai-input::placeholder{color:#9ba3b0;}
#student-ai-shell .student-ai-submit{
  appearance:none;-webkit-appearance:none;position:absolute;right:.44rem;bottom:.44rem;
  width:2.6rem;height:2.6rem;border-radius:999px;
  background:linear-gradient(135deg,#fed330 0%,#e0a800 100%);color:#1a1400;border:1.5px solid #c99600;
  cursor:pointer;font-size:.92rem;display:inline-flex;align-items:center;justify-content:center;
  box-shadow:0 3px 10px rgba(180,130,0,.22);transition:transform .14s,box-shadow .14s;
}
#student-ai-shell .student-ai-submit:hover{transform:scale(1.06);box-shadow:0 5px 16px rgba(180,130,0,.32);}
#student-ai-shell .student-ai-tool-row{display:block;}
#student-ai-shell .student-ai-tool-actions{display:none;}
#student-ai-shell .student-ai-tool{
  appearance:none;-webkit-appearance:none;
  width:2.55rem;height:2.55rem;flex:0 0 auto;border-radius:999px;
  border:1.5px solid #e5e7eb;background:#fff;color:#526173;cursor:pointer;font-size:.92rem;
  display:inline-flex;align-items:center;justify-content:center;transition:background .13s,border-color .13s,color .13s;
}
#student-ai-shell .student-ai-tool:hover{background:#fff8d6;border-color:#e6c84a;color:#7a5200;}
#student-ai-shell .student-ai-note{display:block;margin:0;font-size:.72rem;line-height:1.38;color:#7b8798;text-align:center;max-width:none;}

@media (max-width: 960px){
  #student-ai-shell .student-ai-panel{width:min(33rem,calc(100vw - .6rem));height:min(90vh,calc(100vh - .45rem));}
}
@media (max-width: 760px){
  body.student-ai-open{overflow:hidden !important;}
  #student-ai-shell.student-ai-shell{right:auto;left:auto;bottom:auto;}
  #student-ai-shell .student-ai-toggle{right:.65rem;bottom:.65rem;min-height:3.38rem;padding:.6rem .9rem .6rem .68rem;}
  #student-ai-shell .student-ai-panel{top:.28rem;right:.28rem;bottom:.28rem;left:.28rem;width:auto;height:auto;max-height:none;border-radius:1.38rem;}
  #student-ai-shell .student-ai-head{padding:.92rem .92rem .88rem;}
  #student-ai-shell .student-ai-brand-copy strong{font-size:1.08rem;}
  #student-ai-shell .student-ai-messages{padding:.88rem .9rem .7rem;}
  #student-ai-shell .student-ai-msg{max-width:min(96%,21rem);font-size:.97rem;}
  #student-ai-shell .student-ai-quick-wrap{padding:.52rem .9rem .58rem;gap:.42rem;}
  #student-ai-shell .student-ai-quick{grid-template-columns:repeat(2,minmax(0,1fr));}
  #student-ai-shell .student-ai-foot{padding:.54rem .9rem .66rem;}
  #student-ai-shell .student-ai-pop{left:.9rem;right:.9rem;bottom:5.9rem;}
  #student-ai-shell .student-ai-note{display:block;font-size:.7rem;}
}
@media (max-width: 640px){
  #student-ai-shell .student-ai-panel{top:.22rem;right:.22rem;bottom:.22rem;left:.22rem;border-radius:1.32rem;}
  #student-ai-shell .student-ai-brand-copy strong{font-size:1.02rem;}
  #student-ai-shell .student-ai-icon-btn{width:2.28rem;height:2.28rem;}
}
@media (max-width: 460px){
  #student-ai-shell .student-ai-msg{max-width:min(97%,19rem);font-size:.95rem;line-height:1.56;}
  #student-ai-shell .student-ai-chip{font-size:.77rem;padding:.52rem .64rem;}
  #student-ai-shell .student-ai-input{min-height:2.9rem;font-size:.95rem;padding:.72rem 3.7rem .72rem .9rem;}
  #student-ai-shell .student-ai-submit{width:2.45rem;height:2.45rem;right:.38rem;bottom:.38rem;}
  #student-ai-shell .student-ai-note{font-size:.68rem;}
  #student-ai-shell .student-ai-emoji-grid{grid-template-columns:repeat(4,minmax(0,1fr));}
}
`;
    document.head.appendChild(style);
  }

  function pageMeta() {
    var page = currentPage();
    var map = {
      'home': {
        badge: 'Campus AI',
        title: 'Skibidi GoFood AI',
        subtitle: 'Guidance based on the live menu, your account data, and current website rules.',
        note: 'Tip: ask about menu items, wallet, vouchers, support steps, or where to go next.',
        chips: [
          { label: 'Popular meals', prompt: 'Show popular meals' },
          { label: 'Meals under RM 10', prompt: 'Show budget meals under RM 10' },
          { label: 'Wallet and points', prompt: 'Show my wallet and points' },
          { label: 'Go to support', prompt: 'Where can I get support?' }
        ]
      },
      'menu': {
        badge: 'Menu AI',
        title: 'Skibidi GoFood AI',
        subtitle: 'I can search the live catalog by brand, category, popularity, or budget.',
        note: 'Tip: try “cheapest pizza”, “popular burgers”, or “meals under RM 12”.',
        chips: [
          { label: 'Popular meals', prompt: 'Show popular meals' },
          { label: 'Cheapest items', prompt: 'Show cheapest menu items' },
          { label: 'Pizza under RM 15', prompt: 'Show pizza under RM 15' },
          { label: 'Available brands', prompt: 'What brands are available?' }
        ]
      },
      'cart': {
        badge: 'Cart AI',
        title: 'Skibidi GoFood AI',
        subtitle: 'I can explain your subtotal, vouchers, membership deals, and next checkout steps.',
        note: 'Tip: ask “summarise my cart”, “how does voucher remove work”, or “what deal am I getting?”.',
        chips: [
          { label: 'Cart summary', prompt: 'Summarise my cart' },
          { label: 'Voucher help', prompt: 'How does voucher remove work?' },
          { label: 'Wallet and points', prompt: 'Show my wallet and points' },
          { label: 'Checkout help', prompt: 'What do I need before checkout?' }
        ]
      },
      'menu#orders-panel': {
        badge: 'Orders AI',
        title: 'Skibidi GoFood AI',
        subtitle: 'I can explain your latest order, ETA, refund logic, and support handoff.',
        note: 'Tip: ask “where is my order” or “what happens if my order is cancelled?”.',
        chips: [
          { label: 'Track order', prompt: 'Where is my order?' },
          { label: 'Delivery ETA', prompt: 'How long does delivery take?' },
          { label: 'Refund rule', prompt: 'What happens if my order is cancelled?' },
          { label: 'Support help', prompt: 'I need support' }
        ]
      },
      'rewards': {
        badge: 'Rewards AI',
        title: 'Skibidi GoFood AI',
        subtitle: 'I can explain points, voucher rules, birthday rewards, and plan benefits.',
        note: 'Tip: ask “what can I redeem now”, “birthday reward”, or “what does Student Saver include?”.',
        chips: [
          { label: 'Redeem now', prompt: 'What rewards can I redeem now?' },
          { label: 'Birthday reward', prompt: 'Tell me about the birthday reward' },
          { label: 'Student Saver', prompt: 'What does Student Saver include?' },
          { label: 'Voucher help', prompt: 'How do vouchers work?' }
        ]
      },
      'profile': {
        badge: 'Profile AI',
        title: 'Skibidi GoFood AI',
        subtitle: 'I can summarise your wallet, points, membership, and profile setup needs.',
        note: 'Tip: ask “show my account summary” or “how do I unlock the birthday reward?”.',
        chips: [
          { label: 'Account summary', prompt: 'Show my account summary' },
          { label: 'Wallet and points', prompt: 'Show my wallet and points' },
          { label: 'Birthday reward', prompt: 'How do I unlock the birthday reward?' },
          { label: 'Support priority', prompt: 'What is my support priority?' }
        ]
      },
      'contact': {
        badge: 'Support AI',
        title: 'Skibidi GoFood AI',
        subtitle: 'I can route you to the right support step and explain what details to include.',
        note: 'Tip: ask “how do I report a delivery problem?” or “what details should I send support?”.',
        chips: [
          { label: 'Contact support', prompt: 'Where can I get support?' },
          { label: 'Report issue', prompt: 'How do I report a delivery problem?' },
          { label: 'Refund help', prompt: 'What happens if my order is cancelled?' },
          { label: 'Track order', prompt: 'Where is my order?' }
        ],
        suggestedPrompt: 'How do I report a delivery problem?'
      },
      'how-it-works': {
        badge: 'About AI',
        title: 'Skibidi GoFood AI',
        subtitle: 'I can explain the campus-friendly concept, delivery scope, and project purpose.',
        note: 'Tip: ask “what is Skibidi GoFood for?” or “which area does it focus on?”.',
        chips: [
          { label: 'What is it?', prompt: 'What is Skibidi GoFood for?' },
          { label: 'Campus area', prompt: 'Which area does this app focus on?' },
          { label: 'Menu help', prompt: 'Show popular meals' },
          { label: 'Support page', prompt: 'Where can I get support?' }
        ],
        suggestedPrompt: 'What is Skibidi GoFood for?'
      },
      'checkout': {
        badge: 'Checkout AI',
        title: 'Skibidi GoFood AI',
        subtitle: 'I can review your cart, discounts, wallet payment, and checkout readiness.',
        note: 'Tip: ask “summarise my cart” or “what do I need before checkout?”.',
        chips: [
          { label: 'Cart summary', prompt: 'Summarise my cart' },
          { label: 'Checkout help', prompt: 'What do I need before checkout?' },
          { label: 'Wallet and points', prompt: 'Show my wallet and points' },
          { label: 'Voucher help', prompt: 'How does voucher remove work?' }
        ],
        suggestedPrompt: 'What do I need before checkout?'
      }
    };
    return map[page] || map['home'];
  }

  function brandFromText(text) {
    var lower = normalize(text);
    return getBrands().find(function (brand) {
      return lower.indexOf(normalize(brand.name)) !== -1 || lower.indexOf(normalize(brand.id)) !== -1;
    }) || null;
  }

  function categoryFromText(text) {
    var lower = normalize(text);
    var categories = [
      { id: 'fast food', label: 'fast food' },
      { id: 'pizza', label: 'pizza' },
      { id: 'drinks', label: 'drinks' },
      { id: 'dessert', label: 'dessert' },
      { id: 'burger', label: 'fast food' },
      { id: 'burgers', label: 'fast food' },
      { id: 'drink', label: 'drinks' },
      { id: 'desserts', label: 'dessert' }
    ];
    var match = categories.find(function (entry) { return lower.indexOf(entry.id) !== -1; });
    return match ? match.label : null;
  }

  function filterFoods(options) {
    options = options || {};
    var foods = getFoods().filter(function (food) {
      return food && food.isActive !== false;
    });

    if (options.brandId) {
      foods = foods.filter(function (food) { return String(food.brand) === String(options.brandId); });
    }
    if (options.category) {
      foods = foods.filter(function (food) { return normalize(food.cat) === normalize(options.category); });
    }
    if (Number(options.maxBudget) > 0) {
      foods = foods.filter(function (food) { return Number(food.price) <= Number(options.maxBudget); });
    }
    if (options.query) {
      var tokens = tokenise(options.query);
      if (tokens.length) {
        foods = foods.filter(function (food) {
          var hay = normalize([food.name, food.bName, food.brand, food.cat, food.badge].join(' '));
          return tokens.every(function (token) { return hay.indexOf(token) !== -1; });
        });
      }
    }
    return foods;
  }

  function sortByPriceAsc(items) {
    return items.slice().sort(function (a, b) { return (Number(a.price) || 0) - (Number(b.price) || 0); });
  }

  function sortByPopularity(items) {
    return items.slice().sort(function (a, b) {
      return (Number(b.popularity) || 0) - (Number(a.popularity) || 0);
    });
  }

  function renderFoodList(items, label) {
    if (!items.length) return '<p>I could not find matching menu items from the live catalog.</p>';
    return '<p><strong>' + escapeHtml(label || 'Matching menu items') + ':</strong></p><div class="student-ai-food-list">' + items.map(function (food) {
      var rating = Number(food.rating) ? '<span>' + escapeHtml(String(Number(food.rating).toFixed(1))) + '★</span>' : '';
      return '<div class="student-ai-food-item">'
        + '<strong>' + escapeHtml(food.name) + '</strong>'
        + '<div class="student-ai-food-meta">'
        + '<span>' + formatMoney(food.price) + '</span>'
        + '<span>' + escapeHtml(food.bName || food.brand || 'Partner brand') + '</span>'
        + rating
        + '</div>'
        + '</div>';
    }).join('') + '</div>';
  }

  function buildCatalogReply(text) {
    var brand = brandFromText(text);
    var category = categoryFromText(text);
    var budget = parseBudget(text);
    var count = parseCount(text, 4, 6);
    var lower = normalize(text);
    var labelParts = [];
    if (brand) labelParts.push(brand.name);
    if (category) labelParts.push(category);
    if (budget) labelParts.push('under ' + formatMoney(budget));

    if (/available brands|which brands|what brands|partner brands/.test(lower)) {
      var brands = getBrands();
      if (!brands.length) return '<p>Brand data is not available right now.</p>';
      return '<p><strong>Available partner brands:</strong></p><ul>' + brands.map(function (item) {
        var special = item.special ? ' — ' + escapeHtml(item.special) : '';
        return '<li><strong>' + escapeHtml(item.name) + '</strong>' + special + '</li>';
      }).join('') + '</ul>';
    }

    if (/popular|top|best/.test(lower)) {
      var popular = sortByPopularity(filterFoods({ brandId: brand && brand.id, category: category })).slice(0, count);
      return renderFoodList(popular, 'Top menu picks' + (labelParts.length ? ' for ' + labelParts.join(' · ') : ''));
    }

    if (/cheapest|lowest|budget|under|below/.test(lower) || budget) {
      var cheapest = sortByPriceAsc(filterFoods({ brandId: brand && brand.id, category: category, maxBudget: budget })).slice(0, count);
      return renderFoodList(cheapest, 'Budget-friendly items' + (labelParts.length ? ' for ' + labelParts.join(' · ') : ''));
    }

    if (brand || category) {
      var matches = sortByPopularity(filterFoods({ brandId: brand && brand.id, category: category })).slice(0, count);
      return renderFoodList(matches, 'Matching menu items' + (labelParts.length ? ' for ' + labelParts.join(' · ') : ''));
    }

    var genericMatches = sortByPopularity(filterFoods({ query: text })).slice(0, count);
    if (genericMatches.length) {
      return renderFoodList(genericMatches, 'Best matches from the live menu');
    }

    return '';
  }

  function findLatestOrder() {
    if (!(window.State && State.getOrders)) return null;
    var orders = State.getOrders() || [];
    if (!orders.length) return null;
    var active = orders.find(function (order) {
      var status = String((order || {}).status || '').toLowerCase();
      return status === 'pending' || status === 'preparing' || status === 'on the way';
    });
    return active || orders[0] || null;
  }

  function formatStatus(status) {
    var map = {
      pending: 'Pending',
      preparing: 'Preparing',
      'on the way': 'On the way',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    };
    var key = String(status || 'pending').toLowerCase();
    return map[key] || key.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function supportLinkText() {
    return '<a href="contact#report-panel">open the support page</a>';
  }

  function ordersLinkText() {
    return '<a href="menu#orders-panel">open My Orders</a>';
  }

  function profileLinkText() {
    return '<a href="profile">open My Profile</a>';
  }

  function menuLinkText() {
    return '<a href="menu">open the menu</a>';
  }

  function faqMatch(text) {
    var lower = String(text || '').toLowerCase();
    var faqs = getFaqs();
    var best = null;
    var bestScore = 0;

    faqs.forEach(function (faq) {
      var hay = (String(faq.q || '') + ' ' + String(faq.a || '')).toLowerCase();
      var score = 0;
      lower.split(/[^a-z0-9]+/).filter(Boolean).forEach(function (token) {
        if (token.length >= 3 && hay.indexOf(token) !== -1) score += 1;
      });
      if (score > bestScore) {
        bestScore = score;
        best = faq;
      }
    });

    return bestScore >= 2 ? best : null;
  }

  function voucherLabel(voucher) {
    if (!voucher) return '';
    if (voucher.label) return String(voucher.label);
    if (window.VOUCHER_RULES && VOUCHER_RULES[voucher.id]) return String(VOUCHER_RULES[voucher.id].label || voucher.id);
    return String(voucher.id || '');
  }

  function voucherRuleSummary(voucherId) {
    if (!(window.VOUCHER_RULES && VOUCHER_RULES[voucherId])) return '';
    var rule = VOUCHER_RULES[voucherId];
    var rules = Array.isArray(rule.rules) ? rule.rules.slice(0, 4) : [];
    return '<p><strong>' + escapeHtml(rule.label || voucherId) + '</strong>: ' + escapeHtml(rule.desc || '') + '</p>'
      + (rules.length ? '<ul>' + rules.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>' : '');
  }

  function rewardsSummary() {
    var user = getUser();
    if (!user) return '<p>Please log in first so I can read your points and rewards accurately.</p>';
    var points = Number(user.points || 0);
    var rewards = getRewardsData();
    if (!rewards.length) return '<p>Rewards data is not available right now.</p>';

    var redeemable = rewards.filter(function (reward) { return points >= Number(reward.pts || 0); });
    var nextReward = rewards.slice().sort(function (a, b) { return Number(a.pts || 0) - Number(b.pts || 0); }).find(function (reward) {
      return Number(reward.pts || 0) > points;
    });

    var html = '<p><strong>Your current points:</strong> ' + escapeHtml(String(points)) + '</p>';
    if (redeemable.length) {
      html += '<p><strong>You can redeem now:</strong></p><ul>' + redeemable.slice(0, 4).map(function (reward) {
        return '<li><strong>' + escapeHtml(reward.title) + '</strong> — ' + escapeHtml(String(reward.pts)) + ' pts</li>';
      }).join('') + '</ul>';
    } else {
      html += '<p>You do not have enough points to redeem a reward yet.</p>';
    }

    if (nextReward) {
      var need = Math.max(0, Number(nextReward.pts || 0) - points);
      html += '<p><strong>Next reachable reward:</strong> ' + escapeHtml(nextReward.title) + ' — need ' + escapeHtml(String(need)) + ' more point' + (need === 1 ? '' : 's') + '.</p>';
    }
    return html;
  }

  function accountSummary() {
    var user = getUser();
    if (!user) return '<p>Please log in first so I can read your account accurately.</p>';
    var plan = window.State && State.getActiveMembershipPlan ? State.getActiveMembershipPlan(user) : null;
    var membershipCountdown = window.State && State.getMembershipCountdown ? State.getMembershipCountdown(user) : { active: false };
    var supportPriority = window.State && State.getSupportPriority ? State.getSupportPriority(user) : 'standard';
    var defaultAddress = window.State && State.getDefaultAddress ? State.getDefaultAddress() : '';

    return ''
      + '<p><strong>Account:</strong> ' + escapeHtml(user.firstName || user.name || user.username || 'Student') + '</p>'
      + '<p><strong>Wallet balance:</strong> ' + formatMoney(user.wallet || 0) + '</p>'
      + '<p><strong>Loyalty points:</strong> ' + escapeHtml(String(user.points || 0)) + '</p>'
      + '<p><strong>Membership:</strong> ' + escapeHtml(plan ? plan.name : 'Free') + (membershipCountdown && membershipCountdown.active ? ' · ' + escapeHtml(membershipCountdown.label) : '') + '</p>'
      + '<p><strong>Support priority:</strong> ' + escapeHtml(String(supportPriority)) + '</p>'
      + '<p><strong>Default address:</strong> ' + escapeHtml(defaultAddress || 'Not set yet') + '</p>';
  }

  function cartSummary() {
    var items = getCartItems();
    if (!items.length) {
      return '<p>Your tray is empty right now.</p><p>To start building an order, ' + menuLinkText() + '.</p>';
    }

    var subtotal = getCartSubtotal();
    var vouchers = window.State && State.getVouchers ? State.getVouchers() : [];
    var voucherBreakdown = window.State && State.getDiscountBreakdown ? State.getDiscountBreakdown(subtotal, items, vouchers) : { total: 0, details: [] };
    var membershipDeal = window.State && State.getMembershipDeal ? State.getMembershipDeal(subtotal, items, getUser()) : { amount: 0, eligible: false, requirement: '' };
    var payable = Math.max(0, subtotal - Number(voucherBreakdown.total || 0) - Number(membershipDeal.amount || 0));
    var qty = items.reduce(function (sum, item) { return sum + (Number(item.qty) || 0); }, 0);

    var html = ''
      + '<p><strong>Cart items:</strong> ' + qty + '</p>'
      + '<p><strong>Subtotal:</strong> ' + formatMoney(subtotal) + '</p>'
      + '<p><strong>Voucher savings:</strong> ' + formatMoney(voucherBreakdown.total || 0) + '</p>'
      + '<p><strong>Membership deal:</strong> ' + formatMoney(membershipDeal.amount || 0) + '</p>'
      + '<p><strong>Estimated payable:</strong> ' + formatMoney(payable) + '</p>';

    if (vouchers.length) {
      html += '<p><strong>Applied voucher' + (vouchers.length === 1 ? '' : 's') + ':</strong> ' + escapeHtml(vouchers.map(voucherLabel).join(', ')) + '</p>';
    }

    if (membershipDeal && membershipDeal.requirement) {
      html += '<p>' + escapeHtml(membershipDeal.requirement) + '</p>';
    }

    html += '<ul>' + items.slice(0, 4).map(function (item) {
      return '<li><strong>' + escapeHtml(item.name) + '</strong> × ' + escapeHtml(String(item.qty || 1)) + ' — ' + formatMoney((Number(item.price) || 0) * (Number(item.qty) || 0)) + '</li>';
    }).join('') + '</ul>';

    return html;
  }

  function latestOrderSummary() {
    var order = findLatestOrder();
    if (!order) {
      return '<p>You do not have any order history yet.</p><p>Once you place an order, I can explain its status, ETA, and delivery notes here.</p>';
    }
    var countdown = window.State && State.getOrderCountdown ? State.getOrderCountdown(order) : { active: false };
    var itemCount = Array.isArray(order.items) ? order.items.reduce(function (sum, item) { return sum + (Number(item.qty) || 0); }, 0) : 0;
    var total = Number(order.total || order.grandTotal || order.finalTotal || order.payable || 0);
    var driverBlock = order.driver && order.driver.name
      ? '<p><strong>Driver:</strong> ' + escapeHtml(order.driver.name) + (order.driver.phone ? ' · ' + escapeHtml(order.driver.phone) : '') + '</p>'
      : '';

    return ''
      + '<p><strong>Latest order:</strong> ' + escapeHtml(order.id || 'Order placed') + '</p>'
      + '<p><strong>Status:</strong> ' + escapeHtml(formatStatus(order.status)) + '</p>'
      + '<p><strong>ETA:</strong> ' + (countdown && countdown.active ? escapeHtml(countdown.label) : escapeHtml(String(order.etaMin || 'unavailable') + ' min')) + '</p>'
      + '<p><strong>Items:</strong> ' + itemCount + ' · <strong>Total:</strong> ' + formatMoney(total) + '</p>'
      + (order.deliveryNote ? '<p><strong>Delivery note:</strong> ' + escapeHtml(order.deliveryNote) + '</p>' : '')
      + driverBlock
      + '<p>For the live timeline, ' + ordersLinkText() + '.</p>';
  }

  function getPlanSummary(plan) {
    if (!plan) return '';
    var perks = Array.isArray(plan.perks) ? plan.perks.slice(0, 4) : [];
    return '<p><strong>' + escapeHtml(plan.name) + '</strong> costs ' + formatMoney(plan.price) + ' for ' + escapeHtml(plan.billing || '30 days') + '.</p>'
      + (plan.description ? '<p>' + escapeHtml(plan.description) + '</p>' : '')
      + (perks.length ? '<ul>' + perks.map(function (perk) { return '<li>' + escapeHtml(perk) + '</li>'; }).join('') + '</ul>' : '');
  }

  function buildWelcome() {
    var user = getUser();
    var name = user ? (user.firstName || user.name || user.username || 'student') : 'student';
    var meta = pageMeta();
    return ''
      + '<p><strong>Hi ' + escapeHtml(name) + '.</strong> ' + escapeHtml(meta.subtitle) + '</p>'
      + '<p>I answer from live website data only on the <strong>' + escapeHtml(currentPageName()) + '</strong> page.</p>'
      + '<p>' + escapeHtml(meta.note) + '</p>';
  }

  function routeHelp(text) {
    var lower = normalize(text);
    if (/go to menu|open menu|menu page/.test(lower)) {
      return '<p>For browsing and adding meals, ' + menuLinkText() + '.</p>';
    }
    if (/go to cart|open cart/.test(lower)) {
      return '<p>To review items and vouchers, <a href="cart">open the cart</a>.</p>';
    }
    if (/go to rewards|open rewards/.test(lower)) {
      return '<p>To redeem points and vouchers, <a href="rewards">open rewards</a>.</p>';
    }
    if (/go to profile|open profile/.test(lower)) {
      return '<p>To edit your account, birthday, or address, ' + profileLinkText() + '.</p>';
    }
    if (/go to support|contact support|open support/.test(lower)) {
      return '<p>For support requests, ' + supportLinkText() + '.</p>';
    }
    return '';
  }


  function plainTextToSafeHtml(value) {
    var clean = String(value == null ? '' : value).trim();
    if (!clean) return '';
    var blocks = clean.split(/\n{2,}/).map(function (part) { return part.trim(); }).filter(Boolean);
    if (!blocks.length) blocks = [clean];
    return blocks.map(function (part) {
      var lines = part.split(/\n/).map(function (line) { return escapeHtml(line); }).join('<br>');
      return '<p>' + lines + '</p>';
    }).join('');
  }

  function compactFoodForAi(food) {
    return {
      name: String(food && food.name || '').slice(0, 80),
      brand: String(food && (food.bName || food.brand) || '').slice(0, 60),
      category: String(food && food.cat || '').slice(0, 40),
      price: Number(food && food.price || 0),
      rating: Number(food && food.rating || 0)
    };
  }

  function buildGroqWebsiteContext(question) {
    var user = getUser();
    var plan = user && window.State && State.getActiveMembershipPlan ? State.getActiveMembershipPlan(user) : null;
    var supportPriority = user && window.State && State.getSupportPriority ? State.getSupportPriority(user) : 'standard';
    var latest = findLatestOrder();
    var cartItems = getCartItems();
    var rewards = getRewardsData().slice(0, 12).map(function (reward) {
      return {
        title: String(reward.title || '').slice(0, 80),
        points: Number(reward.pts || 0),
        description: String(reward.desc || reward.description || '').slice(0, 140)
      };
    });

    return {
      app: 'Skibidi GoFood',
      scope: 'MMU Melaka campus food-ordering website',
      currentPage: currentPageName(),
      route: currentPage(),
      question: String(question || '').slice(0, 700),
      publicFeatures: [
        'Browse Menu by brand, category, budget, and popularity',
        'Cart supports vouchers and membership savings',
        'Rewards page redeems loyalty points and explains birthday rewards',
        'Orders page shows status, ETA, delivery notes, and refund logic',
        'Profile page stores wallet, points, birthday, address, and membership view',
        'Contact page routes delivery, refund, payment, and account support issues'
      ],
      accountContext: user ? {
        loggedIn: true,
        walletBalance: Number(user.wallet || 0),
        points: Number(user.points || 0),
        membership: plan ? String(plan.name || 'Paid plan') : 'Free',
        supportPriority: supportPriority
      } : { loggedIn: false },
      cartContext: {
        itemCount: cartItems.reduce(function (sum, item) { return sum + (Number(item.qty) || 0); }, 0),
        subtotal: getCartSubtotal(),
        sampleItems: cartItems.slice(0, 6).map(function (item) { return { name: item.name, qty: item.qty, price: item.price }; })
      },
      latestOrderContext: latest ? {
        id: String(latest.id || '').slice(0, 40),
        status: formatStatus(latest.status),
        etaMin: latest.etaMin || null,
        hasDeliveryNote: !!latest.deliveryNote,
        total: Number(latest.total || latest.grandTotal || latest.finalTotal || latest.payable || 0)
      } : null,
      brands: getBrands().slice(0, 12).map(function (brand) { return { name: brand.name, special: brand.special || '' }; }),
      menuSamples: sortByPopularity(filterFoods({})).slice(0, 18).map(compactFoodForAi),
      rewards: rewards,
      importantRules: [
        'Never ask for passwords, OTPs, or payment card details.',
        'Vouchers are removed from cart without being deleted from the account; they are consumed only after successful checkout.',
        'If a prepaid order is cancelled by admin, refund goes back to in-app wallet.',
        'Cash-on-delivery cancelled orders do not need prepaid refund.',
        'Points can be opened by clicking the dark points pill in the top navigation; it goes to Rewards.'
      ]
    };
  }

  function requestGroqWebsiteAnswer(question) {
    if (!window.fetch) return Promise.resolve('');
    if (window.location && window.location.protocol === 'file:') return Promise.resolve('');
    var payload = {
      question: String(question || '').slice(0, 700),
      context: buildGroqWebsiteContext(question),
      localFallback: buildReply(question).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 900)
    };
    return fetch('/api/sgf-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) return '';
      return response.json();
    }).then(function (data) {
      var reply = data && typeof data.reply === 'string' ? data.reply.trim() : '';
      if (!reply || reply.length < 2) return '';
      return reply.slice(0, 2200);
    }).catch(function () { return ''; });
  }

  function buildReply(rawInput) {
    var text = String(rawInput || '').trim();
    var lower = text.toLowerCase();
    var user = getUser();

    if (!text) return '<p>Please type a question so I can help.</p>';

    if (/\b(hi|hello|hey|help|what can you do)\b/.test(lower)) {
      return buildWelcome();
    }

    var route = routeHelp(text);
    if (route) return route;

    if (/(what is skibidi gofood|what is this app|what is it for|project purpose|who is this app for|about this app|campus friendly concept)/.test(lower)) {
      return ''
        + '<p><strong>Skibidi GoFood</strong> is a campus-focused food ordering concept built for <strong>MMU Melaka</strong> students.</p>'
        + '<p>It focuses on student-friendly ordering with wallet support, rewards, menu discovery, and a UI that feels simple for campus life.</p>'
        + '<p>Use the menu, cart, rewards, orders, and support pages together for the full experience.</p>';
    }

    if (/(menu|brand|brands|meal|meals|food|foods|item|items|burger|burgers|pizza|drink|drinks|dessert|cheapest|popular|under rm|below rm|budget)/.test(lower)) {
      var catalogReply = buildCatalogReply(text);
      if (catalogReply) return catalogReply;
    }

    if (/(summarise my cart|summarize my cart|cart summary|what is in my cart|cart total|checkout help|before checkout)/.test(lower)) {
      var summary = cartSummary();
      if (/(checkout help|before checkout)/.test(lower)) {
        return summary + '<p>Before checkout, confirm your delivery address, payment method, and any delivery note.</p>';
      }
      return summary;
    }

    if (/(voucher|reward|redeem|remove|delete voucher|unapply|apply voucher|coupon)/.test(lower)) {
      var inventory = window.State && State.getVoucherInventory ? State.getVoucherInventory() : [];
      var applied = window.State && State.getVouchers ? State.getVouchers() : [];
      var appliedText = applied.length
        ? '<p>Currently applied in this cart: <strong>' + escapeHtml(applied.map(voucherLabel).join(', ')) + '</strong>.</p>'
        : '<p>You do not have any voucher applied to the cart right now.</p>';
      var savedCount = inventory.length;
      var specificVoucherId = null;
      if (window.VOUCHER_RULES) {
        Object.keys(VOUCHER_RULES).some(function (id) {
          var def = VOUCHER_RULES[id];
          if (normalize(text).indexOf(normalize(id)) !== -1 || normalize(text).indexOf(normalize(def.label || id)) !== -1) {
            specificVoucherId = id;
            return true;
          }
          return false;
        });
      }
      return ''
        + '<p><strong>Voucher mechanism:</strong> using <strong>Remove</strong> only takes the voucher out of the current cart.</p>'
        + '<ul>'
        + '<li>the voucher stays saved inside your account for future use</li>'
        + '<li>it is <strong>not deleted</strong> when you remove it from the cart</li>'
        + '<li>the voucher is only consumed after a successful checkout</li>'
        + '</ul>'
        + appliedText
        + '<p>You currently have <strong>' + savedCount + '</strong> saved voucher' + (savedCount === 1 ? '' : 's') + ' in your account.</p>'
        + (specificVoucherId ? voucherRuleSummary(specificVoucherId) : (applied.length ? voucherRuleSummary(applied[0].id) : ''));
    }

    if (/(order|track|tracking|status|eta|delivery note|where is my order)/.test(lower)) {
      return latestOrderSummary();
    }

    if (/(wallet|balance|points|credit|top up|top-up)/.test(lower)) {
      if (!user) return '<p>Please log in first so I can read your wallet and points accurately.</p>';
      return accountSummary();
    }

    if (/(account summary|profile summary|my account)/.test(lower)) {
      return accountSummary();
    }

    if (/(membership|student saver|study group|plan|subscription)/.test(lower)) {
      if (!(window.State && State.getMembershipPlans)) return '<p>Membership information is not available right now.</p>';
      var plans = State.getMembershipPlans();
      var activePlan = State.getActiveMembershipPlan ? State.getActiveMembershipPlan(user) : null;
      var parts = ['<p><strong>Your current plan:</strong> ' + escapeHtml(activePlan ? activePlan.name : 'Free') + '</p>'];
      var specific = null;

      if (lower.indexOf('student saver') !== -1) {
        specific = plans.find(function (plan) { return String(plan.name).toLowerCase() === 'student saver'; });
      } else if (lower.indexOf('study group') !== -1) {
        specific = plans.find(function (plan) { return String(plan.name).toLowerCase() === 'study group'; });
      }

      if (specific) {
        return parts.join('') + getPlanSummary(specific);
      }

      return parts.join('') + plans.map(getPlanSummary).join('');
    }

    if (/(redeem now|what rewards can i redeem now|how many points|reward points|birthday reward|birthday)/.test(lower)) {
      if (/(birthday)/.test(lower)) {
        return ''
          + '<p><strong>Birthday reward:</strong> Birthday Free Burger.</p>'
          + '<ul>'
          + '<li>granted once per year on your registered birthday</li>'
          + '<li>covers one fast-food item up to RM 13.90</li>'
          + '<li>expires 7 days after your birthday if unused</li>'
          + '<li>cannot be combined with a regular Free Burger voucher</li>'
          + '</ul>'
          + '<p>Add your birthday in ' + profileLinkText() + ' to unlock it correctly.</p>';
      }
      return rewardsSummary();
    }

    if (/(cancelled|canceled|refund|refunded)/.test(lower)) {
      return ''
        + '<p>If a prepaid order is cancelled by admin, the amount is automatically refunded to your in-app wallet.</p>'
        + '<p>Cash-on-delivery orders do not need a refund because no prepaid charge was taken.</p>'
        + '<p>For a timeline view, ' + ordersLinkText() + '.</p>';
    }

    if (/(how long does delivery take|delivery time|eta|late order|delivery takes)/.test(lower)) {
      var planEta = window.State && State.getMembershipEtaReduction ? Number(State.getMembershipEtaReduction(user)) || 0 : 0;
      var faq = faqMatch('delivery time');
      return ''
        + '<p>' + escapeHtml(faq ? faq.a : 'Delivery timing depends on distance, weather, traffic, and kitchen load.') + '</p>'
        + '<p>Please check the live order status for the clearest estimate shown for your current order.</p>'
        + (planEta > 0 ? '<p>Your active plan can reduce ETA by about <strong>' + escapeHtml(String(planEta)) + ' minute' + (planEta === 1 ? '' : 's') + '</strong> when the order is eligible.</p>' : '');
    }

    if (/(support|report|problem|issue|human|agent|complaint|contact)/.test(lower)) {
      var priority = window.State && State.getSupportPriority ? State.getSupportPriority(user) : 'standard';
      return ''
        + '<p>I can answer common website questions here, but account or delivery issues should be sent to support.</p>'
        + '<p><strong>Your support priority:</strong> ' + escapeHtml(String(priority)) + '</p>'
        + '<p>Use ' + supportLinkText() + ' to report delivery delays, payment issues, refund questions, or account problems.</p>'
        + '<p>Include your order ID, the issue, and what result you need.</p>';
    }

    if (/(melaka|mmu|campus|hostel|location|area)/.test(lower)) {
      return ''
        + '<p>Skibidi GoFood is positioned for <strong>MMU Melaka</strong> students and nearby Melaka housing areas.</p>'
        + '<p>That is why the menu, reward wording, and delivery language are focused on campus convenience and student affordability.</p>';
    }

    var faqHit = faqMatch(lower);
    if (faqHit) {
      return '<p><strong>' + escapeHtml(faqHit.q) + '</strong></p><p>' + escapeHtml(faqHit.a) + '</p>';
    }

    return ''
      + '<p>I can help with menu search, cart summaries, order tracking, vouchers, rewards, wallet balance, membership plans, and support routing.</p>'
      + '<p>Try: <strong>Show budget meals under RM 10</strong>, <strong>Summarise my cart</strong>, or <strong>Where is my order?</strong></p>';
  }


  function createShell() {
    if (document.getElementById('student-ai-shell')) return null;

    var meta = pageMeta();
    var chips = Array.isArray(meta.chips) ? meta.chips : [];
    var suggestedPrompt = meta.suggestedPrompt || ((chips[0] && chips[0].prompt) || 'Show popular meals');
    var chipsHtml = chips.map(function (chip) {
      return '<button class="student-ai-chip" type="button" data-ai-prompt="' + escapeHtml(chip.prompt) + '">' + escapeHtml(chip.label) + '</button>';
    }).join('');
    var emojiHtml = ['🍔', '🍕', '☕', '🎁', '🚚'].map(function (emoji) {
      return '<button class="student-ai-emoji-btn" type="button" data-ai-emoji="' + escapeHtml(emoji) + '" aria-label="Insert ' + escapeHtml(emoji) + '">' + escapeHtml(emoji) + '</button>';
    }).join('');
    var attachActions = (Array.isArray(meta.attachActions) && meta.attachActions.length ? meta.attachActions : chips.slice(0, 3)).map(function (chip) {
      return '<button class="student-ai-attach-item" type="button" data-ai-prompt="' + escapeHtml(chip.prompt) + '"><span>' + escapeHtml(chip.label) + '</span><small>' + escapeHtml(chip.prompt) + '</small></button>';
    }).join('');

    var shell = document.createElement('div');
    shell.className = 'student-ai-shell';
    shell.id = 'student-ai-shell';
    shell.innerHTML = ''
      + '<div class="student-ai-backdrop" id="student-ai-backdrop" hidden></div>'
      + '<button class="student-ai-toggle" id="student-ai-toggle" type="button" aria-expanded="false" aria-controls="student-ai-panel">'
      +   '<span class="student-ai-toggle-icon"><i class="fas fa-robot"></i></span>'
      +   '<span class="student-ai-toggle-copy">'
      +     '<strong>GoFood AI</strong>'
      +     '<small>Secure proxy</small>'
      +   '</span>'
      + '</button>'
      + '<section class="student-ai-panel" id="student-ai-panel" role="dialog" aria-modal="false" aria-labelledby="student-ai-title" hidden>'
      +   '<div class="student-ai-head">'
      +     '<div class="student-ai-brand">'
      +       '<span class="student-ai-avatar"><i class="fas fa-robot"></i></span>'
      +       '<div class="student-ai-brand-copy">'
      +         '<strong id="student-ai-title">' + escapeHtml(meta.title) + '</strong>'
      +         '<span class="student-ai-online"><i class="fas fa-circle"></i> Online now</span>'
      +       '</div>'
      +     '</div>'
      +     '<div class="student-ai-actions">'
      +       '<button class="student-ai-icon-btn" id="student-ai-refresh" type="button" aria-label="Chat refresh button"><i class="fas fa-rotate-right"></i></button>'
      +       '<button class="student-ai-icon-btn" id="student-ai-close" type="button" aria-label="Button for minimizing the widget"><i class="fas fa-minus"></i></button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="student-ai-body">'
      +     '<div class="student-ai-messages" id="student-ai-messages" aria-live="polite"></div>'
      +     '<div class="student-ai-quick-wrap">'
      +       '<div class="student-ai-quick-head">'
      +         '<div class="student-ai-quick-title">Quick replies</div>'
      +         '<button class="student-ai-quick-toggle" id="student-ai-quick-toggle" type="button" aria-expanded="false" aria-controls="student-ai-quick-content" aria-label="Show quick replies" title="Show quick replies"><span class="student-ai-quick-caret" aria-hidden="true">^</span></button>'
      +       '</div>'
      +       '<div class="student-ai-quick-content" id="student-ai-quick-content" hidden>'
      +         '<div class="student-ai-quick">' + chipsHtml + '</div>'
      +         '<button class="student-ai-suggest" id="student-ai-suggest" type="button" data-ai-prompt="' + escapeHtml(suggestedPrompt) + '">'
      +           '<span>Suggested reply</span>'
      +           '<strong>' + escapeHtml(suggestedPrompt) + '</strong>'
      +         '</button>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="student-ai-foot">'
      +     '<div class="student-ai-pop student-ai-pop-emoji" id="student-ai-emoji-pop" hidden>'
      +       '<div class="student-ai-pop-title">Emoji</div>'
      +       '<div class="student-ai-emoji-grid">' + emojiHtml + '</div>'
      +     '</div>'
      +     '<div class="student-ai-pop student-ai-pop-attach" id="student-ai-attach-pop" hidden>'
      +       '<div class="student-ai-pop-title">Use live page data</div>'
      +       '<div class="student-ai-attach-list">' + attachActions + '</div>'
      +     '</div>'
      +     '<form class="student-ai-form" id="student-ai-form">'
      +       '<div class="student-ai-composer">'
      +         '<textarea class="student-ai-input" id="student-ai-input" rows="1" placeholder="Enter message" aria-label="Message input text field" spellcheck="true"></textarea>'
      +         '<button class="student-ai-submit" type="submit" aria-label="Send button"><i class="fas fa-paper-plane"></i></button>'
      +       '</div>'
      +       '<div class="student-ai-tool-row">'
      +         '<div class="student-ai-note">' + escapeHtml(meta.note) + '</div>'
      +       '</div>'
      +     '</form>'
      +   '</div>'
      + '</section>';
    document.body.appendChild(shell);
    return shell;
  }


  function bindOpenLinks(openPanel) {
    document.querySelectorAll('.js-open-ai-help').forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        openPanel();
      });
    });
  }

  function initShell() {
    injectStyles();
    createShell();
    var shell = document.getElementById('student-ai-shell');
    var toggle = document.getElementById('student-ai-toggle');
    var panel = document.getElementById('student-ai-panel');
    var closeBtn = document.getElementById('student-ai-close');
    var refreshBtn = document.getElementById('student-ai-refresh');
    var suggestBtn = document.getElementById('student-ai-suggest');
    var quickToggleBtn = document.getElementById('student-ai-quick-toggle');
    var quickContent = document.getElementById('student-ai-quick-content');
    var emojiBtn = document.getElementById('student-ai-emoji');
    var attachBtn = document.getElementById('student-ai-attach');
    var emojiPop = document.getElementById('student-ai-emoji-pop');
    var attachPop = document.getElementById('student-ai-attach-pop');
    var backdrop = document.getElementById('student-ai-backdrop');
    var messages = document.getElementById('student-ai-messages');
    var online = document.querySelector('#student-ai-shell .student-ai-online');
    if (online) online.setAttribute('data-ai-mode', 'groq');
    var form = document.getElementById('student-ai-form');
    var input = document.getElementById('student-ai-input');
    if (!shell || !toggle || !panel || !messages || !form || !input) return;

    var history = getHistoryValue();
    var isComposing = false;
    var keepComposerFocus = false;
    var quickRepliesCollapsed = true;

    function dateStampText() {
      try {
        return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      } catch (err) {
        return '';
      }
    }

    function renderDayStamp() {
      if (messages.querySelector('.student-ai-day-stamp')) return;
      var stamp = document.createElement('div');
      stamp.className = 'student-ai-day-stamp';
      stamp.textContent = dateStampText();
      messages.appendChild(stamp);
    }

    function autoSizeInput() {
      input.style.height = 'auto';
      var nextHeight = Math.max(54, Math.min(input.scrollHeight || 54, 118));
      input.style.height = nextHeight + 'px';
    }

    function closeFloatingMenus() {
      if (emojiPop) emojiPop.hidden = true;
      if (attachPop) attachPop.hidden = true;
    }

    function setQuickRepliesVisibility(collapsed) {
      quickRepliesCollapsed = !!collapsed;
      if (quickContent) {
        quickContent.hidden = quickRepliesCollapsed;
        quickContent.style.display = quickRepliesCollapsed ? 'none' : 'grid';
      }
      if (quickToggleBtn) {
        quickToggleBtn.setAttribute('aria-expanded', quickRepliesCollapsed ? 'false' : 'true');
        quickToggleBtn.setAttribute('aria-label', quickRepliesCollapsed ? 'Show quick replies' : 'Hide quick replies');
        quickToggleBtn.setAttribute('title', quickRepliesCollapsed ? 'Show quick replies' : 'Hide quick replies');
      }
      setQuickRepliesCollapsed(quickRepliesCollapsed);
    }

    function pushHistory(role, html) {
      history.push({ role: role, html: html });
      if (history.length > 24) history = history.slice(history.length - 24);
      setHistoryValue(history);
    }

    function addMessage(role, html, options) {
      options = options || {};
      var node = document.createElement('div');
      node.className = 'student-ai-msg-row student-ai-msg-row-' + role;
      if (role === 'ai') {
        node.innerHTML = ''
          + '<div class="student-ai-msg-wrap">'
          + '  <span class="student-ai-msg-avatar"><i class="fas fa-robot"></i></span>'
          + '  <div class="student-ai-msg student-ai-msg-ai">' + html + '</div>'
          + '</div>';
      } else {
        node.innerHTML = ''
          + '<div class="student-ai-msg-wrap">'
          + '  <div class="student-ai-msg student-ai-msg-user">' + html + '</div>'
          + '</div>';
      }
      messages.appendChild(node);
      messages.scrollTop = messages.scrollHeight;
      if (!options.skipSave) pushHistory(role, html);
      return node;
    }


    function replaceAiMessage(row, html, shouldSave) {
      if (!row) return;
      var bubble = row.querySelector('.student-ai-msg-ai');
      if (bubble) bubble.innerHTML = html;
      messages.scrollTop = messages.scrollHeight;
      if (shouldSave !== false) pushHistory('ai', html);
    }

    function restoreHistory() {
      messages.innerHTML = '';
      renderDayStamp();
      history = getHistoryValue();
      history.forEach(function (entry) {
        if (!entry || !entry.role || !entry.html) return;
        addMessage(entry.role, entry.html, { skipSave: true });
      });
    }

    function ensureWelcome() {
      history = getHistoryValue();
      if (history.length) {
        restoreHistory();
        return;
      }
      messages.innerHTML = '';
      renderDayStamp();
      addMessage('ai', buildWelcome(), { skipSave: false });
    }

    function setComposerValue(value, options) {
      options = options || {};
      input.value = String(value || '');
      autoSizeInput();
      if (!options.skipDraft) setDraftValue(input.value || '');
    }

    function insertAtCursor(text) {
      var before = input.value.slice(0, Number(input.selectionStart || 0));
      var after = input.value.slice(Number(input.selectionEnd || 0));
      var next = before + text + after;
      var cursor = before.length + String(text || '').length;
      setComposerValue(next);
      markAiInteraction();
      try {
        input.focus({ preventScroll: true });
      } catch (err) {
        input.focus();
      }
      try {
        input.setSelectionRange(cursor, cursor);
      } catch (err) {}
    }

    function syncDraftState() {
      setDraftValue(input.value || '');
      autoSizeInput();
      markAiInteraction();
    }

    function hasActiveDraft() {
      return !!String(input.value || getDraftValue() || '').trim();
    }

    function restoreDraftIfNeeded() {
      var draft = getDraftValue();
      if (typeof draft === 'string' && input.value !== draft) {
        input.value = draft;
      }
      autoSizeInput();
    }

    function focusInputSoon(delay) {
      setTimeout(function () {
        if (panel.hidden) return;
        restoreDraftIfNeeded();
        try {
          input.focus({ preventScroll: true });
        } catch (err) {
          input.focus();
        }
        try {
          var end = String(input.value || '').length;
          input.setSelectionRange(end, end);
        } catch (err) {}
      }, Math.max(0, Number(delay) || 0));
    }

    function preserveTypingFocus() {
      if (panel.hidden) return;
      if (!keepComposerFocus) return;
      if (document.activeElement === input) return;
      if (document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement && !panel.contains(document.activeElement)) return;
      if (!hasRecentAiInteraction(2600) && !hasActiveDraft()) return;
      focusInputSoon(40);
    }

    function setOpenState(isOpen) {
      if (!isOpen) keepComposerFocus = false;
      panel.hidden = !isOpen;
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      panel.setAttribute('aria-modal', isOpen ? 'true' : 'false');
      if (backdrop) backdrop.hidden = !isOpen;
      document.body.classList.toggle('student-ai-open', !!isOpen);
      rememberOpenState(!!isOpen);
      if (!isOpen) closeFloatingMenus();
    }

    function openPanel() {
      var wasHidden = !!panel.hidden;
      keepComposerFocus = true;
      setOpenState(true);
      restoreHistory();
      ensureWelcome();
      restoreDraftIfNeeded();
      if (wasHidden) setQuickRepliesVisibility(true);
      markAiInteraction();
      focusInputSoon(30);
    }

    function closePanel() {
      syncDraftState();
      setOpenState(false);
    }

    function resetConversation() {
      history = [];
      setHistoryValue([]);
      messages.innerHTML = '';
      renderDayStamp();
      addMessage('ai', buildWelcome(), { skipSave: false });
      markAiInteraction();
      focusInputSoon(20);
    }

    function ask(prompt) {
      var clean = String(prompt || '').trim();
      if (!clean) return;
      addMessage('user', '<p>' + escapeHtml(clean) + '</p>');
      var pendingRow = addMessage('ai', '<p>Thinking with Skibidi GoFood AI...</p>', { skipSave: true });
      markAiInteraction();
      closeFloatingMenus();
      keepComposerFocus = true;
      focusInputSoon(20);

      requestGroqWebsiteAnswer(clean).then(function (remoteReply) {
        if (remoteReply) {
          replaceAiMessage(pendingRow, plainTextToSafeHtml(remoteReply) + '<span class="ai-source-note">Answered through the secure same-origin AI proxy.</span>', true);
          return;
        }
        replaceAiMessage(pendingRow, buildReply(clean) + '<span class="ai-source-note">Local website fallback used because the secure AI proxy is not configured or unavailable.</span>', true);
      }).catch(function () {
        replaceAiMessage(pendingRow, buildReply(clean) + '<span class="ai-source-note">Local website fallback used because the secure AI proxy is not available.</span>', true);
      });
    }

    function submitComposer() {
      var value = String(input.value || '').trim();
      if (!value) {
        focusInputSoon(0);
        return;
      }
      setComposerValue('', { skipDraft: true });
      setDraftValue('');
      openPanel();
      ask(value);
    }

    function toggleMenu(menu) {
      if (!menu) return;
      var isHidden = !!menu.hidden;
      closeFloatingMenus();
      menu.hidden = !isHidden;
      markAiInteraction();
      if (menu.hidden) focusInputSoon(0);
    }

    toggle.addEventListener('click', function () {
      if (panel.hidden) openPanel();
      else closePanel('toggle');
    });

    closeBtn.addEventListener('click', function () { closePanel('button'); });
    if (refreshBtn) refreshBtn.addEventListener('click', function () {
      setDraftValue(input.value || '');
      openPanel();
      resetConversation();
    });
    if (backdrop) backdrop.addEventListener('click', function () { closePanel('backdrop'); });
    if (suggestBtn) suggestBtn.addEventListener('click', function () {
      openPanel();
      ask(suggestBtn.getAttribute('data-ai-prompt') || '');
    });
    if (quickToggleBtn) quickToggleBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var nextCollapsed = !quickRepliesCollapsed;
      setQuickRepliesVisibility(nextCollapsed);
      markAiInteraction();
      if (nextCollapsed) focusInputSoon(0);
    });
    if (emojiBtn) emojiBtn.addEventListener('click', function (event) {
      event.preventDefault();
      openPanel();
      toggleMenu(emojiPop);
    });
    if (attachBtn) attachBtn.addEventListener('click', function (event) {
      event.preventDefault();
      openPanel();
      toggleMenu(attachPop);
    });

    input.addEventListener('focus', function () { keepComposerFocus = true; markAiInteraction(); });
    input.addEventListener('click', function () { keepComposerFocus = true; markAiInteraction(); });
    input.addEventListener('keydown', function () { keepComposerFocus = true; markAiInteraction(); });
    input.addEventListener('input', function () { keepComposerFocus = true; syncDraftState(); });
    input.addEventListener('blur', function () {
      setTimeout(function () {
        keepComposerFocus = document.activeElement === input;
      }, 0);
    });
    input.addEventListener('compositionstart', function () { keepComposerFocus = true; isComposing = true; });
    input.addEventListener('compositionend', function () { isComposing = false; keepComposerFocus = true; syncDraftState(); });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
        event.preventDefault();
        submitComposer();
      }
    });
    form.addEventListener('focusin', markAiInteraction);

    shell.querySelectorAll('.student-ai-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        openPanel();
        ask(chip.getAttribute('data-ai-prompt') || '');
      });
    });

    shell.querySelectorAll('[data-ai-emoji]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openPanel();
        insertAtCursor((btn.getAttribute('data-ai-emoji') || '') + ' ');
        if (emojiPop) emojiPop.hidden = true;
      });
    });

    if (attachPop) {
      attachPop.querySelectorAll('[data-ai-prompt]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openPanel();
          if (attachPop) attachPop.hidden = true;
          ask(btn.getAttribute('data-ai-prompt') || '');
        });
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitComposer();
    });

    document.addEventListener('click', function (event) {
      if (panel.hidden) return;
      var clickedMenu = (emojiPop && emojiPop.contains(event.target)) || (attachPop && attachPop.contains(event.target));
      var clickedTool = (emojiBtn && (event.target === emojiBtn || emojiBtn.contains(event.target))) || (attachBtn && (event.target === attachBtn || attachBtn.contains(event.target)));
      if (!clickedMenu && !clickedTool) closeFloatingMenus();
    });

    document.addEventListener('focusin', function (event) {
      if (panel.hidden) return;
      if (!event.target) return;
      if (event.target === input || panel.contains(event.target)) return;
      keepComposerFocus = false;
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || panel.hidden) return;
      if (emojiPop && !emojiPop.hidden) {
        emojiPop.hidden = true;
        focusInputSoon(0);
        return;
      }
      if (attachPop && !attachPop.hidden) {
        attachPop.hidden = true;
        focusInputSoon(0);
        return;
      }
      closePanel('escape');
    });

    window.addEventListener('focus', function () { preserveTypingFocus(); });
    window.addEventListener('resize', function () { preserveTypingFocus(); autoSizeInput(); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) preserveTypingFocus();
    });

    setQuickRepliesVisibility(getQuickRepliesCollapsed());

    bindOpenLinks(openPanel);
    restoreHistory();
    restoreDraftIfNeeded();
    if (window.location.hash === '#student-ai-panel' || shouldRestoreOpenState()) {
      setTimeout(openPanel, 60);
    }

    window.SGFStudentAI = {
      open: openPanel,
      close: closePanel,
      ask: ask,
      reset: resetConversation,
      isInteracting: function () {
        var active = document.activeElement;
        return !panel.hidden && ((active && panel.contains(active)) || !emojiPop.hidden || !attachPop.hidden || hasRecentAiInteraction(2200) || hasActiveDraft());
      },
      hasDraft: hasActiveDraft
    };
  }

  ready(function () {
    if (!isSuitablePage()) return;
    if (document.body && document.body.classList.contains('admin-page')) return;
    if (document.body && document.body.classList.contains('admin-login-page')) return;
    initShell();
  });
})();
