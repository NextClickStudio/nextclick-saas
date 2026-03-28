/**
 * auth.js — Shopify session middleware
 *
 * Strategy (in order of priority):
 * 1. Session storage (Prisma) via shopify.session.getOfflineId()
 * 2. Shop.accessToken in DB (shopDomain column, CamelCase)
 * 3. process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN (Admin API token, shpss_...)
 * 4. 401 — no token available
 *
 * Exported BOTH as default and named to prevent "Route.get() requires a
 * callback but got [object Undefined]" when callers destructure differently.
 */

const prisma = require('../utils/prisma');

// ─── verifyShopifySession ────────────────────────────────────────────────────

async function verifyShopifySession(req, res, next) {
  try {
    const shopDomain =
      req.query.shop ||
      req.headers['x-shop-domain'] ||
      req.body?.shop;

    if (!shopDomain) {
      return res.status(401).json({ error: 'Missing shop parameter' });
    }

    let accessToken = null;

    // ── Attempt 1: Shopify SDK session storage ──────────────────────────────
    try {
      const shopify   = req.shopify; // attached in index.js
      const sessionId = shopify.session.getOfflineId(shopDomain);
      const session   = await shopify.config.sessionStorage.loadSession(sessionId);
      if (session?.accessToken) {
        accessToken      = session.accessToken;
        req.session_data = session;
        console.log(`[auth] token from session storage for ${shopDomain}`);
      }
    } catch (e) {
      // SDK not ready or session missing — continue to next fallback
      console.warn('[auth] session storage unavailable, trying DB:', e.message);
    }

    // ── Attempt 2: Shop.accessToken in DB ───────────────────────────────────
    if (!accessToken) {
      try {
        const shopRecord = await prisma.shop.findUnique({
          where:  { shopDomain },          // CamelCase column ✓
          select: { accessToken: true, isActive: true },
        });

        if (shopRecord?.accessToken) {
          accessToken      = shopRecord.accessToken;
          req.session_data = { shop: shopDomain, accessToken };
          console.warn(`[auth] using DB fallback token for ${shopDomain}`);
        }
      } catch (dbErr) {
        console.error('[auth] DB lookup failed:', dbErr.message);
      }
    }

    // ── Attempt 3: Admin API Access Token env var (shpss_...) ───────────────
    if (!accessToken && process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
      accessToken      = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
      req.session_data = { shop: shopDomain, accessToken };
      console.warn(
        `[auth] BYPASS — using SHOPIFY_ADMIN_API_ACCESS_TOKEN for ${shopDomain}`
      );
    }

    // ── No token found → 401 ────────────────────────────────────────────────
    if (!accessToken) {
      return res.status(401).json({
        error: 'Unauthorized — reinstall app or set SHOPIFY_ADMIN_API_ACCESS_TOKEN',
      });
    }

    // ── Load full shop record ───────────────────────────────────────────────
    let shop = null;
    try {
      shop = await prisma.shop.findUnique({
        where:   { shopDomain },
        include: { config: true },
      });
    } catch (dbErr) {
      console.error('[auth] shop load failed:', dbErr.message);
    }

    // If DB has no record but we have the env-var token, build a minimal stub
    if (!shop) {
      if (process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN && accessToken === process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
        req.shop = {
          id:           'env-bypass',
          shopDomain,
          accessToken,
          isActive:     true,
          planName:     process.env.SHOPIFY_PLAN_NAME    || 'pro',
          planStatus:   process.env.SHOPIFY_PLAN_STATUS  || 'active',
          generationsUsed:  0,
          generationsLimit: 99999,
          config:       null,
        };
        console.warn('[auth] shop not in DB — using env-var stub for', shopDomain);
        return next();
      }
      return res.status(401).json({ error: 'Shop not found — reinstall app' });
    }

    if (!shop.isActive) {
      return res.status(403).json({ error: 'Shop inactive' });
    }

    // Ensure accessToken on req.shop reflects what we actually resolved
    req.shop = { ...shop, accessToken };

    // ── Scope check: forza re-auth se mancano permessi ────────────────────
    if (req.session_data?.scope) {
      const required = ['read_products', 'write_script_tags', 'read_script_tags'];
      const has      = req.session_data.scope.split(',').map(s => s.trim());
      const missing  = required.filter(s => !has.includes(s));
      if (missing.length > 0) {
        console.warn('[auth] missing scopes:', missing, '— requesting re-auth header');
        res.setHeader('X-Shopify-Reauth-Required', '1');
      }
    }

    next();

  } catch (err) {
    console.error('[auth] middleware error:', err.message);
    res.status(500).json({ error: 'Authentication error' });
  }
}

// ─── verifyWidgetRequest ─────────────────────────────────────────────────────

async function verifyWidgetRequest(req, res, next) {
  try {
    const shopDomain =
      req.headers['x-shop-domain'] ||
      req.query.shop;

    if (!shopDomain) {
      return res.status(400).json({ error: 'Missing shop domain' });
    }

    const shop = await prisma.shop.findUnique({
      where:   { shopDomain },
      include: { config: true },
    });

    if (!shop || !shop.isActive) {
      return res.status(403).json({ error: 'Shop not found or inactive' });
    }

    const isPreview =
      req.query.preview === 'true' ||
      req.headers['x-preview'] === 'true';

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

// ─── Exports ─────────────────────────────────────────────────────────────────
// Double-export pattern: prevents "Route.get() requires a callback but got
// [object Undefined]" regardless of how the caller imports this module.
//
//   const { verifyShopifySession } = require('../middleware/auth');  ✓
//   const authMiddleware = require('../middleware/auth');             ✓
//   authMiddleware(req, res, next);                                  ✓

module.exports                              = verifyShopifySession; // default
module.exports.verifyShopifySession         = verifyShopifySession; // named
module.exports.authMiddleware               = verifyShopifySession; // alias
module.exports.verifyWidgetRequest          = verifyWidgetRequest;  // named
