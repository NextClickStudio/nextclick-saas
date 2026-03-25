const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');

const authModule = require('../middleware/auth');
const verifyShopifySession =
  authModule.verifyShopifySession ||
  (typeof authModule === 'function' ? authModule : null);

if (typeof verifyShopifySession !== 'function') {
  console.error('[FATAL] verifyShopifySession undefined in routes/products.js');
  process.exit(1);
}

// GET /api/products
router.get('/', verifyShopifySession, async (req, res) => {
  try {
    const { page = 1, limit = 100, search, category, isActive } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const where = { shopId: req.shop.id };
    if (search)                 where.title    = { contains: search, mode: 'insensitive' };
    if (category)               where.category = category;
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

// POST /api/products/manual
router.post('/manual', verifyShopifySession, async (req, res) => {
  try {
    const { title, price, comparePrice, url, imageUrl, category, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Il nome del prodotto è obbligatorio' });

    const fakeShopifyId = 'manual_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const handle = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const product = await prisma.product.create({
      data: {
        shopId:       req.shop.id,
        shopifyId:    fakeShopifyId,
        title:        title.trim(),
        handle,
        url:          url?.trim()          || ('https://' + req.shop.shopDomain + '/products/' + handle),
        imageUrl:     imageUrl?.trim()     || null,
        price:        price        != null ? parseFloat(price)        : null,
        comparePrice: comparePrice != null ? parseFloat(comparePrice) : null,
        category:     category?.trim()     || null,
        description:  description?.trim()  || null,
        isAiManaged:  true,
        isActive:     true,
        syncedAt:     new Date(),
      },
    });
    res.status(201).json({ product });
  } catch (err) {
    console.error('[products/manual]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:id
router.patch('/:id', verifyShopifySession, async (req, res) => {
  try {
    const { title, price, comparePrice, url, imageUrl, category, description, goals, skinTypes, isActive, isAiManaged } = req.body;
    const data = {};
    if (title        !== undefined) data.title        = title;
    if (price        !== undefined) data.price        = price != null ? parseFloat(price) : null;
    if (comparePrice !== undefined) data.comparePrice = comparePrice != null ? parseFloat(comparePrice) : null;
    if (url          !== undefined) data.url          = url;
    if (imageUrl     !== undefined) data.imageUrl     = imageUrl;
    if (category     !== undefined) data.category     = category;
    if (description  !== undefined) data.description  = description;
    if (goals        !== undefined) data.goals        = goals;
    if (skinTypes    !== undefined) data.skinTypes    = skinTypes;
    if (isActive     !== undefined) data.isActive     = isActive;
    if (isAiManaged  !== undefined) data.isAiManaged  = isAiManaged;
    const product = await prisma.product.update({ where: { id: req.params.id, shopId: req.shop.id }, data });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', verifyShopifySession, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id, shopId: req.shop.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/bulk-update
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

// POST /api/products/ai-tag
router.post('/ai-tag', verifyShopifySession, async (req, res) => {
  try {
    if (req.shop.planName === 'starter') return res.status(403).json({ error: 'AI tagging disponibile dal piano Pro' });
    const products = await prisma.product.findMany({
      where: { shopId: req.shop.id, isAiManaged: true },
      select: { id: true, title: true, description: true },
    });
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    let tagged = 0;
    for (const product of products) {
      try {
        const result = await model.generateContent(
          'Analizza questo prodotto e restituisci SOLO JSON con goals (array) e skinTypes (array).\n' +
          'Prodotto: ' + product.title + '\nDescrizione: ' + (product.description || '') + '\nRispondi SOLO con JSON valido.'
        );
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);
        await prisma.product.update({ where: { id: product.id }, data: { goals: data.goals || [], skinTypes: data.skinTypes || [] } });
        tagged++;
      } catch (e) {
        console.warn('[products/ai-tag] failed for "' + product.title + '":', e.message);
      }
    }
    res.json({ tagged, total: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
