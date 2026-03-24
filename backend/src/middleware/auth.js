const prisma = require('../utils/prisma');

// Verify the request comes from a valid Shopify session
async function verifyShopifySession(req, res, next) {
  try {
    const shopify = req.shopify;
    const sessionId = shopify.session.getOfflineId(req.query.shop || req.headers['x-shop-domain']);
    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (!session || !session.accessToken) {
      return res.status(401).json({ error: 'Unauthorized — reinstall app' });
    }

    // Load shop from DB
    const shop = await prisma.shop.findUnique({
      where: { shopDomain: session.shop },
      include: { config: true },
    });

    if (!shop || !shop.isActive) {
      return res.status(403).json({ error: 'Shop not found or inactive' });
    }

    req.session_data = session;
    req.shop = shop;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Lighter check for widget API (uses shop domain header)
async function verifyWidgetRequest(req, res, next) {
  try {
    const shopDomain = req.headers['x-shop-domain'] || req.query.shop;
    if (!shopDomain) return res.status(400).json({ error: 'Missing shop domain' });

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      include: { config: true },
    });

    if (!shop || !shop.isActive || shop.planStatus !== 'active') {
      return res.status(403).json({ error: 'Shop inactive or subscription expired' });
    }

    // Check generation limit
    if (shop.generationsUsed >= shop.generationsLimit) {
      return res.status(429).json({
        error: 'generation_limit_reached',
        used: shop.generationsUsed,
        limit: shop.generationsLimit,
        message: 'Hai raggiunto il limite di generazioni del tuo piano. Aggiorna il piano per continuare.',
      });
    }

    req.shop = shop;
    next();
  } catch (err) {
    console.error('Widget auth error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

module.exports = { verifyShopifySession, verifyWidgetRequest };
