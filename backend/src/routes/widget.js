const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

// GET /api/widget/config?shop=domain.myshopify.com&preview=true
router.get('/config', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  try {
    const shopDomain = req.query.shop;
    if (!shopDomain) return res.status(400).json({ error: 'Missing shop' });

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      include: { config: true },
    });

    if (!shop || !shop.isActive) {
      return res.status(403).json({ error: 'inactive', message: 'Shop non trovato o inattivo.' });
    }

    // Preview mode: bypass plan check (called from admin app)
    const isPreview = req.query.preview === 'true' || req.query.preview === '1';

    if (!isPreview && shop.planStatus !== 'active') {
      return res.status(403).json({
        error: 'plan_inactive',
        message: 'Piano non attivo. Attiva un piano per abilitare il widget.',
      });
    }

    const config = shop.config;
    if (!config) {
      return res.status(404).json({ error: 'config_missing', message: 'Configurazione non trovata. Completa il setup.' });
    }

    res.json({
      shopId: shop.id,
      shopDomain: shop.shopDomain,
      planName: shop.planName,
      isPreview,
      generationsRemaining: isPreview ? 999 : Math.max(0, shop.generationsLimit - shop.generationsUsed),
      config: {
        category: config.category,
        brandName: config.brandName,
        heroTitle: config.heroTitle,
        heroSubtitle: config.heroSubtitle,
        ctaText: config.ctaText,
        loadingText: config.loadingText,
        questionFlow: config.questionFlow,
        aiLanguage: config.aiLanguage,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        bgColor: config.bgColor,
        textColor: config.textColor,
        subtitleColor: config.subtitleColor,
        buttonColor: config.buttonColor,
        buttonTextColor: config.buttonTextColor,
        fontFamily: config.fontFamily,
        borderRadius: config.borderRadius,
        logoUrl: config.logoUrl,
        featureRoutine: config.featureRoutine,
        featureProducts: config.featureProducts,
        featurePdf: config.featurePdf,
        widgetPosition: config.widgetPosition,
      },
    });
  } catch (err) {
    console.error('Widget config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/widget/embed.js?shop=domain.myshopify.com
// Launcher professionale con floating button, animazioni, posizione configurabile
router.get('/embed.js', async (req, res) => {
  const shop = req.query.shop;
  const host = process.env.HOST || 'https://nextclick-saas-production.up.railway.app';

  // Leggi config del widget per posizione e colori
  let widgetPosition = 'bottom-right';
  let btnColor = '#0A0A0A';
  let btnTextColor = '#FFFFFF';
  let brandName = 'AI Advisor';

  try {
    const { PrismaClient } = require('@prisma/client');
    const db = require('../utils/prisma');
    const shopRecord = await db.shop.findUnique({
      where: { shopDomain: shop },
      include: { config: true },
    });
    if (shopRecord?.config) {
      widgetPosition = shopRecord.config.widgetPosition || 'bottom-right';
      btnColor       = shopRecord.config.buttonColor    || '#0A0A0A';
      btnTextColor   = shopRecord.config.buttonTextColor || '#FFFFFF';
      brandName      = shopRecord.config.brandName      || 'AI Advisor';
    }
  } catch(e) {}

  const isLeft   = widgetPosition === 'bottom-left';
  const isCenter = widgetPosition === 'center';
  const btnPos   = isLeft ? 'left:20px' : 'right:20px';

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache'); // no cache: posizione può cambiare
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.send(`
(function() {
  if (window.__nextclickLoaded) return;
  window.__nextclickLoaded = true;

  var HOST     = '${host}';
  var SHOP     = '${shop}';
  var IS_OPEN  = false;

  // ── CSS ──────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#nc-launcher{position:fixed;bottom:24px;${btnPos};z-index:999998;display:flex;align-items:center;gap:10px;cursor:pointer;transition:transform .2s ease,opacity .2s ease;}',
    '#nc-launcher:hover{transform:scale(1.05);}',
    '#nc-launcher:active{transform:scale(0.97);}',
    '#nc-btn{background:${btnColor};color:${btnTextColor};border:none;border-radius:50px;padding:14px 22px;font-size:14px;font-weight:600;font-family:system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,0.22);display:flex;align-items:center;gap:8px;white-space:nowrap;}',
    '#nc-dot{width:8px;height:8px;background:#00E676;border-radius:50%;animation:nc-pulse 2s infinite;}',
    '@keyframes nc-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.3)}}',
    '#nc-frame-wrap{position:fixed;z-index:999999;transition:opacity .3s ease,transform .3s cubic-bezier(0.34,1.56,0.64,1);opacity:0;pointer-events:none;transform:translateY(20px) scale(0.97);}',
    '#nc-frame-wrap.open{opacity:1;pointer-events:all;transform:translateY(0) scale(1);}',
    '#nc-frame{width:420px;height:700px;border:none;border-radius:20px;box-shadow:0 20px 80px rgba(0,0,0,0.25);}',
    '#nc-close{position:absolute;top:-12px;right:-12px;width:28px;height:28px;background:#fff;border:1.5px solid rgba(0,0,0,.1);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:#333;box-shadow:0 2px 8px rgba(0,0,0,.12);transition:.15s;}',
    '#nc-close:hover{background:#f5f5f5;transform:scale(1.1);}',
    '@media(max-width:480px){#nc-frame{width:100vw!important;height:100dvh!important;border-radius:0!important;} #nc-frame-wrap{bottom:0!important;right:0!important;left:0!important;top:0!important;width:100%!important;} #nc-close{top:12px;right:12px;width:32px;height:32px;font-size:14px;}}'
  ].join('');
  document.head.appendChild(style);

  // ── LAUNCHER BUTTON ──────────────────────────────────────────
  var launcher = document.createElement('div');
  launcher.id = 'nc-launcher';
  launcher.innerHTML = '<button id="nc-btn"><span id="nc-dot"></span><span>${brandName.replace(/'/g, "\'")} AI</span></button>';
  document.body.appendChild(launcher);

  // ── IFRAME WRAPPER ───────────────────────────────────────────
  var wrap = document.createElement('div');
  wrap.id = 'nc-frame-wrap';

  // Posizionamento
  var bottom = 90, right = 20, left = 20;
  if ('${isLeft}' === 'true') {
    wrap.style.cssText = 'bottom:' + bottom + 'px;left:' + left + 'px;';
  } else if ('${isCenter}' === 'true') {
    wrap.style.cssText = 'bottom:' + bottom + 'px;left:50%;transform:translateX(-50%) translateY(20px) scale(0.97);';
  } else {
    wrap.style.cssText = 'bottom:' + bottom + 'px;right:' + right + 'px;';
  }

  var iframe = document.createElement('iframe');
  iframe.id  = 'nc-frame';
  iframe.src = HOST + '/widget?shop=' + SHOP;
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allow', 'autoplay');

  var closeBtn = document.createElement('div');
  closeBtn.id = 'nc-close';
  closeBtn.textContent = '✕';

  wrap.appendChild(iframe);
  wrap.appendChild(closeBtn);
  document.body.appendChild(wrap);

  // ── OPEN / CLOSE ─────────────────────────────────────────────
  function open() {
    IS_OPEN = true;
    wrap.classList.add('open');
    launcher.style.opacity = '0';
    launcher.style.pointerEvents = 'none';
    // Fix per center position
    if ('${isCenter}' === 'true') {
      wrap.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    }
  }

  function close() {
    IS_OPEN = false;
    wrap.classList.remove('open');
    launcher.style.opacity = '1';
    launcher.style.pointerEvents = 'all';
    if ('${isCenter}' === 'true') {
      wrap.style.transform = 'translateX(-50%) translateY(20px) scale(0.97)';
    }
  }

  launcher.addEventListener('click', open);
  closeBtn.addEventListener('click', close);

  // Chiudi con ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && IS_OPEN) close();
  });

})();
  `.trim());
});

module.exports = router;
