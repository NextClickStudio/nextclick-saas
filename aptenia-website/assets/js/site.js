/* ==========================================================================
   Aptenia — progetti generati da projects.js, menu, comparse leggere
   ========================================================================== */
(() => {
  'use strict';

  const PROJECTS = window.APTENIA_PROJECTS || [];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const link = (p) => `progetto.html?p=${encodeURIComponent(p.slug)}`;
  const meta = (p) => [p.category, p.location, p.year].filter(Boolean).map(esc).join(' — ');

  /* ---------- Menu mobile ---------- */
  const burger = $('.header__burger');
  if (burger) {
    burger.addEventListener('click', () => {
      const open = document.documentElement.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Elenco progetti: foto della stessa dimensione + descrizione ---------- */
  $$('[data-works]').forEach((list) => {
    list.innerHTML = PROJECTS.map((p) => `
      <article class="work">
        <a class="work__img" href="${link(p)}" tabindex="-1" aria-hidden="true">
          <img src="${esc(p.cover.src)}" alt="" loading="lazy" decoding="async">
        </a>
        <div class="work__text">
          <p class="label muted">${meta(p)}</p>
          <h3 class="work__title"><a href="${link(p)}">${esc(p.title)}</a></h3>
          ${p.subtitle ? `<p class="work__sub">${esc(p.subtitle)}</p>` : ''}
          ${p.text && p.text[0] ? `<p class="work__desc">${esc(p.text[0])}</p>` : ''}
          <a class="more" href="${link(p)}">Scopri il progetto <span aria-hidden="true">→</span></a>
        </div>
      </article>`).join('');
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

    const rows = [
      ['Luogo', esc(p.location)], ['Tipologia', esc(p.category)], ['Anno', esc(p.year)],
      ['Servizi', (p.services || []).map(esc).join('<br>')]
    ].filter(([, v]) => v);

    const fig = (im) => `<figure><img src="${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy" decoding="async"></figure>`;
    const imgs = p.images || [];
    let gallery = '';
    for (let k = 0; k < imgs.length; k++) {
      const a = imgs[k];
      const b = imgs[k + 1];
      if (a.size === 'half' && b && b.size === 'half') { gallery += `<div class="gallery__pair reveal">${fig(a)}${fig(b)}</div>`; k++; }
      else if (a.size === 'half') gallery += `<div class="gallery__single reveal">${fig(a)}</div>`;
      else gallery += `<div class="gallery__full reveal">${fig(a)}</div>`;
    }

    page.innerHTML = `
      <div class="project__head">
        <p class="label muted">${meta(p)}</p>
        <h1 class="project__title">${esc(p.title)}</h1>
        ${p.subtitle ? `<p class="project__sub">${esc(p.subtitle)}</p>` : ''}
      </div>
      <div class="project__body">
        <dl class="project__meta">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <div class="project__text">${(p.text || []).map((t) => `<p>${esc(t)}</p>`).join('')}</div>
      </div>
      <div class="gallery">${gallery}</div>
      <nav class="project__nav" aria-label="Altri progetti">
        ${n > 1 ? `<a href="${link(prev)}">← ${esc(prev.title)}</a>` : '<span></span>'}
        <a href="progetti.html">Tutti i progetti</a>
        ${n > 1 ? `<a href="${link(next)}">${esc(next.title)} →</a>` : '<span></span>'}
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
