const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { verifyShopifySession } = require('../middleware/auth');

// GET /api/products — list products for this shop
router.get('/', verifyShopifySession, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, category, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { shopId: req.shop.id };
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (category) where.category = category;
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

// POST /api/products/sync — sync all products from Shopify
router.post('/sync', verifyShopifySession, async (req, res) => {
  try {
    const { session } = req;
    const shopify = req.shopify;

    // Fetch from Shopify REST API
    const client = new shopify.clients.Rest({ session: req.session_data });
    let allProducts = [];
    let page_info = null;

    do {
      const params = { limit: 250, fields: 'id,title,handle,variants,images,tags,product_type,body_html' };
      if (page_info) params.page_info = page_info;

      const response = await client.get({ path: 'products', query: params });
      allProducts = allProducts.concat(response.body.products || []);
      page_info = response.pageInfo?.nextPage?.query?.page_info || null;
    } while (page_info);

    // Upsert into DB
    let synced = 0;
    for (const p of allProducts) {
      const variant = p.variants?.[0];
      const price = variant?.price ? parseFloat(variant.price) : null;
      const comparePrice = variant?.compare_at_price ? parseFloat(variant.compare_at_price) : null;
      const imageUrl = p.images?.[0]?.src || null;
      const tags = p.tags ? p.tags.split(',').map(t => t.trim()) : [];

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
          shopId: req.shop.id,
          shopifyId: String(p.id),
          title: p.title,
          handle: p.handle,
          url: `https://${req.shop.shopDomain}/products/${p.handle}`,
          imageUrl,
          price,
          comparePrice,
          category: p.product_type || null,
          tags,
          description: p.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
          isAiManaged: true,
        },
      });
      synced++;
    }

    res.json({ synced, total: allProducts.length });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:id — update product metadata (goals, skinTypes, etc.)
router.patch('/:id', verifyShopifySession, async (req, res) => {
  try {
    const { goals, skinTypes, category, tags, isActive, isAiManaged } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id, shopId: req.shop.id },
      data: {
        ...(goals !== undefined && { goals }),
        ...(skinTypes !== undefined && { skinTypes }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags }),
        ...(isActive !== undefined && { isActive }),
        ...(isAiManaged !== undefined && { isAiManaged }),
      },
    });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/bulk-update — toggle AI managed / manual
router.post('/bulk-update', verifyShopifySession, async (req, res) => {
  try {
    const { ids, isAiManaged, isActive } = req.body;
    await prisma.product.updateMany({
      where: { id: { in: ids }, shopId: req.shop.id },
      data: {
        ...(isAiManaged !== undefined && { isAiManaged }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ updated: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/ai-tag — use AI to auto-tag all products
router.post('/ai-tag', verifyShopifySession, async (req, res) => {
  try {
    if (req.shop.planName === 'starter') {
      return res.status(403).json({ error: 'AI tagging available from Pro plan' });
    }

    const products = await prisma.product.findMany({
      where: { shopId: req.shop.id, isAiManaged: true },
      select: { id: true, title: true, description: true, tags: true },
    });

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let tagged = 0;
    for (const product of products) {
      const prompt = `Analizza questo prodotto e restituisci SOLO un JSON con:
- goals: array di obiettivi tra ["idratazione","anti-età","luminosità","imperfezioni","lenitivo","purificante","rassodante","energetico","dimagrante","recovery","proteine","vitamine"]
- skinTypes: array tra ["secca","normale","grassa","mista","sensibile","atopica","matura"] (solo se beauty/skincare, altrimenti [])

Prodotto: ${product.title}
Descrizione: ${product.description || ''}
Tag esistenti: ${product.tags.join(', ')}

Rispondi SOLO con il JSON, niente altro.`;

      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);

        await prisma.product.update({
          where: { id: product.id },
          data: {
            goals: data.goals || [],
            skinTypes: data.skinTypes || [],
          },
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
