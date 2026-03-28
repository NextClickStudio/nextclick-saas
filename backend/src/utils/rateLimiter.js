/**
 * Rate Limiter per generazioni widget
 * - Usa Redis se REDIS_URL è configurato (raccomandato per 10k+ shop)
 * - Fallback in memoria se Redis non disponibile (singola istanza)
 * 
 * Limite: MAX_GENERATIONS_PER_IP al giorno per IP, reset a mezzanotte UTC
 */

const MAX_PER_IP = parseInt(process.env.MAX_GENERATIONS_PER_IP || '10');

// ── Redis client (se disponibile) ─────────────────────────────
let redis = null;
if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      console.warn('[rate-limiter] Redis error, falling back to memory:', err.message);
      redis = null;
    });
    console.log('[rate-limiter] Redis connected');
  } catch (e) {
    console.warn('[rate-limiter] Redis not available, using memory fallback');
  }
}

// ── In-memory fallback ────────────────────────────────────────
// NOTA: non scala su più istanze — usa Redis in produzione
const memoryStore = new Map();

function getMemoryKey(ip, shopId) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `ratelimit:${shopId}:${ip}:${today}`;
}

// Pulizia automatica memoria ogni ora (evita memory leak)
setInterval(() => {
  const today = new Date().toISOString().split('T')[0];
  for (const [key] of memoryStore) {
    if (!key.includes(`:${today}`)) memoryStore.delete(key);
  }
}, 60 * 60 * 1000);

// ── Funzioni pubbliche ────────────────────────────────────────

/**
 * Controlla se l'IP ha superato il limite per lo shop
 * @returns {{ allowed: boolean, remaining: number, used: number }}
 */
async function checkLimit(ip, shopId) {
  const key = `nc:ratelimit:${shopId}:${ip}`;
  const today = new Date().toISOString().split('T')[0];
  const fullKey = `${key}:${today}`;

  if (redis) {
    try {
      const count = parseInt(await redis.get(fullKey) || '0');
      return {
        allowed: count < MAX_PER_IP,
        used: count,
        remaining: Math.max(0, MAX_PER_IP - count),
      };
    } catch (e) {
      // Redis down: fail open (non bloccare per errore infra)
      return { allowed: true, used: 0, remaining: MAX_PER_IP };
    }
  }

  // Memory fallback
  const count = memoryStore.get(fullKey) || 0;
  return {
    allowed: count < MAX_PER_IP,
    used: count,
    remaining: Math.max(0, MAX_PER_IP - count),
  };
}

/**
 * Incrementa il contatore per l'IP
 */
async function increment(ip, shopId) {
  const today = new Date().toISOString().split('T')[0];
  const fullKey = `nc:ratelimit:${shopId}:${ip}:${today}`;

  // Calcola secondi a mezzanotte UTC
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const ttl = Math.floor((midnight - now) / 1000);

  if (redis) {
    try {
      const count = await redis.incr(fullKey);
      if (count === 1) await redis.expire(fullKey, ttl); // TTL solo al primo insert
      return count;
    } catch (e) {
      // fail open
    }
  }

  // Memory fallback
  const count = (memoryStore.get(fullKey) || 0) + 1;
  memoryStore.set(fullKey, count);
  return count;
}

/**
 * Reset manuale IP per uno shop (chiamato dal brand dalla dashboard)
 */
async function resetShopIPs(shopId) {
  const today = new Date().toISOString().split('T')[0];
  const pattern = `nc:ratelimit:${shopId}:*:${today}`;

  if (redis) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
      return keys.length;
    } catch (e) {
      return 0;
    }
  }

  // Memory fallback
  let deleted = 0;
  for (const [key] of memoryStore) {
    if (key.includes(`nc:ratelimit:${shopId}:`) && key.includes(today)) {
      memoryStore.delete(key);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Ottieni IP reale (gestisce proxy/Shopify CDN)
 */
function getClientIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||       // Cloudflare
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

module.exports = { checkLimit, increment, resetShopIPs, getClientIP, MAX_PER_IP };
