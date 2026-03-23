const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../services/db');
const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const brand = db.get().prepare('SELECT * FROM brands WHERE id = ?').get(req.session.brandId);
  const status = req.query.status || '';
  const upgrade = req.query.upgrade || '';
  res.send(billingPage(brand, status, upgrade));
});

// Upgrade plan (manual for now, Stripe to be added)
router.post('/upgrade', (req, res) => {
  const { plan } = req.body;
  const genLimit = plan === 'advisor' ? 2000 : 500;
  db.get().prepare('UPDATE brands SET plan = ?, generations_limit = ?, plan_status = "active" WHERE id = ?')
    .run(plan, genLimit, req.session.brandId);
  res.redirect('/dashboard?success=upgraded');
});

function billingPage(brand, status, upgrade) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Abbonamento — NextClick</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#060809;color:#eef4f8;font-family:'DM Sans',sans-serif;min-height:100vh}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:56px;border-bottom:1px solid #1a2535;background:#060809}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:#00ff88;text-decoration:none}
.logo span{color:#eef4f8}
.wrap{max-width:800px;margin:0 auto;padding:48px 32px}
h1{font-family:'Syne',sans-serif;font-size:1.5rem;font-weight:800;margin-bottom:8px}
.sub{color:#7a90a4;font-size:.88rem;margin-bottom:40px}
.plans{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:40px}
.plan{background:#0d1117;border:1px solid #1a2535;padding:28px;border-radius:2px;position:relative}
.plan.current{border-color:#00ff88}
.plan.current::before{content:'Piano attuale';position:absolute;top:-10px;left:20px;background:#00ff88;color:#060809;font-size:.6rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:3px 10px;border-radius:20px}
.plan-name{font-family:'Syne',sans-serif;font-size:1rem;font-weight:700;margin-bottom:4px}
.plan-price{font-family:'Syne',sans-serif;font-size:2rem;font-weight:800;color:#00ff88;margin-bottom:4px}
.plan-price span{font-size:.9rem;color:#7a90a4}
.plan-desc{font-size:.82rem;color:#7a90a4;margin-bottom:20px;line-height:1.6}
.features{list-style:none;margin-bottom:24px}
.features li{font-size:.82rem;padding:6px 0;border-bottom:1px solid #1a2535;display:flex;align-items:center;gap:8px}
.features li::before{content:'✓';color:#00ff88;font-weight:700}
.btn{display:block;width:100%;padding:12px;background:#00ff88;color:#060809;font-family:'Syne',sans-serif;font-size:.7rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border:none;cursor:pointer;border-radius:2px;text-align:center;text-decoration:none}
.btn:hover{background:#00ffaa}
.btn-outline{background:transparent;border:1px solid #1a2535;color:#7a90a4}
.btn-outline:hover{border-color:#00ff88;color:#00ff88}
.info-box{background:#0b1f13;border:1px solid #00ff8830;padding:20px;border-radius:2px;margin-bottom:20px;font-size:.85rem;line-height:1.7;color:#7a90a4}
.info-box strong{color:#00ff88}
@media(max-width:600px){.plans{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="topbar"><a class="logo" href="/dashboard">•N<span>EXTCLICK</span></a></div>
<div class="wrap">
  <h1>Abbonamento</h1>
  <p class="sub">Gestisci il tuo piano NextClick</p>

  ${upgrade === 'advisor' ? '<div class="info-box"><strong>Upgrade richiesto.</strong> Questa funzionalità è disponibile nel piano Advisor.</div>' : ''}

  <div class="plans">
    <div class="plan ${brand.plan === 'recommend' ? 'current' : ''}">
      <div class="plan-name">Recommend</div>
      <div class="plan-price">€59<span>/mese</span></div>
      <div class="plan-desc">Suggerisce i prodotti giusti agli utenti del tuo store.</div>
      <ul class="features">
        <li>500 generazioni/mese</li>
        <li>Suggerimento prodotti AI</li>
        <li>Personalizzazione design</li>
        <li>Sincronizzazione Shopify</li>
        <li>Supporto email</li>
      </ul>
      ${brand.plan === 'recommend'
        ? '<div class="btn btn-outline" style="text-align:center;padding:12px">Piano attuale</div>'
        : `<form method="POST" action="/billing/upgrade"><input type="hidden" name="plan" value="recommend"/><button class="btn" type="submit">Passa a Recommend</button></form>`
      }
    </div>
    <div class="plan ${brand.plan === 'advisor' ? 'current' : ''}">
      <div class="plan-name">Advisor</div>
      <div class="plan-price">€199<span>/mese</span></div>
      <div class="plan-desc">Genera routine complete e personalizzate con analisi AI avanzata.</div>
      <ul class="features">
        <li>2000 generazioni/mese</li>
        <li>Routine personalizzata completa</li>
        <li>Suggerimento prodotti AI</li>
        <li>Personalizzazione design + copy</li>
        <li>AI Persona personalizzabile</li>
        <li>Sincronizzazione Shopify</li>
        <li>Supporto prioritario</li>
      </ul>
      ${brand.plan === 'advisor'
        ? '<div class="btn btn-outline" style="text-align:center;padding:12px">Piano attuale</div>'
        : `<form method="POST" action="/billing/upgrade"><input type="hidden" name="plan" value="advisor"/><button class="btn" type="submit">Upgrade a Advisor →</button></form>`
      }
    </div>
  </div>

  <div class="info-box">
    <strong>Generazioni questo mese:</strong> ${brand.generations_used} / ${brand.generations_limit}<br>
    <strong>Stato:</strong> ${brand.plan_status}<br>
    <strong>Prossimo rinnovo:</strong> Il tuo piano si rinnova mensilmente.<br><br>
    Per cancellare o modificare l'abbonamento contatta <strong>support@nextclick.studio</strong>
  </div>

  <a href="/dashboard" class="btn btn-outline" style="display:inline-block;width:auto;padding:12px 24px">← Torna alla dashboard</a>
</div>
</body>
</html>`;
}

module.exports = router;
