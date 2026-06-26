
  requireAuth();

  function orderLang(en) { return en; }
  function orderStatusLabel(value) { return window.I18N && I18N.localizeOrderStatus ? I18N.localizeOrderStatus(value) : value; }
  function paymentLabel(value) { return window.I18N && I18N.localizePaymentMethod ? I18N.localizePaymentMethod(value) : value; }
  function supportPriorityLabel(value) { return window.I18N && I18N.localizeSupportPriority ? I18N.localizeSupportPriority(value) : String(value || 'standard').replace(/-/g, ' '); }
  function accountTypeLabel(value) { const v = String(value || 'personal'); const labels = { personal: orderLang('Student'), corporate: orderLang('Campus Group') }; return labels[v] || v.replace(/-/g, ' '); }
  function formatOrderDate(value) { return window.I18N && I18N.formatDateTime ? I18N.formatDateTime(value) : value; }

  function orderStatusClass(status) {
    return String(status || 'pending').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeInlineJs(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, ' ');
  }

  function getProgressPercent(status) {
    const map = { pending: 18, preparing: 48, 'on the way': 78, delivered: 100, cancelled: 100 };
    return map[String(status || '').toLowerCase()] || 12;
  }

  function formatOrderStatus(status) {
    return orderStatusLabel(status) || String(status || 'pending');
  }

  function formatPaymentMethod(method) {
    return paymentLabel(method) || method || '—';
  }

  function sortTimelineHistory(history) {
    return (Array.isArray(history) ? history.filter(Boolean) : []).slice().sort((a, b) => {
      const ta = new Date(a.at || 0).getTime() || 0;
      const tb = new Date(b.at || 0).getTime() || 0;
      return ta - tb;
    });
  }

  function renderTimeline(order) {
    const orderedHistory = sortTimelineHistory(order.statusHistory);
    if (!orderedHistory.length) return '';
    return `
      <div class="order-timeline">
        <div class="order-mini-title"><i class="fas fa-stream"></i> ${orderLang('Tracking timeline')}</div>
        <div class="order-timeline-list">
          ${orderedHistory.map((item, idx) => `
            <div class="order-timeline-item timeline-${orderStatusClass(item.status)}${idx === orderedHistory.length - 1 ? ' is-current' : ''}">
              <div class="order-timeline-copy">
                <strong>${escapeHtml(formatOrderStatus(item.status))}</strong>
                <span>${escapeHtml(item.note || '')}</span>
                <small>${item.at ? formatOrderDate(item.at) : '—'}</small>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function getCountdownHtml(order) {
    const status = String(order.status || '').toLowerCase();
    if (!['pending', 'preparing', 'on the way'].includes(status)) return '';
    const countdown = State.getOrderCountdown ? State.getOrderCountdown(order) : null;
    if (!countdown || !countdown.active) return '';
    return `<span class="order-countdown-pill ${countdown.overdue ? 'delayed' : ''}"><i class="fas fa-hourglass-half"></i> ${countdown.overdue ? orderLang('Delayed') : countdown.label}</span>`;
  }

  function getPointsHtml(order) {
    const pts = Number(order.pointsToAward || 0);
    if (!pts) return '';
    const status = order.pointsStatus || (order.pointsAwarded ? 'awarded' : 'pending');
    if (status === 'reversed') return `<span class="order-points-pill"><i class="fas fa-star"></i> ${pts} ${orderLang('pts reversed because the order was cancelled')}</span>`;
    if (status === 'awarded' || order.pointsAwarded) return `<span class="order-points-pill"><i class="fas fa-star"></i> ${pts} ${orderLang('pts added after delivery')}</span>`;
    return `<span class="order-points-pill"><i class="fas fa-star"></i> ${pts} ${orderLang('pts waiting to be added after delivery')}</span>`;
  }

  const REVIEW_LABELS = {
    1: orderLang('Very bad • 1/5'),
    2: orderLang('Not good • 2/5'),
    3: orderLang('Okay • 3/5'),
    4: orderLang('Good • 4/5'),
    5: orderLang('Excellent • 5/5')
  };

  const reviewDrafts = {};

  function getReviewDraft(orderId) {
    const key = String(orderId || '').replace(/^review-/, '');
    return reviewDrafts[key] || null;
  }

  function setReviewDraft(orderId, next = {}) {
    const key = String(orderId || '').replace(/^review-/, '');
    if (!key) return null;
    const current = reviewDrafts[key] || {};
    const merged = { ...current, ...next, touchedAt: Date.now() };
    if (typeof merged.text === 'string') merged.text = merged.text.slice(0, 240);
    reviewDrafts[key] = merged;
    return reviewDrafts[key];
  }

  function hasUnsavedReviewDraft(orderId) {
    const draft = getReviewDraft(orderId);
    return !!(draft && ((typeof draft.text === 'string' && draft.text.trim()) || Number(draft.rating || 0) > 0));
  }

  function clearReviewDraft(orderId) {
    const key = String(orderId || '').replace(/^review-/, '');
    if (!key) return;
    delete reviewDrafts[key];
  }

  function getDraftRating(orderId, fallback = 5) {
    const draft = getReviewDraft(orderId);
    if (draft && draft.rating != null && draft.rating !== '') return Math.max(1, Math.min(5, Number(draft.rating) || fallback));
    return Math.max(1, Math.min(5, Number(fallback) || 5));
  }

  function getDraftText(orderId, fallback = '') {
    const draft = getReviewDraft(orderId);
    if (draft && typeof draft.text === 'string') return draft.text;
    return String(fallback || '');
  }

  function getRatingLabel(rating) {
    return REVIEW_LABELS[Math.max(1, Math.min(5, Number(rating) || 5))] || REVIEW_LABELS[5];
  }

  function buildStarPicker(idPrefix, selected = 5) {
    const safeValue = Math.max(1, Math.min(5, Number(selected) || 5));
    return Array.from({ length: 5 }, (_, idx) => {
      const value = idx + 1;
      const active = value <= safeValue ? ' active' : '';
      return `<button type="button" class="star-btn${active}" data-value="${value}" onpointerdown="return handleStarActivate(event, '${idPrefix}', ${value})" onclick="return false" onkeydown="return handleStarKey(event, '${idPrefix}', ${value})" aria-label="${orderLang(`Rate ${value} out of 5`)}" aria-checked="${value === safeValue ? 'true' : 'false'}"><i class="fas fa-star"></i></button>`;
    }).join('');
  }

  function handleStarActivate(event, idPrefix, rating) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setStarRating(idPrefix, rating);
    return false;
  }

  function handleStarKey(event, idPrefix, rating) {
    const key = event?.key || '';
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') return handleStarActivate(event, idPrefix, rating);
    if (key === 'ArrowLeft' || key === 'ArrowDown') return handleStarActivate(event, idPrefix, Math.max(1, Number(rating || 1) - 1));
    if (key === 'ArrowRight' || key === 'ArrowUp') return handleStarActivate(event, idPrefix, Math.min(5, Number(rating || 1) + 1));
    return true;
  }

  function setStarRating(idPrefix, rating) {
    const safeValue = Math.max(1, Math.min(5, Number(rating) || 5));
    if (/^review-/.test(String(idPrefix || ''))) setReviewDraft(idPrefix, { rating: safeValue });
    if (String(idPrefix || '') === 'prompt' && activePromptOrderId) setReviewDraft(activePromptOrderId, { rating: safeValue, text: document.getElementById('prompt-review')?.value || getDraftText(activePromptOrderId, '') });
    const input = document.getElementById(`${idPrefix}-rate`);
    if (input) input.value = String(safeValue);
    const picker = document.getElementById(`${idPrefix}-stars`);
    if (picker) {
      picker.querySelectorAll('.star-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx < safeValue);
        btn.setAttribute('aria-checked', idx + 1 === safeValue ? 'true' : 'false');
      });
    }
    const label = document.getElementById(`${idPrefix}-rate-label`);
    if (label) label.textContent = getRatingLabel(safeValue);
  }

  function bindReviewTextarea(textareaId, counterId) {
    const textarea = document.getElementById(textareaId);
    const counter = document.getElementById(counterId);
    if (!textarea || !counter || textarea.dataset.counterBound === '1') return;
    const sync = () => {
      counter.textContent = `${textarea.value.length}/240`;
      if (/^review-/.test(String(textareaId || ''))) {
        setReviewDraft(textareaId, { text: textarea.value });
      } else if (textareaId === 'prompt-review' && activePromptOrderId) {
        setReviewDraft(activePromptOrderId, { text: textarea.value, rating: Number(document.getElementById('prompt-rate')?.value || 5) });
      }
    };
    textarea.addEventListener('input', sync);
    textarea.addEventListener('focus', sync);
    textarea.dataset.counterBound = '1';
    sync();
  }

  function useReviewChip(textareaId, value) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const next = String(value || '').trim();
    const current = String(textarea.value || '').trim();
    textarea.value = current ? `${current}${/[.!?]$/.test(current) ? ' ' : '. '}${next}` : next;
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
    if (textareaId === 'prompt-review' && activePromptOrderId) {
      setReviewDraft(activePromptOrderId, { text: textarea.value, rating: Number(document.getElementById('prompt-rate')?.value || 5) });
    }
  }

  function ensurePromptStarPicker() {
    const picker = document.getElementById('prompt-stars');
    if (picker && !picker.querySelector('.star-btn')) picker.innerHTML = buildStarPicker('prompt', Number(document.getElementById('prompt-rate')?.value || 5));
  }

  function bindReviewArea(orderId) {
    const draft = getReviewDraft(orderId);
    const textareaId = `review-${orderId}`;
    const textarea = document.getElementById(textareaId);
    if (textarea && draft && typeof draft.text === 'string' && textarea.value !== draft.text) textarea.value = draft.text;
    bindReviewTextarea(textareaId, `review-count-${orderId}`);
    const rateValue = draft && draft.rating != null ? draft.rating : Number(document.getElementById(`review-${orderId}-rate`)?.value || 5);
    setStarRating(`review-${orderId}`, rateValue);
  }

  let selectedOrderId = null;

  function getSelectedOrder(orders) {
    const list = Array.isArray(orders) ? orders : [];
    if (!list.length) return null;
    let savedId = selectedOrderId;
    try {
      const promptId = sessionStorage.getItem('sgf_review_prompt_order_id');
      if (promptId && list.some((entry) => String(entry.id) === String(promptId))) savedId = promptId;
      if (!savedId) savedId = sessionStorage.getItem('sgf_selected_order_id');
    } catch (e) {}
    let active = list.find((entry) => String(entry.id) === String(savedId));
    if (!active) active = list[0];
    selectedOrderId = String(active.id);
    try { sessionStorage.setItem('sgf_selected_order_id', selectedOrderId); } catch (e) {}
    return active;
  }

  function selectOrder(orderId, scrollIntoView = false) {
    if (!orderId) return;
    selectedOrderId = String(orderId);
    try { sessionStorage.setItem('sgf_selected_order_id', selectedOrderId); } catch (e) {}
    renderOrders();
    if (scrollIntoView && window.innerWidth <= 980) {
      const detail = document.getElementById('order-detail');
      if (detail && typeof detail.scrollIntoView === 'function') detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function addOrderItemToCart(orderId, itemIndex) {
    const order = (State.getOrders() || []).find((entry) => String(entry.id) === String(orderId));
    const item = order && Array.isArray(order.items) ? order.items[Number(itemIndex)] : null;
    if (!item) {
      State.notify(orderLang('⚠️ This item could not be added again.'));
      return;
    }
    const qty = Math.max(1, Number(item.qty) || 1);
    const added = State.addToCart(item, qty, item.options || null);
    if (!added) {
      State.notify(orderLang('⚠️ This saved item is no longer available in the active menu.'));
      return;
    }
    if (typeof updateHeader === 'function') updateHeader();
    State.notify(orderLang('✅ ' + item.name + ' ×' + qty + ' added back to cart.'));
  }

  function renderOrderListCard(order, isActive) {
    const itemsPreview = (order.items || []).slice(0, 3).map((item) => `<span>${escapeHtml(item.name)} ×${item.qty}</span>`).join('');
    const moreCount = Math.max(0, (order.items || []).length - 3);
    const orderIdForJs = escapeInlineJs(order.id);
    return `
      <article role="button" tabindex="0" class="order-list-card${isActive ? ' active' : ''}" aria-current="${isActive ? 'true' : 'false'}" data-order-card="true" onclick="selectOrder('${orderIdForJs}', true)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectOrder('${orderIdForJs}', true);}">
        <div class="order-list-top">
          <div>
            <div class="order-list-id">Order #${String(order.id).slice(-6)}</div>
            <div class="order-list-date"><i class="fas fa-calendar"></i> ${order.date}</div>
          </div>
          <span class="status-pill status-${orderStatusClass(order.status)}">${formatOrderStatus(order.status)}${order.refunded ? orderLang(' • refunded') : ''}</span>
        </div>
        <div class="order-list-items">
          ${itemsPreview}
          ${moreCount ? `<small>+${moreCount}</small>` : ''}
        </div>
        <div class="order-list-footer">
          <strong class="order-list-total">RM ${Number(order.total || 0).toFixed(2)}</strong>
          <span class="order-list-eta"><i class="fas fa-clock"></i> ${orderLang('ETA')} ${order.etaMin || '—'} ${orderLang('min')}</span>
        </div>
        <div class="order-list-chips">
          ${getCountdownHtml(order)}
          ${order.deliveryNote ? `<span class="order-list-note"><i class="fas fa-motorcycle"></i> ${escapeHtml(order.deliveryNote)}</span>` : ''}
        </div>
      </article>`;
  }

  function renderOrderDetail(order) {
    if (!order) return '';

    const itemsHtml = (order.items || []).map((item, itemIndex) => {
      const qty = Math.max(1, Number(item.qty) || 1);
      const lineTotal = (Number(item.price || 0) * qty).toFixed(2);
      const unitPrice = Number(item.price || 0).toFixed(2);
      const brandText = item.bName || item.brand || orderLang('Menu item');
      const categoryText = item.cat ? String(item.cat).replace(/-/g, ' ') : orderLang('Saved order item');
      return `
      <div class="order-item-row order-item-row-detailed">
        <div class="order-item-main">
          <span>${escapeHtml(item.name)} ×${qty}</span>
          ${item.options ? `<small>${escapeHtml(item.options.summary || '')}</small>` : ''}
          <div class="order-item-meta">
            <em><i class="fas fa-store"></i> ${escapeHtml(brandText)}</em>
            <em><i class="fas fa-layer-group"></i> ${escapeHtml(categoryText)}</em>
            <em><i class="fas fa-tag"></i> RM ${unitPrice} each</em>
          </div>
        </div>
        <div class="order-item-side">
          <strong>RM ${lineTotal}</strong>
          <button class="order-reorder-btn" type="button" onclick="addOrderItemToCart('${escapeInlineJs(order.id)}', ${itemIndex})">
            <i class="fas fa-cart-plus"></i> ${orderLang('Add to cart again')}
          </button>
        </div>
      </div>`;
    }).join('');

    const driver = order.driver && order.driver.name ? `
      <div class="order-driver-box">
        <div><strong>${escapeHtml(order.driver.name)}</strong> • ${escapeHtml(order.driver.vehicle || orderLang('Delivery vehicle'))}</div>
        <div>${escapeHtml(order.driver.phone || orderLang('No phone shared'))}</div>
        <div>${escapeHtml(order.deliveryNote || '')}</div>
        <div class="order-driver-links">
          ${order.driver.phone ? `<a href="https://wa.me/${String(order.driver.phone).replace(/[^0-9]/g, '')}" target="_blank"><i class="fab fa-whatsapp"></i> ${orderLang('WhatsApp driver')}</a>` : ''}
          ${order.driver.phone ? `<a href="https://t.me/+${String(order.driver.phone).replace(/[^0-9]/g, '')}" target="_blank"><i class="fab fa-telegram-plane"></i> Telegram</a>` : ''}
        </div>
      </div>` : `<div class="order-driver-box waiting">${orderLang('Driver details will appear here once admin assigns one.')}</div>`;

    const membershipRow = order.membershipDiscount > 0 ? `
      <div class="order-delivery-row">
        <div class="order-delivery-icon"><i class="fas fa-crown"></i></div>
        <div class="order-delivery-copy">
          <strong>${escapeHtml(order.membershipDiscountLabel || orderLang('Member deal'))}</strong>
          <span>${orderLang('saved RM')} ${Number(order.membershipDiscount || 0).toFixed(2)}</span>
        </div>
      </div>` : '';

    const voucherRow = Array.isArray(order.appliedVouchers) && order.appliedVouchers.length ? `
      <div class="order-delivery-row">
        <div class="order-delivery-icon"><i class="fas fa-ticket-alt"></i></div>
        <div class="order-delivery-copy">
          <strong>${orderLang(order.appliedVouchers.length === 1 ? 'Used voucher' : 'Used vouchers')}</strong>
          <span>${escapeHtml(order.appliedVouchers.map((voucher) => voucher.label).join(', '))}</span>
        </div>
      </div>` : '';

    const accountTypeRow = order.membershipAccountType ? `
      <div class="order-delivery-row">
        <div class="order-delivery-icon"><i class="fas fa-building"></i></div>
        <div class="order-delivery-copy">
          <strong>${orderLang('Account type')}</strong>
          <span>${escapeHtml(accountTypeLabel(order.membershipAccountType))}</span>
        </div>
      </div>` : '';

    const refundRow = order.refunded ? `
      <div class="order-delivery-row">
        <div class="order-delivery-icon"><i class="fas fa-wallet"></i></div>
        <div class="order-delivery-copy">
          <strong>${orderLang('Refund')}</strong>
          <span>RM ${Number(order.refundAmount || 0).toFixed(2)} ${orderLang('returned to your wallet')}${order.refundedAt ? orderLang(' on ') + formatOrderDate(order.refundedAt) : ''}</span>
        </div>
      </div>` : '';

    const timelineHtml = renderTimeline(order);
    const reviewHtml = renderReviewBox(order);
    const bottomHtml = [timelineHtml, reviewHtml].filter(Boolean).join('');
    const bottomClass = timelineHtml && reviewHtml ? 'detail-bottom-grid' : 'detail-bottom-grid single';

    return `
      <article class="order-detail-card">
        <div class="order-detail-head">
          <div class="order-detail-head-top">
            <div>
              <div class="order-detail-kicker">${orderLang('My orders')}</div>
              <div class="order-detail-id">Order #${String(order.id).slice(-6)}</div>
              <div class="order-detail-date"><i class="fas fa-calendar"></i> ${order.date}</div>
            </div>
            <span class="status-pill status-${orderStatusClass(order.status)}">${formatOrderStatus(order.status)}${order.refunded ? orderLang(' • refunded') : ''}</span>
          </div>

          <div class="order-detail-summary">
            <span class="order-summary-chip"><i class="fas fa-credit-card"></i> ${escapeHtml(formatPaymentMethod(order.method))}</span>
            <span class="order-summary-chip"><i class="fas fa-wallet"></i> RM ${Number(order.total || 0).toFixed(2)}</span>
            <span class="order-summary-chip"><i class="fas fa-clock"></i> ${orderLang('ETA')} ${order.etaMin || '—'} ${orderLang('min')}</span>
            ${order.membershipAccountType ? `<span class="order-summary-chip"><i class="fas fa-id-card"></i> ${escapeHtml(accountTypeLabel(order.membershipAccountType))}</span>` : ''}
          </div>

          <div class="order-progress-card">
            <div class="order-progress">
              <div class="order-progress-bar"><span style="width:${getProgressPercent(order.status)}%"></span></div>
              <div class="order-extra-meta">
                ${getCountdownHtml(order)}
                ${getPointsHtml(order)}
                ${order.membershipPlanName && order.membershipPlanName !== 'Free' ? `<span class="order-points-pill"><i class="fas fa-id-card"></i> ${escapeHtml(order.membershipPlanName)} · ${escapeHtml(supportPriorityLabel(order.membershipSupportPriority || 'standard'))}</span>` : ''}
              </div>
              <div class="order-progress-meta">
                <span><i class="fas fa-clock"></i> ${orderLang('ETA')} ${order.etaMin || '—'} ${orderLang('min')}</span>
                <span><i class="fas fa-motorcycle"></i> ${escapeHtml(order.deliveryNote || orderLang('Tracking active'))}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="order-detail-grid">
          <section class="order-panel order-surface">
            <div class="order-mini-title"><i class="fas fa-utensils"></i> ${orderLang('Items Ordered')}</div>
            <div class="order-item-list">${itemsHtml}</div>
          </section>

          <section class="order-panel order-surface">
            <div class="order-mini-title"><i class="fas fa-route"></i> ${orderLang('Delivery')}</div>
            <div class="order-delivery-list">
              <div class="order-delivery-row">
                <div class="order-delivery-icon"><i class="fas fa-credit-card"></i></div>
                <div class="order-delivery-copy"><strong>${escapeHtml(formatPaymentMethod(order.method))}</strong></div>
              </div>
              <div class="order-delivery-row">
                <div class="order-delivery-icon"><i class="fas fa-map-marker-alt"></i></div>
                <div class="order-delivery-copy"><strong>${escapeHtml(order.address)}</strong></div>
              </div>
              <div class="order-delivery-row order-price-row">
                <div class="order-delivery-icon"><i class="fas fa-money-bill-wave"></i></div>
                <div class="order-delivery-copy">
                  <strong>RM ${Number(order.total || 0).toFixed(2)}</strong>
                  ${order.discount > 0 ? `<span class="savings-note">${orderLang('saved RM')} ${Number(order.discount).toFixed(2)}</span>` : ''}
                </div>
              </div>
              ${membershipRow}
              ${voucherRow}
              ${accountTypeRow}
              ${refundRow}
            </div>
            ${driver}
          </section>
        </div>

        ${bottomHtml ? `<div class="${bottomClass}">${bottomHtml}</div>` : ''}
      </article>`;
  }

  function renderReviewBox(order) {
    const canShowPrompt = !!order.reviewPromptPending || String(order.status || '').toLowerCase() === 'delivered';
    if (!canShowPrompt && !order.rating) return '';
    if (order.rating) {
      const savedReview = State.getStoredReviews ? State.getStoredReviews().find((review) => String(review.orderId) === String(order.id) && String(review.username || '') === String(order.username || '')) : null;
      return `
        <div class="order-review-box done">
          <div class="order-mini-title"><i class="fas fa-star"></i> ${orderLang('Your review')}</div>
          <div class="order-review-stars">${'★'.repeat(order.rating)}${'☆'.repeat(5 - order.rating)}</div>
          <p>${escapeHtml(order.reviewText || orderLang('Thanks for rating this order.'))}</p>
          <div class="review-card-actions">
            <button type="button" class="btn btn-sm" onclick="openReviewPrompt('${order.id}', true)"><i class="fas fa-pen"></i> ${orderLang('Edit review')}</button>
          </div>
          <p class="order-review-visibility-note">${savedReview && savedReview.hiddenByAdmin ? orderLang('This review is hidden by admin and is not shown on the public menu right now.') : orderLang('This review is live on the menu so other customers can see it.')}</p>
        </div>`;
    }
    const draftRating = getDraftRating(order.id, 5);
    const draftText = getDraftText(order.id, '');
    return `
      <div class="order-review-box">
        <div class="order-mini-title"><i class="fas fa-star"></i> ${orderLang('Leave a comment and rating')}</div>
        <p class="review-helper-copy" style="margin:.4rem 0 1rem">${orderLang('Tap a star to rate your order. You can also use a quick comment below.')}</p>
        <div id="review-${order.id}-stars" class="star-picker compact" role="radiogroup" aria-label="${orderLang('Rate this order')}">${buildStarPicker(`review-${order.id}`, draftRating)}</div>
        <input type="hidden" id="review-${order.id}-rate" value="${draftRating}">
        <div class="star-picker-meta compact"><strong id="review-${order.id}-rate-label">${getRatingLabel(draftRating)}</strong><span>${orderLang('Easy tap-to-rate stars')}</span></div>
        <div class="review-chip-row compact">
          <button type="button" class="review-chip" onclick="useReviewChip('review-${order.id}','${orderLang('Fast delivery')}')">${orderLang('Fast delivery')}</button>
          <button type="button" class="review-chip" onclick="useReviewChip('review-${order.id}','${orderLang('Tasty food')}')">${orderLang('Tasty food')}</button>
          <button type="button" class="review-chip" onclick="useReviewChip('review-${order.id}','${orderLang('Fresh and hot')}')">${orderLang('Fresh and hot')}</button>
          <button type="button" class="review-chip" onclick="useReviewChip('review-${order.id}','${orderLang('Needs improvement')}')">${orderLang('Needs improvement')}</button>
        </div>
        <textarea id="review-${order.id}" class="form-field review-textarea" rows="3" maxlength="240" placeholder="${orderLang('Share your comment about the order, menu, or overall experience.')}">${escapeHtml(draftText)}</textarea>
        <div class="review-text-meta"><span>${orderLang('Your feedback helps improve future orders.')}</span><strong id="review-count-${order.id}">0/240</strong></div>
        <div class="review-card-actions">
          <button class="btn btn-sm" onclick="submitReview('${order.id}')"><i class="fas fa-paper-plane"></i> ${orderLang('Submit Comment & Rating')}</button>
        </div>
      </div>`;
  }

  async function submitReview(orderId) {
    const rating = document.getElementById(`review-${orderId}-rate`)?.value || String(getDraftRating(orderId, 5));
    const text = document.getElementById('review-' + orderId)?.value || getDraftText(orderId, '');
    if (!State.addReview(orderId, rating, text)) {
      State.notify(orderLang('⚠️ Unable to save review.'));
      return;
    }
    clearReviewDraft(orderId);
    try { sessionStorage.removeItem('sgf_review_prompt_order_id'); } catch (e) {}
    if (window.SGFBackend && window.SGFBackend.enabled) {
      try {
        const order = (State.getOrders() || []).find((entry) => String(entry.id) === String(orderId));
        const review = (State.getStoredReviews ? State.getStoredReviews() : []).find((entry) => String(entry.orderId) === String(orderId) && String(entry.username || '') === String((order && order.username) || (State.getUser() || {}).username || ''));
        if (order) await window.SGFBackend.saveOrder(order);
        if (review) await window.SGFBackend.saveReview(review);
      } catch (err) {
        console.error('[SGF Orders] review sync failed', err);
      }
    }
    State.notify(orderLang('⭐ Thanks! Your review is now live on the menu for other customers to see.'));
    renderOrders();
  }

  let activePromptOrderId = null;

  function closeReviewPrompt() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.classList.remove('open');
    activePromptOrderId = null;
    try { sessionStorage.removeItem('sgf_review_prompt_order_id'); } catch (e) {}
  }

  function openReviewPrompt(orderId, isEditing = false) {
    const modal = document.getElementById('review-modal');
    if (!modal || !orderId) return;
    activePromptOrderId = String(orderId);
    const order = (State.getOrders() || []).find((entry) => String(entry.id) === String(orderId));
    const draft = getReviewDraft(orderId);
    const rate = document.getElementById('prompt-rate');
    const box = document.getElementById('prompt-review');
    const copy = document.getElementById('review-modal-copy');
    if (copy) {
      copy.textContent = isEditing
        ? orderLang('Update your rating or comment any time. Tap the stars to adjust your score, then save the changes.')
        : orderLang('Your order has been delivered. Please tap a star, share a quick comment, and submit your review.');
    }
    if (rate) rate.value = String(draft && draft.rating != null ? draft.rating : Number(order?.rating) || 5);
    ensurePromptStarPicker();
    if (box) box.value = String(draft && typeof draft.text === 'string' ? draft.text : order?.reviewText || '');
    bindReviewTextarea('prompt-review', 'prompt-review-count');
    setStarRating('prompt', Number(rate?.value || 5));
    modal.classList.add('open');
    if (box) box.focus();
  }

  async function submitPromptReview() {
    if (!activePromptOrderId) return closeReviewPrompt();
    const orderId = activePromptOrderId;
    const rating = document.getElementById('prompt-rate')?.value || '5';
    const text = document.getElementById('prompt-review')?.value || '';
    if (!State.addReview(orderId, rating, text)) {
      State.notify(orderLang('⚠️ Unable to save review.'));
      return;
    }
    clearReviewDraft(orderId);
    if (window.SGFBackend && window.SGFBackend.enabled) {
      try {
        const order = (State.getOrders() || []).find((entry) => String(entry.id) === String(orderId));
        const review = (State.getStoredReviews ? State.getStoredReviews() : []).find((entry) => String(entry.orderId) === String(orderId) && String(entry.username || '') === String((order && order.username) || (State.getUser() || {}).username || ''));
        if (order) await window.SGFBackend.saveOrder(order);
        if (review) await window.SGFBackend.saveReview(review);
      } catch (err) {
        console.error('[SGF Orders] prompt review sync failed', err);
      }
    }
    State.notify(orderLang('⭐ Thanks! Your comment and rating were saved successfully.'));
    closeReviewPrompt();
    renderOrders();
  }

  function autoOpenReviewPrompt(orders) {
    let targetId = null;
    try { targetId = sessionStorage.getItem('sgf_review_prompt_order_id'); } catch (e) {}
    if (!targetId) return;
    const target = (orders || []).find((order) => String(order.id) === String(targetId) && !order.rating && (!!order.reviewPromptPending || String(order.status || '').toLowerCase() === 'delivered'));
    if (!target) return closeReviewPrompt();
    openReviewPrompt(target.id);
  }

  function isReviewInteractionActive() {
    const active = document.activeElement;
    const modalOpen = document.getElementById('review-modal')?.classList.contains('open');
    const hasRecentDraft = Object.values(reviewDrafts).some((draft) => draft && ((typeof draft.text === 'string' && draft.text.trim()) || Number(draft.rating || 0) > 0) && Date.now() - Number(draft.touchedAt || 0) < 600000);
    return modalOpen || !!activePromptOrderId || hasRecentDraft || !!(active && (active.id === 'prompt-review' || /^review-/.test(active.id || '')));
  }

  function renderOrders() {
    if (State.processDeliveryCountdowns) State.processDeliveryCountdowns();
    if (typeof updateHeader === 'function') updateHeader();

    const orders = State.getOrders();
    const listEl = document.getElementById('orders-list');
    const detailEl = document.getElementById('order-detail');

    if (!orders.length) {
      const emptyList = `
        <div class="order-empty-state">
          <div class="cart-empty-icon"><i class="fas fa-box-open"></i></div>
          <h3>${orderLang('No saved orders yet')}</h3>
          <p>${orderLang('Your real checkout history will appear here after you place an order. No sample or fake order cards are shown in this list.')}</p>
          <a href="menu" class="btn btn-sm" style="display:inline-flex"><i class="fas fa-utensils"></i> ${orderLang('Start Ordering')}</a>
        </div>`;
      const emptyDetail = `
        <div class="orders-empty-detail">
          <article class="order-detail-card">
            <div class="order-detail-head">
              <div class="order-detail-head-top">
                <div>
                  <div class="order-detail-kicker">${orderLang('Order details')}</div>
                  <div class="order-detail-id">${orderLang('Nothing to track yet')}</div>
                  <div class="order-detail-date"><i class="fas fa-calendar"></i> ${orderLang('Waiting for your first checkout')}</div>
                </div>
                <span class="status-pill status-pending">${orderLang('No active order')}</span>
              </div>
            </div>
            <p class="empty" style="margin:1.5rem 0 0">${orderLang('Once an order is placed, this panel will show its actual items, total, driver, ETA, points, vouchers, refund state, and review status.')}</p>
          </article>
        </div>`;
      if (listEl) listEl.innerHTML = emptyList;
      if (detailEl) detailEl.innerHTML = emptyDetail;
      return;
    }

    const activeOrder = getSelectedOrder(orders);
    if (listEl) {
      listEl.innerHTML = `
        ${orders.map((order) => renderOrderListCard(order, String(order.id) === String(activeOrder && activeOrder.id))).join('')}
      `;
    }
    if (detailEl) detailEl.innerHTML = renderOrderDetail(activeOrder);

    if (activeOrder && !activeOrder.rating && (!!activeOrder.reviewPromptPending || String(activeOrder.status || '').toLowerCase() === 'delivered')) bindReviewArea(activeOrder.id);
    ensurePromptStarPicker();
    bindReviewTextarea('prompt-review', 'prompt-review-count');
    setStarRating('prompt', Number(document.getElementById('prompt-rate')?.value || 5));
    autoOpenReviewPrompt(orders);
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensurePromptStarPicker();
    bindReviewTextarea('prompt-review', 'prompt-review-count');
    setStarRating('prompt', Number(document.getElementById('prompt-rate')?.value || 5));
    renderOrders();
    setInterval(() => {
      if (isReviewInteractionActive()) {
        if (typeof updateHeader === 'function') updateHeader();
        return;
      }
      renderOrders();
    }, 1000);
  });
  window.addEventListener('storage', () => { if (!isReviewInteractionActive()) renderOrders(); if (typeof updateHeader === 'function') updateHeader(); });
