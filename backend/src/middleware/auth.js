const prisma = require('../utils/prisma');

// Verify the request comes from a valid Shopify session
async function verifyShopifySession(req, res, next) {
  try {
    const shopify = req.shopify;

    // Support both query param and header for shop domain
    const shopDomain = req.query.shop || req.headers['x-shop-domain'];
    if (!shopDomain) {
      return res.status(401).json({ error: 'Missing shop parameter' });
    }

    // Try to load Shopify session
    let session = null;
    try {
      const sessionId = shopify.session.getOfflineId(shopDomain);
      session = await shopify.config.sessionStorage.loadSession(sessionId);
    } catch (sessionErr) {
      console.warn('Session load error:', sessionErr.message);
    }

    // ✅ FIX: if session not found via shopify lib, try loading directly from DB
    if (!session || !session.accessToken) {
      // Try to get accessToken directly from Shop record in DB
      const shopRecord = await prisma.shop.findUnique({
        where: { shopDomain },
        select: { id: true, accessToken: true, isActive: true, shopDomain: true },
      });

      if (shopRecord && shopRecord.accessToken) {
        // Reconstruct a minimal session object
        session = {
          shop: shopDomain,
          accessToken: shopRecord.accessToken,
        };
      } else {
        return res.status(401).json({ error: 'Unauthorized — reinstall app' });
      }
    }

    // Load full shop from DB
    const shop = await prisma.shop.findUnique({
      where: { shopDomain: session.shop || shopDomain },
      include: { config: true },
    });

    if (!shop) {
      return res.status(401).json({ error: 'Shop not found — reinstall app' });
    }

    if (!shop.isActive) {
      return res.status(403).json({ error: 'Shop inactive' });
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

    if (!shop || !shop.isActive) {
      return res.status(403).json({ error: 'Shop inactive or not found' });
    }

    // Allow preview mode without plan check
    const isPreview = req.query.preview === 'true' || req.headers['x-preview'] === 'true';
    if (!isPreview && shop.planStatus !== 'active') {
      return res.status(403).json({ error: 'Shop inactive or subscription expired' });
    }

    // Check generation limit (skip in preview)
    if (!isPreview && shop.generationsUsed >= shop.generationsLimit) {
      return res.status(429).json({
        error: 'generation_limit_reached',
        used: shop.generationsUsed,
        limit: shop.generationsLimit,
        message: 'Hai raggiunto il limite di generazioni del tuo piano.',
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
