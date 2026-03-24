const db = require('../services/db');

async function requireAuth(req, res, next) {
  if (req.session && req.session.brandId) return next();
  res.redirect('/login');
}

async function checkGenerations(req, res, next) {
  try {
    const brand = await db.queryOne('SELECT generations_used, generations_limit, plan_status FROM brands WHERE id = $1', [req.session.brandId]);
    if (!brand) return res.status(401).json({ error: 'Non autorizzato' });
    if (brand.plan_status === 'cancelled') return res.status(403).json({ error: 'Piano scaduto', code: 'plan_cancelled' });
    if (brand.generations_used >= brand.generations_limit) {
      return res.status(429).json({ error: 'Limite generazioni raggiunto', code: 'generations_limit', used: brand.generations_used, limit: brand.generations_limit });
    }
    next();
  } catch(e) {
    res.status(500).json({ error: 'Errore server' });
  }
}

module.exports = { requireAuth, checkGenerations };
