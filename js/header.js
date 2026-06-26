// ============================================================
//  header.js — Dynamic header: counts, nav highlight, responsive mobile drawer
// ============================================================

var SGF_THEME_KEY = 'sgf_theme';

function applySiteAppearance() {
  document.documentElement.removeAttribute('data-theme');
  if (document.body) document.body.removeAttribute('data-theme');
  try { localStorage.removeItem(SGF_THEME_KEY); } catch (err) {}
}

window.toggleTheme = function () {
  applySiteAppearance();
  return 'light-only';
};

function escapeHeaderHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNavbarLinksMarkup() {
  var navbar = document.getElementById('navbar');
  if (!navbar) return '';

  return Array.prototype.slice.call(navbar.querySelectorAll('a')).map(function (link) {
    var href = link.getAttribute('href') || '#';
    var text = link.textContent || '';
    var className = link.classList.contains('active') ? ' class="active"' : '';
    return '<a href="' + escapeHeaderHtml(href) + '"' + className + '>' + escapeHeaderHtml(text) + '</a>';
  }).join('');
}


function isCompactHeaderLayout() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
}

function formatCompactHeaderNumber(value, decimals) {
  var number = Number(value) || 0;
  var abs = Math.abs(number);
  var units = [
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' }
  ];

  if (!isCompactHeaderLayout() || abs < 100000) {
    return number.toFixed(decimals || 0);
  }

  for (var i = 0; i < units.length; i += 1) {
    if (abs >= units[i].value) {
      var shortValue = number / units[i].value;
      var fixed = Math.abs(shortValue) >= 10 ? shortValue.toFixed(1) : shortValue.toFixed(2);
      return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0$/, '$1') + units[i].suffix;
    }
  }

  return number.toFixed(decimals || 0);
}

function formatHeaderWallet(value) {
  if (isCompactHeaderLayout()) return formatCompactHeaderNumber(value, 2);
  return Number(value || 0).toFixed(2);
}

function formatHeaderPoints(value) {
  if (isCompactHeaderLayout()) return formatCompactHeaderNumber(value, 0);
  return value || 0;
}

function buildMobileMenuMarkup() {
  return ''
    + '<button class="mobile-close" type="button" aria-label="Close menu"><i class="fas fa-times" aria-hidden="true"></i></button>'
    + '<div class="mobile-menu-title">Menu</div>'
    + '<div class="mobile-menu-links">' + getNavbarLinksMarkup() + '</div>';
}

function setMenuButtonState(isOpen) {
  var menuBtn = document.getElementById('menu-btn');
  if (!menuBtn) return;
  menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  menuBtn.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
}

function ensureMobileMenu() {
  var navbar = document.getElementById('navbar');
  var panel = document.getElementById('mobile-menu');
  if (!navbar && panel) return panel;
  if (!navbar) return null;

  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'mobile-menu';
    panel.id = 'mobile-menu';
    document.body.appendChild(panel);
  }

  panel.setAttribute('aria-hidden', panel.classList.contains('open') ? 'false' : 'true');
  panel.inert = !panel.classList.contains('open');
  panel.innerHTML = buildMobileMenuMarkup();

  var closeBtn = panel.querySelector('.mobile-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeMobile();
    });
  }

  panel.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () { closeMobile(); });
  });

  return panel;
}

window.openMobile = function () {
  var panel = ensureMobileMenu();
  if (panel) {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    panel.inert = false;
  }
  if (document.body) document.body.classList.add('mobile-nav-open');
  var navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.add('active');
  setMenuButtonState(true);
};

window.closeMobile = function () {
  var panel = document.getElementById('mobile-menu');
  if (panel) {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
  }
  if (document.body) document.body.classList.remove('mobile-nav-open');
  var navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.remove('active');
  setMenuButtonState(false);
};

window.toggleMobile = function () {
  var panel = ensureMobileMenu();
  if (panel && panel.classList.contains('open')) closeMobile();
  else openMobile();
};

window.toggleProfile = function () {
  var profileDd = document.getElementById('profileDrop');
  if (!profileDd) return;
  profileDd.classList.toggle('active');
  profileDd.classList.toggle('open');
};

/** Refresh wallet, points, cart count in header */
function updateHeader() {
  var u = window.State && State.getUser && State.getUser();
  var el = function (id) { return document.getElementById(id); };

  var walletValue = u && typeof u.wallet === 'number' ? u.wallet : 0;
  var pointsValue = u && typeof u.points === 'number' ? u.points : 0;
  var cartCount = window.State && State.getCartCount ? State.getCartCount() : 0;

  var wEl = el('navWallet'); if (wEl) wEl.textContent = formatHeaderWallet(walletValue);
  var pEl = el('navPts');    if (pEl) pEl.textContent = formatHeaderPoints(pointsValue);
  var cEl = el('navCart');   if (cEl) cEl.textContent = '(' + cartCount + ')';
  bindRewardsPointsNavigation();

  var displayNameRaw = ((u && (u.firstName || u.name)) || 'Guest');
  var username = ((u && u.username) || 'guest');

  var nEl = el('profileName');
  if (nEl) nEl.textContent = displayNameRaw;

  var hEl = el('profileHandle');
  if (hEl) hEl.textContent = '@' + username;

  var pwEl = el('profileWallet');
  if (pwEl) pwEl.textContent = Number(walletValue).toFixed(2);

  var ppEl = el('profilePoints');
  if (ppEl) ppEl.textContent = pointsValue || 0;

  var avatarEl = el('profileAvatar');
  if (avatarEl) {
    var initialsSource = String(displayNameRaw || 'G').trim().split(/\s+/).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join('');
    avatarEl.textContent = initialsSource || 'G';
  }
}

function normalizePageName(value) {
  var page = String(value || '').trim();
  if (!page || page === '.' || page === './') return 'home';
  page = page.split('/').pop() || page;
  page = page.replace(/\.html?$/i, '');
  if (page === 'index') return 'index';
  return page || 'home';
}

function parseNavHref(href) {
  var value = String(href || '').trim();
  if (!value || value === '#') return { page: '', hash: '' };
  var hashIndex = value.indexOf('#');
  var hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
  var page = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  return { page: normalizePageName(page || 'home'), hash: hash };
}


function bindRewardsPointsNavigation() {
  var points = document.getElementById('navPts');
  if (!points) return;
  var pill = points.closest ? points.closest('.nav-pill') : null;
  if (!pill || pill.dataset.rewardsNavBound === '1') return;

  pill.dataset.rewardsNavBound = '1';
  pill.dataset.destination = 'rewards';
  pill.setAttribute('role', 'link');
  pill.setAttribute('tabindex', '0');
  pill.setAttribute('aria-label', 'Open Rewards page to redeem loyalty points');
  pill.setAttribute('title', 'Open Rewards');

  var goRewards = function () {
    try { sessionStorage.setItem('sgf_last_nav_intent', 'points-pill-to-rewards'); } catch (err) {}
    window.location.href = 'rewards';
  };

  pill.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    goRewards();
  });
  pill.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goRewards();
    }
  });
}

function setActiveNavLink() {
  var page = normalizePageName(window.location.pathname.split('/').pop() || 'home');
  var hash = window.location.hash || '';
  var links = Array.prototype.slice.call(document.querySelectorAll('.navbar a, .mobile-menu a'));

  links.forEach(function (a) { a.classList.remove('active'); });

  var exactSectionMatch = links.find(function (a) {
    var parsed = parseNavHref(a.getAttribute('href') || '');
    return parsed.page === page && parsed.hash && parsed.hash === hash;
  });

  links.forEach(function (a) {
    var parsed = parseNavHref(a.getAttribute('href') || '');
    if (parsed.page !== page) return;
    if (exactSectionMatch) {
      if (parsed.hash && parsed.hash === hash) a.classList.add('active');
      return;
    }
    if (!parsed.hash) a.classList.add('active');
  });
}

function initNavToggles() {
  ensureMobileMenu();
  setActiveNavLink();

  var menuBtn = document.getElementById('menu-btn');
  if (menuBtn) {
    menuBtn.setAttribute('role', 'button');
    menuBtn.setAttribute('tabindex', '0');
    menuBtn.setAttribute('aria-controls', 'mobile-menu');
    setMenuButtonState(false);
    menuBtn.onclick = function (event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      toggleMobile();
    };
    menuBtn.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMobile();
      }
    });
  }

  document.addEventListener('click', function (event) {
    var userBtn = document.getElementById('user-btn');
    var profileDd = document.getElementById('profileDrop');
    var mobileMenu = document.getElementById('mobile-menu');
    var menuButton = document.getElementById('menu-btn');

    if (profileDd && event.target !== userBtn && !profileDd.contains(event.target)) {
      profileDd.classList.remove('active');
      profileDd.classList.remove('open');
    }

    if (mobileMenu && mobileMenu.classList.contains('open')) {
      var clickedInsideMenu = mobileMenu.contains(event.target);
      var clickedMenuBtn = menuButton && (event.target === menuButton || menuButton.contains(event.target));
      if (!clickedInsideMenu && !clickedMenuBtn) closeMobile();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMobile();
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) closeMobile();
  });
}


function syncFixedUserTopbarSpacing() {
  var header = document.querySelector('.header.user-topbar');
  if (!document.body) return;
  if (!header) {
    document.body.classList.remove('has-fixed-user-topbar');
    return;
  }
  document.body.classList.add('has-fixed-user-topbar');
  var height = Math.ceil(header.getBoundingClientRect().height || header.offsetHeight || 68);
  if (height < 56) height = 68;
  document.documentElement.style.setProperty('--sgf-user-nav-space', height + 'px');
}

function hideLoader() {
  var loader = document.getElementById('loader');
  if (!loader) return;
  setTimeout(function () {
    loader.style.opacity = '0';
    setTimeout(function () { loader.style.display = 'none'; }, 400);
  }, 900);
}

document.addEventListener('DOMContentLoaded', function () {
  applySiteAppearance();
  syncFixedUserTopbarSpacing();
  updateHeader();
  initNavToggles();
  hideLoader();
});

window.addEventListener('hashchange', setActiveNavLink);

window.addEventListener('resize', function () {
  syncFixedUserTopbarSpacing();
  updateHeader();
});

window.addEventListener('storage', function (event) {
  if (event && event.key === SGF_THEME_KEY) applySiteAppearance();
  updateHeader();
});

window.addEventListener('load', syncFixedUserTopbarSpacing);
window.addEventListener('orientationchange', syncFixedUserTopbarSpacing);


document.addEventListener('DOMContentLoaded', function () {
  bindRewardsPointsNavigation();
});
