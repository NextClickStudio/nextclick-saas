require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const db = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ──
app.use(morgan('dev'));

// Global CORS — widget runs on Shopify (different origin), needs permissive headers
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'nc-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// ── VIEW ENGINE ──
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));
app.engine('html', (filePath, options, callback) => {
  const fs = require('fs');
  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) return callback(err);
    const rendered = content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return options[key] !== undefined ? options[key] : '';
    });
    callback(null, rendered);
  });
});

// ── ROUTES ──
app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/onboarding', require('./routes/onboarding'));
app.use('/api', require('./routes/api'));
app.use('/', require('./routes/widget'));
app.use('/billing', require('./routes/billing'));

// ── START ──
db.init();
app.listen(PORT, () => {
  console.log(`✓ NextClick SaaS running on port ${PORT}`);
});
