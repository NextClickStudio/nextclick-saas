function requireAuth(req, res, next) {
  if (req.session && req.session.brandId) return next();
  res.redirect('/login');
}

function requirePlan(plan) {
  return (req, res, next) => {
    const db = require('../services/db').get();
    const brand = db.prepare('SELECT plan, plan_status FROM brands WHERE id = ?').get(req.session.brandId);
    if (!brand) return res.redirect('/login');
    if (brand.plan_status === 'cancelled') return res.redirect('/billing?status=cancelled');
    if (plan === 'advisor' && brand.plan !== 'advisor') {
      return res.redirect('/billing?upgrade=advisor');
    }
    next();
  };
}

function checkGenerations(req, res, next) {
  const db = require('../services/db').get();
  const brand = db.prepare('SELECT generations_used, generations_limit, plan_status FROM brands WHERE id = ?').get(req.session.brandId);
  if (!brand) return res.status(401).json({ error: 'Non autorizzato' });
  if (brand.plan_status === 'cancelled') return res.status(403).json({ error: 'Piano scaduto', code: 'plan_cancelled' });
  if (brand.generations_used >= brand.generations_limit) {
    return res.status(429).json({
      error: 'Limite generazioni raggiunto',
      code: 'generations_limit',
      used: brand.generations_used,
      limit: brand.generations_limit
    });
  }
  next();
}

module.exports = { requireAuth, requirePlan, checkGenerations };
