const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

// GET /api/auth?shop=mystore.myshopify.com
// Initiates OAuth — Shopify redirects here first
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
    res.status(500).send('Failed to start authentication. Please try again.');
  }
});

// GET /api/auth/callback
// Shopify redirects here after merchant approves
router.get('/callback', async (req, res) => {
  const shopify = req.shopify;

  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;

    // Fetch shop info using the correct v11 REST client
    const shopInfo = await getShopInfo(shopify, session);

    // Upsert shop in DB
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

    // Ensure default config exists
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

    // Register webhooks (non-blocking)
    registerWebhooks(shopify, session).catch(err =>
      console.warn('Webhook registration failed:', err.message)
    );

    // Redirect to embedded app
    const host = req.query.host;
    const redirectUrl = `/?shop=${session.shop}&host=${host}`;
    res.redirect(redirectUrl);

  } catch (err) {
    console.error('Auth callback error:', err);
    res.status(500).send('Authentication failed. Please try reinstalling the app.');
  }
});

// Correct way to call REST API with @shopify/shopify-api v9+
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
  const topics = ['APP_UNINSTALLED', 'SHOP_UPDATE'];
  const addresses = {
    APP_UNINSTALLED: `${process.env.HOST}/api/webhooks/uninstall`,
    SHOP_UPDATE: `${process.env.HOST}/api/webhooks/shop-update`,
  };

  for (const topic of topics) {
    try {
      await shopify.webhooks.addHandlers({
        [topic]: [{
          deliveryMethod: 'http',
          callbackUrl: addresses[topic],
          callback: async () => {},
        }],
      });
    } catch (err) {
      console.warn(`Webhook ${topic} registration failed:`, err.message);
    }
  }
}

module.exports = router;
