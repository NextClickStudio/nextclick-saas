const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/nextclick.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db;

function init() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- BRANDS (customers)
    CREATE TABLE IF NOT EXISTS brands (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      name        TEXT NOT NULL,
      plan        TEXT DEFAULT 'recommend',  -- 'recommend' | 'advisor'
      plan_status TEXT DEFAULT 'trial',      -- 'trial' | 'active' | 'cancelled'
      generations_used  INTEGER DEFAULT 0,
      generations_limit INTEGER DEFAULT 100,
      stripe_customer_id TEXT,
      stripe_sub_id      TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      last_login  TEXT
    );

    -- BRAND CONFIG (onboarding data)
    CREATE TABLE IF NOT EXISTS brand_configs (
      brand_id      TEXT PRIMARY KEY REFERENCES brands(id),
      category      TEXT,
      logo_url      TEXT,
      color_bg      TEXT DEFAULT '#FFFFFF',
      color_primary TEXT DEFAULT '#000000',
      color_text    TEXT DEFAULT '#333333',
      color_button  TEXT DEFAULT '#000000',
      font_family   TEXT DEFAULT 'Inter',
      copy_title    TEXT,
      copy_subtitle TEXT,
      copy_cta      TEXT,
      questions     TEXT,   -- JSON array of custom questions
      ai_persona    TEXT,   -- Free text: how AI should speak
      ai_language   TEXT DEFAULT 'it',
      widget_position TEXT DEFAULT 'inline',
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    -- PRODUCTS (imported from Shopify or manual)
    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      brand_id    TEXT REFERENCES brands(id),
      shopify_id  TEXT,
      nome        TEXT NOT NULL,
      url         TEXT,
      descrizione TEXT,
      prezzo      TEXT,
      prezzo_num  REAL,
      immagine    TEXT,
      categoria   TEXT,
      tags        TEXT,  -- JSON array
      attivo      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- GENERATIONS (analytics + usage tracking)
    CREATE TABLE IF NOT EXISTS generations (
      id          TEXT PRIMARY KEY,
      brand_id    TEXT REFERENCES brands(id),
      created_at  TEXT DEFAULT (datetime('now')),
      categoria   TEXT,
      plan_type   TEXT,
      success     INTEGER DEFAULT 1,
      tokens_used INTEGER DEFAULT 0
    );

    -- SHOPIFY CONNECTIONS
    CREATE TABLE IF NOT EXISTS shopify_connections (
      brand_id      TEXT PRIMARY KEY REFERENCES brands(id),
      shop_domain   TEXT NOT NULL,
      access_token  TEXT NOT NULL,
      connected_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('✓ Database initialized');
}

function get() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

module.exports = { init, get };
