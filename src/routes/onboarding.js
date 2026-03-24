const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../services/db');
const router = express.Router();

router.use(requireAuth);

router.get('/step1', async (req, res) => {
  const brand = await db.queryOne('SELECT name FROM brands WHERE id = $1', [req.session.brandId]);
  res.send(step1Page(brand.name));
});

router.post('/step1', async (req, res) => {
  const { category } = req.body;
  const existing = await db.queryOne('SELECT brand_id FROM brand_configs WHERE brand_id = $1', [req.session.brandId]);
  if (existing) {
    await db.execute('UPDATE brand_configs SET category = $1, updated_at = NOW() WHERE brand_id = $2', [category, req.session.brandId]);
  } else {
    await db.execute('INSERT INTO brand_configs (brand_id, category) VALUES ($1, $2)', [req.session.brandId, category]);
  }
  res.redirect('/onboarding/step2');
});

router.get('/step2', async (req, res) => {
  const config = await db.queryOne('SELECT * FROM brand_configs WHERE brand_id = $1', [req.session.brandId]) || {};
  res.send(step2Page(config));
});

router.post('/step2', async (req, res) => {
  const { color_bg, color_primary, color_text, color_button, font_family } = req.body;
  await db.execute(
    'UPDATE brand_configs SET color_bg=$1, color_primary=$2, color_text=$3, color_button=$4, font_family=$5, updated_at=NOW() WHERE brand_id=$6',
    [color_bg, color_primary, color_text, color_button, font_family, req.session.brandId]
  );
  res.redirect('/onboarding/step3');
});

router.get('/step3', async (req, res) => {
  const config = await db.queryOne('SELECT * FROM brand_configs WHERE brand_id = $1', [req.session.brandId]) || {};
  res.send(step3Page(config));
});

router.post('/step3', async (req, res) => {
  const { copy_title, copy_subtitle, copy_cta, ai_language } = req.body;
  await db.execute(
    'UPDATE brand_configs SET copy_title=$1, copy_subtitle=$2, copy_cta=$3, ai_language=$4, updated_at=NOW() WHERE brand_id=$5',
    [copy_title, copy_subtitle, copy_cta, ai_language || 'it', req.session.brandId]
  );
  res.redirect('/onboarding/step4');
});

router.get('/step4', async (req, res) => {
  const config = await db.queryOne('SELECT * FROM brand_configs WHERE brand_id = $1', [req.session.brandId]) || {};
  const shopify = await db.queryOne('SELECT shop_domain FROM shopify_connections WHERE brand_id = $1', [req.session.brandId]);
  const products = await db.query('SELECT * FROM products WHERE brand_id = $1 AND attivo = 1 LIMIT 50', [req.session.brandId]);
  res.send(step4Page(config, shopify, products));
});

router.get('/step5', async (req, res) => {
  const config = await db.queryOne('SELECT * FROM brand_configs WHERE brand_id = $1', [req.session.brandId]) || {};
  res.send(step5Page(config));
});

router.post('/step5', async (req, res) => {
  const { ai_persona } = req.body;
  await db.execute('UPDATE brand_configs SET ai_persona=$1, updated_at=NOW() WHERE brand_id=$2', [ai_persona, req.session.brandId]);
  res.redirect('/dashboard');
});

const baseStyle = `<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#060809;color:#eef4f8;font-family:'DM Sans',sans-serif;min-height:100vh}.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:56px;border-bottom:1px solid #1a2535;background:#060809;position:sticky;top:0;z-index:50}.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:#00ff88;text-decoration:none}.logo span{color:#eef4f8}.logout{font-size:.7rem;color:#7a90a4;text-decoration:none;letter-spacing:.1em;text-transform:uppercase}.wrap{max-width:640px;margin:0 auto;padding:48px 24px}.progress{display:flex;gap:8px;margin-bottom:40px}.step-dot{flex:1;height:3px;background:#1a2535;border-radius:2px}.step-dot.done{background:#00ff88}.step-dot.active{background:#00ff88;opacity:.5}h1{font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;margin-bottom:8px}.sub{color:#7a90a4;font-size:.9rem;margin-bottom:36px;line-height:1.6}label{display:block;font-size:.72rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#7a90a4;margin-bottom:8px;margin-top:20px}label:first-of-type{margin-top:0}input[type=text],input[type=url],input[type=color],select,textarea{width:100%;padding:12px 14px;background:#0d1117;border:1px solid #1a2535;color:#eef4f8;font-family:'DM Sans',sans-serif;font-size:.92rem;outline:none;border-radius:2px}input:focus,select:focus,textarea:focus{border-color:#00ff88}textarea{resize:vertical;min-height:120px}input[type=color]{height:46px;padding:4px 8px;cursor:pointer}.btn{display:inline-block;padding:14px 32px;background:#00ff88;color:#060809;font-family:'Syne',sans-serif;font-size:.72rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;border:none;cursor:pointer;border-radius:2px;text-decoration:none}.btn:hover{background:#00ffaa}.btn-secondary{background:transparent;border:1px solid #1a2535;color:#7a90a4}.btn-secondary:hover{border-color:#00ff88;color:#00ff88;background:transparent}.row{display:flex;gap:12px;align-items:flex-end;margin-top:20px}.cats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px}.cat-card{border:1px solid #1a2535;padding:16px 12px;cursor:pointer;border-radius:2px;text-align:center;transition:.2s}.cat-card:hover{border-color:#00ff88}.cat-card.selected{border-color:#00ff88;background:rgba(0,255,136,0.05)}.cat-card input{display:none}.cat-icon{font-size:1.8rem;margin-bottom:8px}.cat-name{font-family:'Syne',sans-serif;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}</style>`;

function step1Page(brandName) {
  const cats = [
    {val:'beauty',icon:'✨',name:'Beauty'},{val:'skincare',icon:'🧴',name:'Skincare'},
    {val:'haircare',icon:'💆',name:'Capelli'},{val:'nutrition',icon:'🥗',name:'Nutrition'},
    {val:'baby',icon:'🍼',name:'Baby'},{val:'pet',icon:'🐾',name:'Pet'},
    {val:'wellness',icon:'💊',name:'Wellness'},{val:'fitness',icon:'🏋️',name:'Fitness'},
    {val:'other',icon:'✦',name:'Altro'},
  ];
  return `<!DOCTYPE html><html lang="it"><head>${baseStyle}<title>Step 1 — NextClick</title></head>
<body><div class="topbar"><a class="logo" href="/dashboard">•N<span>EXTCLICK</span></a><a class="logout" href="/logout">Esci</a></div>
<div class="wrap"><div class="progress"><div class="step-dot active"></div><div class="step-dot"></div><div class="step-dot"></div><div class="step-dot"></div><div class="step-dot"></div></div>
<h1>Ciao ${brandName}! 👋</h1><p class="sub">In quale categoria opera il tuo brand?</p>
<form method="POST" action="/onboarding/step1"><div class="cats">
${cats.map(c=>`<label class="cat-card" onclick="sel(this)"><input type="radio" name="category" value="${c.val}"/><div class="cat-icon">${c.icon}</div><div class="cat-name">${c.name}</div></label>`).join('')}
</div><div class="row"><button class="btn" type="submit">Continua →</button></div></form></div>
<script>function sel(el){document.querySelectorAll('.cat-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');el.querySelector('input').checked=true;}
document.querySelector('.cat-card').classList.add('selected');document.querySelector('.cat-card input').checked=true;</script>
</body></html>`;
}

function step2Page(config) {
  const fonts = ['DM Sans','Inter','Poppins','Montserrat','Raleway','Playfair Display','Lato','Nunito'];
  return `<!DOCTYPE html><html lang="it"><head>${baseStyle}<title>Step 2 — Design</title></head>
<body><div class="topbar"><a class="logo" href="/dashboard">•N<span>EXTCLICK</span></a><a class="logout" href="/logout">Esci</a></div>
<div class="wrap"><div class="progress"><div class="step-dot done"></div><div class="step-dot active"></div><div class="step-dot"></div><div class="step-dot"></div><div class="step-dot"></div></div>
<h1>Design del Widget</h1><p class="sub">Personalizza colori e font del tuo AI Advisor.</p>
<form method="POST" action="/onboarding/step2">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
<div><label>Colore Sfondo</label><input type="color" name="color_bg" value="${config.color_bg||'#FFFFFF'}"/></div>
<div><label>Colore Primario</label><input type="color" name="color_primary" value="${config.color_primary||'#000000'}"/></div>
<div><label>Colore Testo</label><input type="color" name="color_text" value="${config.color_text||'#333333'}"/></div>
<div><label>Colore Pulsanti</label><input type="color" name="color_button" value="${config.color_button||'#000000'}"/></div>
</div>
<label>Font</label><select name="font_family">${fonts.map(f=>`<option value="${f}" ${config.font_family===f?'selected':''}>${f}</option>`).join('')}</select>
<div class="row" style="margin-top:32px"><a href="/onboarding/step1" class="btn btn-secondary">← Indietro</a><button class="btn" type="submit">Continua →</button></div>
</form></div></body></html>`;
}

function step3Page(config) {
  const langs = [{val:'it',name:'🇮🇹 Italiano'},{val:'en',name:'🇬🇧 English'},{val:'es',name:'🇪🇸 Español'},{val:'fr',name:'🇫🇷 Français'},{val:'de',name:'🇩🇪 Deutsch'}];
  return `<!DOCTYPE html><html lang="it"><head>${baseStyle}<title>Step 3 — Copy</title></head>
<body><div class="topbar"><a class="logo" href="/dashboard">•N<span>EXTCLICK</span></a><a class="logout" href="/logout">Esci</a></div>
<div class="wrap"><div class="progress"><div class="step-dot done"></div><div class="step-dot done"></div><div class="step-dot active"></div><div class="step-dot"></div><div class="step-dot"></div></div>
<h1>Testi e Copy</h1><p class="sub">Personalizza i testi del widget.</p>
<form method="POST" action="/onboarding/step3">
<label>Titolo principale</label><input type="text" name="copy_title" value="${config.copy_title||''}" placeholder="Es: Trova i prodotti perfetti per te"/>
<label>Sottotitolo</label><input type="text" name="copy_subtitle" value="${config.copy_subtitle||''}" placeholder="Es: Rispondi a poche domande"/>
<label>Testo pulsante CTA</label><input type="text" name="copy_cta" value="${config.copy_cta||''}" placeholder="Es: Inizia ora →"/>
<label>Lingua</label><select name="ai_language">${langs.map(l=>`<option value="${l.val}" ${config.ai_language===l.val?'selected':''}>${l.name}</option>`).join('')}</select>
<div class="row" style="margin-top:32px"><a href="/onboarding/step2" class="btn btn-secondary">← Indietro</a><button class="btn" type="submit">Continua →</button></div>
</form></div></body></html>`;
}

function step4Page(config, shopify, products) {
  return `<!DOCTYPE html><html lang="it"><head>${baseStyle}<title>Step 4 — Prodotti</title>
<style>.prod-list{margin-top:16px;max-height:300px;overflow-y:auto;border:1px solid #1a2535;border-radius:2px}.prod-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #1a2535}.prod-name{font-size:.88rem;flex:1}.prod-price{font-size:.82rem;color:#00ff88}.empty{text-align:center;padding:32px;color:#7a90a4;font-size:.88rem}.shopify-box{background:#0d1117;border:1px solid #1a2535;padding:20px;border-radius:2px;margin-bottom:20px}.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:.65rem;font-weight:700;text-transform:uppercase}.badge.ok{background:rgba(0,255,136,0.15);color:#00ff88}.badge.no{background:rgba(255,107,107,0.15);color:#ff6b6b}</style></head>
<body><div class="topbar"><a class="logo" href="/dashboard">•N<span>EXTCLICK</span></a><a class="logout" href="/logout">Esci</a></div>
<div class="wrap"><div class="progress"><div class="step-dot done"></div><div class="step-dot done"></div><div class="step-dot done"></div><div class="step-dot active"></div><div class="step-dot"></div></div>
<h1>I tuoi Prodotti</h1><p class="sub">Connetti Shopify per importare automaticamente, oppure aggiungili dalla dashboard.</p>
<div class="shopify-box"><h3 style="font-family:Syne,sans-serif;font-size:.9rem;margin-bottom:8px">🛍️ Shopify <span class="badge ${shopify?'ok':'no'}">${shopify?'Connesso':'Non connesso'}</span></h3>
<p style="font-size:.82rem;color:#7a90a4;margin-bottom:14px">${shopify?'Store: '+shopify.shop_domain:'Connetti per sincronizzare i prodotti automaticamente.'}</p>
${shopify?`<a href="/api/shopify/sync" class="btn" style="font-size:.65rem;padding:10px 20px">↻ Sincronizza</a>`:`<a href="/api/shopify/connect" class="btn" style="font-size:.65rem;padding:10px 20px">Connetti Shopify →</a>`}
</div>
<div class="prod-list">${products.length>0?products.map(p=>`<div class="prod-item"><div class="prod-name">${p.nome}</div><div class="prod-price">${p.prezzo||'—'}</div></div>`).join(''):'<div class="empty">Nessun prodotto. Connetti Shopify o aggiungili dalla dashboard.</div>'}</div>
<div class="row" style="margin-top:32px"><a href="/onboarding/step3" class="btn btn-secondary">← Indietro</a><a href="/onboarding/step5" class="btn">Continua →</a></div>
</div></body></html>`;
}

function step5Page(config) {
  return `<!DOCTYPE html><html lang="it"><head>${baseStyle}<title>Step 5 — AI Persona</title>
<style>.example{background:#0d1117;border:1px solid #1a2535;padding:12px 16px;cursor:pointer;border-radius:2px;font-size:.82rem;color:#7a90a4;transition:.2s;margin-bottom:8px}.example:hover{border-color:#00ff88;color:#eef4f8}</style></head>
<body><div class="topbar"><a class="logo" href="/dashboard">•N<span>EXTCLICK</span></a><a class="logout" href="/logout">Esci</a></div>
<div class="wrap"><div class="progress"><div class="step-dot done"></div><div class="step-dot done"></div><div class="step-dot done"></div><div class="step-dot done"></div><div class="step-dot active"></div></div>
<h1>Personalità AI 🤖</h1><p class="sub">Descrivi come deve parlare il tuo AI Advisor.</p>
<p style="font-size:.78rem;color:#7a90a4;margin-bottom:12px">Esempi (clicca per usare):</p>
<div class="example" onclick="use(this)">Parla come un dermatologo specializzato con tono professionale ma accessibile. Usa terminologia medica appropriata. Non menzionare mai AI o algoritmi.</div>
<div class="example" onclick="use(this)">Sei una nutrizionista esperta e appassionata. Parla in modo caldo e incoraggiante. Usa esempi pratici di vita quotidiana.</div>
<div class="example" onclick="use(this)">Sei un esperto di pet care con 10 anni di esperienza. Tono amichevole e rassicurante per i proprietari di animali.</div>
<form method="POST" action="/onboarding/step5">
<label style="margin-top:16px">La tua AI Persona</label>
<textarea name="ai_persona" id="pt" placeholder="Descrivi come deve parlare il tuo AI Advisor...">${config.ai_persona||''}</textarea>
<div class="row" style="margin-top:32px"><a href="/onboarding/step4" class="btn btn-secondary">← Indietro</a><button class="btn" type="submit">✓ Completa</button></div>
</form></div>
<script>function use(el){document.getElementById('pt').value=el.textContent.trim();}</script>
</body></html>`;
}

module.exports = router;
