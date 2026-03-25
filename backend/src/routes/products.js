const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');
const { verifyShopifySession } = require('../middleware/auth');

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
    const shopify = req.shopify;
    const session = req.session_data; // set by verifyShopifySession

    if (!session || !session.accessToken) {
      return res.status(401).json({ error: 'Session non valida. Reinstalla l\'app.' });
    }

    const client = new shopify.clients.Rest({ session });
    let allProducts = [];

    // Shopify paginates with cursor-based page_info
    let nextPageQuery = null;
    do {
      const query = {
        limit: 250,
        fields: 'id,title,handle,variants,images,tags,product_type,body_html',
      };
      if (nextPageQuery) {
        // page_info-based pagination
        Object.assign(query, nextPageQuery);
      }

      const response = await client.get({ path: 'products', query });
      const products = response.body?.products || [];
      allProducts = allProducts.concat(products);

      // Get next page cursor
      const linkHeader = response.headers?.get?.('link') || response.headers?.link || '';
      const nextMatch  = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
      nextPageQuery    = nextMatch ? { page_info: nextMatch[1], limit: 250 } : null;

    } while (nextPageQuery);

    let synced = 0;
    for (const p of allProducts) {
      const variant      = p.variants?.[0];
      const price        = variant?.price ? parseFloat(variant.price) : null;
      const comparePrice = variant?.compare_at_price ? parseFloat(variant.compare_at_price) : null;
      const imageUrl     = p.images?.[0]?.src || null;
      const tags         = p.tags ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      await prisma.product.upsert({
        where: { shopId_shopifyId: { shopId: req.shop.id, shopifyId: String(p.id) } },
        update: {
          title: p.title,
          handle: p.handle,
          url: `https://${req.shop.shopDomain}/products/${p.handle}`,
          imageUrl,
          price,
          comparePrice,
          category: p.product_type || null,
          tags,
          description: p.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
          syncedAt: new Date(),
        },
        create: {
          shopId:    req.shop.id,
          shopifyId: String(p.id),
          title:     p.title,
          handle:    p.handle,
          url:       `https://${req.shop.shopDomain}/products/${p.handle}`,
          imageUrl,
          price,
          comparePrice,
          category:    p.product_type || null,
          tags,
          description: p.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
          isAiManaged: true,
        },
      });
      synced++;
    }

    res.json({ synced, total: allProducts.length });
  } catch (err) {
    console.error('Sync error:', err.message, err.stack);
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
