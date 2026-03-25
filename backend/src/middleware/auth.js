const prisma = require('../utils/prisma');

/**
 * verifyShopifySession
 *
 * Strategy (in order):
 * 1. Load session from Prisma via shopify.session.getOfflineId()
 * 2. If not found or token missing, fall back to accessToken stored on Shop record
 * 3. If still no token → 401
 *
 * This dual-fallback means the app keeps working even if the session table
 * has stale/missing entries, as long as the Shop.accessToken is current.
 */
async function verifyShopifySession(req, res, next) {
  try {
    const shopify    = req.shopify;
    const shopDomain = req.query.shop || req.headers['x-shop-domain'];

    if (!shopDomain) {
      return res.status(401).json({ error: 'Missing shop parameter' });
    }

    // --- Attempt 1: load from session storage ---
    let accessToken = null;
    try {
      const sessionId = shopify.session.getOfflineId(shopDomain);
      const session   = await shopify.config.sessionStorage.loadSession(sessionId);
      if (session?.accessToken) {
        accessToken = session.accessToken;
        req.session_data = session;
      }
    } catch (e) {
      console.warn('[auth] session load error (will try DB fallback):', e.message);
    }

    // --- Attempt 2: fall back to Shop.accessToken in DB ---
    if (!accessToken) {
      const shopRecord = await prisma.shop.findUnique({
        where:  { shopDomain },
        select: { accessToken: true, isActive: true },
      });

      if (shopRecord?.accessToken) {
        accessToken = shopRecord.accessToken;
        req.session_data = { shop: shopDomain, accessToken };
        console.warn(`[auth] using DB fallback token for ${shopDomain}`);
      } else {
        return res.status(401).json({ error: 'Unauthorized — reinstall app' });
      }
    }

    // --- Load full shop with config ---
    const shop = await prisma.shop.findUnique({
      where:   { shopDomain },
      include: { config: true },
    });

    if (!shop) {
      return res.status(401).json({ error: 'Shop not found — reinstall app' });
    }
    if (!shop.isActive) {
      return res.status(403).json({ error: 'Shop inactive' });
    }

    req.shop = shop;
    next();
  } catch (err) {
    console.error('[auth] middleware error:', err.message);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * verifyWidgetRequest
 * Lighter check for public widget endpoints (no session needed — uses shop domain only).
 */
async function verifyWidgetRequest(req, res, next) {
  try {
    const shopDomain = req.headers['x-shop-domain'] || req.query.shop;
    if (!shopDomain) return res.status(400).json({ error: 'Missing shop domain' });

    const shop = await prisma.shop.findUnique({
      where:   { shopDomain },
      include: { config: true },
    });

    if (!shop || !shop.isActive) {
      return res.status(403).json({ error: 'Shop not found or inactive' });
    }

    const isPreview = req.query.preview === 'true' || req.headers['x-preview'] === 'true';

    if (!isPreview && shop.planStatus !== 'active') {
      return res.status(403).json({ error: 'Subscription not active' });
    }

    if (!isPreview && shop.generationsUsed >= shop.generationsLimit) {
      return res.status(429).json({
        error:   'generation_limit_reached',
        used:    shop.generationsUsed,
        limit:   shop.generationsLimit,
        message: 'Hai raggiunto il limite di generazioni del tuo piano.',
      });
    }

    req.shop = shop;
    next();
  } catch (err) {
    console.error('[auth] widget middleware error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
}

module.exports = { verifyShopifySession, verifyWidgetRequest };
