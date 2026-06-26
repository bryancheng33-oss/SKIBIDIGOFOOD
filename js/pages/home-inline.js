(function () {
  'use strict';
  if (typeof requireAuth === 'function' && requireAuth() === false) return;

/* ── LOADER ─────────────────────────────────────────────── */
  window.addEventListener('load', () => {
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) loader.classList.add('hidden');
    }, 950);
  });

  /* Shared header/mobile/profile behaviour is handled by js/header.js */

  /* ── NOTIFICATION ──────────────────────────────────────── */
  function showNotif(msg) {
    const n = document.getElementById('notif');
    n.textContent = msg; n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 3200);
  }

  /* ── HERO IMAGE ROTATOR ────────────────────────────────── */
  const heroImgs = ['images/hero-chicken.webp','images/hero-burger.webp','images/hero-pizza.webp'];
  let heroIdx = 0;
  setInterval(() => {
    heroIdx = (heroIdx + 1) % heroImgs.length;
    const img = document.getElementById('hero-img');
    if (img) { img.style.opacity = 0; setTimeout(() => { img.src = heroImgs[heroIdx]; img.style.opacity = 1; }, 300); }
  }, 3500);

  /* ── SCROLL FADE-IN ────────────────────────────────────── */
  const fadeEls = document.querySelectorAll('.fade-up');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });
  fadeEls.forEach(el => obs.observe(el));

  /* ── AUTH GUARD (graceful) ──────────────────────────────── */
  if (typeof updateHeader === 'function') updateHeader();
})();
