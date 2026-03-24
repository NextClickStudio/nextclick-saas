require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const { shopifyApi, ApiVersion } = require('@shopify/shopify-api');
const { PrismaSessionStorage } = require('./utils/prismaSession');
const prisma = require('./utils/prisma');

const authRoutes      = require('./routes/auth');
const shopRoutes      = require('./routes/shop');
const configRoutes    = require('./routes/config');
const productsRoutes  = require('./routes/products');
const widgetRoutes    = require('./routes/widget');
const billingRoutes   = require('./routes/billing');
const analyticsRoutes = require('./routes/analytics');
const generateRoutes  = require('./routes/generate');
const webhookRoutes   = require('./routes/webhooks');

const app  = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'http://localhost:' + PORT;

// Shopify SDK
const shopify = shopifyApi({
  apiKey:        process.env.SHOPIFY_API_KEY || 'dev_key',
  apiSecretKey:  process.env.SHOPIFY_API_SECRET || 'dev_secret',
  scopes:        ['read_products', 'write_script_tags', 'read_script_tags'],
  hostName:      HOST.replace(/https?:\/\//, ''),
  apiVersion:    ApiVersion.October24,
  isEmbeddedApp: true,
  sessionStorage: new PrismaSessionStorage(prisma),
});
app.set('shopify', shopify);

// Webhooks need raw body - BEFORE json parser
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'nextclick-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 86400000,
  },
}));
app.use((req, _res, next) => { req.shopify = shopify; next(); });

// Widget HTML page (iframe embeddabile)
app.get('/widget', (req, res) => {
  const widgetPath = path.join(__dirname, '../../widget/index.html');
  if (!fs.existsSync(widgetPath)) return res.status(404).send('Widget not found');
  let html = fs.readFileSync(widgetPath, 'utf-8');
  html = html.replace('%%API_HOST%%', HOST);
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.send(html);
});

// API
app.use('/api/auth',      authRoutes);
app.use('/api/shop',      shopRoutes);
app.use('/api/config',    configRoutes);
app.use('/api/products',  productsRoutes);
app.use('/api/widget',    widgetRoutes);
app.use('/api/billing',   billingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/generate',  generateRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Serve React build (frontend)
const frontendBuild = path.join(__dirname, '../../frontend/build');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get(/^(?!\/api|\/widget|\/health).*$/, (_req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log('NextClick Backend running');
  console.log('  HOST:   ' + HOST);
  console.log('  Widget: ' + HOST + '/widget?shop=<domain>');
});

module.exports = app;
