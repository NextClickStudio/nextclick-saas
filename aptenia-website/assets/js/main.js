/* ==========================================================================
   Aptenia — routing, transizioni e animazioni
   ========================================================================== */
(() => {
  'use strict';

  const PROJECTS = window.APTENIA_PROJECTS || [];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const root = document.documentElement;
  const view = $('#main');
  const header = $('.header');
  const useHash = location.protocol === 'file:';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const G = window.gsap;
  const anim = !!(G && window.ScrollTrigger && window.SplitText) && !reduced;
  const SECTIONS = ['studio', 'metodo', 'approccio', 'contatti'];
  const BASE_TITLE = 'Aptenia — Hospitality Identity Design';

  if (G && window.ScrollTrigger) G.registerPlugin(ScrollTrigger, SplitText);
  root.classList.toggle('is-anim', anim);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- Utilità ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rich = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
  const arrowSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M8 18h10V8"/></svg>';

  const logoMarkup = $('#tpl-logo').innerHTML.trim();
  const injectLogos = (scope) => $$('[data-logo]', scope).forEach((el) => { if (!el.firstElementChild) el.innerHTML = logoMarkup; });

  /* ==========================================================================
     Smooth scroll
     ========================================================================== */
  let lenis = null;
  if (anim && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  const stopScroll = () => lenis && lenis.stop();
  const startScroll = () => lenis && lenis.start();

  function scrollToTarget(target, immediate) {
    let el = target;
    if (typeof target === 'string') el = target === 'top' ? 0 : document.getElementById(target);
    if (el == null) return;
    // le sezioni bloccate (pin) vanno raggiunte tramite il loro contenitore
    if (el !== 0 && el.parentElement && el.parentElement.classList.contains('pin-spacer')) el = el.parentElement;
    if (lenis) {
      lenis.scrollTo(el, { immediate, force: true, duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    } else if (el === 0) {
      window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' });
    } else {
      el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' });
    }
  }

  /* ==========================================================================
     Header: colore in base alla sezione + nascondi scorrendo verso il basso
     ========================================================================== */
  const setTone = (theme) => header.classList.toggle('on-dark', theme === 'dark');
  let lastY = 0;
  let menuOpen = false;
  function onScroll(y) {
    if (Math.abs(y - lastY) < 4) return;
    header.classList.toggle('is-hidden', y > lastY && y > 160 && !menuOpen);
    lastY = y;
  }
  if (lenis) lenis.on('scroll', (e) => onScroll(e.scroll));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

  /* ==========================================================================
     Menu mobile
     ========================================================================== */
  const menu = $('.menu');
  const burger = $('.header__burger');
  function openMenu() {
    menuOpen = true;
    root.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Chiudi il menu');
    menu.setAttribute('aria-hidden', 'false');
    stopScroll();
    if (anim) {
      G.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' });
      G.fromTo($$('.menu__link span', menu), { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06, delay: 0.3 });
      G.fromTo('.menu__foot', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 0.6 });
    }
  }
  function closeMenu(instant) {
    if (!menuOpen) return;
    menuOpen = false;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Apri il menu');
    menu.setAttribute('aria-hidden', 'true');
    startScroll();
    if (anim && !instant) {
      G.to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.8, ease: 'expo.inOut', onComplete: () => root.classList.remove('menu-open') });
    } else {
      root.classList.remove('menu-open');
      if (anim) G.set(menu, { clearProps: 'clipPath' });
    }
  }
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  /* ==========================================================================
     Cursore
     ========================================================================== */
  function initCursor() {
    if (!finePointer || reduced) return;
    root.classList.add('has-cursor', 'is-cursor-out');
    const dot = $('.cursor-dot');
    const label = $('.cursor-label');
    const labelText = $('span', label);
    const tgt = { x: innerWidth / 2, y: innerHeight / 2 };
    const d = { ...tgt };
    const l = { ...tgt };
    window.addEventListener('pointermove', (e) => {
      tgt.x = e.clientX; tgt.y = e.clientY;
      root.classList.remove('is-cursor-out');
    }, { passive: true });
    document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) root.classList.add('is-cursor-out'); });
    const tick = () => {
      d.x += (tgt.x - d.x) * 0.38; d.y += (tgt.y - d.y) * 0.38;
      l.x += (tgt.x - l.x) * 0.16; l.y += (tgt.y - l.y) * 0.16;
      dot.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;
      label.style.transform = `translate3d(${l.x}px, ${l.y}px, 0)`;
    };
    if (G) G.ticker.add(tick); else (function loop() { tick(); requestAnimationFrame(loop); })();
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-cursor], a, button');
      const text = el && el.dataset.cursor;
      root.classList.toggle('is-cursor-label', !!text);
      root.classList.toggle('is-cursor-link', !!el && !text);
      if (text) labelText.textContent = text;
    });
  }

  /* ==========================================================================
     Routing
     ========================================================================== */
  function currentPath() {
    let p = useHash ? location.hash.replace(/^#/, '') : location.pathname;
    p = '/' + p.replace(/^\/+|\/+$/g, '');
    return p === '/index.html' ? '/' : p;
  }
  function resolve(path) {
    const seg = path.split('/').filter(Boolean);
    if (!seg.length) return { name: 'home', path: '/' };
    if (seg.length === 1 && SECTIONS.includes(seg[0])) return { name: 'home', path: '/', section: seg[0] };
    if (seg[0] === 'progetti' && seg.length === 1) return { name: 'index', path: '/progetti' };
    if (seg[0] === 'progetti' && seg.length === 2) {
      const i = PROJECTS.findIndex((p) => p.slug === seg[1]);
      if (i > -1) return { name: 'project', index: i, path: '/progetti/' + seg[1] };
    }
    return { name: '404', path };
  }
  const toHref = (path) => (useHash ? '#' + path : path);

  function wireLinks(scope) {
    $$('a[data-link]', scope).forEach((a) => {
      if (!a.dataset.path) a.dataset.path = a.getAttribute('href');
      a.setAttribute('href', toHref(a.dataset.path));
    });
  }

  let current = null;
  let busy = false;
  let lastHashPath = null;
  const scrollMemory = {};

  document.addEventListener('click', (e) => {
    const top = e.target.closest('[data-top]');
    if (top) { e.preventDefault(); scrollToTarget('top'); return; }
    if (e.target.closest('.skip')) { e.preventDefault(); view.focus({ preventScroll: true }); scrollToTarget(view.firstElementChild); return; }
    const a = e.target.closest('a[data-link]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    closeMenu(true);
    go(a.dataset.path);
  });

  window.addEventListener(useHash ? 'hashchange' : 'popstate', () => {
    const p = currentPath();
    if (useHash && p === lastHashPath) return;
    lastHashPath = p;
    go(p, { push: false });
  });

  function setURL(path) {
    if (useHash) { lastHashPath = path; location.hash = path; }
    else history.pushState({}, '', path);
  }

  async function go(path, { push = true } = {}) {
    const route = resolve(path);
    // Stessa pagina: basta scorrere fino alla sezione
    if (current && route.name === 'home' && current.name === 'home') {
      if (push) {
        const p = route.section ? path : '/';
        if (useHash) setURL(p); else history.replaceState({}, '', p);
      }
      scrollToTarget(route.section || 'top');
      return;
    }
    // "Contatti" da qualunque pagina: il footer è già qui sotto
    if (route.section === 'contatti' && $('#contatti', view)) { scrollToTarget('contatti'); return; }
    if (busy) return;
    busy = true;
    if (current) scrollMemory[current.path] = window.scrollY;
    await curtain(true);
    if (push) setURL(path);
    render(route, { restore: !push });
    await curtain(false);
    busy = false;
  }

  /* ==========================================================================
     Viste
     ========================================================================== */
  function metaLine(p) {
    return [p.category, p.location, p.year].filter(Boolean).map(esc).join('<i>—</i>');
  }

  function cardsHTML() {
    const ratios = ['4/3', '4/5', '3/4', '4/3'];
    return PROJECTS.map((p, i) => `
      <article class="card card--${'abcd'[i % 4]}">
        <a class="card__link" href="/progetti/${esc(p.slug)}" data-link data-cursor="Scopri">
          <figure class="media card__media" data-reveal style="--ar:${ratios[i % 4]}">
            <img data-parallax src="${esc(p.cover.src)}" alt="${esc(p.cover.alt)}" loading="lazy" decoding="async">
          </figure>
          <div class="card__info">
            <span class="card__num">${pad(i + 1)}</span>
            <h3 class="card__title display">${rich(p.title)}</h3>
            <span class="card__arrow">${arrowSVG}</span>
          </div>
          <p class="card__meta">${metaLine(p)}</p>
        </a>
      </article>`).join('');
  }

  function figureHTML(img, fallbackRatio, extra = '') {
    return `<figure class="media ${extra}" data-reveal style="--ar:${esc(img.ratio || fallbackRatio)}">
      <img data-parallax src="${esc(img.src)}" alt="${esc(img.alt || '')}" loading="lazy" decoding="async">
    </figure>`;
  }
  const captionHTML = (img) => (img.caption ? `<p class="g-cap" data-fade>${rich(img.caption)}</p>` : '');

  function blockHTML(b) {
    switch (b.layout) {
      case 'full':
        return `<div class="g g-full">${figureHTML(b, '16/9')}${captionHTML(b)}</div>`;
      case 'pair':
        return `<div class="g g-pair">${(b.images || []).map((im, j) => `
          <div class="g-pair__item">${figureHTML(im, j ? '4/5' : '3/4')}${captionHTML(im)}</div>`).join('')}</div>`;
      case 'offset':
        return `<div class="g g-offset g-offset--${b.align === 'right' ? 'right' : 'left'}${b.size === 'small' ? ' g-offset--small' : ''}">
          <div class="g-offset__img">${figureHTML(b, '4/5')}</div>${captionHTML(b)}</div>`;
      case 'quote':
        return `<blockquote class="g g-quote display" data-split>${rich(b.text)}</blockquote>`;
      case 'text':
        return `<div class="g g-text"><h3 class="eyebrow" data-fade>${esc(b.title)}</h3><p data-split>${rich(b.text)}</p></div>`;
      default:
        return '';
    }
  }

  function projectHTML(p, i) {
    const n = PROJECTS.length;
    const nextIndex = (i + 1) % n;
    const next = PROJECTS[nextIndex];
    const meta = [
      ['Luogo', esc(p.location)],
      ['Tipologia', esc(p.category)],
      ['Anno', esc(p.year)],
      ['Servizi', (p.services || []).map(esc).join('<br>')],
      ...(p.credits || []).map(([k, v]) => [esc(k), esc(v)])
    ].filter(([, v]) => v);
    return `
      <section class="p-hero" data-theme="light" data-section="${esc(p.title)}">
        <div class="p-hero__top" data-intro-fade>
          <a class="back roll" href="/progetti" data-link><span data-text="← Tutti i progetti">← Tutti i progetti</span></a>
          <span class="eyebrow">${pad(i + 1)} / ${pad(n)}</span>
        </div>
        <p class="eyebrow" data-intro-fade>${esc(p.category)}</p>
        <h1 class="p-hero__title display" data-intro-title>${rich(p.title)}</h1>
        ${p.tagline ? `<p class="p-hero__tagline" data-intro-fade>${rich(p.tagline)}</p>` : ''}
        <dl class="p-meta">${meta.map(([k, v]) => `<div data-intro-fade><dt class="eyebrow">${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </section>
      <figure class="media p-cover" data-cover style="--ar:${esc(p.cover.ratio || '16/9')}">
        <img data-parallax src="${esc(p.cover.src)}" alt="${esc(p.cover.alt)}" decoding="async" fetchpriority="high">
      </figure>
      <section class="p-intro" data-theme="light" data-section="Il progetto">
        <span class="eyebrow" data-fade>Il progetto</span>
        <div class="p-intro__body">
          <p class="lead" data-split>${rich(p.intro)}</p>
          ${(p.text || []).map((t) => `<p data-fade>${rich(t)}</p>`).join('')}
        </div>
      </section>
      <section class="p-gallery" data-theme="light">${(p.gallery || []).map(blockHTML).join('')}</section>
      ${n > 1 ? `
      <section class="p-next" data-theme="dark" data-section="Prossimo progetto">
        <a class="p-next__link" href="/progetti/${esc(next.slug)}" data-link data-cursor="Apri">
          <div class="p-next__text">
            <span class="eyebrow">Prossimo progetto — ${pad(nextIndex + 1)} / ${pad(n)}</span>
            <h2 class="p-next__title display" data-split>${rich(next.title)}</h2>
            <span class="p-next__meta">${metaLine(next)}</span>
          </div>
          <figure class="media p-next__img" style="--ar:4/3"><img src="${esc(next.cover.src)}" alt="" loading="lazy" decoding="async"></figure>
        </a>
      </section>` : ''}`;
  }

  function indexHTML() {
    const n = PROJECTS.length;
    const cats = [...new Set(PROJECTS.map((p) => p.category).filter(Boolean))];
    const count = (c) => PROJECTS.filter((p) => p.category === c).length;
    return `
      <section class="i-hero" data-theme="light" data-section="Progetti">
        <div class="i-hero__head">
          <h1 class="i-hero__title display" data-intro-title>Progetti</h1>
          <span class="i-hero__count eyebrow" data-intro-fade>(${pad(n)})</span>
        </div>
        <p class="i-hero__lead" data-intro-fade>Hotel, ristoranti, residenze e spazi contract: ogni progetto nasce dall’ascolto di un luogo e dalla sua storia.</p>
      </section>
      <section class="i-list" data-theme="light">
        ${cats.length > 1 ? `
        <div class="filters" role="group" aria-label="Filtra per tipologia" data-fade>
          <button class="filter is-active" type="button" data-filter="*">Tutti <sup>${pad(n)}</sup></button>
          ${cats.map((c) => `<button class="filter" type="button" data-filter="${esc(c)}">${esc(c)} <sup>${pad(count(c))}</sup></button>`).join('')}
        </div>` : ''}
        <ul class="rows">
          ${PROJECTS.map((p, i) => `
          <li class="row" data-cat="${esc(p.category)}">
            <a class="row__link" href="/progetti/${esc(p.slug)}" data-link data-cursor="Apri" data-index="${i}">
              <span class="row__line" data-line></span>
              <figure class="media row__thumb" style="--ar:4/3"><img src="${esc(p.cover.src)}" alt="" loading="lazy" decoding="async"></figure>
              <span class="row__num">${pad(i + 1)}</span>
              <span class="row__title display">${rich(p.title)}</span>
              <span class="row__cat">${esc(p.category)}</span>
              <span class="row__loc">${esc(p.location)}</span>
              <span class="row__year">${esc(p.year)}</span>
            </a>
          </li>`).join('')}
        </ul>
      </section>
      <div class="preview" aria-hidden="true">${PROJECTS.map((p) => `<img src="${esc(p.cover.src)}" alt="">`).join('')}</div>`;
  }

  const notFoundHTML = () => `
    <section class="nf" data-theme="dark" data-section="404">
      <span class="eyebrow" data-intro-fade>Errore 404</span>
      <h1 class="display" data-intro-title>Questo luogo <em>non esiste.</em></h1>
      <a class="link-arrow" href="/" data-link data-intro-fade><span>Torna alla home</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg></a>
    </section>`;

  /* ==========================================================================
     Render
     ========================================================================== */
  let pageCtx = null;
  let pageEnter = null;
  let cleanups = [];

  function teardown() {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    if (pageCtx) pageCtx.revert();
    pageCtx = null;
    pageEnter = null;
    if (window.ScrollTrigger) ScrollTrigger.getAll().forEach((st) => st.kill());
  }

  function render(route, { restore = false } = {}) {
    teardown();
    view.innerHTML = '';
    let title = BASE_TITLE;

    if (route.name === 'home') {
      view.append($('#tpl-home').content.cloneNode(true));
      $('[data-project-cards]', view).innerHTML = cardsHTML();
      $('[data-project-count]', view).textContent = `(${pad(PROJECTS.length)})`;
    } else if (route.name === 'index') {
      view.innerHTML = indexHTML();
      title = 'Progetti — Aptenia';
    } else if (route.name === 'project') {
      const p = PROJECTS[route.index];
      view.innerHTML = projectHTML(p, route.index);
      title = `${p.title} — Aptenia`;
    } else {
      view.innerHTML = notFoundHTML();
      title = 'Pagina non trovata — Aptenia';
    }
    view.append($('#tpl-footer').content.cloneNode(true));

    document.title = title;
    injectLogos(view);
    wireLinks(view);
    $$('[data-year]', view).forEach((el) => { el.textContent = new Date().getFullYear(); });
    $$('[data-nav]').forEach((a) => {
      const active = (a.dataset.nav === 'progetti' && (route.name === 'index' || route.name === 'project'));
      a.classList.toggle('is-active', active);
    });

    current = route;
    root.classList.remove('is-cursor-label', 'is-cursor-link');
    header.classList.remove('is-hidden');
    const firstTheme = $('[data-theme]', view);
    setTone(firstTheme ? firstTheme.dataset.theme : 'light');

    if (lenis) { lenis.resize(); lenis.scrollTo(0, { immediate: true, force: true }); }
    window.scrollTo(0, 0);

    if (anim) {
      pageCtx = G.context(() => { pageEnter = buildAnimations(route); }, view);
    } else {
      initFilters();
    }

    // La posizione (sezione o scroll ricordato) si applica quando lo scroll viene sbloccato
    pendingScroll = route.section || (restore ? scrollMemory[route.path] : null) || null;
    if (!anim) requestAnimationFrame(applyPendingScroll);
  }

  let pendingScroll = null;
  function applyPendingScroll() {
    if (pendingScroll == null) return;
    const target = pendingScroll;
    pendingScroll = null;
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    if (lenis) lenis.resize(); // altrimenti Lenis usa ancora l'altezza della pagina precedente
    if (typeof target === 'number') {
      if (lenis) lenis.scrollTo(target, { immediate: true, force: true }); else window.scrollTo(0, target);
    } else {
      scrollToTarget(target, true);
    }
    lastY = window.scrollY;
    header.classList.remove('is-hidden');
  }

  /* ==========================================================================
     Sipario (cambio pagina) e intro
     ========================================================================== */
  function curtain(show) {
    return new Promise((resolveP) => {
      if (!anim) { resolveP(); return; }
      const c = $('.curtain');
      const letters = $$('.logo-l', c);
      if (show) {
        stopScroll();
        G.set(c, { visibility: 'visible' });
        G.fromTo(c, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut', onComplete: resolveP });
        G.fromTo(letters, { y: 380 }, { y: 0, duration: 1, ease: 'expo.out', stagger: 0.035, delay: 0.35 });
      } else {
        startScroll();
        applyPendingScroll();
        G.to(letters, { y: -380, duration: 0.7, ease: 'expo.in', stagger: 0.02 });
        G.to(c, {
          clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'expo.inOut', delay: 0.25,
          onComplete: resolveP
        });
        G.delayedCall(0.6, () => pageEnter && pageEnter.play());
      }
    });
  }

  function runLoader() {
    const loader = $('.loader');
    return new Promise((resolveP) => {
      if (!anim) { loader.remove(); resolveP(); return; }
      stopScroll();
      const quick = sessionStorage.getItem('aptenia-intro') === '1';
      try { sessionStorage.setItem('aptenia-intro', '1'); } catch (e) { /* storage non disponibile */ }

      const logo = $('.loader__logo', loader);
      const letters = $$('.logo-l', logo);
      const counter = $('.loader__count', loader);
      const headerLogo = $('.header__logo');
      const target = { v: 0 };
      let started = false;
      const unlock = () => { startScroll(); applyPendingScroll(); };
      const startPage = () => {
        if (started) return;
        started = true;
        unlock();
        root.classList.add('is-ready');
        if (pageEnter) pageEnter.play();
        resolveP();
      };

      G.set(headerLogo, { autoAlpha: 0 });
      const tl = G.timeline({ onComplete: () => { loader.remove(); startPage(); } });
      tl.from(letters, { y: 380, duration: 1.3, ease: 'expo.out', stagger: 0.07 }, 0.15)
        .to(target, {
          v: 100, duration: 1.7, ease: 'power2.inOut',
          onUpdate: () => { counter.textContent = String(Math.round(target.v)).padStart(3, '0'); }
        }, 0)
        .to('.loader__meta', { autoAlpha: 0, duration: 0.4 }, 1.7)
        .to(logo, {
          x: () => headerLogo.getBoundingClientRect().left - logo.getBoundingClientRect().left,
          y: () => headerLogo.getBoundingClientRect().top - logo.getBoundingClientRect().top,
          scale: () => headerLogo.getBoundingClientRect().width / logo.getBoundingClientRect().width,
          duration: 1.3, ease: 'expo.inOut'
        }, 1.75)
        .to(logo, { color: () => getComputedStyle(headerLogo).color, duration: 0.5 }, 2.4)
        .set(headerLogo, { autoAlpha: 1 }, 3.05)
        .set(logo, { autoAlpha: 0 }, 3.05)
        .add(unlock, 2.5)
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, 2.55)
        .add(startPage, 2.75);
      if (quick) tl.timeScale(1.7);
    });
  }

  /* ==========================================================================
     Animazioni di pagina
     ========================================================================== */
  function buildAnimations(route) {
    const mm = G.matchMedia(view);
    cleanups.push(() => mm.revert());
    const enter = G.timeline({ paused: true });

    // Intro comune (titoli di pagina, cover, elementi "data-intro-*")
    $$('[data-intro-title]', view).forEach((el) => {
      const split = SplitText.create(el, { type: 'lines,chars', mask: 'lines', linesClass: 'split-line' });
      enter.from(split.chars, { yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: 0.03 }, 0);
    });
    const introFades = $$('[data-intro-fade]', view);
    if (introFades.length) enter.from(introFades, { y: 24, autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06 }, 0.25);
    const cover = $('[data-cover]', view);
    if (cover) {
      enter.fromTo(cover, { clipPath: 'inset(18% 8% 0% 8%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut' }, 0.2)
        .from($('img', cover), { scale: 1.35, duration: 2.2, ease: 'expo.out' }, 0.2);
    }

    // Testi che salgono riga per riga
    $$('[data-split]', view).forEach((el) => {
      SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
        onSplit: (self) => G.from(self.lines, {
          yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        })
      });
    });

    // Paragrafo che si "accende" parola per parola mentre si scorre
    $$('[data-words]', view).forEach((el) => {
      SplitText.create(el, {
        type: 'words', autoSplit: true,
        onSplit: (self) => G.fromTo(self.words, { opacity: 0.13 }, {
          opacity: 1, ease: 'none', stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true }
        })
      });
    });

    $$('[data-fade]', view).forEach((el) => {
      G.from(el, { y: 36, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    $$('[data-line]', view).forEach((el) => {
      G.from(el, { scaleX: 0, duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 94%', once: true } });
    });

    // Immagini: apertura a sipario + leggero zoom
    $$('[data-reveal]', view).forEach((fig) => {
      const img = $('img', fig);
      G.timeline({ scrollTrigger: { trigger: fig, start: 'top 88%', once: true } })
        .fromTo(fig, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' })
        .from(img, { scale: 1.3, duration: 2, ease: 'expo.out' }, 0.15);
    });

    // Parallax dentro le cornici
    $$('[data-parallax]', view).forEach((img) => {
      G.fromTo(img, { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    if (route.name === 'home') {
      heroAnimation(mm, enter);
      blueprintAnimation();
      vennAnimation(mm);
      methodAnimation(mm);
      marqueeAnimation();
    }
    if (route.name === 'index') { previewAnimation(); initFilters(); }

    footerAnimation();
    themeTriggers();

    // Dopo il caricamento dei font ricalcola le posizioni
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (current === route) { ScrollTrigger.sort(); ScrollTrigger.refresh(); } });
    }
    return enter;
  }

  /* HERO: titolo che sale lettera per lettera, poi la foto si apre a tutto schermo */
  function heroAnimation(mm, enter) {
    const hero = $('.hero', view);
    if (!hero) return;
    const media = $('.hero__media', hero);
    const img = $('img', media);
    const title = $('.hero__title', hero);
    const shade = $('.hero__shade', hero);
    const caption = $('.hero__caption', hero);
    const fades = $$('[data-hero-fade]', hero);

    const split = SplitText.create($$('.l', title), { type: 'chars' });
    const capSplit = SplitText.create(caption, { type: 'lines', mask: 'lines' });

    const base = getComputedStyle(media).clipPath;                      // es. inset(50% 5% 9% 57%)
    const nums = (base.match(/-?[\d.]+/g) || ['50', '5', '9', '57']).map(Number);
    const collapsed = `inset(${100 - nums[2]}% ${nums[1]}% ${nums[2]}% ${nums[3]}%)`;

    enter.from(split.chars, { yPercent: 115, duration: 1.5, ease: 'expo.out', stagger: 0.03 }, 0)
      .fromTo(media, { clipPath: collapsed }, { clipPath: base, duration: 1.7, ease: 'expo.inOut' }, 0.15)
      .fromTo(img, { scale: 1.45 }, { scale: 1.15, duration: 2.2, ease: 'expo.out' }, 0.3)
      .from(fades, { y: 20, autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1 }, 0.55);

    G.timeline({
      scrollTrigger: { trigger: hero, start: 'top top', end: '+=140%', pin: true, scrub: 1, anticipatePin: 1 }
    })
      .fromTo(media, { clipPath: base }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power1.inOut', duration: 1, immediateRender: false }, 0)
      .fromTo(img, { scale: 1.15 }, { scale: 1, ease: 'none', duration: 1.3, immediateRender: false }, 0)
      .fromTo(title, { yPercent: 0, autoAlpha: 1 }, { yPercent: -35, autoAlpha: 0, ease: 'power1.in', duration: 0.55, immediateRender: false }, 0)
      .fromTo(fades, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false }, 0)
      .fromTo('.hero__light', { opacity: 0.35 }, { opacity: 1, duration: 0.8, immediateRender: false }, 0)
      .fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.4, immediateRender: false }, 0.75)
      .from(capSplit.lines, { yPercent: 110, duration: 0.45, stagger: 0.08, ease: 'power3.out' }, 0.85)
      .to({}, { duration: 0.25 });

    heroLight(hero);
  }

  /* HERO: una luce calda segue il cursore (o si muove da sola su touch), con il pulviscolo nel fascio */
  function heroLight(hero) {
    const media = $('.hero__media', hero);
    const canvas = $('.hero__dust', hero);
    if (!media || !canvas) return;
    const c2d = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    const size = () => {
      w = media.clientWidth; h = media.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const motes = Array.from({ length: Math.round(Math.min(120, (w * h) / 12000)) }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 0.12, vy: -0.04 - Math.random() * 0.18, p: Math.random() * 6.28
    }));
    const light = { x: w * 0.62, y: h * 0.42 };
    const target = { ...light };
    let usePointer = false;
    const onMove = (e) => {
      if (!finePointer) return;
      const r = media.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      target.x = e.clientX - r.left; target.y = e.clientY - r.top;
      usePointer = true;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', size);
    let visible = true;
    let t = 0;
    const tick = () => {
      if (!visible) return;
      t += 0.016;
      if (!usePointer) {
        target.x = w * (0.58 + 0.2 * Math.sin(t * 0.33));
        target.y = h * (0.5 + 0.16 * Math.cos(t * 0.27));
      }
      light.x += (target.x - light.x) * 0.07;
      light.y += (target.y - light.y) * 0.07;
      media.style.setProperty('--lx', light.x.toFixed(1) + 'px');
      media.style.setProperty('--ly', light.y.toFixed(1) + 'px');
      c2d.clearRect(0, 0, w, h);
      const reach = Math.max(w, h) * 0.3;
      for (const m of motes) {
        m.p += 0.02;
        m.x += m.vx + Math.sin(m.p) * 0.07;
        m.y += m.vy;
        if (m.y < -4) { m.y = h + 4; m.x = Math.random() * w; }
        if (m.x < -4) m.x = w + 4; else if (m.x > w + 4) m.x = -4;
        const glow = Math.max(0, 1 - Math.hypot(m.x - light.x, m.y - light.y) / reach);
        const a = 0.04 + 0.8 * glow * (0.65 + 0.35 * Math.sin(m.p * 1.4));
        c2d.fillStyle = `rgba(255, 236, 214, ${a.toFixed(3)})`;
        c2d.beginPath(); c2d.arc(m.x, m.y, m.r, 0, 6.283); c2d.fill();
      }
    };
    G.ticker.add(tick);
    const holder = hero.parentElement.classList.contains('pin-spacer') ? hero.parentElement : hero;
    ScrollTrigger.create({ trigger: holder, start: 'top bottom', end: 'bottom top', onToggle: (self) => { visible = self.isActive; } });
    cleanups.push(() => {
      G.ticker.remove(tick);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', size);
    });
  }

  /* DAL DISEGNO ALLO SPAZIO: il disegno tecnico si traccia, poi diventa fotografia */
  function blueprintAnimation() {
    const sec = $('.bp', view);
    if (!sec) return;
    const draw = $$('.bp__draw > *', sec);
    const dims = $$('.bp__dims path', sec);
    const notes = $$('.bp__note', sec);
    const leaders = notes.map((n) => $('path', n));
    const count = $('.bp__count', sec);
    G.set([...draw, ...dims, ...leaders], { strokeDasharray: 1, strokeDashoffset: 1 });

    G.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec, start: 'top top', end: '+=260%', pin: true, scrub: 1, anticipatePin: 1,
        onUpdate: (self) => { count.textContent = String(Math.round(self.progress * 100)).padStart(3, '0'); }
      }
    })
      .from('.bp__grid', { opacity: 0, duration: 0.3 }, 0)
      .to(draw, { strokeDashoffset: 0, duration: 0.6, stagger: 0.05, ease: 'power1.inOut' }, 0.1)
      .to(dims, { strokeDashoffset: 0, duration: 0.4, stagger: 0.12 }, 1.55)
      .from('.bp__dims text', { opacity: 0, duration: 0.2 }, 1.85)
      .from(notes.map((n) => $('circle', n)), { scale: 0, transformOrigin: '50% 50%', duration: 0.2, stagger: 0.12 }, 1.8)
      .to(leaders, { strokeDashoffset: 0, duration: 0.3, stagger: 0.12 }, 1.9)
      .from(notes.map((n) => $('text', n)), { opacity: 0, x: -24, duration: 0.3, stagger: 0.12 }, 2.05)
      .to({}, { duration: 0.3 })
      .addLabel('reveal')
      .fromTo('.bp__photo', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power1.inOut' }, 'reveal')
      .fromTo('.bp__scan', { left: '0%', opacity: 1 }, { left: '100%', duration: 1.2, ease: 'power1.inOut' }, 'reveal')
      .to('.bp__scan', { opacity: 0, duration: 0.1 }, 'reveal+=1.15')
      .to(['.bp__draw', '.bp__dims', '.bp__grid'], { opacity: 0.16, duration: 0.6 }, 'reveal+=0.5')
      .to('.bp__notes', { opacity: 0, duration: 0.3 }, 'reveal+=0.95')
      .from('.bp__copy > *', { yPercent: 60, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, 'reveal+=1')
      .to({}, { duration: 0.4 });
  }

  /* THE IDENTITY WALKTHROUGH: la pianta si disegna e il percorso attraversa gli ambienti */
  function walkTimeline(svg) {
    const walls = $$('.walk__walls path', svg);
    const shelf = $('.walk__shelf', svg);
    const details = $$('.walk__details > *', svg).filter((el) => el !== shelf);
    const reveal = $('.walk__reveal', svg);
    const route = $('.walk__route', svg);
    const dot = $('.walk__dot', svg);
    const stops = $$('.walk__stop', svg);
    const len = route.getTotalLength();
    const stopAt = stops.map((st) => {
      const x = Number(st.dataset.x);
      const y = Number(st.dataset.y);
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i <= 200; i++) {
        const p = route.getPointAtLength((len * i) / 200);
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestD) { bestD = d; best = i / 200; }
      }
      return best;
    });
    const reached = stops.map(() => false);
    const setStop = (i, on) => {
      if (reached[i] === on) return;
      reached[i] = on;
      G.to($('.walk__halo', stops[i]), { scale: on ? 1 : 0, duration: on ? 0.9 : 0.4, ease: on ? 'back.out(2.2)' : 'power2.in', overwrite: true });
      G.to([$('text', stops[i]), $('.walk__pin', stops[i])], { opacity: on ? 1 : 0, duration: 0.5, overwrite: true });
    };
    G.set([...walls, ...details, reveal], { strokeDasharray: 1, strokeDashoffset: 1 });
    G.set(stops.map((st) => $('.walk__halo', st)), { scale: 0, transformOrigin: '50% 50%' });
    G.set(stops.map((st) => [$('text', st), $('.walk__pin', st)]).flat(), { opacity: 0 });
    const walker = { p: 0 };
    return G.timeline({ defaults: { ease: 'none' } })
      .to(walls, { strokeDashoffset: 0, duration: 1, stagger: 0.15, ease: 'power1.inOut' }, 0)
      .to(details, { strokeDashoffset: 0, duration: 0.7, stagger: 0.03 }, 0.5)
      .from([shelf, ...$$('.walk__rooms text', svg)], { opacity: 0, duration: 0.4 }, 1)
      .from(dot, { opacity: 0, duration: 0.1 }, 1.2)
      .to(walker, {
        p: 1, duration: 2.2,
        onUpdate: () => {
          const pt = route.getPointAtLength(len * walker.p);
          dot.setAttribute('cx', pt.x.toFixed(1));
          dot.setAttribute('cy', pt.y.toFixed(1));
          reveal.style.strokeDashoffset = String(1 - walker.p);
          stops.forEach((st, i) => setStop(i, walker.p >= stopAt[i]));
        }
      }, 1.2)
      .to({}, { duration: 0.3 });
  }

  /* THE IDENTITY BOOK: il libro si apre e le pagine si sfogliano */
  function bookTimeline(book) {
    const pages = [1, 2, 3].map((n) => $(`.book__page[data-page="${n}"]`, book));
    const sketchA = $$('.book__page[data-page="3"] .sketches path', book);
    const sketchB = $$('.book__base .sketches path', book);
    G.set([...sketchA, ...sketchB], { strokeDasharray: 1, strokeDashoffset: 1 });
    const tl = G.timeline({ defaults: { ease: 'power2.inOut' } });
    tl.fromTo(book, { xPercent: -25 }, { xPercent: 0, duration: 1 }, 0);
    pages.forEach((page, i) => {
      const at = i * 1.15;
      tl.to(page, { rotateY: -180, duration: 1 }, at).set(page, { zIndex: 10 + i }, at + 0.5);
    });
    return tl
      .to(sketchA, { strokeDashoffset: 0, duration: 0.7, stagger: 0.12, ease: 'none' }, 2.9)
      .to(sketchB, { strokeDashoffset: 0, duration: 0.7, stagger: 0.08, ease: 'none' }, 3.1)
      .to({}, { duration: 0.2 });
  }

  /* HOSPITALITY IDENTITY DESIGN: i tre cerchi si incontrano */
  function vennAnimation(mm) {
    const sec = $('.approach', view);
    if (!sec) return;
    const build = (tl) => tl
      .from('.vc1', { x: -150, y: -50, opacity: 0, duration: 1 }, 0)
      .from('.vc2', { x: 150, y: -50, opacity: 0, duration: 1 }, 0)
      .from('.vc3', { y: 170, opacity: 0, duration: 1 }, 0)
      .from('.vt', { opacity: 0, y: 14, stagger: 0.15, duration: 0.5 }, 0.55)
      .from('.venn__dot', { scale: 0, transformOrigin: '50% 50%', duration: 0.4 }, 0.9);

    mm.add('(min-width: 1024px)', () => {
      const tl = G.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: '+=230%', pin: true, scrub: 1, anticipatePin: 1 } });
      build(tl)
        .from('.slot__rule', { scaleX: 0, duration: 0.7, stagger: 0.15 }, 0.7)
        .from('.layer--a', { autoAlpha: 0, y: 26, duration: 0.7, stagger: 0.15 }, 0.85)
        .to({}, { duration: 0.6 })
        .addLabel('core')
        .to('.vt', { opacity: 0, duration: 0.4 }, 'core')
        .to('.venn__dot', { scale: 0, duration: 0.3 }, 'core')
        .to('.layer--a', { autoAlpha: 0, y: -22, duration: 0.5, stagger: 0.08 }, 'core')
        .fromTo('.venn__core', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.8, ease: 'power3.out' }, 'core+=0.15')
        .from('.venn__core text', { opacity: 0, y: 10, stagger: 0.08, duration: 0.4 }, 'core+=0.6')
        .from('.layer--b', { autoAlpha: 0, y: 26, duration: 0.7, stagger: 0.15 }, 'core+=0.45')
        .to({}, { duration: 0.5 });
    });

    mm.add('(max-width: 1023px)', () => {
      const tl = G.timeline({ scrollTrigger: { trigger: '.venn', start: 'top 85%', end: 'center 45%', scrub: 1 } });
      build(tl).fromTo('.venn__core', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.6 }, 1.1)
        .to('.vt', { opacity: 0, duration: 0.3 }, 1.1);
      $$('.layer', sec).forEach((l) => G.from(l, { y: 30, autoAlpha: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: l, start: 'top 90%', once: true } }));
    });
  }

  /* METODO: scorrimento orizzontale con righello che si riempie */
  function methodAnimation(mm) {
    const sec = $('.method', view);
    if (!sec) return;
    const track = $('.method__track', sec);
    const panels = $$('.method__panel', sec);

    mm.add('(min-width: 1024px)', () => {
      const fill = $('.ruler__fill', sec);
      const stepLabel = $('.ruler__step', sec);
      const distance = () => track.scrollWidth - window.innerWidth;
      const scroll = G.to(track, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: {
          trigger: sec, start: 'top top', end: () => '+=' + distance(),
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: (self) => G.set(fill, { scaleX: self.progress })
        }
      });
      panels.forEach((panel, i) => {
        const items = $$('[data-h]', panel);
        if (i === 0) {
          G.from(items, { y: 40, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: sec, start: 'top 60%', once: true } });
        } else {
          G.from(items, {
            x: 120, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07,
            scrollTrigger: { trigger: panel, containerAnimation: scroll, start: 'left 78%', toggleActions: 'play none none reverse' }
          });
          ScrollTrigger.create({
            trigger: panel, containerAnimation: scroll, start: 'left 50%', end: 'right 50%',
            onToggle: (self) => { if (self.isActive) stepLabel.textContent = `${pad(i)} — ${panel.dataset.step}`; },
            onLeaveBack: () => { if (i === 1) stepLabel.textContent = 'Il metodo'; }
          });
        }
        const img = $('.method__img img', panel);
        if (img) {
          G.fromTo(img, { xPercent: -5 }, {
            xPercent: 5, ease: 'none',
            scrollTrigger: { trigger: panel, containerAnimation: scroll, start: 'left right', end: 'right left', scrub: true }
          });
        }
        const walk = $('.walk', panel);
        if (walk) {
          ScrollTrigger.create({ trigger: panel, containerAnimation: scroll, start: 'left 45%', end: 'right 40%', scrub: 1, animation: walkTimeline(walk) });
        }
        const book = $('.book', panel);
        if (book) {
          ScrollTrigger.create({ trigger: panel, containerAnimation: scroll, start: 'left 20%', end: 'right 45%', scrub: 1, animation: bookTimeline(book) });
        }
      });
    });

    mm.add('(max-width: 1023px)', () => {
      const walk = $('.walk', sec);
      if (walk) ScrollTrigger.create({ trigger: walk, start: 'top 80%', end: 'bottom 35%', scrub: 1, animation: walkTimeline(walk) });
      const book = $('.book', sec);
      if (book) ScrollTrigger.create({ trigger: book, start: 'top 80%', end: 'bottom 20%', scrub: 1, animation: bookTimeline(book) });
      $$('[data-h]', sec).forEach((el) => {
        G.from(el, { y: 36, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      });
    });
  }

  /* Nastro di testo che accelera con lo scroll */
  function marqueeAnimation() {
    $$('.marquee', view).forEach((m) => {
      const loop = G.to($('.marquee__track', m), { xPercent: -50, duration: 36, ease: 'none', repeat: -1 });
      loop.totalTime(loop.duration() * 200); // margine per poter scorrere anche all'indietro
      let boost = 1;
      let dir = 1;
      ScrollTrigger.create({
        trigger: m, start: 'top bottom', end: 'bottom top',
        onUpdate: (self) => {
          dir = self.direction;
          boost = 1 + Math.min(Math.abs(self.getVelocity()) / 220, 8);
        }
      });
      const tick = () => {
        boost += (1 - boost) * 0.05;
        loop.timeScale(loop.timeScale() + (dir * boost - loop.timeScale()) * 0.1);
      };
      G.ticker.add(tick);
      cleanups.push(() => G.ticker.remove(tick));
    });
  }

  /* Archivio: anteprima che segue il cursore */
  function previewAnimation() {
    const preview = $('.preview', view);
    if (!preview || !finePointer) return;
    const imgs = $$('img', preview);
    G.set(preview, { xPercent: -50, yPercent: -50, autoAlpha: 0, scale: 0.85 });
    const xTo = G.quickTo(preview, 'x', { duration: 0.7, ease: 'power3' });
    const yTo = G.quickTo(preview, 'y', { duration: 0.7, ease: 'power3' });
    const move = (e) => { xTo(e.clientX); yTo(e.clientY); };
    window.addEventListener('pointermove', move, { passive: true });
    cleanups.push(() => window.removeEventListener('pointermove', move));
    $$('.row__link', view).forEach((link) => {
      const i = Number(link.dataset.index);
      link.addEventListener('pointerenter', () => {
        G.to(preview, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'expo.out' });
        imgs.forEach((im, j) => G.to(im, { opacity: j === i ? 1 : 0, scale: j === i ? 1 : 1.15, duration: 0.6, ease: 'expo.out' }));
      });
      link.addEventListener('pointerleave', () => G.to(preview, { autoAlpha: 0, scale: 0.85, duration: 0.5, ease: 'expo.out' }));
    });
  }

  function initFilters() {
    const buttons = $$('.filter', view);
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
      $$('.row', view).forEach((row) => { row.hidden = !(f === '*' || row.dataset.cat === f); });
      if (anim) {
        G.fromTo($$('.row:not([hidden]) .row__link', view), { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.06 });
        ScrollTrigger.refresh();
      }
    }));
  }

  /* Il logo del footer sale lettera per lettera */
  function footerAnimation() {
    const letters = $$('.footer__logo .logo-l', view);
    if (!letters.length) return;
    G.from(letters, {
      y: 380, ease: 'none', stagger: 0.06,
      scrollTrigger: { trigger: '.footer__logo', start: 'top bottom', end: 'bottom bottom', scrub: 1 }
    });
  }

  /* Colore dell'header e indicatore di sezione */
  function themeTriggers() {
    const holder = (el) => (el.parentElement && el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el);
    $$('[data-theme]', view).forEach((sec) => {
      ScrollTrigger.create({
        trigger: holder(sec), start: 'top 38px', end: 'bottom 38px',
        onToggle: (self) => { if (self.isActive) setTone(sec.dataset.theme); }
      });
    });
    const sections = $$('[data-section]', view);
    const num = $('.indicator__num');
    $('.indicator__tot').textContent = pad(sections.length);
    num.textContent = '01';
    sections.forEach((sec, i) => {
      ScrollTrigger.create({
        trigger: holder(sec), start: 'top 55%', end: 'bottom 55%',
        onToggle: (self) => { if (self.isActive) num.textContent = pad(i + 1); }
      });
    });
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }

  /* ==========================================================================
     Avvio
     ========================================================================== */
  injectLogos(document);
  wireLinks(document);
  initCursor();
  const startPath = currentPath();
  lastHashPath = startPath;
  render(resolve(startPath));
  runLoader();
  if (!anim) root.classList.add('is-ready');
})();
