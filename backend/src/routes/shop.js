const express = require('express');
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

module.exports = router;
