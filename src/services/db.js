const { Pool } = require('pg');

let pool;

async function init() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS brands (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      name        TEXT NOT NULL,
      plan        TEXT DEFAULT 'recommend',
      plan_status TEXT DEFAULT 'trial',
      generations_used  INTEGER DEFAULT 0,
      generations_limit INTEGER DEFAULT 100,
      stripe_customer_id TEXT,
      stripe_sub_id      TEXT,
      created_at  TIMESTAMP DEFAULT NOW(),
      last_login  TIMESTAMP
    );
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
      questions     TEXT,
      ai_persona    TEXT,
      ai_language   TEXT DEFAULT 'it',
      widget_position TEXT DEFAULT 'inline',
      updated_at    TIMESTAMP DEFAULT NOW()
    );
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
      tags        TEXT,
      attivo      INTEGER DEFAULT 1,
      created_at  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS generations (
      id          TEXT PRIMARY KEY,
      brand_id    TEXT REFERENCES brands(id),
      created_at  TIMESTAMP DEFAULT NOW(),
      categoria   TEXT,
      plan_type   TEXT,
      success     INTEGER DEFAULT 1,
      tokens_used INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS shopify_connections (
      brand_id      TEXT PRIMARY KEY REFERENCES brands(id),
      shop_domain   TEXT NOT NULL,
      access_token  TEXT NOT NULL,
      connected_at  TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✓ PostgreSQL initialized');
}

async function query(sql, params = []) {
  // Convert SQLite ? placeholders to PostgreSQL $1, $2...
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  const result = await pool.query(pgSql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function execute(sql, params = []) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  await pool.query(pgSql, params);
}

module.exports = { init, query, queryOne, execute };
