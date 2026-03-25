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

    if (products.length === 0) {
      return res.status(400).json({ error: 'no_products', message: 'Nessun prodotto nel catalogo.' });
    }

    // Build prompt
    const isRoutine = config.featureRoutine; // Pro/Scale gets full routine
    const prompt = buildPrompt(config, answers, products, isRoutine);

    // Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: isRoutine ? 3000 : 1500,
        temperature: 0.7,
      },
    });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;

    // Parse AI response
    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'parse_error', message: 'Errore nella generazione. Riprova.' });
    }

    // Save generation record & increment counter
    const [generation] = await Promise.all([
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

    // Log failed generation
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

    res.status(500).json({ error: 'generation_failed', message: 'Generazione fallita. Riprova.' });
  }
});

// POST /api/generate/click — track product click
router.post('/click', async (req, res) => {
  try {
    const { generationId, shopifyId, productTitle, price } = req.body;
    if (!generationId) return res.json({ ok: true });

    await prisma.productClick.create({
      data: { generationId, shopifyId: String(shopifyId), productTitle, price: price || null },
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // Non-critical, never fail
  }
});

// ── PROMPT BUILDER ────────────────────────────────────────────────────────────
function buildPrompt(config, answers, products, isRoutine) {
  const category = config.category;
  const persona = config.aiPersona;
  const lang = config.aiLanguage || 'it';

  const productList = products.slice(0, 80).map(p =>
    `- ID:${p.shopifyId} | ${p.title} | €${p.price || '?'} | Goals:${p.goals.join(',')} | Tags:${p.tags.join(',')}`
  ).join('\n');

  const answersText = Object.entries(answers)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  if (isRoutine) {
    return `${persona}

Sei un esperto consulente ${getCategoryExpert(category)}. 
Lingua risposta: ${lang}.
Rispondi SOLO con un oggetto JSON valido, niente markdown.

PROFILO UTENTE:
${answersText}

CATALOGO PRODOTTI DISPONIBILI:
${productList}

Genera una routine personalizzata. Struttura JSON richiesta:
{
  "message": "Messaggio introduttivo personalizzato (2-3 frasi)",
  "sections": [
    {
      "title": "Titolo sezione (es. Mattina, Sera, Integrazione)",
      "steps": [
        {
          "order": 1,
          "action": "Descrizione breve del gesto (es. Detergi il viso)",
          "tip": "Consiglio dell'esperto (1 frase)",
          "productId": "shopify_id_del_prodotto_o_null",
          "productTitle": "Nome prodotto o null",
          "productUrl": "url_prodotto_o_null",
          "productImage": "url_immagine_o_null",
          "productPrice": 0.00
        }
      ]
    }
  ],
  "products": [
    {
      "shopifyId": "id",
      "title": "nome",
      "url": "url",
      "imageUrl": "url_immagine",
      "price": 0.00,
      "reason": "Perché questo prodotto è perfetto per te (1-2 frasi)"
    }
  ]
}

Usa SOLO prodotti presenti nel catalogo. Seleziona 3-7 prodotti pertinenti.`;

  } else {
    return `${persona}

Sei un esperto consulente ${getCategoryExpert(category)}.
Lingua risposta: ${lang}.
Rispondi SOLO con un oggetto JSON valido, niente markdown.

PROFILO UTENTE:
${answersText}

CATALOGO PRODOTTI DISPONIBILI:
${productList}

Seleziona i 3-5 prodotti più adatti a questo utente. Struttura JSON:
{
  "message": "Messaggio introduttivo personalizzato (1-2 frasi)",
  "products": [
    {
      "shopifyId": "id",
      "title": "nome",
      "url": "url",
      "imageUrl": "url_immagine",
      "price": 0.00,
      "reason": "Perché questo prodotto è perfetto per te (1-2 frasi)"
    }
  ]
}

Usa SOLO prodotti presenti nel catalogo. Max 5 prodotti.`;
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
