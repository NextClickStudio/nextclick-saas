require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const db = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'nc-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/onboarding', require('./routes/onboarding'));
app.use('/api', require('./routes/api'));
app.use('/widget', require('./routes/widget'));
app.use('/billing', require('./routes/billing'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).send('Errore server: ' + err.message);
});

async function start() {
  await db.init();
  app.listen(PORT, () => {
    console.log(`✓ NextClick SaaS running on port ${PORT}`);
  });
}

start().catch(e => {
  console.error('Startup error:', e.message);
  process.exit(1);
});
