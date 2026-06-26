if (typeof updateHeader === 'function') updateHeader();

  function menuLang(en) { return en; }
  function menuCategory(value) { return window.I18N && I18N.localizeCategory ? I18N.localizeCategory(value) : value; }
  function menuBadge(value) { return window.I18N && I18N.localizeBadge ? I18N.localizeBadge(value) : value; }

  function getBrands() {
    return State.getBrandsData ? State.getBrandsData() : BRANDS;
  }

  function getFoods() {
    return (State.getFoodsData ? State.getFoodsData() : FOODS).filter(function (food) {
      return food && food.isActive !== false;
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeMenuUrl(value, fallback) {
    var raw = String(value || '').trim();
    if (!raw || /^(javascript|data):/i.test(raw)) return fallback || '';
    return escapeHtml(raw);
  }

  function inlineMenuArg(value) {
    return escapeHtml(String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/[\r\n]+/g, ' '));
  }

  function safeDomIdPart(value) {
    return escapeHtml(String(value == null ? '' : value).replace(/[^a-zA-Z0-9_-]/g, '-'));
  }

  function normalizeCategoryParam(value) {
    var raw = decodeURIComponent(String(value || '')).replace(/\+/g, ' ').trim().toLowerCase();
    if (!raw) return 'all';
    var normalized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    var aliases = {
      all: 'all',
      'all items': 'all',
      'fast food': 'fast food',
      fastfood: 'fast food',
      burger: 'fast food',
      burgers: 'fast food',
      pizza: 'pizza',
      pizzas: 'pizza',
      drink: 'drinks',
      drinks: 'drinks',
      beverage: 'drinks',
      beverages: 'drinks',
      dessert: 'dessert',
      desserts: 'dessert',
      sweet: 'dessert',
      sweets: 'dessert'
    };
    return aliases[normalized] || 'all';
  }

  function normalizeBrandParam(value) {
    return String(value || '').trim().toLowerCase() || 'all';
  }

  var params = new URLSearchParams(window.location.search);
  var activeBrand = normalizeBrandParam(params.get('brand'));
  var activeCat = normalizeCategoryParam(params.get('cat'));
  var activeSearch = String(params.get('q') || '').trim();
  var activeSort = String(params.get('sort') || 'popular').trim() || 'popular';

  function syncUrl() {
    var url = new URL(window.location.href);
    if (activeBrand !== 'all') url.searchParams.set('brand', activeBrand);
    else url.searchParams.delete('brand');

    if (activeCat !== 'all') url.searchParams.set('cat', activeCat.replace(/\s+/g, '-'));
    else url.searchParams.delete('cat');

    if (activeSearch.trim()) url.searchParams.set('q', activeSearch.trim());
    else url.searchParams.delete('q');

    if (activeSort && activeSort !== 'popular') url.searchParams.set('sort', activeSort);
    else url.searchParams.delete('sort');

    window.history.replaceState(null, '', url.toString());
  }

  function getFilteredFoods() {
    var q = activeSearch.trim().toLowerCase();
    var foods = getFoods().filter(function (food) {
      var brandMatch = activeBrand === 'all' || food.brand === activeBrand;
      var catMatch = activeCat === 'all' || food.cat === activeCat;
      if (!brandMatch || !catMatch) return false;
      if (!q) return true;
      var brand = getBrands().find(function (item) { return item.id === food.brand; }) || {};
      var haystack = [food.name, food.bName, food.cat, food.badge || '', brand.tag || '', brand.special || '', brand.location || '']
        .join(' ')
        .toLowerCase();
      return haystack.indexOf(q) !== -1;
    });

    foods.sort(function (a, b) {
      if (activeSort === 'price-asc') return (a.price || 0) - (b.price || 0);
      if (activeSort === 'price-desc') return (b.price || 0) - (a.price || 0);
      if (activeSort === 'rating') return (b.rating || 0) - (a.rating || 0);
      return (b.popularity || 0) - (a.popularity || 0);
    });

    return foods;
  }

  function getCategoryList() {
    return (CATEGORIES || []).map(function (category) {
      return {
        id: category.id,
        label: category.id === 'all' ? menuLang('All Items') : menuCategory(category.label || category.id),
        img: category.img || ''
      };
    });
  }

  function getGroups(foods) {
    var categories = getCategoryList().filter(function (category) { return category.id !== 'all'; });
    if (activeCat !== 'all') {
      var singleCategory = categories.find(function (category) { return category.id === activeCat; });
      return singleCategory ? [{ category: singleCategory, foods: foods }] : [];
    }
    return categories
      .map(function (category) {
        return {
          category: category,
          foods: foods.filter(function (food) { return food.cat === category.id; })
        };
      })
      .filter(function (group) { return group.foods.length; });
  }

  function renderHeroStats() {
    var brandCount = document.getElementById('hero-brand-count');
    var itemCount = document.getElementById('hero-item-count');
    if (brandCount) brandCount.textContent = String(getBrands().length);
    if (itemCount) itemCount.textContent = String(getFoods().length);
  }

  function renderBrandRow() {
    var el = document.getElementById('menu-brand-row');
    if (!el) return;
    var allCopy = '<button class="menu-brand-chip ' + (activeBrand === 'all' ? 'active' : '') + '" onclick="setBrand(\'all\')">'
      + '<img loading="lazy" decoding="async" src="images/logo.webp" alt="All brands">'
      + '<div class="menu-brand-copy"><strong>' + menuLang('All Brands') + '</strong><span>' + menuLang('Browse everything in one catalog') + '</span></div>'
      + '</button>';

    var chips = getBrands().map(function (brand) {
      return '<button class="menu-brand-chip ' + (activeBrand === brand.id ? 'active' : '') + '" onclick="setBrand(\'' + inlineMenuArg(brand.id) + '\')">'
        + '<img loading="lazy" decoding="async" src="' + safeMenuUrl(brand.logo, 'images/logo.webp') + '" alt="' + escapeHtml(brand.name) + '" onerror="this.src=\'images/logo.webp\'">'
        + '<div class="menu-brand-copy"><strong>' + escapeHtml(brand.name) + '</strong><span>' + escapeHtml(brand.special || brand.tag || menuLang('Student favourite')) + '</span></div>'
        + '</button>';
    }).join('');

    el.innerHTML = allCopy + chips;
  }

  function renderCategoryRail() {
    var el = document.getElementById('menu-category-rail');
    if (!el) return;
    el.innerHTML = getCategoryList().map(function (category) {
      var activeClass = activeCat === category.id ? 'active' : '';
      var click = 'handleCategoryClick(\'' + inlineMenuArg(category.id) + '\')';
      var img = category.img ? '<img loading="lazy" decoding="async" src="' + safeMenuUrl(category.img, '') + '" alt="' + escapeHtml(category.label) + '" onerror="this.style.display=\'none\'">' : '';
      return '<button class="menu-category-pill ' + activeClass + '" onclick="' + click + '">' + img + '<span>' + escapeHtml(category.label) + '</span></button>';
    }).join('');
  }

  function buildMenuCard(food) {
    var id = Number(food.id) || 0;
    var badge = food.badge ? '<div class="menu-item-badge">' + escapeHtml(menuBadge(food.badge)) + '</div>' : '';
    var badgeText = food.badge ? menuLang('Featured item with higher traction and stronger engagement.') : menuLang('Quick view keeps custom size, spice, and add-on options available.');
    var rating = Number.isFinite(Number(food.rating)) ? Number(food.rating) : 4.5;
    var popularity = Math.max(0, Math.min(100, Number(food.popularity) || 0));
    return ''
      + '<article class="menu-item-card">'
      + '  <div class="menu-item-media">'
      + badge
      + '    <img loading="lazy" decoding="async" src="' + safeMenuUrl(food.img, 'images/food-burger.webp') + '" alt="' + escapeHtml(food.name) + '" onerror="this.src=&quot;images/food-burger.webp&quot;">'
      + '  </div>'
      + '  <div class="menu-item-copy">'
      + '    <div class="menu-item-brand"><img loading="lazy" decoding="async" src="' + safeMenuUrl(food.bLogo, '') + '" alt="' + escapeHtml(food.bName) + '" onerror="this.style.display=&quot;none&quot;"> <span>' + escapeHtml(food.bName) + '</span></div>'
      + '    <div class="menu-item-name">' + escapeHtml(food.name) + '</div>'
      + '    <div class="menu-item-note">' + escapeHtml(badgeText) + '</div>'
      + '    <div class="menu-item-details">'
      + '      <span><i class="fas fa-star"></i> ' + rating.toFixed(1) + '</span>'
      + '      <span><i class="fas fa-fire"></i> ' + popularity + '%</span>'
      + '      <span><i class="fas fa-coins"></i> +' + (Number(food.pts) || 0) + ' pts</span>'
      + '    </div>'
      + '  </div>'
      + '  <div class="menu-item-foot">'
      + '    <div class="menu-item-price"><span>' + menuLang('Price') + '</span><strong>RM ' + Number(food.price || 0).toFixed(2) + '</strong></div>'
      + '    <div class="menu-item-actions">'
      + '      <button class="menu-icon-btn" type="button" onclick="openQV(' + id + ')" aria-label="Quick view"><i class="fas fa-eye"></i></button>'
      + '      <div class="menu-card-qty" aria-label="Quantity selector">'
      + '        <button type="button" onclick="changeMenuCardQty(' + id + ', -1)" aria-label="Decrease quantity">−</button>'
      + '        <input type="number" id="menu_qty_' + id + '" min="1" max="99" value="1" aria-label="Quantity for ' + escapeHtml(food.name) + '">'
      + '        <button type="button" onclick="changeMenuCardQty(' + id + ', 1)" aria-label="Increase quantity">+</button>'
      + '      </div>'
      + '      <button class="menu-add-btn menu-add-btn-detail" type="button" onclick="menuAddFromCard(' + id + ')" aria-label="Add to cart"><i class="fas fa-cart-plus"></i> ' + menuLang('Add') + '</button>'
      + '    </div>'
      + '  </div>'
      + '</article>';
  }

  function getMenuFoodById(foodId) {
    var id = Number(foodId) || 0;
    return getFoods().find(function (food) { return Number(food.id) === id; });
  }

  function getMenuCardQty(foodId) {
    var input = document.getElementById('menu_qty_' + (Number(foodId) || 0));
    var qty = input ? parseInt(input.value, 10) : 1;
    qty = Math.max(1, Math.min(99, qty || 1));
    if (input) input.value = String(qty);
    return qty;
  }

  function changeMenuCardQty(foodId, delta) {
    var input = document.getElementById('menu_qty_' + (Number(foodId) || 0));
    if (!input) return;
    var current = parseInt(input.value, 10) || 1;
    input.value = String(Math.max(1, Math.min(99, current + Number(delta || 0))));
  }

  function menuAddFromCard(foodId) {
    var food = getMenuFoodById(foodId);
    if (!food || food.isActive === false) {
      if (window.State && typeof State.notify === 'function') State.notify(menuLang('⚠️ This item is temporarily unavailable.'));
      return;
    }
    var qty = getMenuCardQty(foodId);
    if (!window.State || !State.isLoggedIn || !State.isLoggedIn()) {
      if (typeof window.SGFQueueCartIntent === 'function') window.SGFQueueCartIntent(food.id, qty, null, 'menu#catalog-start');
      else { try { sessionStorage.setItem('sgf_next_after_login', 'menu#catalog-start'); } catch (err) {} }
      if (window.State && typeof State.notify === 'function') State.notify(menuLang('Please log in or register first. We will keep this item ready for your cart.'));
      setTimeout(function () { window.location.href = './?notice=login'; }, 450);
      return;
    }
    if (window.State && typeof State.addToCart === 'function') {
      State.addToCart(food, qty);
      if (typeof updateHeader === 'function') updateHeader();
      if (typeof State.notify === 'function') State.notify(menuLang('✅ ' + food.name + ' ×' + qty + ' added to cart!'));
    }
  }

  window.staticAddToCart = function staticAddToCart(foodId) { menuAddFromCard(foodId); };

  function getMenuCategoryDescription(categoryId) {
    var descriptions = {
      'fast food': 'Burgers, fried chicken, fries, and quick sides for everyday student meals.',
      pizza: 'Shareable pizzas and classic slices built for group orders and late-night study fuel.',
      drinks: 'Coffee, tea, soft drinks, and bottled water to complete the order.',
      dessert: 'Cold sweets and snackable desserts for a simple finish after meals.',
    };
    return descriptions[categoryId] || 'Freshly grouped menu cards with live prices, ratings, customisation, and add-to-cart controls.';
  }

  function renderCatalogSections() {
    var target = document.getElementById('pdf-menu-sections');
    if (!target) return;
    var foods = getFilteredFoods();
    var groups = getGroups(foods);

    if (!foods.length || !groups.length) {
      target.innerHTML = '<div class="menu-empty-state">'
        + '<strong>' + menuLang('No dishes matched your current filters.') + '</strong><br>'
        + menuLang('Try another keyword, switch brand, or reset the category rail to see the full menu again.')
        + '</div>';
      updateSummary(0, 0);
      return;
    }

    target.innerHTML = groups.map(function (group) {
      var categoryId = group.category.id;
      var title = group.category.label;
      var description = getMenuCategoryDescription(categoryId);
      return ''
        + '<section class="menu-catalog-section" id="section-' + safeDomIdPart(categoryId) + '">'
        + '  <div class="menu-catalog-head">'
        + '    <div>'
        + '      <h2>' + escapeHtml(title) + '</h2>'
        + '      <p>' + escapeHtml(menuLang(description)) + '</p>'
        + '    </div>'
        + '    <div class="menu-catalog-count"><i class="fas fa-layer-group"></i> ' + group.foods.length + ' ' + menuLang(group.foods.length === 1 ? 'item' : 'items') + '</div>'
        + '  </div>'
        + '  <div class="menu-card-grid">' + group.foods.map(buildMenuCard).join('') + '</div>'
        + '</section>';
    }).join('');

    updateSummary(foods.length, groups.length);
  }

  function updateSummary(count, groups) {
    var searchResult = document.getElementById('menu-search-result');
    var activeContext = document.getElementById('menu-active-context');
    if (searchResult) {
      searchResult.innerHTML = menuLang('Showing') + ' <strong>' + count + '</strong> ' + menuLang(count === 1 ? 'item' : 'items')
        + (activeSearch.trim() ? ' ' + menuLang('for') + ' <strong>"' + escapeHtml(activeSearch.trim()) + '"</strong>' : '')
        + '. ' + menuLang('Displayed across') + ' <strong>' + groups + '</strong> ' + menuLang(groups === 1 ? 'section' : 'sections') + '.';
    }

    if (!activeContext) return;
    var filters = [];
    if (activeBrand !== 'all') {
      var brand = getBrands().find(function (item) { return item.id === activeBrand; });
      filters.push(menuLang('Brand') + ': <strong>' + escapeHtml(brand ? brand.name : activeBrand) + '</strong>');
    }
    if (activeCat !== 'all') {
      var category = getCategoryList().find(function (item) { return item.id === activeCat; });
      filters.push(menuLang('Category') + ': <strong>' + escapeHtml(category ? category.label : activeCat) + '</strong>');
    }
    if (activeSearch.trim()) {
      filters.push(menuLang('Search') + ': <strong>"' + escapeHtml(activeSearch.trim()) + '"</strong>');
    }
    if (activeSort !== 'popular') {
      var sortLabels = {
        'rating': menuLang('Highest rating'),
        'price-asc': menuLang('Lowest price'),
        'price-desc': menuLang('Highest price')
      };
      filters.push(menuLang('Sort') + ': <strong>' + escapeHtml(sortLabels[activeSort] || activeSort) + '</strong>');
    }

    if (!filters.length) {
      activeContext.style.display = 'none';
      activeContext.innerHTML = '';
      return;
    }

    activeContext.style.display = 'block';
    activeContext.innerHTML = filters.join(' &nbsp;·&nbsp; ');
  }

  function setBrand(id) {
    activeBrand = normalizeBrandParam(id);
    renderAll();
  }

  function setCat(id) {
    activeCat = normalizeCategoryParam(id);
    renderAll();
  }

  function handleCategoryClick(id) {
    setCat(id);
    if (id === 'all') {
      window.scrollTo({ top: Math.max(0, document.getElementById('catalog-start').offsetTop - 130), behavior: 'smooth' });
      return;
    }
    setTimeout(function () {
      var section = document.getElementById('section-' + normalizeCategoryParam(id).replace(/\s+/g, '-'));
      if (!section) return;
      window.scrollTo({ top: Math.max(0, section.offsetTop - 128), behavior: 'smooth' });
    }, 50);
  }

  function setSearch(value) {
    activeSearch = String(value || '');
    renderAll();
  }

  function setMenuSort(value) {
    activeSort = String(value || 'popular') || 'popular';
    renderAll();
  }

  function resetMenuFilters() {
    activeBrand = 'all';
    activeCat = 'all';
    activeSearch = '';
    activeSort = 'popular';
    var searchInput = document.getElementById('menu-search');
    var sortInput = document.getElementById('menu-sort');
    if (searchInput) searchInput.value = '';
    if (sortInput) sortInput.value = 'popular';
    renderAll();
  }

  function hydrateControls() {
    var searchInput = document.getElementById('menu-search');
    var sortInput = document.getElementById('menu-sort');
    if (searchInput) searchInput.value = activeSearch;
    if (sortInput) sortInput.value = activeSort;
  }

  function renderAll() {
    renderHeroStats();
    renderBrandRow();
    renderCategoryRail();
    renderCatalogSections();
    hydrateControls();
    syncUrl();
  }

  renderAll();

  window.addEventListener('sgf:langchange', function () {
    renderAll();
  });
