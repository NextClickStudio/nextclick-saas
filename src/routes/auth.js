const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.brandId) return res.redirect('/dashboard');
  res.redirect('/login');
});

router.get('/login', (req, res) => {
  res.send(loginPage(req.query.error || ''));
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const brand = await db.queryOne('SELECT * FROM brands WHERE email = $1', [email]);
    if (!brand || !bcrypt.compareSync(password, brand.password)) {
      return res.redirect('/login?error=Credenziali+non+valide');
    }
    await db.execute('UPDATE brands SET last_login = NOW() WHERE id = $1', [brand.id]);
    req.session.brandId = brand.id;
    req.session.brandName = brand.name;
    const config = await db.queryOne('SELECT * FROM brand_configs WHERE brand_id = $1', [brand.id]);
    if (!config || !config.category) return res.redirect('/onboarding/step1');
    res.redirect('/dashboard');
  } catch(e) {
    console.error('Login error:', e.message);
    res.redirect('/login?error=Errore+del+server');
  }
});

router.get('/register', (req, res) => {
  res.send(registerPage(req.query.error || ''));
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, plan } = req.body;
    if (!email || !password || !name) return res.redirect('/register?error=Compila+tutti+i+campi');
    const existing = await db.queryOne('SELECT id FROM brands WHERE email = $1', [email]);
    if (existing) return res.redirect('/register?error=Email+già+registrata');
    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    const genLimit = plan === 'advisor' ? 2000 : 500;
    await db.execute(
      `INSERT INTO brands (id, email, password, name, plan, plan_status, generations_limit) VALUES ($1,$2,$3,$4,$5,'trial',$6)`,
      [id, email, hash, name, plan || 'recommend', genLimit]
    );
    req.session.brandId = id;
    req.session.brandName = name;
    res.redirect('/onboarding/step1');
  } catch(e) {
    console.error('Register error:', e.message);
    res.redirect('/register?error=Errore+del+server');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

function loginPage(error) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Login — NextClick</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#060809;color:#eef4f8;font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{background:#0d1117;border:1px solid #1a2535;padding:48px;width:100%;max-width:420px;border-radius:2px}.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.4rem;color:#00ff88;margin-bottom:8px}.logo span{color:#eef4f8}h1{font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;margin-bottom:32px;color:#7a90a4}label{display:block;font-size:.72rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#7a90a4;margin-bottom:6px}input{width:100%;padding:12px 14px;background:#060809;border:1px solid #1a2535;color:#eef4f8;font-family:'DM Sans',sans-serif;font-size:.92rem;margin-bottom:20px;outline:none;border-radius:2px}input:focus{border-color:#00ff88}.btn{width:100%;padding:14px;background:#00ff88;color:#060809;font-family:'Syne',sans-serif;font-size:.75rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;border:none;cursor:pointer;border-radius:2px}.btn:hover{background:#00ffaa}.error{background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.3);color:#ff6b6b;padding:12px;margin-bottom:20px;font-size:.82rem;border-radius:2px}.link{text-align:center;margin-top:20px;font-size:.82rem;color:#7a90a4}.link a{color:#00ff88;text-decoration:none}</style></head>
<body><div class="card"><div class="logo">•N<span>EXTCLICK</span></div><h1>Accedi al tuo account</h1>
${error ? `<div class="error">${decodeURIComponent(error)}</div>` : ''}
<form method="POST" action="/login"><label>Email</label><input type="email" name="email" required/><label>Password</label><input type="password" name="password" required/><button class="btn" type="submit">Accedi →</button></form>
<div class="link">Non hai un account? <a href="/register">Registrati gratis</a></div></div></body></html>`;
}

function registerPage(error) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Registrati — NextClick</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#060809;color:#eef4f8;font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{background:#0d1117;border:1px solid #1a2535;padding:48px;width:100%;max-width:480px;border-radius:2px}.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.4rem;color:#00ff88;margin-bottom:8px}.logo span{color:#eef4f8}h1{font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;margin-bottom:8px}.sub{color:#7a90a4;font-size:.85rem;margin-bottom:32px}label{display:block;font-size:.72rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#7a90a4;margin-bottom:6px}input,select{width:100%;padding:12px 14px;background:#060809;border:1px solid #1a2535;color:#eef4f8;font-family:'DM Sans',sans-serif;font-size:.92rem;margin-bottom:20px;outline:none;border-radius:2px}input:focus{border-color:#00ff88}.plans{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}.plan-card{border:1px solid #1a2535;padding:16px;cursor:pointer;border-radius:2px;transition:.2s}.plan-card.selected{border-color:#00ff88;background:rgba(0,255,136,0.05)}.plan-card input[type=radio]{display:none}.plan-name{font-family:'Syne',sans-serif;font-weight:700;font-size:.9rem;margin-bottom:4px}.plan-price{color:#00ff88;font-size:1.1rem;font-weight:700;font-family:'Syne',sans-serif}.plan-desc{font-size:.72rem;color:#7a90a4;margin-top:6px}.btn{width:100%;padding:14px;background:#00ff88;color:#060809;font-family:'Syne',sans-serif;font-size:.75rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;border:none;cursor:pointer;border-radius:2px}.error{background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.3);color:#ff6b6b;padding:12px;margin-bottom:20px;font-size:.82rem;border-radius:2px}.link{text-align:center;margin-top:20px;font-size:.82rem;color:#7a90a4}.link a{color:#00ff88;text-decoration:none}</style></head>
<body><div class="card"><div class="logo">•N<span>EXTCLICK</span></div><h1>Inizia gratis</h1><p class="sub">Trial gratuito · Nessuna carta richiesta</p>
${error ? `<div class="error">${decodeURIComponent(error)}</div>` : ''}
<form method="POST" action="/register">
<label>Nome Brand</label><input type="text" name="name" placeholder="Es. Glow Beauty Studio" required/>
<label>Email</label><input type="email" name="email" placeholder="brand@example.com" required/>
<label>Password</label><input type="password" name="password" placeholder="Min. 8 caratteri" required/>
<label>Scegli il piano</label>
<div class="plans">
<label class="plan-card selected" onclick="sel(this)"><input type="radio" name="plan" value="recommend" checked/><div class="plan-name">Recommend</div><div class="plan-price">€59/mese</div><div class="plan-desc">Prodotti AI · 500 gen/mese</div></label>
<label class="plan-card" onclick="sel(this)"><input type="radio" name="plan" value="advisor"/><div class="plan-name">Advisor</div><div class="plan-price">€199/mese</div><div class="plan-desc">Routine completa · 2000 gen/mese</div></label>
</div>
<button class="btn" type="submit">Crea account →</button></form>
<div class="link">Hai già un account? <a href="/login">Accedi</a></div></div>
<script>function sel(el){document.querySelectorAll('.plan-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');el.querySelector('input[type=radio]').checked=true;}</script>
</body></html>`;
}

module.exports = router;
