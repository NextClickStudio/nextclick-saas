require('dotenv').config();
const cron = require('node-cron');
const logger = require('./utils/logger');
require('@shopify/shopify-api/adapters/node');

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');

const { shopifyApi, ApiVersion } = require('@shopify/shopify-api');
const { PrismaSessionStorage }   = require('./utils/prismaSession');
const prisma                     = require('./utils/prisma');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const shopRoutes      = require('./routes/shop');
const configRoutes    = require('./routes/config');
const productsRoutes  = require('./routes/products');
const widgetRoutes    = require('./routes/widget');
const billingRoutes   = require('./routes/billing');
const analyticsRoutes = require('./routes/analytics');
const generateRoutes  = require('./routes/generate');
const webhookRoutes   = require('./routes/webhooks');

// Guard: crash with a clear message instead of the cryptic
// "Route.get() requires a callback but got [object Undefined]"
const routeMap = {
  authRoutes, shopRoutes, configRoutes, productsRoutes,
  widgetRoutes, billingRoutes, analyticsRoutes, generateRoutes, webhookRoutes,
};
for (const [name, router] of Object.entries(routeMap)) {
  if (!router || typeof router !== 'function') {
    console.error(
      `[FATAL] Route module "${name}" exported undefined or non-function. ` +
      `Check the corresponding file for missing module.exports.`
    );
    process.exit(1);
  }
}

const app  = express();
const PORT = process.env.PORT || 8080;
const HOST = (process.env.HOST || 'http://localhost:' + PORT).replace(/\/$/, '');

// ── Shopify SDK ───────────────────────────────────────────────────────────────
const shopify = shopifyApi({
  apiKey:         process.env.SHOPIFY_API_KEY    || 'dev_key',
  apiSecretKey:   process.env.SHOPIFY_API_SECRET || 'dev_secret',
  scopes:         ['read_products', 'write_script_tags', 'read_script_tags', 'write_products', 'read_orders'],
  hostName:       HOST.replace(/https?:\/\//, ''),
  apiVersion:     ApiVersion.October24,
  isEmbeddedApp:  true,
  sessionStorage: new PrismaSessionStorage(prisma),
});
app.set('shopify', shopify);

// ── Webhooks (raw body — must come before body parsers) ───────────────────────
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// ── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));

app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    'frame-ancestors https://admin.shopify.com https://*.myshopify.com'
  );
  res.removeHeader('X-Frame-Options');
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge:   86400000, // 24h
  },
}));

// Attach shopify instance to every request
app.use((req, _res, next) => { req.shopify = shopify; next(); });

// ── Widget HTML (public) ──────────────────────────────────────────────────────
app.get('/widget', (req, res) => {
  const widgetPath = path.join(__dirname, '../../widget/index.html');
  if (!fs.existsSync(widgetPath)) {
    return res.status(404).send('Widget not found');
  }
  let html = fs.readFileSync(widgetPath, 'utf-8');
  html = html.split('%%API_HOST%%').join(HOST);
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.send(html);
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/shop',      shopRoutes);
app.use('/api/config',    configRoutes);
app.use('/api/products',  productsRoutes);
app.use('/api/widget',    widgetRoutes);
app.use('/api/billing',   billingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/generate',  generateRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    host:   HOST,
    ts:     new Date().toISOString(),
    env: {
      apiKey:       process.env.SHOPIFY_API_KEY    ? 'set' : 'MISSING',
      apiSecret:    process.env.SHOPIFY_API_SECRET ? 'set' : 'MISSING',
      adminToken:   process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN ? 'set' : 'not set',
      database:     process.env.DATABASE_URL       ? 'set' : 'MISSING',
    },
  })
);

// ── Privacy Policy ────────────────────────────────────────────────────────────
app.get('/privacy', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Privacy Policy — NextClick Studio</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:780px;margin:0 auto;padding:40px 24px;color:#111;line-height:1.7;}
  h1{font-size:2rem;font-weight:700;margin-bottom:8px;}
  h2{font-size:1.15rem;font-weight:600;margin-top:36px;margin-bottom:8px;}
  p,li{font-size:.95rem;color:#333;}
  a{color:#0066cc;}
  .meta{color:#888;font-size:.85rem;margin-bottom:32px;}
  hr{border:none;border-top:1px solid #eee;margin:40px 0;}
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p class="meta">Last updated: March 28, 2026 &mdash; NextClick Studio</p>

<p>NextClick Studio operates the NextClick AI Advisor Shopify App. This policy describes how we collect, use and protect data.</p>

<h2>1. Data We Collect</h2>
<p><strong>From merchants (Shopify store owners):</strong></p>
<ul>
  <li>Shop domain, owner name and email (via Shopify OAuth)</li>
  <li>Product catalog: titles, prices, images, descriptions (synced on request)</li>
  <li>App configuration: colors, fonts, AI persona, question flows</li>
  <li>Billing plan and usage counters</li>
</ul>
<p><strong>From end-users (store visitors using the widget):</strong></p>
<ul>
  <li>Anonymous quiz answers (skin type, goals, budget) — never linked to identity</li>
  <li>IP address for rate limiting only (max 10 req/day, expires daily)</li>
  <li>Product click events for merchant analytics</li>
</ul>
<p>We do <strong>not</strong> collect names, emails, or payment data from end-users.</p>

<h2>2. How We Use Data</h2>
<ul>
  <li>To generate AI-powered product recommendations</li>
  <li>To show merchants analytics (generation counts, click rates)</li>
  <li>To enforce fair usage limits</li>
</ul>

<h2>3. Sub-processors</h2>
<ul>
  <li><strong>Google Gemini API</strong> — AI generation (anonymous quiz answers only)</li>
  <li><strong>Railway</strong> — Cloud hosting and database</li>
  <li><strong>Redis</strong> — Temporary rate limit storage (expires daily)</li>
</ul>

<h2>4. Data Retention & Deletion</h2>
<ul>
  <li>Merchant data is retained while the App is installed</li>
  <li>On uninstall: data marked inactive immediately</li>
  <li>On shop/redact webhook: all data permanently deleted within 48h</li>
  <li>Generation logs retained 90 days for analytics</li>
  <li>IP rate data expires daily at midnight UTC</li>
</ul>

<h2>5. GDPR Webhooks</h2>
<p>We support all mandatory Shopify GDPR webhooks:</p>
<ul>
  <li>customers/data_request — data access requests</li>
  <li>customers/redact — customer data deletion</li>
  <li>shop/redact — full shop data deletion</li>
</ul>

<h2>6. Your Rights</h2>
<p>Merchants may request data access, correction or deletion by contacting us. Uninstalling the App triggers automatic deletion.</p>

<h2>7. Contact</h2>
<p><a href="mailto:privacy@nextclickstudio.com">privacy@nextclickstudio.com</a></p>
<hr/>
<p style="color:#888;font-size:.82rem;">NextClick Studio &mdash; nextclickstudio.com</p>
</body>
</html>\`);
});

app.get('/terms', (_req, res) => res.redirect('/privacy'));

app.get('/gdpr', (_req, res) => res.json({
  webhooks: {
    customers_data_request: HOST + '/api/webhooks/customers/data_request',
    customers_redact:       HOST + '/api/webhooks/customers/redact',
    shop_redact:            HOST + '/api/webhooks/shop/redact',
  },
  privacy_policy: HOST + '/privacy',
  contact: 'privacy@nextclickstudio.com',
}));

// ── Serve React frontend ──────────────────────────────────────────────────────
const frontendBuild = path.join(__dirname, '../../frontend/build');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get(/^(?!\/api|\/widget|\/health).*$/, (_req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
} else {
  console.warn('WARNING: frontend/build not found — skipping static serving');
}

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server] unhandled error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`NextClick Backend running on port ${PORT}`);
  console.log(`HOST: ${HOST}`);
  console.log(`API Key:      ${process.env.SHOPIFY_API_KEY    ? 'set' : '⚠️  MISSING'}`);
  console.log(`API Secret:   ${process.env.SHOPIFY_API_SECRET ? 'set' : '⚠️  MISSING'}`);
  console.log(`Admin Token:  ${process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN ? 'set ✓' : 'not set (OAuth only)'}`);
  console.log(`Database:     ${process.env.DATABASE_URL ? 'set' : '⚠️  MISSING'}`);

  // ── Self-ping ogni 4 minuti — previene cold start Railway ──
  setInterval(() => {
    const lib = HOST.startsWith('https') ? require('https') : require('http');
    lib.get(HOST + '/health', () => {}).on('error', () => {});
  }, 4 * 60 * 1000);

  // ── Cron: reset generazioni il 1° di ogni mese alle 00:00 UTC ──
  // Safety net per quando il webhook billing-update di Shopify non arriva
  cron.schedule('0 0 1 * *', async () => {
    try {
      const result = await prisma.shop.updateMany({
        where: {
          planStatus: 'active',
          isActive: true,
        },
        data: {
          generationsUsed: 0,
          billingCycleStart: new Date(),
        },
      });
      logger.info('Cron monthly reset', { shopsReset: result.count });
    } catch (err) {
      logger.error('Cron monthly reset failed', err);
    }
  }, { timezone: 'UTC' });

  console.log('[cron] Monthly generation reset scheduled (1st of month, 00:00 UTC)');
});

module.exports = app;
