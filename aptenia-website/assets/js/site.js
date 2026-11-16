/* ==========================================================================
   Aptenia — progetti generati da projects.js, filtri, accordion, comparse
   ========================================================================== */
(() => {
  'use strict';

  const PROJECTS = window.APTENIA_PROJECTS || [];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arrow = '<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M5 13h8V5"/></svg>';
  const link = (p) => `progetto.html?p=${encodeURIComponent(p.slug)}`;

  /* ---------- Menu mobile ---------- */
  const burger = $('.header__burger');
  if (burger) {
    burger.addEventListener('click', () => {
      const open = document.documentElement.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Griglia progetti (home e archivio) ---------- */
  function card(p) {
    return `
      <article class="work" data-cat="${esc(p.category)}">
        <a href="${link(p)}">
          <figure class="work__img"><img src="${esc(p.cover.src)}" alt="${esc(p.cover.alt)}" loading="lazy" decoding="async"></figure>
          <div class="work__info">
            <h3 class="work__title">${esc(p.title)}</h3>
            ${arrow}
          </div>
          <p class="work__meta">${[p.category, p.location, p.year].filter(Boolean).map(esc).join(' — ')}</p>
        </a>
      </article>`;
  }

  $$('[data-works]').forEach((grid) => {
    const limit = Number(grid.dataset.works) || PROJECTS.length;
    grid.innerHTML = PROJECTS.slice(0, limit).map(card).join('');
  });

  $$('[data-filters]').forEach((bar) => {
    const grid = $(bar.dataset.filters);
    const cats = [...new Set(PROJECTS.map((p) => p.category).filter(Boolean))];
    if (cats.length < 2) { bar.remove(); return; }
    bar.innerHTML = ['Tutti', ...cats].map((c, i) =>
      `<button type="button" class="${i ? '' : 'is-active'}" data-cat="${i ? esc(c) : '*'}">${esc(c)}</button>`).join('');
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      $$('button', bar).forEach((b) => b.classList.toggle('is-active', b === btn));
      $$('.work', grid).forEach((w) => { w.hidden = !(btn.dataset.cat === '*' || w.dataset.cat === btn.dataset.cat); });
    });
  });

  /* ---------- Pagina progetto ---------- */
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

    const meta = [
      ['Luogo', p.location], ['Tipologia', p.category], ['Anno', p.year],
      ['Superficie', p.area], ['Servizi', (p.services || []).join('<br>')]
    ].filter(([, v]) => v);

    let gallery = '';
    const imgs = p.images || [];
    for (let k = 0; k < imgs.length; k++) {
      const a = imgs[k];
      const b = imgs[k + 1];
      const fig = (im) => `<figure><img src="${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy" decoding="async"></figure>`;
      if (a.size === 'half' && b && b.size === 'half') { gallery += `<div class="gallery__pair reveal">${fig(a)}${fig(b)}</div>`; k++; }
      else gallery += `<div class="gallery__full reveal">${fig(a)}</div>`;
    }

    page.innerHTML = `
      <div class="project__head">
        <h1 class="project__title">${esc(p.title)}</h1>
        <p class="project__tag">${[p.category, p.year].filter(Boolean).map(esc).join('<br>')}</p>
        <a class="project__next" href="${link(next)}">Successivo</a>
      </div>
      <figure class="project__cover"><img src="${esc(p.cover.src)}" alt="${esc(p.cover.alt)}" decoding="async"></figure>
      <div class="project__body">
        <dl class="project__meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${k === 'Servizi' ? v : esc(v)}</dd></div>`).join('')}</dl>
        <div class="project__text">
          ${p.intro ? `<p class="project__intro">${esc(p.intro)}</p>` : ''}
          ${(p.text || []).map((t) => `<p>${esc(t)}</p>`).join('')}
        </div>
      </div>
      <div class="gallery">${gallery}</div>
      <nav class="project__nav" aria-label="Altri progetti">
        <a href="${link(prev)}">← Precedente</a>
        <a href="progetti.html">Tutti i progetti</a>
        <a href="${link(next)}">Successivo →</a>
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
