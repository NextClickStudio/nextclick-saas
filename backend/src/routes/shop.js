const express = require('express');
const { resetShopIPs, MAX_PER_IP } = require('../utils/rateLimiter');
const router  = express.Router();
const prisma  = require('../utils/prisma');

// ── Safe import with crash-guard ──────────────────────────────────────────────
// Using the named export so this never receives undefined even if the module
// is imported without destructuring elsewhere.
const authModule = require('../middleware/auth');
const verifyShopifySession =
  authModule.verifyShopifySession ||   // named export (preferred)
  (typeof authModule === 'function' ? authModule : null); // default export fallback

if (typeof verifyShopifySession !== 'function') {
  console.error(
    '[FATAL] verifyShopifySession is not a function in routes/shop.js — ' +
    'check middleware/auth.js exports'
  );
  process.exit(1);
}

// GET /api/shop
router.get('/', verifyShopifySession, async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({
      where:   { id: req.shop.id },
      include: { config: true },
    });
    res.json({ shop });
  } catch (err) {
    console.error('[shop] GET / error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shop/status — lightweight ping used by the frontend dashboard
router.get('/status', verifyShopifySession, async (req, res) => {
  res.json({
    shopDomain:       req.shop.shopDomain,
    planName:         req.shop.planName,
    planStatus:       req.shop.planStatus,
    generationsUsed:  req.shop.generationsUsed,
    generationsLimit: req.shop.generationsLimit,
    isActive:         req.shop.isActive,
  });
});


// POST /api/shop/reset-session — cancella sessione e forza re-auth
// Usare solo per debug/fix permessi OAuth
router.post('/reset-session', async (req, res) => {
  try {
    const shopDomain = req.query.shop || req.body?.shop;
    if (!shopDomain) return res.status(400).json({ error: 'Missing shop' });

    // Cancella sessioni dal DB
    await prisma.shopSession.deleteMany({ where: { shopDomain: shopDomain } });

    // Cancella anche il token dal record shop così forza OAuth fresco
    await prisma.shop.update({
      where: { shopDomain },
      data: { accessToken: '' },
    });

    res.json({ 
      ok: true, 
      message: 'Sessione cancellata. Ora apri: ' + (process.env.HOST || '') + '/api/auth?shop=' + shopDomain 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shop/reset-ip-limits — reset manuale IP rate limits
router.post('/reset-ip-limits', verifyShopifySession, async (req, res) => {
  try {
    const deleted = await resetShopIPs(req.shop.id);
    res.json({ ok: true, message: `IP rate limits reset. ${deleted} entries cleared.`, maxPerIp: MAX_PER_IP });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shop/rate-limit-config — info sul rate limiting
router.get('/rate-limit-config', verifyShopifySession, async (req, res) => {
  res.json({ maxGenerationsPerIp: MAX_PER_IP, resetAt: 'midnight UTC' });
});

module.exports = router;
