const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');
const axios   = require('axios');
const { verifyShopifySession } = require('../middleware/auth');

// Helper: chiama l'API REST Shopify con il token salvato nel DB
async function shopifyGet(shopDomain, accessToken, path, params = {}) {
  const url = `https://${shopDomain}/admin/api/2024-10/${path}.json`;
  const res = await axios.get(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    params,
  });
  return res.data;
}

router.get('/', verifyShopifySession, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, category, isActive } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const where = { shopId: req.shop.id };
    if (search)              where.title    = { contains: search, mode: 'insensitive' };
    if (category)            where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: parseInt(limit), orderBy: { title: 'asc' } }),
      prisma.product.count({ where }),
    ]);
    res.json({ products, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync', verifyShopifySession, async (req, res) => {
  try {
    const { shopDomain, accessToken } = req.shop;

    if (!accessToken) {
      return res.status(401).json({ error: 'Token mancante. Reinstalla l\'app.' });
    }

    let allProducts = [];
    let pageInfo    = null;

    do {
      const params = { limit: 250, fields: 'id,title,handle,variants,images,tags,product_type,body_html' };
      if (pageInfo) params.page_info = pageInfo;

      const url = `https://${shopDomain}/admin/api/2024-10/products.json`;
      const response = await axios.get(url, {
        headers: { 'X-Shopify-Access-Token': accessToken },
        params,
      });

      allProducts = allProducts.concat(response.data.products || []);

      // Cursor pagination dal Link header
      const linkHeader = response.headers?.link || '';
      const nextMatch  = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
      pageInfo = nextMatch ? nextMatch[1] : null;

    } while (pageInfo);

    let synced = 0;
    for (const p of allProducts) {
      const variant      = p.variants?.[0];
      const price        = variant?.price ? parseFloat(variant.price) : null;
      const comparePrice = variant?.compare_at_price ? parseFloat(variant.compare_at_price) : null;
      const imageUrl     = p.images?.[0]?.src || null;
      const tags         = p.tags ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      await prisma.product.upsert({
        where:  { shopId_shopifyId: { shopId: req.shop.id, shopifyId: String(p.id) } },
        update: {
          title: p.title, handle: p.handle,
          url:   `https://${shopDomain}/products/${p.handle}`,
          imageUrl, price, comparePrice,
          category:    p.product_type || null, tags,
          description: p.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
          syncedAt:    new Date(),
        },
        create: {
          shopId: req.shop.id, shopifyId: String(p.id),
          title: p.title, handle: p.handle,
          url:   `https://${shopDomain}/products/${p.handle}`,
          imageUrl, price, comparePrice,
          category:    p.product_type || null, tags,
          description: p.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
          isAiManaged: true,
        },
      });
      synced++;
    }

    res.json({ synced, total: allProducts.length });
  } catch (err) {
    console.error('Sync error:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Token non valido. Reinstalla l\'app per aggiornare i permessi.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Import manuale prodotto tramite URL Shopify
router.post('/import-url', verifyShopifySession, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL mancante' });

    const match = url.match(/\/products\/([^/?#]+)/);
    if (!match) return res.status(400).json({ error: 'URL non valido. Deve contenere /products/handle' });
    const handle = match[1];

    const { shopDomain, accessToken } = req.shop;
    if (!accessToken) return res.status(401).json({ error: 'Token mancante. Reinstalla l\'app.' });

    const shopifyUrl = `https://${shopDomain}/admin/api/2024-10/products.json`;
    const response   = await axios.get(shopifyUrl, {
      headers: { 'X-Shopify-Access-Token': accessToken },
      params:  { handle, fields: 'id,title,handle,variants,images,tags,product_type,body_html', limit: 1 },
    });

    const products = response.data?.products || [];
    if (products.length === 0) {
      return res.status(404).json({ error: 'Prodotto non trovato. Verifica che l\'URL sia corretto e appartenga a questo store.' });
    }

    const p          = products[0];
    const variant    = p.variants?.[0];
    const price      = variant?.price ? parseFloat(variant.price) : null;
    const comparePrice = variant?.compare_at_price ? parseFloat(variant.compare_at_price) : null;
    const imageUrl   = p.images?.[0]?.src || null;
    const tags       = p.tags ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const product = await prisma.product.upsert({
      where:  { shopId_shopifyId: { shopId: req.shop.id, shopifyId: String(p.id) } },
      update: {
        title: p.title, handle: p.handle,
        url:   `https://${shopDomain}/products/${p.handle}`,
        imageUrl, price, comparePrice,
        category:    p.product_type || null, tags,
        description: p.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
        syncedAt:    new Date(),
      },
      create: {
        shopId: req.shop.id, shopifyId: String(p.id),
        title: p.title, handle: p.handle,
        url:   `https://${shopDomain}/products/${p.handle}`,
        imageUrl, price, comparePrice,
        category:    p.product_type || null, tags,
        description: p.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
        isAiManaged: true,
      },
    });

    res.json({ product });
  } catch (err) {
    console.error('Import URL error:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Token non valido. Reinstalla l\'app.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', verifyShopifySession, async (req, res) => {
  try {
    const { goals, skinTypes, category, tags, isActive, isAiManaged } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id, shopId: req.shop.id },
      data: {
        ...(goals       !== undefined && { goals }),
        ...(skinTypes   !== undefined && { skinTypes }),
        ...(category    !== undefined && { category }),
        ...(tags        !== undefined && { tags }),
        ...(isActive    !== undefined && { isActive }),
        ...(isAiManaged !== undefined && { isAiManaged }),
      },
    });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk-update', verifyShopifySession, async (req, res) => {
  try {
    const { ids, isAiManaged, isActive } = req.body;
    await prisma.product.updateMany({
      where: { id: { in: ids }, shopId: req.shop.id },
      data: {
        ...(isAiManaged !== undefined && { isAiManaged }),
        ...(isActive    !== undefined && { isActive }),
      },
    });
    res.json({ updated: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai-tag', verifyShopifySession, async (req, res) => {
  try {
    if (req.shop.planName === 'starter') {
      return res.status(403).json({ error: 'AI tagging disponibile dal piano Pro' });
    }
    const products = await prisma.product.findMany({
      where: { shopId: req.shop.id, isAiManaged: true },
      select: { id: true, title: true, description: true, tags: true },
    });
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    let tagged = 0;
    for (const product of products) {
      try {
        const result = await model.generateContent(
          `Analizza questo prodotto e restituisci SOLO JSON con goals (array) e skinTypes (array).\n` +
          `Prodotto: ${product.title}\nDescrizione: ${product.description || ''}\nRispondi SOLO con JSON.`
        );
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);
        await prisma.product.update({
          where: { id: product.id },
          data: { goals: data.goals || [], skinTypes: data.skinTypes || [] },
        });
        tagged++;
      } catch (e) {
        console.warn(`AI tag failed for ${product.title}:`, e.message);
      }
    }
    res.json({ tagged, total: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
