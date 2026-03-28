require('dotenv').config();
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
  scopes:         ['read_products', 'write_script_tags', 'read_script_tags'],
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

  // Self-ping ogni 4 minuti — previene il cold start di Railway
  setInterval(() => {
    const lib = HOST.startsWith('https') ? require('https') : require('http');
    lib.get(HOST + '/health', () => {}).on('error', () => {});
  }, 4 * 60 * 1000);
});

module.exports = app;
