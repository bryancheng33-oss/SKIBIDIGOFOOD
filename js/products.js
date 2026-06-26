// ============================================================
//  products.js — Product cards, Hot & Popular, quick-view
//  Enhanced with dynamic catalog + customisation support
// ============================================================


function pLang(en) { return en; }

function pCategory(value) {
  return window.I18N && I18N.localizeCategory ? I18N.localizeCategory(value) : value;
}

function pCuisine(value) {
  return window.I18N && I18N.localizeCuisine ? I18N.localizeCuisine(value) : value;
}

function pBadge(value) {
  return window.I18N && I18N.localizeBadge ? I18N.localizeBadge(value) : value;
}

function pEsc(value) {
  return typeof sgfEscapeHtml === 'function' ? sgfEscapeHtml(value) : String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pAttr(value) {
  return pEsc(value);
}

function pSafeUrl(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (/^(?:javascript|data):/i.test(raw) && !/^data:image\//i.test(raw)) return fallback;
  return pAttr(raw);
}

function getLiveFoods() {
  return (typeof State !== 'undefined' && State.getFoodsData) ? State.getFoodsData() : FOODS;
}

function getLiveBrands() {
  return (typeof State !== 'undefined' && State.getBrandsData) ? State.getBrandsData() : BRANDS;
}

function getFoodByIdLive(foodId) {
  return getLiveFoods().find((f) => String(f.id) === String(foodId));
}

/* ── HOT & POPULAR LIST ───────────────────────────────────── */
function renderHotPopular(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const top = [...getLiveFoods()]
    .filter((food) => food.isActive !== false)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 8);

  el.innerHTML = top.map((food, rank) => {
    const rankLabel = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`;
    const isHot = food.badge === 'HOT' || food.badge === 'FAMOUS';
    const barWidth = Math.max(0, Math.min(100, Number(food.popularity) || 0));

    return `
    <div class="hot-item" onclick="openQV(${Number(food.id) || 0})">
      <div class="hot-rank">${rankLabel}</div>
      <div class="hot-img-wrap">
        <img loading="lazy" decoding="async" src="${pSafeUrl(food.img, 'images/food-burger.webp')}" alt="${pAttr(food.name)}" onerror="this.src='images/food-burger.webp'">
      </div>
      <div class="hot-info">
        <div class="hot-brand-row">
          <img loading="lazy" decoding="async" class="hot-brand-logo" src="${pSafeUrl(food.bLogo)}" alt="${pAttr(food.bName)}" onerror="this.style.display='none'">
          <span class="hot-brand-name">${pEsc(food.bName)}</span>
          ${isHot ? `<span class="hot-flame">🔥</span>` : ''}
          ${food.badge ? `<span class="hot-badge hot-badge-${pAttr(String(food.badge).toLowerCase())}">${pEsc(pBadge(food.badge))}</span>` : ''}
        </div>
        <div class="hot-name">${pEsc(food.name)}</div>
        <div class="hot-bar-wrap"><div class="hot-bar-fill" style="width:${barWidth}%"></div></div>
        <div class="hot-meta">
          <span class="hot-popularity">${barWidth}% ${pLang('popularity')}</span>
          <span class="hot-pts">⭐ +${food.pts} pts</span>
        </div>
      </div>
      <div class="hot-right">
        <div class="hot-price">RM ${Number(food.price).toFixed(2)}</div>
        <button class="hot-add-btn" onclick="event.stopPropagation(); handleAddToCart(${Number(food.id) || 0})" title="${pLang('Add to cart')}">
          <i class="fas fa-cart-plus"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

/* ── PRODUCT GRID CARD ────────────────────────────────────── */
function buildProductCard(food) {
  const badgeHtml = food.badge ? `<span class="badge badge-${pAttr(String(food.badge).toLowerCase())}">${pEsc(pBadge(food.badge))}</span>` : '';
  const popularity = Math.max(0, Math.min(100, Number(food.popularity) || 0));
  const popColor = popularity >= 90 ? '#e74c3c' : popularity >= 70 ? '#ff9800' : '#27ae60';
  const baseRating = Number.isFinite(Number(food.rating)) ? Number(food.rating) : 4.5;
  const reviewSummary = State.getFoodReviewSummary ? State.getFoodReviewSummary(food.id) : { avg: baseRating, count: 0 };
  const latestReview = State.getRecentFoodReviews ? State.getRecentFoodReviews(food.id, 1)[0] : null;
  const latestReviewSnippet = latestReview
    ? `<div class="product-review-snippet"><div class="product-review-snippet-head"><strong>${pEsc(latestReview.name || latestReview.username || pLang('Customer'))}</strong><span>${'★'.repeat(Math.max(1, Number(latestReview.stars) || 0))}</span></div><p>${pEsc(latestReview.text || '')}</p></div>`
    : '';

  return `
  <div class="product-card ${food.isActive === false ? 'product-card-offline' : ''}">
    ${badgeHtml}
    <i class="fas fa-eye" onclick="openQV(${Number(food.id) || 0})" title="${pLang('Quick view')}"></i>
    <i class="fas fa-shopping-cart" onclick="handleAddToCart(${Number(food.id) || 0})" title="${pLang('Add to cart')}"></i>
    <img loading="lazy" decoding="async" class="product-main-img" src="${pSafeUrl(food.img, 'images/food-burger.webp')}" alt="${pAttr(food.name)}" onerror="this.src='images/food-burger.webp'">
    <div class="brand-tag product-brand-compact">
      <img loading="lazy" decoding="async" src="${pSafeUrl(food.bLogo)}" alt="${pAttr(food.bName)}" onerror="this.style.display='none'">
      <span>${pEsc(food.bName)}</span>
    </div>
    <div class="name">${pEsc(food.name)}</div>
    <div class="pts">⭐ ${pLang('Earn')} ${Number(food.pts) || 0} ${pLang('pts')}</div>
    <div class="product-meta-row">
      <span>⭐ ${Number(Number.isFinite(Number(reviewSummary.avg)) ? Number(reviewSummary.avg) : baseRating).toFixed(1)}</span>
      <span>${pEsc(food.priceLevel || '$$')}</span>
      <span>${pEsc(pCategory(food.cat))}</span>
    </div>
    <div class="product-review-meta">
      <span>${reviewSummary.count ? pLang(`${reviewSummary.count} review${reviewSummary.count === 1 ? '' : 's'}`) : pLang('No customer reviews yet')}</span>
      <span>${reviewSummary.count ? pLang('Latest customer ratings are live') : pLang('Be the first to review this item')}</span>
    </div>
    ${latestReviewSnippet}
    <div class="pop-bar-wrap" title="Popularity: ${popularity}%">
      <div class="pop-bar-fill" style="width:${popularity}%;background:${popColor}"></div>
    </div>
    <div class="pop-label">${popularity >= 90 ? pLang('🔥 Trending') : popularity >= 75 ? pLang('📈 Popular') : pLang('Popularity')}: ${popularity}%</div>
    <div class="row">
      <div class="price"><span>RM </span>${Number(food.price).toFixed(2)}</div>
      <input type="number" class="qty-input" id="qty_${Number(food.id) || 0}" min="1" max="99" value="1" ${food.isActive === false ? 'disabled' : ''}>
    </div>
    <div class="product-custom-hint">${pLang('Custom size, spice, and add-ons available in quick view.')}</div>
    ${food.isActive === false ? `<div class="product-offline-note">${pLang('Temporarily unavailable')}</div>` : ''}
  </div>`;
}

function renderProducts(foods, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const visibleFoods = (foods || []).filter((food) => food && food.isActive !== false);
  el.innerHTML = visibleFoods.length ? visibleFoods.map(buildProductCard).join('') : `<p class="empty">${pLang('No items found.')}</p>`;
}

function handleAddToCart(foodId) {
  const food = getFoodByIdLive(foodId);
  if (!food) return;
  if (food.isActive === false) {
    State.notify(pLang('⚠️ This item is temporarily unavailable.'));
    return;
  }
  const qtyEl = document.getElementById('qty_' + foodId);
  const qty = Math.max(1, Math.min(99, qtyEl ? (parseInt(qtyEl.value, 10) || 1) : 1));
  if (!State.isLoggedIn || !State.isLoggedIn()) {
    if (typeof window.SGFQueueCartIntent === 'function') window.SGFQueueCartIntent(food.id, qty, null, 'menu#catalog-start');
    State.notify(pLang('Please log in or register first. We will keep this item ready for your cart.'));
    setTimeout(() => { window.location.href = './?notice=login'; }, 450);
    return;
  }
  State.addToCart(food, qty);
  if (typeof updateHeader === 'function') updateHeader();
  State.notify(pLang(`✅ ${food.name} ×${qty} added to cart!`));
}

/* ── QUICK VIEW MODAL ──────────────────────────────────────── */
let _qvFood = null;

function renderQuickViewReviews(food) {
  const wrap = document.getElementById('qv-reviews');
  if (!wrap || !food) return;
  const reviews = State.getRecentFoodReviews ? State.getRecentFoodReviews(food.id, 1) : [];
  if (!reviews.length) {
    wrap.innerHTML = `<div class="qv-review-item"><div class="qv-review-head"><strong>${pLang('No reviews yet')}</strong><span class="qv-review-stars">☆☆☆☆☆</span></div><p>${pLang('Fresh feedback will appear here after the first completed order.')}</p></div>`;
    return;
  }
  const review = reviews[0];
  wrap.innerHTML = `<div class="qv-review-item"><div class="qv-review-head"><strong>${pEsc(review.name || review.username || pLang('Customer'))}</strong><span class="qv-review-stars">${'★'.repeat(Math.max(1, Number(review.stars) || 0))}</span></div><p>${pEsc(review.text || '')}</p></div>`;
}

function ensureQuickViewScaffold() { return; }

function renderQuickViewCustomisations(food) {
  const wrap = document.getElementById('qv-customizations');
  if (!wrap) return;
  const cfg = food.customization || {};
  const sizes = Array.isArray(cfg.sizes) ? cfg.sizes : [];
  const spice = Array.isArray(cfg.spice) ? cfg.spice : [];
  const addons = Array.isArray(cfg.addons) ? cfg.addons : [];

  wrap.innerHTML = `
    <div class="qv-custom-grid">
      <label class="qv-field">
        <span>${pLang('Size')}</span>
        <select id="qv-size" onchange="updateQVPrice()">
          ${sizes.map((size) => `<option value="${pAttr(size.label)}" data-price="${Number(size.price) || 0}">${pEsc(size.label)}${size.price ? ` (+RM ${Number(size.price).toFixed(2)})` : ''}</option>`).join('')}
        </select>
      </label>
      <label class="qv-field">
        <span>${pLang('Preference')}</span>
        <select id="qv-spice" onchange="updateQVPrice()">
          ${spice.map((level) => `<option value="${pAttr(level)}">${pEsc(level)}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="qv-addon-wrap">
      <div class="qv-addon-title">${pLang('Add-ons')}</div>
      <div class="qv-addon-grid">
        ${addons.map((addon, idx) => `
          <label class="qv-addon-pill">
            <input type="checkbox" value="${pAttr(addon.label)}" data-price="${Number(addon.price) || 0}" onchange="updateQVPrice()" id="qv-addon-${idx}">
            <span>${pEsc(addon.label)} ${addon.price ? `(+RM ${Number(addon.price).toFixed(2)})` : ''}</span>
          </label>`).join('')}
      </div>
    </div>`;
  updateQVPrice();
}

function getQVSelection() {
  if (!_qvFood) return { size: 'Regular', spice: 'Original', addons: [], unitPrice: Number(_qvFood?.price || 0) };
  const sizeEl = document.getElementById('qv-size');
  const spiceEl = document.getElementById('qv-spice');
  const addonEls = Array.from(document.querySelectorAll('#qv-customizations input[type="checkbox"]:checked'));
  const selected = {
    size: sizeEl ? sizeEl.value : ((_qvFood.customization?.sizes || [])[0]?.label || pLang('Regular')),
    spice: spiceEl ? spiceEl.value : ((_qvFood.customization?.spice || [])[0] || pLang('Original')),
    addons: addonEls.map((el) => el.value),
  };
  return State._normaliseOptions ? State._normaliseOptions(_qvFood, selected) : selected;
}

function updateQVPrice() {
  if (!_qvFood) return;
  const selected = getQVSelection();
  const priceEl = document.getElementById('qv-price');
  const noteEl = document.getElementById('qv-option-price');
  if (priceEl) priceEl.textContent = Number(selected.unitPrice || _qvFood.price).toFixed(2);
  if (noteEl) {
    const addonText = selected.addons && selected.addons.length ? selected.addons.join(', ') : pLang('No extra add-ons selected');
    noteEl.innerHTML = `<strong>${pEsc(selected.summary || `${selected.size} · ${selected.spice}`)}</strong><span>${pEsc(addonText)}</span>`;
  }
}

function openQV(foodId) {
  _qvFood = getFoodByIdLive(foodId);
  if (!_qvFood) return;

  const qvImage = document.getElementById('qv-img');
  if (qvImage) {
    qvImage.src = _qvFood.img || 'images/food-burger.webp';
    qvImage.alt = `${_qvFood.name || 'Selected menu item'} preview image`;
    qvImage.onerror = function () { this.src = 'images/food-burger.webp'; this.alt = 'Fallback food preview image'; };
  }
  document.getElementById('qv-brand').textContent = `${_qvFood.bName} · ${pCategory(_qvFood.cat)}`;
  document.getElementById('qv-name').textContent = _qvFood.name;
  document.getElementById('qv-price').textContent = Number(_qvFood.price).toFixed(2);
  const qvRating = Number.isFinite(Number(_qvFood.rating)) ? Number(_qvFood.rating) : 4.5;
  document.getElementById('qv-pts').textContent = pLang(`+${_qvFood.pts} loyalty points · ⭐ ${qvRating.toFixed(1)}`);
  document.getElementById('qv-qty').value = 1;

  const popEl = document.getElementById('qv-popularity');
  if (popEl) popEl.textContent = pLang(`${_qvFood.popularity}% popularity • ${_qvFood.priceLevel || '$$'} • ${_qvFood.bName}`);

  const badgeEl = document.getElementById('qv-badge');
  if (badgeEl) {
    if (_qvFood.badge) {
      badgeEl.textContent = pBadge(_qvFood.badge);
      badgeEl.className = 'qv-badge-pill badge-' + String(_qvFood.badge).toLowerCase();
      badgeEl.style.display = '';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  renderQuickViewCustomisations(_qvFood);
  renderQuickViewReviews(_qvFood);
  const modal = document.getElementById('qv-modal');
  if (modal) modal.classList.add('open');
  document.body.classList.add('qv-open');
}

function changeQuickViewQty(delta) {
  const input = document.getElementById('qv-qty');
  if (!input) return 1;
  const current = parseInt(input.value, 10) || 1;
  const next = Math.max(1, Math.min(99, current + Number(delta || 0)));
  input.value = String(next);
  return next;
}

function getQuickViewQty() {
  const input = document.getElementById('qv-qty');
  const qty = Math.max(1, Math.min(99, parseInt(input && input.value, 10) || 1));
  if (input) input.value = String(qty);
  return qty;
}

function closeQV() {
  const modal = document.getElementById('qv-modal');
  if (modal) modal.classList.remove('open');
  document.body.classList.remove('qv-open');
  _qvFood = null;
}

function addFromQV() {
  if (!_qvFood) return;
  const qty = getQuickViewQty();
  const selected = getQVSelection();
  if (!State.isLoggedIn || !State.isLoggedIn()) {
    if (typeof window.SGFQueueCartIntent === 'function') window.SGFQueueCartIntent(_qvFood.id, qty, selected, 'menu#catalog-start');
    State.notify(pLang('Please log in or register first. We will keep this customised item ready for your cart.'));
    closeQV();
    setTimeout(() => { window.location.href = './?notice=login'; }, 450);
    return;
  }
  State.addToCart(_qvFood, qty, selected);
  if (typeof updateHeader === 'function') updateHeader();
  State.notify(pLang(`✅ ${_qvFood.name} ×${qty} added to cart!`));
  closeQV();
}

window.changeQuickViewQty = changeQuickViewQty;

document.addEventListener('DOMContentLoaded', () => {
  ensureQuickViewScaffold();
  const modal = document.getElementById('qv-modal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeQV(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQV();
  });
});
