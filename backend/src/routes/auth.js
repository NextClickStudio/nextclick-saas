const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

// GET /api/auth?shop=mystore.myshopify.com
// Initiates OAuth — Shopify redirects here first
router.get('/', async (req, res) => {
  const shopify = req.shopify;
  await shopify.auth.begin({
    shop: shopify.utils.sanitizeShop(req.query.shop, true),
    callbackPath: '/api/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
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

    // Upsert shop in DB
    const shopInfo = await getShopInfo(session);

    await prisma.shop.upsert({
      where: { shopDomain: session.shop },
      update: {
        accessToken: session.accessToken,
        email: shopInfo?.email,
        ownerName: shopInfo?.name,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        shopDomain: session.shop,
        accessToken: session.accessToken,
        email: shopInfo?.email,
        ownerName: shopInfo?.name,
        planName: 'starter',
        planStatus: 'pending',
        generationsLimit: 1000,
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

    // Register webhooks
    await registerWebhooks(shopify, session);

    // Redirect to embedded app
    const host = req.query.host;
    const redirectUrl = `/?shop=${session.shop}&host=${host}`;
    res.redirect(redirectUrl);

  } catch (err) {
    console.error('Auth callback error:', err);
    res.status(500).send('Authentication failed. Please try reinstalling the app.');
  }
});

async function getShopInfo(session) {
  try {
    const client = new (require('@shopify/shopify-api').Shopify).Clients.Rest({
      session,
    });
    const resp = await client.get({ path: 'shop' });
    return resp.body?.shop;
  } catch {
    return null;
  }
}

async function registerWebhooks(shopify, session) {
  const webhooks = [
    { topic: 'APP_UNINSTALLED', address: `${process.env.HOST}/api/webhooks/uninstall` },
    { topic: 'SHOP_UPDATE', address: `${process.env.HOST}/api/webhooks/shop-update` },
  ];

  for (const wh of webhooks) {
    try {
      await shopify.webhooks.addHandlers({
        [wh.topic]: [{
          deliveryMethod: 'http',
          callbackUrl: wh.address,
          callback: async () => {},
        }],
      });
    } catch (err) {
      console.warn(`Webhook ${wh.topic} registration failed:`, err.message);
    }
  }
}

module.exports = router;
