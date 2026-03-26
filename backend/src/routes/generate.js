const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { verifyWidgetRequest } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// POST /api/generate — called by the widget on the storefront
router.post('/', verifyWidgetRequest, async (req, res) => {
  const startTime = Date.now();
  const shop = req.shop;
  const config = shop.config;

  try {
    const { answers, sessionId } = req.body;
    if (!answers) return res.status(400).json({ error: 'Missing answers' });

    // Load active products filtered by shop
    const products = await prisma.product.findMany({
      where: { shopId: shop.id, isActive: true },
      select: {
        shopifyId: true, title: true, url: true, imageUrl: true,
        price: true, category: true, goals: true, skinTypes: true,
        tags: true, description: true,
      },
    });

    // In preview mode with no products, return demo data
    const isPreview = req.query.preview === 'true' || req.headers['x-preview'] === 'true';
    if (products.length === 0) {
      if (isPreview) {
        return res.json({
          generationId: 'preview-' + Date.now(),
          type: 'products',
          routine: null,
          sections: null,
          products: [
            { shopifyId: 'demo1', title: 'Crema Idratante Intensiva', url: '#', imageUrl: null, price: 29.90, reason: 'Perfetta per il tuo tipo di pelle secca, fornisce idratazione profonda per 24 ore.' },
            { shopifyId: 'demo2', title: 'Siero Anti-età Vitamine C', url: '#', imageUrl: null, price: 45.00, reason: 'Riduce i segni dell\'invecchiamento e illumina la carnagione in poche settimane.' },
            { shopifyId: 'demo3', title: 'SPF 50+ Protezione Solare', url: '#', imageUrl: null, price: 22.50, reason: 'Protezione essenziale contro i raggi UV per mantenere la pelle sana.' },
          ],
          message: '✨ Questi sono prodotti di esempio. Sincronizza il tuo catalogo per vedere i tuoi prodotti reali.',
        });
      }
      return res.status(400).json({ error: 'no_products', message: 'Nessun prodotto nel catalogo. Sincronizza i prodotti prima di usare il widget.' });
    }

    // Build prompt
    const isRoutine = config?.featureRoutine || false;
    const prompt = buildPrompt(config, answers, products, isRoutine);

   // Call Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    maxOutputTokens: isRoutine ? 1500 : 800,
    temperature: 0.7,
  },
}, { timeout: 60000 });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    console.log('RAW GEMINI RESPONSE:', rawText?.substring(0, 500));
    const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;

    // Parse AI response
    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'parse_error', message: 'Errore nella generazione. Riprova.' });
    }

    // Save generation record (skip in preview)
    let generation = { id: 'preview-' + Date.now() };
    if (!isPreview) {
      const [gen] = await Promise.all([
        prisma.generation.create({
          data: {
            shopId: shop.id,
            sessionId: sessionId || null,
            answers,
            resultType: isRoutine ? 'routine' : 'products',
            productsCount: parsed.products?.length || 0,
            tokensUsed,
            durationMs: Date.now() - startTime,
          },
        }),
        prisma.shop.update({
          where: { id: shop.id },
          data: { generationsUsed: { increment: 1 } },
        }),
      ]);
      generation = gen;
    }

    res.json({
      generationId: generation.id,
      type: isRoutine ? 'routine' : 'products',
      routine: parsed.routine || null,
      sections: parsed.sections || null,
      products: parsed.products || [],
      message: parsed.message || null,
    });

  } catch (err) {
    console.error('Generation error:', err);

    if (!req.query.preview) {
      await prisma.generation.create({
        data: {
          shopId: shop.id,
          answers: req.body?.answers || {},
          resultType: 'error',
          error: true,
          errorMessage: err.message,
          durationMs: Date.now() - startTime,
        },
      }).catch(() => {});
    }

    res.status(500).json({ error: 'generation_failed', message: 'Generazione fallita. Riprova.' });
  }
});

// POST /api/generate/click — track product click
router.post('/click', async (req, res) => {
  try {
    const { generationId, shopifyId, productTitle, price } = req.body;
    if (!generationId || generationId.startsWith('preview-')) return res.json({ ok: true });

    await prisma.productClick.create({
      data: { generationId, shopifyId: String(shopifyId), productTitle, price: price || null },
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

function buildPrompt(config, answers, products, isRoutine) {
  const category = config?.category || 'beauty';
  const persona = config?.aiPersona || 'Sei un esperto consulente. Fornisci consigli personalizzati e professionali.';
  const lang = config?.aiLanguage || 'it';

  const productList = products.slice(0, 80).map(p =>
    `- ID:${p.shopifyId} | ${p.title} | €${p.price || '?'} | Goals:${(p.goals||[]).join(',')} | Tags:${(p.tags||[]).join(',')}`
  ).join('\n');

  const answersText = Object.entries(answers)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  if (isRoutine) {
    return `${persona}\n\nSei un esperto consulente ${getCategoryExpert(category)}.\nLingua risposta: ${lang}.\nRispondi SOLO con un oggetto JSON valido, niente markdown.\n\nPROFILO UTENTE:\n${answersText}\n\nCATALOGO PRODOTTI DISPONIBILI:\n${productList}\n\nGenera una routine personalizzata. Struttura JSON richiesta:\n{\n  "message": "Messaggio introduttivo personalizzato (2-3 frasi)",\n  "sections": [\n    {\n      "title": "Titolo sezione",\n      "steps": [\n        {\n          "order": 1,\n          "action": "Descrizione breve del gesto",\n          "tip": "Consiglio dell\'esperto",\n          "productId": "shopify_id_o_null",\n          "productTitle": "Nome prodotto o null",\n          "productUrl": "url_o_null",\n          "productImage": "url_immagine_o_null",\n          "productPrice": 0.00\n        }\n      ]\n    }\n  ],\n  "products": [\n    {\n      "shopifyId": "id",\n      "title": "nome",\n      "url": "url",\n      "imageUrl": "url_immagine",\n      "price": 0.00,\n      "reason": "Perché questo prodotto è perfetto per te"\n    }\n  ]\n}\n\nUsa SOLO prodotti presenti nel catalogo. Seleziona 3-7 prodotti pertinenti.`;
  } else {
    return `${persona}\n\nSei un esperto consulente ${getCategoryExpert(category)}.\nLingua risposta: ${lang}.\nRispondi SOLO con un oggetto JSON valido, niente markdown.\n\nPROFILO UTENTE:\n${answersText}\n\nCATALOGO PRODOTTI DISPONIBILI:\n${productList}\n\nSeleziona i 3-5 prodotti più adatti a questo utente. Struttura JSON:\n{\n  "message": "Messaggio introduttivo personalizzato (1-2 frasi)",\n  "products": [\n    {\n      "shopifyId": "id",\n      "title": "nome",\n      "url": "url",\n      "imageUrl": "url_immagine",\n      "price": 0.00,\n      "reason": "Perché questo prodotto è perfetto per te"\n    }\n  ]\n}\n\nUsa SOLO prodotti presenti nel catalogo. Max 5 prodotti.`;
  }
}

function getCategoryExpert(category) {
  const experts = {
    beauty: 'dermatologo e skincare expert',
    nutrition: 'nutrizionista sportivo',
    baby: 'pediatra e specialista neonatale',
    pet: 'veterinario nutrizionista',
    wellness: 'specialista del benessere',
    fitness: 'personal trainer e nutrizionista',
  };
  return experts[category] || 'consulente specializzato';
}

module.exports = router;
