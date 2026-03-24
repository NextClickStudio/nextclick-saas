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

// Global CORS — widget runs on Shopify (different origin)
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

// ── SESSION ──
// FIX: Use a persistent SQLite session store so sessions survive Railway
// container restarts / sleep. Without this, every restart logs everyone out.
// Run: npm install connect-sqlite3
let sessionMiddleware;
try {
  const SQLiteStore = require('connect-sqlite3')(session);
  const fs = require('fs');
  const dataDir = process.env.DB_PATH
    ? path.dirname(process.env.DB_PATH)
    : path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  sessionMiddleware = session({
    store: new SQLiteStore({ db: 'sessions.db', dir: dataDir }),
    secret: process.env.SESSION_SECRET || 'nc-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  });
  console.log('✓ Session store: SQLite (persistent)');
} catch (e) {
  // Fallback to memory store if connect-sqlite3 not installed yet
  console.warn('⚠ connect-sqlite3 not found, using memory session store.');
  console.warn('  Run: npm install connect-sqlite3');
  sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'nc-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // force false for memory store fallback
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  });
}

app.use(sessionMiddleware);

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
