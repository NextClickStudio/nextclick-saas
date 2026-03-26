const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');

// GET /api/auth?shop=xxx.myshopify.com  — avvia OAuth standard
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
    const callback = await shopify.auth.callback({ rawRequest: req, rawResponse: res });
    const { session } = callback;

    const shopInfo = await getShopInfo(shopify, session).catch(() => null);

    await prisma.shop.upsert({
      where:  { shopDomain: session.shop },
      update: { accessToken: session.accessToken, email: shopInfo?.email || null, ownerName: shopInfo?.shop_owner || null, isActive: true, updatedAt: new Date() },
      create: { shopDomain: session.shop, accessToken: session.accessToken, email: shopInfo?.email || null, ownerName: shopInfo?.shop_owner || null, planName: 'starter', planStatus: 'pending', generationsLimit: 1000, generationsUsed: 0, isActive: true },
    });

    await shopify.config.sessionStorage.storeSession(session).catch(() => {});

    const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    await prisma.shopConfig.upsert({
      where:  { shopId: shop.id },
      update: {},
      create: { shopId: shop.id, category: 'beauty', brandName: shopInfo?.name || 'My Brand' },
    });

    const host = req.query.host || '';
    res.redirect('/?shop=' + session.shop + '&host=' + host);
  } catch (err) {
    console.error('Auth callback error:', err.message);
    res.status(500).send('<h2>Authentication failed</h2><p>' + err.message + '</p>');
  }
});

// GET /api/auth/setup?shop=xxx.myshopify.com&secret=SETUP_SECRET
// Crea lo shop nel DB usando SHOPIFY_ADMIN_API_ACCESS_TOKEN — chiamare UNA VOLTA SOLA
router.get('/setup', async (req, res) => {
  try {
    const { shop, secret } = req.query;

    // Protezione minima con secret
    const expectedSecret = process.env.SETUP_SECRET || process.env.SESSION_SECRET || 'setup';
    if (secret !== expectedSecret) {
      return res.status(403).json({ error: 'Invalid secret' });
    }

    if (!shop) return res.status(400).json({ error: 'Missing shop parameter' });

    const accessToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
    if (!accessToken) return res.status(500).json({ error: 'SHOPIFY_ADMIN_API_ACCESS_TOKEN not set' });

    const existing = await prisma.shop.upsert({
      where:  { shopDomain: shop },
      update: { accessToken, isActive: true, updatedAt: new Date() },
      create: {
        shopDomain:       shop,
        accessToken,
        planName:         'pro',
        planStatus:       'active',
        generationsLimit: 99999,
        generationsUsed:  0,
        isActive:         true,
      },
    });

    await prisma.shopConfig.upsert({
      where:  { shopId: existing.id },
      update: {},
      create: { shopId: existing.id, category: 'beauty', brandName: 'My Brand' },
    });

    console.log('[setup] shop created/updated:', shop);
    res.json({ ok: true, message: 'Shop setup completato!', shopId: existing.id, shopDomain: existing.shopDomain });
  } catch (err) {
    console.error('[setup] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function getShopInfo(shopify, session) {
  const client = new shopify.clients.Rest({ session });
  const resp   = await client.get({ path: 'shop' });
  return resp.body?.shop || null;
}

module.exports = router;
