const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../services/db');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const router = express.Router();

// ── PRODUCTS ──
router.post('/products/add', requireAuth, async (req, res) => {
  try {
    const { nome, prezzo, url, descrizione, categoria } = req.body;
    if (!nome) return res.redirect('/dashboard/products?error=nome_mancante');
    const id = uuidv4();
    const prezzoNum = prezzo ? parseFloat(prezzo.replace(/[€\s]/g, '').replace(',', '.')) || null : null;
    await db.execute(
      'INSERT INTO products (id, brand_id, nome, prezzo, prezzo_num, url, descrizione, categoria) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, req.session.brandId, nome, prezzo||null, prezzoNum, url||null, descrizione||null, categoria||null]
    );
    res.redirect('/dashboard/products');
  } catch(e) {
    res.redirect('/dashboard/products?error=' + encodeURIComponent(e.message));
  }
});

router.delete('/products/:id', requireAuth, async (req, res) => {
  await db.execute('DELETE FROM products WHERE id = $1 AND brand_id = $2', [req.params.id, req.session.brandId]);
  res.json({ ok: true });
});

// ── SHOPIFY ──
router.get('/shopify/connect', requireAuth, (req, res) => {
  res.send(shopifyConnectPage(req.query.error || ''));
});

router.post('/shopify/connect', requireAuth, async (req, res) => {
  const { shop_domain, access_token } = req.body;
  if (!shop_domain || !access_token) return res.redirect('/api/shopify/connect?error=Compila+tutti+i+campi');
  try {
    const shopDomain = shop_domain.replace('https://','').replace('http://','').replace(/\/$/,'');
    const testRes = await fetch(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token }
    });
    if (!testRes.ok) throw new Error('Token non valido');
    const existing = await db.queryOne('SELECT brand_id FROM shopify_connections WHERE brand_id = $1', [req.session.brandId]);
    if (existing) {
      await db.execute('UPDATE shopify_connections SET shop_domain=$1, access_token=$2 WHERE brand_id=$3', [shopDomain, access_token, req.session.brandId]);
    } else {
      await db.execute('INSERT INTO shopify_connections (brand_id, shop_domain, access_token) VALUES ($1,$2,$3)', [req.session.brandId, shopDomain, access_token]);
    }
    await syncShopifyProducts(req.session.brandId, shopDomain, access_token);
    res.redirect('/dashboard/products?success=connected');
  } catch(e) {
    res.redirect('/api/shopify/connect?error=' + encodeURIComponent(e.message));
  }
});

router.get('/shopify/sync', requireAuth, async (req, res) => {
  const conn = await db.queryOne('SELECT * FROM shopify_connections WHERE brand_id = $1', [req.session.brandId]);
  if (!conn) return res.redirect('/api/shopify/connect');
  try {
    const count = await syncShopifyProducts(req.session.brandId, conn.shop_domain, conn.access_token);
    res.redirect('/dashboard/products?success=synced&count=' + count);
  } catch(e) {
    res.redirect('/dashboard/products?error=' + encodeURIComponent(e.message));
  }
});

async function syncShopifyProducts(brandId, shopDomain, accessToken) {
  const response = await fetch(`https://${shopDomain}/admin/api/2024-01/products.json?limit=250&status=active`, {
    headers: { 'X-Shopify-Access-Token': accessToken }
  });
  if (!response.ok) throw new Error('Errore sincronizzazione Shopify');
  const data = await response.json();
  const products = data.products || [];
  let imported = 0;
  for (const p of products) {
    const variant = p.variants?.[0];
    const price = variant?.price ? `€${parseFloat(variant.price).toFixed(2).replace('.',',')}` : null;
    const priceNum = variant?.price ? parseFloat(variant.price) : null;
    const imageUrl = p.images?.[0]?.src || null;
    const url = `https://${shopDomain}/products/${p.handle}`;
    const existing = await db.queryOne('SELECT id FROM products WHERE brand_id = $1 AND shopify_id = $2', [brandId, String(p.id)]);
    if (existing) {
      await db.execute('UPDATE products SET nome=$1, prezzo=$2, prezzo_num=$3, url=$4, immagine=$5, descrizione=$6 WHERE id=$7',
        [p.title, price, priceNum, url, imageUrl, p.body_html?.replace(/<[^>]*>/g,'').substring(0,300)||null, existing.id]);
    } else {
      await db.execute('INSERT INTO products (id, brand_id, shopify_id, nome, prezzo, prezzo_num, url, immagine, descrizione) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [uuidv4(), brandId, String(p.id), p.title, price, priceNum, url, imageUrl, p.body_html?.replace(/<[^>]*>/g,'').substring(0,300)||null]);
      imported++;
    }
  }
  return imported;
}

// ── GENERATE ──
router.post('/generate', async (req, res) => {
  const { brand_id, profile, description, budget_max } = req.body;
  if (!brand_id) return res.status(400).json({ error: 'brand_id mancante' });
  try {
    const brand = await db.queryOne('SELECT * FROM brands WHERE id = $1', [brand_id]);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
    if (brand.plan_status === 'cancelled') return res.status(403).json({ error: 'Piano scaduto', code: 'plan_cancelled' });
    if (brand.generations_used >= brand.generations_limit) {
      return res.status(429).json({ error: 'Limite generazioni raggiunto', code: 'generations_limit' });
    }
    const config = await db.queryOne('SELECT * FROM brand_configs WHERE brand_id = $1', [brand_id]);
    if (!config) return res.status(400).json({ error: 'Configurazione non trovata' });
    let products = await db.query('SELECT * FROM products WHERE brand_id = $1 AND attivo = 1', [brand_id]);
    if (products.length === 0) return res.status(400).json({ error: 'Nessun prodotto disponibile' });
    const catalogText = products.map((p,i) => `${i+1}. ${p.nome} | Prezzo: ${p.prezzo||'N/D'} | URL: ${p.url||'N/D'} | ${p.descrizione||''}`).join('\n');
    const isPlanAdvisor = brand.plan === 'advisor';
    const profileText = Object.entries(profile||{}).map(([k,v])=>`- ${k}: ${v}`).join('\n');
    const budgetText = budget_max ? `- Budget totale: max €${budget_max}` : '';
    const persona = config.ai_persona || 'Sei un consulente esperto nel settore. Parla in modo professionale ma accessibile.';
    const lang = config.ai_language || 'it';
    const langName = lang==='it'?'italiano':lang==='en'?'inglese':lang==='es'?'spagnolo':lang==='fr'?'francese':'tedesco';

    let prompt;
    if (isPlanAdvisor) {
      prompt = `${persona}\n\nPROFILO UTENTE:\n${profileText}\n${budgetText}\n- Descrizione: ${description||''}\n\nPRODOTTI DISPONIBILI:\n${catalogText}\n\nGenera una routine personalizzata strutturata con sezioni markdown (## Titolo). Cita i prodotti per nome in ogni sezione con istruzioni d'uso. ${budget_max?`Somma prezzi max €${budget_max}.`:''} Concludi con ## Avvertenze. Rispondi in ${langName}.\n\nPoi elenca i prodotti in JSON:\n[PRODOTTI_JSON]\n[{"nome":"Nome ESATTO","motivo":"max 12 parole","url":"URL esatto","quando":"Mattina o Sera o Mattina e Sera o Settimanale","prezzo":"prezzo o null"}]\n[/PRODOTTI_JSON]\n\nREGOLE: 3-6 prodotti solo dal catalogo.`;
    } else {
      prompt = `${persona}\n\nPROFILO UTENTE:\n${profileText}\n${budgetText}\n- Descrizione: ${description||''}\n\nPRODOTTI DISPONIBILI:\n${catalogText}\n\nSeleziona 3-5 prodotti più adatti. ${budget_max?`Somma max €${budget_max}.`:''} Rispondi in ${langName}.\n\nRispondi SOLO con questo JSON:\n[{"nome":"Nome ESATTO","motivo":"motivazione breve","url":"URL esatto","quando":"Mattina o Sera o Mattina e Sera","prezzo":"prezzo o null"}]`;
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.4, maxOutputTokens:isPlanAdvisor?4000:1500} }) }
    );
    if (!geminiRes.ok) throw new Error('Gemini error ' + geminiRes.status);
    const geminiData = await geminiRes.json();
    const fullText = (geminiData?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');

    let routine = fullText;
    let recommendedProducts = [];
    if (isPlanAdvisor) {
      const jsonMatch = fullText.match(/\[PRODOTTI_JSON\]([\s\S]*?)\[\/PRODOTTI_JSON\]/);
      if (jsonMatch) {
        try { recommendedProducts = JSON.parse(jsonMatch[1].trim().replace(/```json\n?/g,'').replace(/```\n?/g,'')); routine = fullText.replace(/\[PRODOTTI_JSON\][\s\S]*?\[\/PRODOTTI_JSON\]/,'').trim(); } catch(e) {}
      }
    } else {
      try { const arr = fullText.match(/\[[\s\S]*\]/); if(arr) recommendedProducts = JSON.parse(arr[0]); } catch(e) {}
    }

    await db.execute('UPDATE brands SET generations_used = generations_used + 1 WHERE id = $1', [brand_id]);
    await db.execute('INSERT INTO generations (id, brand_id, plan_type, success) VALUES ($1,$2,$3,1)', [uuidv4(), brand_id, brand.plan]);
    return res.json({ routine: isPlanAdvisor ? routine : null, products: recommendedProducts });
  } catch(e) {
    console.error('Generate error:', e.message);
    return res.status(500).json({ error: 'Errore generazione: ' + e.message });
  }
});

// ── CONFIG (public) ──
router.get('/config/:brandId', async (req, res) => {
  try {
    const brand = await db.queryOne('SELECT name, plan, plan_status FROM brands WHERE id = $1', [req.params.brandId]);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
    if (brand.plan_status === 'cancelled') return res.status(403).json({ error: 'Piano scaduto' });
    const config = await db.queryOne('SELECT * FROM brand_configs WHERE brand_id = $1', [req.params.brandId]);
    if (!config) return res.status(404).json({ error: 'Config non trovata' });
    res.json({
      brand_name: brand.name, plan: brand.plan, category: config.category,
      design: { color_bg: config.color_bg, color_primary: config.color_primary, color_text: config.color_text, color_button: config.color_button, font_family: config.font_family },
      copy: { title: config.copy_title||'Trova i prodotti perfetti per te', subtitle: config.copy_subtitle||'Rispondi a poche domande', cta: config.copy_cta||'Inizia ora →' },
      language: config.ai_language || 'it'
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

function shopifyConnectPage(error) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Connetti Shopify — NextClick</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#060809;color:#eef4f8;font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:#0d1117;border:1px solid #1a2535;padding:40px;max-width:480px;width:100%;border-radius:2px}.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:#00ff88;margin-bottom:32px}.logo span{color:#eef4f8}h1{font-family:'Syne',sans-serif;font-size:1.2rem;margin-bottom:8px}.sub{color:#7a90a4;font-size:.85rem;margin-bottom:28px;line-height:1.6}label{display:block;font-size:.7rem;color:#7a90a4;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;margin-top:16px}input{width:100%;padding:12px;background:#060809;border:1px solid #1a2535;color:#eef4f8;font-family:'DM Sans',sans-serif;font-size:.9rem;outline:none;border-radius:2px;margin-bottom:4px}input:focus{border-color:#00ff88}.hint{font-size:.72rem;color:#7a90a4;margin-bottom:8px}.btn{width:100%;padding:14px;background:#00ff88;color:#060809;font-family:'Syne',sans-serif;font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border:none;cursor:pointer;border-radius:2px;margin-top:8px}.info{background:#0b1f13;border:1px solid #00ff8830;padding:14px;border-radius:2px;font-size:.8rem;color:#7a90a4;margin-bottom:20px;line-height:1.6}.info strong{color:#00ff88}.error{background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.3);color:#ff6b6b;padding:12px;margin-bottom:20px;font-size:.82rem;border-radius:2px}</style></head>
<body><div class="card"><div class="logo">•N<span>EXTCLICK</span></div>
<h1>Connetti il tuo Shopify</h1>
<p class="sub">Inserisci il dominio del tuo store e il token di accesso per sincronizzare i prodotti automaticamente.</p>
${error ? `<div class="error">${decodeURIComponent(error)}</div>` : ''}
<div class="info"><strong>Come ottenere il token:</strong><br>Shopify Admin → Settings → Apps → Develop apps → Create app → Configure Admin API scopes → spunta <strong>read_products</strong> → Install app → copia <strong>Admin API access token</strong></div>
<form method="POST" action="/api/shopify/connect">
<label>Dominio Shopify</label><input type="text" name="shop_domain" placeholder="tuostore.myshopify.com" required/>
<div class="hint">Senza https:// e senza slash finale</div>
<label>Admin API Access Token</label><input type="text" name="access_token" placeholder="shpat_xxxxxxxxxxxxxxxx" required/>
<button class="btn" type="submit">Connetti →</button>
</form></div></body></html>`;
}

module.exports = router;
