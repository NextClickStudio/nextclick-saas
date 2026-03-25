const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

// GET /api/widget/config?shop=domain.myshopify.com
// Called by the widget JS on the storefront to get brand config
router.get('/config', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const shopDomain = req.query.shop;
    if (!shopDomain) return res.status(400).json({ error: 'Missing shop' });

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      include: { config: true },
    });

    if (!shop || !shop.isActive) {
      return res.status(403).json({ error: 'inactive' });
    }

    // In preview mode (chiamato dall'admin dell'app) bypassa il check del piano
    const isPreview = req.query.preview === 'true';
    if (!isPreview && shop.planStatus !== 'active') {
      return res.status(403).json({ error: 'plan_inactive', message: 'Piano non attivo. Attiva un piano per abilitare il widget.' });
    }

    const config = shop.config;

    // Return only public-safe config (no secrets)
    res.json({
      shopId: shop.id,
      shopDomain: shop.shopDomain,
      planName: shop.planName,
      generationsRemaining: Math.max(0, shop.generationsLimit - shop.generationsUsed),
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
    res.status(500).json({ error: err.message });
  }
});

// GET /api/widget/embed.js?shop=domain.myshopify.com
// The script tag that merchants add to their Shopify theme
router.get('/embed.js', async (req, res) => {
  const shop = req.query.shop;
  const host = process.env.HOST;
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(`
(function() {
  if (window.__nextclickLoaded) return;
  window.__nextclickLoaded = true;
  var iframe = document.createElement('iframe');
  iframe.src = '${host}/widget?shop=${shop}';
  iframe.style.cssText = 'position:fixed;bottom:20px;right:20px;width:420px;height:680px;border:none;z-index:999999;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);';
  iframe.id = 'nextclick-widget';
  document.body.appendChild(iframe);
})();
  `.trim());
});

module.exports = router;
