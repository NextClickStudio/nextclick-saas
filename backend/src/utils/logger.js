/**
 * Logger strutturato per NextClick
 * - In development: console colorato leggibile
 * - In production: JSON strutturato (compatibile BetterStack/Datadog/Sentry)
 * 
 * Per attivare BetterStack: aggiungi BETTERSTACK_TOKEN nelle variabili Railway
 * Per attivare Sentry: aggiungi SENTRY_DSN nelle variabili Railway
 */

const IS_PROD = process.env.NODE_ENV === 'production';
const SERVICE = 'nextclick-backend';

// ── Sentry (opzionale) ────────────────────────────────────────
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1,
    });
    console.log('[logger] Sentry initialized');
  } catch (e) {
    console.warn('[logger] Sentry not available:', e.message);
  }
}

// ── BetterStack / Logtail (opzionale) ────────────────────────
let logtail = null;
if (process.env.BETTERSTACK_TOKEN) {
  try {
    const { Logtail } = require('@logtail/node');
    logtail = new Logtail(process.env.BETTERSTACK_TOKEN);
    console.log('[logger] BetterStack initialized');
  } catch (e) {
    console.warn('[logger] BetterStack not available:', e.message);
  }
}

// ── Core logger ───────────────────────────────────────────────
function formatLog(level, message, meta = {}) {
  const entry = {
    ts:      new Date().toISOString(),
    level,
    service: SERVICE,
    msg:     message,
    ...meta,
  };

  if (IS_PROD) {
    return JSON.stringify(entry);
  }

  // Dev: colorato
  const colors = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
  const reset = '\x1b[0m';
  const color = colors[level] || '';
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `${color}[${level.toUpperCase()}]${reset} ${message}${metaStr}`;
}

const logger = {
  info(message, meta = {}) {
    console.log(formatLog('info', message, meta));
    if (logtail) logtail.info(message, meta).catch(() => {});
  },

  warn(message, meta = {}) {
    console.warn(formatLog('warn', message, meta));
    if (logtail) logtail.warn(message, meta).catch(() => {});
  },

  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      ...meta,
      error: error.message,
      stack: IS_PROD ? undefined : error.stack,
    } : meta;
    console.error(formatLog('error', message, errorMeta));
    if (logtail) logtail.error(message, errorMeta).catch(() => {});
    if (Sentry && error) Sentry.captureException(error, { extra: meta });
  },

  debug(message, meta = {}) {
    if (!IS_PROD) console.debug(formatLog('debug', message, meta));
  },
};

module.exports = logger;
