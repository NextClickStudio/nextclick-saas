const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { verifyWidgetRequest } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

router.post('/', verifyWidgetRequest, async (req, res) => {
  const startTime = Date.now();
  const shop = req.shop;
  const config = shop.config;

  try {
    const { answers, sessionId } = req.body;
    if (!answers) return res.status(400).json({ error: 'Missing answers' });

    const products = await prisma.product.findMany({
      where: { shopId: shop.id, isActive: true },
      select: { shopifyId: true, title: true, url: true, imageUrl: true, price: true, category: true, goals: true, skinTypes: true, tags: true, description: true },
    });

    const isPreview = req.query.preview === 'true' || req.headers['x-preview'] === 'true';
    if (products.length === 0) {
      if (isPreview) {
        return res.json({
          generationId: 'preview-' + Date.now(), type: 'products', routine: null, sections: null,
          products: [
            { shopifyId: 'demo1', title: 'Intensive Moisturizing Cream', url: '#', imageUrl: null, price: 29.90, reason: 'Perfect for your dry skin type, provides deep hydration for 24 hours.' },
            { shopifyId: 'demo2', title: 'Vitamin C Anti-aging Serum', url: '#', imageUrl: null, price: 45.00, reason: 'Reduces signs of aging and brightens complexion in just a few weeks.' },
            { shopifyId: 'demo3', title: 'SPF 50+ Sun Protection', url: '#', imageUrl: null, price: 22.50, reason: 'Essential protection against UV rays to keep skin healthy.' },
          ],
          message: '✨ These are sample products. Sync your catalog to see your real products.',
        });
      }
      return res.status(400).json({ error: 'no_products', message: 'No products in catalog. Sync products before using the widget.' });
    }

    const isRoutine = config?.featureRoutine || false;
    const prompt = buildPrompt(config, answers, products, isRoutine);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: isRoutine ? 8192 : 2000,
        temperature: 0.7,
      },
    }, { timeout: 60000 });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;

    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      console.log('PARSE ERROR:', e.message, 'RAW:', rawText?.substring(0, 300));
      return res.status(500).json({ error: 'parse_error', message: 'Generation error. Please retry.' });
    }

    let generation = { id: 'preview-' + Date.now() };
    if (!isPreview) {
      const [gen] = await Promise.all([
        prisma.generation.create({
          data: { shopId: shop.id, sessionId: sessionId || null, answers, resultType: isRoutine ? 'routine' : 'products', productsCount: parsed.products?.length || 0, tokensUsed, durationMs: Date.now() - startTime },
        }),
        prisma.shop.update({ where: { id: shop.id }, data: { generationsUsed: { increment: 1 } } }),
      ]);
      generation = gen;
    }

    res.json({ generationId: generation.id, type: isRoutine ? 'routine' : 'products', routine: parsed.routine || null, sections: parsed.sections || null, products: parsed.products || [], message: parsed.message || null });

  } catch (err) {
    console.error('Generation error:', err);
    if (!req.query.preview) {
      await prisma.generation.create({
        data: { shopId: shop.id, answers: req.body?.answers || {}, resultType: 'error', error: true, errorMessage: err.message, durationMs: Date.now() - startTime },
      }).catch(() => {});
    }
    res.status(500).json({ error: 'generation_failed', message: 'Generation failed. Please retry.' });
  }
});

router.post('/click', async (req, res) => {
  try {
    const { generationId, shopifyId, productTitle, price } = req.body;
    if (!generationId || generationId.startsWith('preview-')) return res.json({ ok: true });
    await prisma.productClick.create({ data: { generationId, shopifyId: String(shopifyId), productTitle, price: price || null } });
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

function buildPrompt(config, answers, products, isRoutine) {
  const category = config?.category || 'beauty';
  const persona = config?.aiPersona || 'You are an expert consultant. Provide personalized and professional advice.';
  const lang = config?.aiLanguage || 'it';
  const productList = products.slice(0, 80).map(p => `- ID:${p.shopifyId} | ${p.title} | €${p.price || '?'} | Goals:${(p.goals||[]).join(',')} | Tags:${(p.tags||[]).join(',')}`).join('\n');
  const answersText = Object.entries(answers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');

  if (isRoutine) {
    return `${persona}\n\nYou are an expert ${getCategoryExpert(category)}.\nResponse language: ${lang}.\nRespond ONLY with a valid JSON object, no markdown.\n\nUSER PROFILE:\n${answersText}\n\nAVAILABLE PRODUCT CATALOG:\n${productList}\n\nGenerate a personalized routine. Required JSON structure:\n{\n  "message": "Personalized intro (2-3 sentences)",\n  "sections": [\n    {\n      "title": "Section title",\n      "steps": [\n        {\n          "order": 1,\n          "action": "Short gesture description",\n          "tip": "Expert tip",\n          "productId": "shopify_id_or_null",\n          "productTitle": "Product name or null",\n          "productUrl": "url_or_null",\n          "productImage": "image_url_or_null",\n          "productPrice": 0.00\n        }\n      ]\n    }\n  ],\n  "products": [\n    {\n      "shopifyId": "id",\n      "title": "name",\n      "url": "url",\n      "imageUrl": "image_url",\n      "price": 0.00,\n      "reason": "Why this product is perfect for you"\n    }\n  ]\n}\n\nUse ONLY products from the catalog. Select 3-7 relevant products.`;
  } else {
    return `${persona}\n\nYou are an expert ${getCategoryExpert(category)}.\nResponse language: ${lang}.\nRespond ONLY with a valid JSON object, no markdown.\n\nUSER PROFILE:\n${answersText}\n\nAVAILABLE PRODUCT CATALOG:\n${productList}\n\nSelect the 3-5 most suitable products for this user. JSON structure:\n{\n  "message": "Personalized intro (1-2 sentences)",\n  "products": [\n    {\n      "shopifyId": "id",\n      "title": "name",\n      "url": "url",\n      "imageUrl": "image_url",\n      "price": 0.00,\n      "reason": "Why this product is perfect for you"\n    }\n  ]\n}\n\nUse ONLY products from the catalog. Max 5 products.`;
  }
}

function getCategoryExpert(category) {
  const experts = { beauty: 'dermatologist and skincare expert', nutrition: 'sports nutritionist', baby: 'pediatrician and neonatal specialist', pet: 'veterinary nutritionist', wellness: 'wellness specialist', fitness: 'personal trainer and nutritionist' };
  return experts[category] || 'specialized consultant';
}

module.exports = router;
