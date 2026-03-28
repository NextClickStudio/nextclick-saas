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


// POST /api/products/sync — sincronizza da Shopify con paginazione
router.post('/sync', verifyShopifySession, async (req, res) => {
  try {
    const shopify     = req.shopify;
    const shopDomain  = req.shop.shopDomain;
    const accessToken = req.shop.accessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'Token non disponibile. Reinstalla l\'app.' });
    }

    // Chiama Shopify REST API con paginazione cursor-based
    const axios = require('axios');
    let allProducts = [];
    let url = `https://${shopDomain}/admin/api/2024-10/products.json?limit=250&fields=id,title,handle,variants,images,tags,product_type,body_html`;

    while (url) {
      const resp = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const products = resp.data?.products || [];
      allProducts = allProducts.concat(products);

      // Gestione paginazione Link header
      const linkHeader = resp.headers?.link || '';
      const nextMatch  = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }

    // Upsert su Prisma
    let synced = 0;
    for (const p of allProducts) {
      try {
        const variant      = p.variants?.[0];
        const price        = variant?.price        ? parseFloat(variant.price)             : null;
        const comparePrice = variant?.compare_at_price ? parseFloat(variant.compare_at_price) : null;
        const imageUrl     = p.images?.[0]?.src   || null;
        const tags         = p.tags ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        const description  = p.body_html
          ? p.body_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
          : null;

        await prisma.product.upsert({
          where: { shopId_shopifyId: { shopId: req.shop.id, shopifyId: String(p.id) } },
          update: {
            title:        p.title,
            handle:       p.handle,
            url:          `https://${shopDomain}/products/${p.handle}`,
            imageUrl,
            price,
            comparePrice,
            category:     p.product_type || null,
            tags,
            description,
            syncedAt:     new Date(),
          },
          create: {
            shopId:       req.shop.id,
            shopifyId:    String(p.id),
            title:        p.title,
            handle:       p.handle,
            url:          `https://${shopDomain}/products/${p.handle}`,
            imageUrl,
            price,
            comparePrice,
            category:     p.product_type || null,
            tags,
            description,
            isActive:     true,
            isAiManaged:  true,
            syncedAt:     new Date(),
          },
        });
        synced++;
      } catch (upsertErr) {
        console.warn('[sync] upsert failed for', p.id, upsertErr.message);
      }
    }

    res.json({ synced, total: allProducts.length });

  } catch (err) {
    console.error('[products/sync]', err.message);
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      return res.status(401).json({
        error: 'Token non valido o permessi insufficienti. Reinstalla l\'app per aggiornare i permessi.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// POST /api/products/bulk-import
// Body: { urls: ["https://...", ...] }
router.post('/bulk-import', verifyShopifySession, async (req, res) => {
  const { urls } = req.body;
  if (!Array.isArray(urls) || urls.length === 0)
    return res.status(400).json({ error: 'No URLs provided' });
  if (urls.length > 50)
    return res.status(400).json({ error: 'Max 50 URLs per import' });

  const axios = require('axios');
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { maxOutputTokens: 4096, temperature: 0.2 },
  }, { timeout: 30000 });

  const results = { imported: 0, failed: 0, errors: [] };

  for (const rawUrl of urls) {
    const url = rawUrl.trim();
    if (!url) continue;
    try {
      // 1. Fetch the page HTML
      const resp = await axios.get(url, {
        timeout: 12000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NextClickBot/1.0)' },
        maxRedirects: 5,
      });
      const html = resp.data || '';

      // 2. Extract relevant text (title, meta, price patterns) — strip scripts/styles
      const clean = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 4000); // keep first 4k chars to stay within token budget

      // 3. Ask Gemini to extract structured product info
      const prompt = `Analyze this product page content and extract structured data.
Return ONLY a valid JSON object with these fields:
{
  "title": "product name",
  "price": 0.00,
  "comparePrice": null,
  "imageUrl": "https://... or null",
  "description": "1-2 sentence description",
  "category": "beauty|skincare|haircare|makeup|fragrance|nutrition|wellness|other",
  "goals": ["goal1", "goal2"],
  "skinTypes": ["skintype1"],
  "tags": ["tag1", "tag2"]
}

For goals use values like: Idratazione, Anti-età, Luminosità, Imperfezioni, Lenitivo, Nutrizione, Protezione, Purificante
For skinTypes use: Secca, Normale, Grassa, Mista, Sensibile, Tutti i tipi
Extract price as a number (no currency symbol).
If a field cannot be determined, use null or empty array.

PAGE URL: ${url}
PAGE CONTENT:
${clean}`;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text().replace(/```json|```/g, '').trim();
      // Try to fix truncated JSON by closing open structures
let jsonStr = rawText;
if (!jsonStr.endsWith('}')) {
  const lastBrace = jsonStr.lastIndexOf('}');
  jsonStr = lastBrace > 0 ? jsonStr.slice(0, lastBrace + 1) : jsonStr + '}';
}
const data = JSON.parse(jsonStr);
if (!data.title) throw new Error('No title extracted');

      const fakeId = 'import_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const handle = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Upsert by URL to avoid duplicates
      const existing = await prisma.product.findFirst({ where: { shopId: req.shop.id, url } });
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            title: data.title, price: data.price || null,
            comparePrice: data.comparePrice || null,
            imageUrl: data.imageUrl || null,
            description: data.description || null,
            category: data.category || null,
            goals: data.goals || [], skinTypes: data.skinTypes || [],
            tags: data.tags || [], syncedAt: new Date(),
          },
        });
      } else {
        await prisma.product.create({
          data: {
            shopId: req.shop.id, shopifyId: fakeId,
            title: data.title, handle, url,
            imageUrl: data.imageUrl || null,
            price: data.price || null,
            comparePrice: data.comparePrice || null,
            description: data.description || null,
            category: data.category || null,
            goals: data.goals || [], skinTypes: data.skinTypes || [],
            tags: data.tags || [], isActive: true, isAiManaged: true, syncedAt: new Date(),
          },
        });
      }
      results.imported++;

    } catch (err) {
      results.failed++;
      results.errors.push({ url, error: err.message?.slice(0, 120) });
      console.warn('[bulk-import] failed:', url, err.message?.slice(0, 80));
    }

    // Small delay to avoid hammering servers
    await new Promise(r => setTimeout(r, 300));
  }

  res.json(results);
});
