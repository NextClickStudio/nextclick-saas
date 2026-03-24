const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../services/db');
const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const brand = await db.queryOne('SELECT * FROM brands WHERE id = $1', [req.session.brandId]);
    const config = await db.queryOne('SELECT * FROM brand_configs WHERE brand_id = $1', [req.session.brandId]);
    const prodCount = await db.queryOne('SELECT COUNT(*) as count FROM products WHERE brand_id = $1 AND attivo = 1', [req.session.brandId]);
    const genCount = await db.queryOne("SELECT COUNT(*) as count FROM generations WHERE brand_id = $1 AND created_at >= NOW() - INTERVAL '30 days'", [req.session.brandId]);
    const shopify = await db.queryOne('SELECT shop_domain FROM shopify_connections WHERE brand_id = $1', [req.session.brandId]);
    const domain = process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3000';
    const widgetCode = `<script src="https://${domain}/widget.js" data-brand="${req.session.brandId}"></script>`;
    const genPercent = Math.round((brand.generations_used / brand.generations_limit) * 100);
    res.send(dashboardPage({ brand, config, products: prodCount, gens: genCount, shopify, widgetCode, genPercent }));
  } catch(e) {
    console.error('Dashboard error:', e.message);
    res.status(500).send('Errore server: ' + e.message);
  }
});

router.get('/products', async (req, res) => {
  try {
    const products = await db.query('SELECT * FROM products WHERE brand_id = $1 AND attivo = 1 ORDER BY created_at DESC', [req.session.brandId]);
    const shopify = await db.queryOne('SELECT shop_domain FROM shopify_connections WHERE brand_id = $1', [req.session.brandId]);
    const success = req.query.success || '';
    const error = req.query.error || '';
    res.send(productsPage(products, shopify, success, error));
  } catch(e) {
    res.status(500).send('Errore: ' + e.message);
  }
});

function dashboardPage({ brand, config, products, gens, shopify, widgetCode, genPercent }) {
  const planLabel = brand.plan === 'advisor' ? 'Advisor' : 'Recommend';
  const planPrice = brand.plan === 'advisor' ? '€199' : '€59';
  const statusColor = brand.plan_status === 'active' ? '#00ff88' : brand.plan_status === 'trial' ? '#ffca28' : '#ff6b6b';
  const statusLabel = brand.plan_status === 'active' ? 'ACTIVE' : brand.plan_status === 'trial' ? 'TRIAL' : 'SCADUTO';
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dashboard — NextClick</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#060809;color:#eef4f8;font-family:'DM Sans',sans-serif;min-height:100vh}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:56px;border-bottom:1px solid #1a2535;background:#060809;position:sticky;top:0;z-index:50}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:#00ff88;text-decoration:none}.logo span{color:#eef4f8}
.topbar-right{display:flex;align-items:center;gap:20px}.brand-name{font-size:.82rem;color:#7a90a4}
.logout{font-size:.65rem;color:#7a90a4;text-decoration:none;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;border:1px solid #1a2535;border-radius:2px}
.logout:hover{color:#ff6b6b;border-color:#ff6b6b}.wrap{max-width:1100px;margin:0 auto;padding:40px 32px}
h1{font-family:'Syne',sans-serif;font-size:1.5rem;font-weight:800;margin-bottom:4px}.sub{color:#7a90a4;font-size:.88rem;margin-bottom:32px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
.stat{background:#0d1117;border:1px solid #1a2535;padding:20px;border-radius:2px}
.stat-label{font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:#7a90a4;margin-bottom:8px}
.stat-value{font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800}
.stat-sub{font-size:.75rem;color:#7a90a4;margin-top:4px}
.section{background:#0d1117;border:1px solid #1a2535;padding:24px;border-radius:2px;margin-bottom:20px}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.section-title{font-family:'Syne',sans-serif;font-size:.85rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.btn{display:inline-block;padding:10px 20px;background:#00ff88;color:#060809;font-family:'Syne',sans-serif;font-size:.65rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border:none;cursor:pointer;border-radius:2px;text-decoration:none}
.btn:hover{background:#00ffaa}.btn-outline{background:transparent;border:1px solid #1a2535;color:#7a90a4}.btn-outline:hover{border-color:#00ff88;color:#00ff88}
.code-box{background:#060809;border:1px solid #1a2535;padding:14px 16px;font-family:'DM Mono',monospace;font-size:.75rem;color:#00ff88;word-break:break-all;border-radius:2px;position:relative}
.copy-btn{position:absolute;top:8px;right:8px;background:rgba(0,255,136,0.1);border:1px solid #00ff8840;color:#00ff88;font-size:.6rem;padding:4px 10px;cursor:pointer;border-radius:2px}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.action{background:#0d1117;border:1px solid #1a2535;padding:20px;border-radius:2px;text-decoration:none;color:#eef4f8;display:flex;align-items:center;gap:14px;transition:.2s}
.action:hover{border-color:#00ff88}.action-icon{font-size:1.4rem}.action-title{font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem}
.action-desc{font-size:.75rem;color:#7a90a4;margin-top:2px}
.progress-bar{height:4px;background:#1a2535;border-radius:2px;margin-top:8px}
.progress-fill{height:100%;background:#00ff88;border-radius:2px}
@media(max-width:700px){.grid{grid-template-columns:1fr 1fr}.actions{grid-template-columns:1fr}}
</style></head>
<body>
<div class="topbar">
  <a class="logo" href="/dashboard">•N<span>EXTCLICK</span></a>
  <div class="topbar-right">
    <span class="brand-name">${brand.name}</span>
    <a class="logout" href="/logout">Esci</a>
  </div>
</div>
<div class="wrap">
  <h1>Dashboard</h1>
  <p class="sub">Benvenuto, ${brand.name} · Piano <strong>${planLabel}</strong> ${planPrice}/mese <span style="background:${statusColor}22;color:${statusColor};font-size:.6rem;font-weight:700;letter-spacing:.1em;padding:3px 8px;border-radius:20px">${statusLabel}</span></p>
  <div class="grid">
    <div class="stat"><div class="stat-label">Prodotti Attivi</div><div class="stat-value" style="color:#00ff88">${products?.count||0}</div><div class="stat-sub">nel catalogo</div></div>
    <div class="stat"><div class="stat-label">Generazioni Usate</div><div class="stat-value">${brand.generations_used}<span style="font-size:1rem;color:#7a90a4">/${brand.generations_limit}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${genPercent}%"></div></div></div>
    <div class="stat"><div class="stat-label">Gen. Ultimi 30gg</div><div class="stat-value">${gens?.count||0}</div><div class="stat-sub">routine generate</div></div>
    <div class="stat"><div class="stat-label">Shopify</div><div class="stat-value" style="font-size:1rem">${shopify?shopify.shop_domain:'Non connesso'}</div><div class="stat-sub">${shopify?'connesso':'da connettere'}</div></div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-title">🧩 Il tuo Widget</div><a href="/onboarding/step2" class="btn btn-outline" style="font-size:.6rem;padding:8px 14px">✦ Modifica Config</a></div>
    <p style="font-size:.82rem;color:#7a90a4;margin-bottom:12px">Incolla questo codice nel tema Shopify dove vuoi mostrare l'AI Advisor:</p>
    <div class="code-box">${widgetCode.replace(/</g,'&lt;').replace(/>/g,'&gt;')}<button class="copy-btn" onclick="navigator.clipboard.writeText('${widgetCode.replace(/'/g,"\\'")}');this.textContent='✓ Copiato!'">clicca per copiare</button></div>
    <p style="font-size:.75rem;color:#7a90a4;margin-top:12px">Posizionalo su qualsiasi pagina del tuo store. Il widget si caricherà automaticamente con il tuo design personalizzato.</p>
  </div>
  <div class="section">
    <div class="section-title" style="margin-bottom:16px">⚡ Azioni Rapide</div>
    <div class="actions">
      <a class="action" href="/dashboard/products"><div class="action-icon">🛍️</div><div><div class="action-title">Gestisci prodotti</div><div class="action-desc">Aggiungi, modifica o sincronizza i prodotti</div></div></a>
      <a class="action" href="/onboarding/step2"><div class="action-icon">🎨</div><div><div class="action-title">Modifica design</div><div class="action-desc">Colori, font e layout del widget</div></div></a>
      <a class="action" href="/onboarding/step5"><div class="action-icon">🤖</div><div><div class="action-title">AI Persona</div><div class="action-desc">Come parla il tuo consulente AI</div></div></a>
      <a class="action" href="/billing"><div class="action-icon">💳</div><div><div class="action-title">Abbonamento</div><div class="action-desc">Piano, fatturazione e upgrade</div></div></a>
    </div>
  </div>
</div>
</body></html>`;
}

function productsPage(products, shopify, success, error) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Prodotti — NextClick</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#060809;color:#eef4f8;font-family:'DM Sans',sans-serif;min-height:100vh}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:56px;border-bottom:1px solid #1a2535;background:#060809;position:sticky;top:0}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:#00ff88;text-decoration:none}.logo span{color:#eef4f8}
.wrap{max-width:900px;margin:0 auto;padding:40px 32px}h1{font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;margin-bottom:32px}
.section{background:#0d1117;border:1px solid #1a2535;padding:24px;border-radius:2px;margin-bottom:20px}
.section-title{font-family:'Syne',sans-serif;font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px}
label{display:block;font-size:.7rem;color:#7a90a4;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;margin-top:14px}
input{width:100%;padding:10px 12px;background:#060809;border:1px solid #1a2535;color:#eef4f8;font-family:'DM Sans',sans-serif;font-size:.88rem;outline:none;border-radius:2px;margin-bottom:4px}
input:focus{border-color:#00ff88}
.btn{display:inline-block;padding:10px 20px;background:#00ff88;color:#060809;font-family:'Syne',sans-serif;font-size:.65rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border:none;cursor:pointer;border-radius:2px;text-decoration:none}
.btn:hover{background:#00ffaa}.btn-outline{background:transparent;border:1px solid #1a2535;color:#7a90a4}
.prod-table{width:100%;border-collapse:collapse}
.prod-table th{font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#7a90a4;text-align:left;padding:8px 12px;border-bottom:1px solid #1a2535}
.prod-table td{padding:12px;border-bottom:1px solid #1a2535;font-size:.85rem}
.success{background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:#00ff88;padding:12px;margin-bottom:20px;font-size:.85rem;border-radius:2px}
.error{background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.3);color:#ff6b6b;padding:12px;margin-bottom:20px;font-size:.85rem;border-radius:2px}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:.65rem;font-weight:700;text-transform:uppercase}
.badge.ok{background:rgba(0,255,136,0.15);color:#00ff88}.badge.no{background:rgba(255,107,107,0.15);color:#ff6b6b}
</style></head>
<body>
<div class="topbar"><a class="logo" href="/dashboard">•N<span>EXTCLICK</span></a><a href="/dashboard" class="btn btn-outline" style="font-size:.6rem;padding:8px 14px">← Dashboard</a></div>
<div class="wrap">
<h1>🛍️ Gestione Prodotti</h1>
${success ? `<div class="success">✓ ${success === 'connected' ? 'Shopify connesso con successo!' : success === 'synced' ? 'Prodotti sincronizzati!' : 'Operazione completata'}</div>` : ''}
${error ? `<div class="error">✗ ${decodeURIComponent(error)}</div>` : ''}

<div class="section">
  <div class="section-title">🛍️ Shopify <span class="badge ${shopify?'ok':'no'}">${shopify?'Connesso: '+shopify.shop_domain:'Non connesso'}</span></div>
  ${shopify
    ? `<a href="/api/shopify/sync" class="btn" style="font-size:.65rem">↻ Sincronizza prodotti</a>`
    : `<a href="/api/shopify/connect" class="btn">Connetti Shopify →</a>`
  }
</div>

<div class="section">
  <div class="section-title">+ Aggiungi prodotto manuale</div>
  <form method="POST" action="/api/products/add">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><label>Nome prodotto *</label><input type="text" name="nome" placeholder="Es. Crema Idratante" required/></div>
      <div><label>Prezzo</label><input type="text" name="prezzo" placeholder="Es. €29,00"/></div>
    </div>
    <label>URL prodotto</label><input type="text" name="url" placeholder="https://tuostore.myshopify.com/products/..."/>
    <label>Descrizione</label><input type="text" name="descrizione" placeholder="Breve descrizione del prodotto"/>
    <div style="margin-top:16px"><button class="btn" type="submit">+ Aggiungi</button></div>
  </form>
</div>

<div class="section">
  <div class="section-title">Catalogo (${products.length} prodotti)</div>
  ${products.length > 0 ? `
  <table class="prod-table">
    <thead><tr><th>Nome</th><th>Prezzo</th><th>URL</th><th></th></tr></thead>
    <tbody>
      ${products.map(p => `
      <tr>
        <td>${p.nome}</td>
        <td style="color:#00ff88">${p.prezzo||'—'}</td>
        <td style="font-size:.75rem;color:#7a90a4">${p.url?`<a href="${p.url}" target="_blank" style="color:#7a90a4">Vedi →</a>`:'—'}</td>
        <td><button onclick="del('${p.id}')" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:.75rem">✕ Rimuovi</button></td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p style="color:#7a90a4;font-size:.85rem">Nessun prodotto nel catalogo. Aggiungine uno sopra o connetti Shopify.</p>'}
</div>
</div>
<script>
async function del(id) {
  if(!confirm('Rimuovere questo prodotto?')) return;
  await fetch('/api/products/'+id, {method:'DELETE'});
  location.reload();
}
</script>
</body></html>`;
}

module.exports = router;
