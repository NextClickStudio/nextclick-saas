/* ==========================================================================
   Aptenia — progetti generati da projects.js, menu, accordion, comparse
   ========================================================================== */
(() => {
  'use strict';

  const PROJECTS = window.APTENIA_PROJECTS || [];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const link = (p) => `progetto.html?p=${encodeURIComponent(p.slug)}`;
  const meta = (p) => [p.category, p.location, p.year].filter(Boolean).map(esc).join(' — ');
  const arrow = '<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M6 13h7V6"/></svg>';

  /* ---------- Menu mobile ---------- */
  const burger = $('.header__burger');
  if (burger) {
    burger.addEventListener('click', () => {
      const open = document.documentElement.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Griglia progetti (come "Latest works"): stessa dimensione, descrizione ---------- */
  $$('[data-works]').forEach((grid) => {
    grid.innerHTML = PROJECTS.map((p) => `
      <article class="work">
        <a href="${link(p)}">
          <figure class="work__img"><img src="${esc(p.cover.src)}" alt="${esc(p.cover.alt)}" loading="lazy" decoding="async"></figure>
          <div class="work__bar"><h3 class="work__title">${esc(p.title)}</h3>${arrow}</div>
        </a>
        <p class="work__meta">${meta(p)}</p>
        ${p.excerpt ? `<p class="work__desc">${esc(p.excerpt)}</p>` : ''}
      </article>`).join('');
  });

  /* ---------- Pagina progetto (come "#ND1H") ---------- */
  const page = $('[data-project]');
  if (page) {
    const slug = new URLSearchParams(location.search).get('p');
    let i = PROJECTS.findIndex((p) => p.slug === slug);
    if (i < 0) i = 0;
    const p = PROJECTS[i];
    const n = PROJECTS.length;
    const prev = PROJECTS[(i - 1 + n) % n];
    const next = PROJECTS[(i + 1) % n];
    document.title = `${p.title} — Aptenia`;

    const rows = [
      ['Luogo', esc(p.location)], ['Tipologia', esc(p.category)], ['Anno', esc(p.year)],
      ['Servizi', (p.services || []).map(esc).join('<br>')]
    ].filter(([, v]) => v);

    const fig = (im) => `<figure><img src="${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy" decoding="async"></figure>`;
    const imgs = p.images || [];
    let gallery = '';
    let side = 0;
    for (let k = 0; k < imgs.length; k++) {
      const a = imgs[k];
      const b = imgs[k + 1];
      if (a.size === 'half' && b && b.size === 'half') { gallery += `<div class="g-pair reveal">${fig(a)}${fig(b)}</div>`; k++; }
      else if (a.size === 'half') { gallery += `<div class="g-single g-single--${side++ % 2 ? 'left' : 'right'} reveal">${fig(a)}</div>`; }
      else gallery += `<div class="g-full reveal">${fig(a)}</div>`;
    }
    const wide = p.cover;

    page.innerHTML = `
      <div class="project__head">
        <h1 class="project__title">${esc(p.title)}</h1>
      </div>
      <figure class="project__cover"><img src="${esc(wide.src)}" alt="${esc(wide.alt)}" decoding="async" fetchpriority="high"></figure>
      <div class="project__body">
        <dl class="project__meta">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <div class="project__text">
          ${p.subtitle ? `<p class="project__sub">${esc(p.subtitle)}</p>` : ''}
          ${(p.text || []).map((t) => `<p>${esc(t)}</p>`).join('')}
        </div>
      </div>
      <div class="gallery">${gallery}</div>
      <nav class="project__nav" aria-label="Altri progetti">
        ${n > 1 ? `<a href="${link(prev)}">Precedente</a>` : '<span></span>'}
        <a href="progetti.html">Tutti i progetti</a>
        ${n > 1 ? `<a href="${link(next)}">Successivo</a>` : '<span></span>'}
      </nav>`;
  }

  /* ---------- Accordion (metodo) ---------- */
  $$('.acc__head').forEach((head) => {
    head.addEventListener('click', () => {
      const item = head.parentElement;
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      head.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Comparsa leggera al passaggio ---------- */
  const items = $$('.reveal, .work');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('has-reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
  }
})();
