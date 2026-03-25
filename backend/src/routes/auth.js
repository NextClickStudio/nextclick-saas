const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');

router.get('/', async (req, res) => {
  const shopify = req.shopify;
  try {
    await shopify.auth.begin({
      shop: shopify.utils.sanitizeShop(req.query.shop, true),
      callbackPath: '/api/auth/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
  } catch (err) {
    console.error('Auth begin error:', err);
    res.status(500).send('Failed to start authentication.');
  }
});

router.get('/callback', async (req, res) => {
  const shopify = req.shopify;
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;

    // 1. Fetch shop info from Shopify
    const shopInfo = await getShopInfo(shopify, session);

    // 2. Upsert shop FIRST — so the FK exists before we save the session
    await prisma.shop.upsert({
      where: { shopDomain: session.shop },
      update: {
        accessToken: session.accessToken,
        email: shopInfo?.email || null,
        ownerName: shopInfo?.shop_owner || shopInfo?.name || null,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        shopDomain: session.shop,
        accessToken: session.accessToken,
        email: shopInfo?.email || null,
        ownerName: shopInfo?.shop_owner || shopInfo?.name || null,
        planName: 'starter',
        planStatus: 'pending',
        generationsLimit: 1000,
        generationsUsed: 0,
        isActive: true,
      },
    });

    // 3. NOW save the session (FK to Shop.id now exists)
    await shopify.config.sessionStorage.storeSession(session);

    // 4. Ensure default config
    const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    await prisma.shopConfig.upsert({
      where: { shopId: shop.id },
      update: {},
      create: {
        shopId: shop.id,
        category: 'beauty',
        brandName: shopInfo?.name || 'My Brand',
      },
    });

    // 5. Register webhooks (non-blocking)
    registerWebhooks(shopify, session).catch(err =>
      console.warn('Webhook registration failed:', err.message)
    );

    // 6. Verifica che la sessione abbia tutti gli scopes necessari
    const requiredScopes = ['read_products', 'write_script_tags', 'read_script_tags'];
    const sessionScopes = session.scope ? session.scope.split(',') : [];
    const missingScopes = requiredScopes.filter(s => !sessionScopes.includes(s));

    if (missingScopes.length > 0) {
      console.warn('Missing scopes:', missingScopes, '— forcing re-auth');
      return await shopify.auth.begin({
        shop: session.shop,
        callbackPath: '/api/auth/callback',
        isOnline: false,
        rawRequest: req,
        rawResponse: res,
      });
    }

    // 7. Redirect into embedded app
    const host = req.query.host;
    res.redirect(`/?shop=${session.shop}&host=${host}`);

  } catch (err) {
    console.error('Auth callback error:', err.message, err.stack);
    res.status(500).send('Authentication failed: ' + err.message);
  }
});

async function getShopInfo(shopify, session) {
  try {
    const client = new shopify.clients.Rest({ session });
    const resp = await client.get({ path: 'shop' });
    return resp.body?.shop || null;
  } catch (err) {
    console.warn('Could not fetch shop info:', err.message);
    return null;
  }
}

async function registerWebhooks(shopify, session) {
  const base = process.env.HOST;
  const topics = {
    APP_UNINSTALLED: `${base}/api/webhooks/uninstall`,
    SHOP_UPDATE:     `${base}/api/webhooks/shop-update`,
  };
  for (const [topic, callbackUrl] of Object.entries(topics)) {
    try {
      await shopify.webhooks.addHandlers({
        [topic]: [{ deliveryMethod: 'http', callbackUrl, callback: async () => {} }],
      });
    } catch (err) {
      console.warn(`Webhook ${topic} failed:`, err.message);
    }
  }
}

module.exports = router;
