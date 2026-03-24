const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../services/db');
const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const brand = db.get().prepare('SELECT * FROM brands WHERE id = ?').get(req.session.brandId);
  const config = db.get().prepare('SELECT * FROM brand_configs WHERE brand_id = ?').get(req.session.brandId);
  const products = db.get().prepare('SELECT COUNT(*) as count FROM products WHERE brand_id = ? AND attivo = 1').get(req.session.brandId);
  const gens = db.get().prepare("SELECT COUNT(*) as count FROM generations WHERE brand_id = ? AND date(created_at) >= date('now','-30 days')").get(req.session.brandId);
  const shopify = db.get().prepare('SELECT shop_domain FROM shopify_connections WHERE brand_id = ?').get(req.session.brandId);

  const widgetCode = `<script src="https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3000'}/widget.js" data-brand="${req.session.brandId}"></script>`;
  const genPercent = Math.round((brand.generations_used / brand.generations_limit) * 100);

  res.send(dashboardPage({
    brand, config, products, gens, shopify, widgetCode, genPercent
  }));
});

function dashboardPage({ brand, config, products, gens, shopify, widgetCode, genPercent }) {
  const planLabel = brand.plan === 'advisor' ? 'Advisor' : 'Recommend';
  const planPrice = brand.plan === 'advisor' ? '€199' : '€59';
  const statusColor = brand.plan_status === 'active' ? '#00ff88' : brand.plan_status === 'trial' ? '#ffca28' : '#ff6b6b';
  const statusLabel = brand.plan_status === 'active' ? 'Attivo' : brand.plan_status === 'trial' ? 'Trial' : 'Scaduto';

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dashboard — NextClick</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#060809;color:#eef4f8;font-family:'DM Sans',sans-serif;min-height:100vh}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:56px;border-bottom:1px solid #1a2535;background:#060809;position:sticky;top:0;z-index:50}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:#00ff88;text-decoration:none}
.logo span{color:#eef4f8}
.topbar-right{display:flex;align-items:center;gap:20px}
.brand-name{font-size:.82rem;color:#7a90a4}
.logout{font-size:.65rem;color:#7a90a4;text-decoration:none;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;border:1px solid #1a2535;border-radius:2px}
.logout:hover{color:#ff6b6b;border-color:#ff6b6b}
.wrap{max-width:1100px;margin:0 auto;padding:40px 32px}
h1{font-family:'Syne',sans-serif;font-size:1.5rem;font-weight:800;margin-bottom:4px}
.sub{color:#7a90a4;font-size:.88rem;margin-bottom:32px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
.stat{background:#0d1117;border:1px solid #1a2535;padding:20px;border-radius:2px}
.stat-label{font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:#7a90a4;margin-bottom:8px}
.stat-value{font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800}
.stat-sub{font-size:.75rem;color:#7a90a4;margin-top:4px}
.section{background:#0d1117;border:1px solid #1a2535;padding:24px;border-radius:2px;margin-bottom:20px}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.section-title{font-family:'Syne',sans-serif;font-size:.85rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.btn{display:inline-block;padding:10px 20px;background:#00ff88;color:#060809;font-family:'Syne',sans-serif;font-size:.65rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border:none;cursor:pointer;border-radius:2px;text-decoration:none}
.btn:hover{background:#00ffaa}
.btn-sm{padding:7px 14px;font-size:.62rem}
.btn-outline{background:transparent;border:1px solid #1a2535;color:#7a90a4}
.btn-outline:hover{border-color:#00ff88;color:#00ff88}
.code-block{background:#060809;border:1px solid #1a2535;padding:16px;border-radius:2px;font-family:monospace;font-size:.78rem;color:#00ff88;word-break:break-all;cursor:pointer;position:relative}
.code-block:hover{border-color:#00ff88}
.copy-hint{position:absolute;top:8px;right:12px;font-size:.65rem;color:#7a90a4;font-family:'DM Sans',sans-serif}
.progress-bar{background:#1a2535;height:6px;border-radius:3px;margin-top:8px;overflow:hidden}
.progress-fill{height:100%;background:#00ff88;border-radius:3px;transition:.3s}
.progress-fill.warn{background:#ffca28}
.progress-fill.danger{background:#ff6b6b}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-left:8px}
.links-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.quick-link{background:#060809;border:1px solid #1a2535;padding:16px;border-radius:2px;text-decoration:none;color:#eef4f8;transition:.2s;display:flex;align-items:center;gap:12px}
.quick-link:hover{border-color:#00ff88}
.quick-link-icon{font-size:1.4rem}
.quick-link-text .title{font-family:'Syne',sans-serif;font-size:.82rem;font-weight:700;margin-bottom:2px}
.quick-link-text .desc{font-size:.72rem;color:#7a90a4}
@media(max-width:768px){.grid{grid-template-columns:repeat(2,1fr)}.links-grid{grid-template-columns:1fr}.wrap{padding:24px 16px}}
</style>
</head>
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
  <p class="sub">Benvenuto, ${brand.name} · Piano <strong>${planLabel}</strong> ${planPrice}/mese
    <span class="badge" style="background:rgba(0,255,136,0.1);color:${statusColor}">${statusLabel}</span>
  </p>

  <!-- STATS -->
  <div class="grid">
    <div class="stat">
      <div class="stat-label">Prodotti attivi</div>
      <div class="stat-value" style="color:#00ff88">${products.count}</div>
      <div class="stat-sub">nel catalogo</div>
    </div>
    <div class="stat">
      <div class="stat-label">Generazioni usate</div>
      <div class="stat-value">${brand.generations_used}<span style="font-size:1rem;color:#7a90a4">/${brand.generations_limit}</span></div>
      <div class="stat-sub">questo mese</div>
      <div class="progress-bar"><div class="progress-fill ${genPercent > 90 ? 'danger' : genPercent > 70 ? 'warn' : ''}" style="width:${genPercent}%"></div></div>
    </div>
    <div class="stat">
      <div class="stat-label">Gen. ultimi 30gg</div>
      <div class="stat-value">${gens.count}</div>
      <div class="stat-sub">routine generate</div>
    </div>
    <div class="stat">
      <div class="stat-label">Shopify</div>
      <div class="stat-value" style="font-size:1rem;padding-top:4px">${shopify ? shopify.shop_domain : 'Non connesso'}</div>
      <div class="stat-sub">${shopify ? '✓ sincronizzato' : 'da connettere'}</div>
    </div>
  </div>

  <!-- WIDGET SNIPPET -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">📦 Il tuo Widget</span>
      <a href="/onboarding/step1" class="btn btn-outline btn-sm">✏️ Modifica config</a>
    </div>
    <p style="font-size:.82rem;color:#7a90a4;margin-bottom:12px">Incolla questo codice nel tema Shopify dove vuoi mostrare l'AI Advisor:</p>
    <div class="code-block" onclick="copyCode(this)">
      <span class="copy-hint">clicca per copiare</span>
      &lt;script src="https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'yourdomain.up.railway.app'}/widget.js" data-brand="${brand.id}"&gt;&lt;/script&gt;
    </div>
    <p style="font-size:.75rem;color:#7a90a4;margin-top:10px">Posizionalo su qualsiasi pagina del tuo store. Il widget si caricherà automaticamente con il tuo design personalizzato.</p>
  </div>

  <!-- QUICK LINKS -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">⚡ Azioni rapide</span>
    </div>
    <div class="links-grid">
      <a href="/dashboard/products" class="quick-link">
        <div class="quick-link-icon">🛍️</div>
        <div class="quick-link-text">
          <div class="title">Gestisci prodotti</div>
          <div class="desc">Aggiungi, modifica o sincronizza i prodotti</div>
        </div>
      </a>
      <a href="/onboarding/step2" class="quick-link">
        <div class="quick-link-icon">🎨</div>
        <div class="quick-link-text">
          <div class="title">Modifica design</div>
          <div class="desc">Colori, font e layout del widget</div>
        </div>
      </a>
      <a href="/onboarding/step5" class="quick-link">
        <div class="quick-link-icon">🤖</div>
        <div class="quick-link-text">
          <div class="title">AI Persona</div>
          <div class="desc">Come parla il tuo consulente AI</div>
        </div>
      </a>
      <a href="/billing" class="quick-link">
        <div class="quick-link-icon">💳</div>
        <div class="quick-link-text">
          <div class="title">Abbonamento</div>
          <div class="desc">Piano, fatturazione e upgrade</div>
        </div>
      </a>
    </div>
  </div>

</div>
<script>
function copyCode(el) {
  const text = el.textContent.replace('clicca per copiare','').trim();
  navigator.clipboard.writeText(text).then(() => {
    el.style.borderColor = '#00ff88';
    el.querySelector('.copy-hint').textContent = '✓ copiato!';
    setTimeout(() => {
      el.style.borderColor = '';
      el.querySelector('.copy-hint').textContent = 'clicca per copiare';
    }, 2000);
  });
}
</script>
</body>
</html>`;
}

// Products management page
router.get('/products', (req, res) => {
  const products = db.get().prepare('SELECT * FROM products WHERE brand_id = ? ORDER BY created_at DESC').all(req.session.brandId);
  const shopify = db.get().prepare('SELECT shop_domain FROM shopify_connections WHERE brand_id = ?').get(req.session.brandId);
  res.send(productsPage(products, shopify, req.session.brandId));
});

function productsPage(products, shopify, brandId) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Prodotti — NextClick</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#060809;color:#eef4f8;font-family:'DM Sans',sans-serif;min-height:100vh}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:56px;border-bottom:1px solid #1a2535;background:#060809;position:sticky;top:0;z-index:50}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:#00ff88;text-decoration:none}
.logo span{color:#eef4f8}
.wrap{max-width:1000px;margin:0 auto;padding:40px 32px}
h1{font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;margin-bottom:32px}
.actions{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
.btn{display:inline-block;padding:10px 20px;background:#00ff88;color:#060809;font-family:'Syne',sans-serif;font-size:.65rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border:none;cursor:pointer;border-radius:2px;text-decoration:none}
.btn:hover{background:#00ffaa}
.btn-outline{background:transparent;border:1px solid #1a2535;color:#7a90a4}
.btn-outline:hover{border-color:#00ff88;color:#00ff88}
.btn-danger{background:#ff4444;color:#fff}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:#7a90a4;padding:10px 16px;border-bottom:1px solid #1a2535}
td{padding:12px 16px;border-bottom:1px solid #0d1117;font-size:.85rem}
tr:hover td{background:#0d1117}
.status-active{color:#00ff88}
.status-inactive{color:#ff6b6b}
.empty{text-align:center;padding:48px;color:#7a90a4}
</style>
</head>
<body>
<div class="topbar"><a class="logo" href="/dashboard">•N<span>EXTCLICK</span></a></div>
<div class="wrap">
  <h1>Gestione Prodotti</h1>
  <div class="actions">
    <a href="/dashboard" class="btn btn-outline">← Dashboard</a>
    ${shopify ? `<a href="/api/shopify/sync" class="btn">↻ Sincronizza Shopify</a>` : `<a href="/api/shopify/connect" class="btn">Connetti Shopify</a>`}
    <button class="btn btn-outline" onclick="document.getElementById('addForm').style.display='block'">+ Aggiungi manuale</button>
  </div>

  <!-- ADD MANUAL FORM -->
  <div id="addForm" style="display:none;background:#0d1117;border:1px solid #1a2535;padding:24px;border-radius:2px;margin-bottom:24px">
    <h3 style="font-family:Syne,sans-serif;font-size:.9rem;margin-bottom:16px">Aggiungi prodotto manualmente</h3>
    <form method="POST" action="/api/products/add" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><label style="font-size:.65rem;color:#7a90a4;display:block;margin-bottom:4px">Nome *</label><input type="text" name="nome" required style="width:100%;padding:10px;background:#060809;border:1px solid #1a2535;color:#eef4f8;border-radius:2px"/></div>
      <div><label style="font-size:.65rem;color:#7a90a4;display:block;margin-bottom:4px">Prezzo</label><input type="text" name="prezzo" placeholder="€29,00" style="width:100%;padding:10px;background:#060809;border:1px solid #1a2535;color:#eef4f8;border-radius:2px"/></div>
      <div style="grid-column:1/-1"><label style="font-size:.65rem;color:#7a90a4;display:block;margin-bottom:4px">URL prodotto</label><input type="url" name="url" placeholder="https://tuostore.myshopify.com/products/..." style="width:100%;padding:10px;background:#060809;border:1px solid #1a2535;color:#eef4f8;border-radius:2px"/></div>
      <div style="grid-column:1/-1"><label style="font-size:.65rem;color:#7a90a4;display:block;margin-bottom:4px">Descrizione</label><textarea name="descrizione" style="width:100%;padding:10px;background:#060809;border:1px solid #1a2535;color:#eef4f8;border-radius:2px;resize:vertical;min-height:80px"></textarea></div>
      <div style="grid-column:1/-1;display:flex;gap:12px">
        <button class="btn" type="submit">Salva prodotto</button>
        <button class="btn btn-outline" type="button" onclick="document.getElementById('addForm').style.display='none'">Annulla</button>
      </div>
    </form>
  </div>

  ${products.length > 0 ? `
  <table>
    <thead><tr><th>Nome</th><th>Prezzo</th><th>Categoria</th><th>Stato</th><th>Azioni</th></tr></thead>
    <tbody>
      ${products.map(p => `
        <tr>
          <td>${p.nome}</td>
          <td>${p.prezzo || '—'}</td>
          <td>${p.categoria || '—'}</td>
          <td class="${p.attivo ? 'status-active' : 'status-inactive'}">${p.attivo ? '● Attivo' : '○ Inattivo'}</td>
          <td>
            <button class="btn btn-danger" style="padding:4px 10px;font-size:.6rem" onclick="deleteProduct('${p.id}')">✕</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>` : '<div class="empty">Nessun prodotto. Connetti Shopify o aggiungili manualmente.</div>'}
</div>
<script>
function deleteProduct(id){
  if(!confirm('Eliminare questo prodotto?')) return;
  fetch('/api/products/'+id, {method:'DELETE'})
    .then(()=>location.reload());
}
</script>
</body></html>`;
}

module.exports = router;
