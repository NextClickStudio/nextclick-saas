const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');

// GET /api/auth?shop=xxx.myshopify.com
router.get('/', async (req, res) => {
  const shopify = req.shopify;
  try {
    const shop = shopify.utils.sanitizeShop(req.query.shop, true);
    if (!shop) return res.status(400).send('Invalid shop parameter');
    await shopify.auth.begin({
      shop,
      callbackPath: '/api/auth/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
  } catch (err) {
    console.error('Auth begin error:', err.message);
    res.status(500).send('Failed to start authentication: ' + err.message);
  }
});

// GET /api/auth/callback
router.get('/callback', async (req, res) => {
  const shopify = req.shopify;
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;
    console.log('OAuth callback — shop:', session.shop, 'token:', session.accessToken ? 'OK' : 'MISSING', 'scopes:', session.scope);

    // 1. Fetch shop info from Shopify REST
    const shopInfo = await getShopInfo(shopify, session);

    // 2. Upsert shop in DB FIRST (so FK exists for session storage)
    await prisma.shop.upsert({
      where: { shopDomain: session.shop },
      update: {
        accessToken: session.accessToken,
        email:     shopInfo?.email     || null,
        ownerName: shopInfo?.shop_owner || shopInfo?.name || null,
        isActive:  true,
        updatedAt: new Date(),
      },
      create: {
        shopDomain:      session.shop,
        accessToken:     session.accessToken,
        email:           shopInfo?.email     || null,
        ownerName:       shopInfo?.shop_owner || shopInfo?.name || null,
        planName:        'starter',
        planStatus:      'pending',
        generationsLimit: 1000,
        generationsUsed:  0,
        isActive:        true,
      },
    });

    // 3. Save session to storage
    const stored = await shopify.config.sessionStorage.storeSession(session);
    if (!stored) {
      console.error('CRITICAL: session storage failed for', session.shop);
    }

    // 4. Ensure default ShopConfig exists
    const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    await prisma.shopConfig.upsert({
      where:  { shopId: shop.id },
      update: {},
      create: {
        shopId:    shop.id,
        category:  'beauty',
        brandName: shopInfo?.name || 'My Brand',
      },
    });

    // 5. Register webhooks (non-blocking, don't fail install)
    registerWebhooks(shopify, session).catch(err =>
      console.warn('Webhook registration failed (non-critical):', err.message)
    );

    // 6. Redirect into embedded app
    // NOTE: do NOT re-trigger auth here for missing scopes — that causes infinite loops.
    // If scopes are missing, the app simply won't have those permissions.
    // Fix scopes in Shopify Partner Dashboard instead.
    const host = req.query.host || '';
    res.redirect(`/?shop=${session.shop}&host=${host}`);

  } catch (err) {
    console.error('Auth callback error:', err.message);
    console.error(err.stack);
    res.status(500).send(`
      <h2>Authentication failed</h2>
      <p>${err.message}</p>
      <p><a href="/api/auth?shop=${req.query.shop}">Try again</a></p>
    `);
  }
});

async function getShopInfo(shopify, session) {
  try {
    const client = new shopify.clients.Rest({ session });
    const resp   = await client.get({ path: 'shop' });
    return resp.body?.shop || null;
  } catch (err) {
    console.warn('getShopInfo failed (non-critical):', err.message);
    return null;
  }
}

async function registerWebhooks(shopify, session) {
  const base = (process.env.HOST || '').replace(/\/$/, '');
  const handlers = {
    APP_UNINSTALLED: `${base}/api/webhooks/uninstall`,
    SHOP_UPDATE:     `${base}/api/webhooks/shop-update`,
  };
  for (const [topic, callbackUrl] of Object.entries(handlers)) {
    try {
      await shopify.webhooks.addHandlers({
        [topic]: [{ deliveryMethod: 'http', callbackUrl, callback: async () => {} }],
      });
    } catch (err) {
      console.warn(`Webhook ${topic} registration failed:`, err.message);
    }
  }
}

module.exports = router;
