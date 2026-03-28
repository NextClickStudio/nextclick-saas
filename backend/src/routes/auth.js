const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');
const crypto  = require('crypto');

// Salva gli state OAuth nel DB invece dei cookie (evita il problema cookie third-party)
async function saveOAuthState(state, shop) {
  await prisma.shopSession.upsert({
    where: { id: 'oauth_state_' + state },
    update: { payload: { state, shop, createdAt: Date.now() }, updatedAt: new Date() },
    create: { id: 'oauth_state_' + state, shopId: shop, payload: { state, shop, createdAt: Date.now() }, updatedAt: new Date() },
  });
}

async function verifyOAuthState(state) {
  try {
    const record = await prisma.shopSession.findUnique({ where: { id: 'oauth_state_' + state } });
    if (!record) return null;
    const data = record.payload;
    // State valido per 10 minuti
    if (Date.now() - data.createdAt > 10 * 60 * 1000) return null;
    // Cancella dopo uso
    await prisma.shopSession.delete({ where: { id: 'oauth_state_' + state } });
    return data.shop;
  } catch { return null; }
}

// GET /api/auth?shop=xxx.myshopify.com — avvia OAuth senza dipendere dai cookie
router.get('/', async (req, res) => {
  try {
    const shopify  = req.shopify;
    const shop     = req.query.shop?.trim().toLowerCase();
    if (!shop || !shop.includes('.myshopify.com')) {
      return res.status(400).send('Invalid shop parameter');
    }

    const state    = crypto.randomBytes(16).toString('hex');
    const apiKey   = process.env.SHOPIFY_API_KEY;
    const scopes   = ['read_products', 'write_script_tags', 'read_script_tags', 'write_products', 'read_orders'].join(',');
    const redirect = encodeURIComponent(process.env.HOST + '/api/auth/callback');
    const authUrl  = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${redirect}&state=${state}&grant_options[]=`;

    // Salva state nel DB invece del cookie
    await saveOAuthState(state, shop);

    console.log('[auth] redirecting to Shopify OAuth for', shop);
    res.redirect(authUrl);
  } catch (err) {
    console.error('Auth begin error:', err.message);
    res.status(500).send('Failed to start authentication: ' + err.message);
  }
});

// GET /api/auth/callback — completa OAuth verificando state dal DB
router.get('/callback', async (req, res) => {
  const shopify = req.shopify;
  try {
    const { code, shop, state, hmac } = req.query;

    // Verifica state dal DB (non dal cookie)
    const savedShop = await verifyOAuthState(state);
    if (!savedShop || savedShop !== shop) {
      console.error('[auth] state mismatch — savedShop:', savedShop, 'shop:', shop);
      return res.status(400).send('<h2>Authentication failed</h2><p>Invalid state parameter. Please try again.</p>');
    }

    // Scambia code per access token
    const axios = require('axios');
    const tokenResp = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id:     process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    });
    const accessToken = tokenResp.data?.access_token;
    if (!accessToken) throw new Error('No access token received');

    console.log('[auth] OAuth complete for', shop, '— token starts with', accessToken.substring(0, 8));

    // Crea sessione manualmente per il SDK
    const { Session } = require('@shopify/shopify-api');
    const session = new Session({
      id:          'offline_' + shop,
      shop,
      state,
      isOnline:    false,
      accessToken,
      scope:       ['read_products', 'write_script_tags', 'read_script_tags', 'write_products', 'read_orders'].join(','),
    });
    await shopify.config.sessionStorage.storeSession(session);

    const shopInfo = await getShopInfo(shopify, session).catch(() => null);

    await prisma.shop.upsert({
      where:  { shopDomain: session.shop },
      update: { accessToken: session.accessToken, email: shopInfo?.email || null, ownerName: shopInfo?.shop_owner || null, isActive: true, updatedAt: new Date() },
      create: { shopDomain: session.shop, accessToken: session.accessToken, email: shopInfo?.email || null, ownerName: shopInfo?.shop_owner || null, planName: 'starter', planStatus: 'pending', generationsLimit: 1000, generationsUsed: 0, isActive: true },
    });

    await shopify.config.sessionStorage.storeSession(session).catch(() => {});

    const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    await prisma.shopConfig.upsert({
      where:  { shopId: shopRecord.id },
      update: {},
      create: { shopId: shopRecord.id, category: 'beauty', brandName: shopInfo?.name || 'My Brand' },
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
