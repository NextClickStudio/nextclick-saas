// Records real pump.fun launches from PumpPortal's free data feed into Supabase.
// Each coin is followed for WINDOW_MS after creation; coins with too little
// activity are dropped. Wallet addresses never leave this process: each coin
// gets its own wallet index (0 = creator).
//
//   YR_KEY=... node recorder.mjs

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://djzzjybrcknrvvovvlpq.supabase.co";
const ANON = process.env.SUPABASE_ANON ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqenpqeWJyY2tucnZ2b3Z2bHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzc3NDgsImV4cCI6MjEwNTgxMzc0OH0.zfGX4ut9qgY04L6tnrxtchpjgf28blV9ISrg7c5rueo";
const KEY = process.env.YR_KEY;
const WINDOW_MS = Number(process.env.WINDOW_MS ?? 25 * 60_000);
const MIN_EVENTS = 10;
const META_AT = 25;
if (!KEY) throw new Error("YR_KEY missing");

const coins = new Map(); // mint -> state
const done = new Set();
let solUsd = null;
let ws = null;
let pendingSubs = [];
let pendingUnsubs = [];
const stats = { created: 0, trades: 0, uploadedEvents: 0, uploadedCoins: 0, errors: 0, reconnects: 0, unknown: 0, migrations: 0 };

async function refreshSol() {
  try {
    const r = await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=SOLUSDT");
    solUsd = Number((await r.json()).price);
  } catch {
    stats.errors++;
  }
}

function connect() {
  ws = new WebSocket("wss://pumpportal.fun/api/data");
  ws.onopen = () => {
    ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    ws.send(JSON.stringify({ method: "subscribeMigration" }));
    const active = [...coins.keys()];
    for (let i = 0; i < active.length; i += 200) ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: active.slice(i, i + 200) }));
  };
  ws.onmessage = (m) => {
    let d;
    try {
      d = JSON.parse(String(m.data));
    } catch {
      return;
    }
    onMessage(d);
  };
  ws.onclose = () => {
    stats.reconnects++;
    setTimeout(connect, 2000);
  };
  ws.onerror = () => {};
}

function walletIdx(c, pk) {
  let i = c.wallets.get(pk);
  if (i === undefined) {
    i = c.wallets.size;
    c.wallets.set(pk, i);
  }
  return i;
}

function onMessage(d) {
  if (!d || !d.mint) return;
  const now = Date.now();
  if (d.txType === "create") {
    if (coins.has(d.mint) || done.has(d.mint)) return;
    stats.created++;
    const c = {
      mint: d.mint,
      name: String(d.name ?? "").slice(0, 64),
      symbol: String(d.symbol ?? "").slice(0, 24),
      uri: d.uri ?? null,
      created_ms: now,
      sol_usd: solUsd,
      wallets: new Map([[d.traderPublicKey, 0]]),
      seq: 0,
      events: [],
      flushed: 0,
      uploaded: false,
      meta: null,
      metaTried: false,
      migrated_t: null,
      dirtyMeta: false,
    };
    c.events.push([d.mint, c.seq++, 0, 0, 0, num(d.solAmount), num(d.initialBuy), num(d.initialBuy), num(d.marketCapSol), num(d.vSolInBondingCurve)]);
    coins.set(d.mint, c);
    pendingSubs.push(d.mint);
    return;
  }
  const c = coins.get(d.mint);
  if (!c) return;
  const t = now - c.created_ms;
  if (d.txType === "buy" || d.txType === "sell") {
    if (t > WINDOW_MS) return;
    stats.trades++;
    c.events.push([
      d.mint,
      c.seq++,
      t,
      walletIdx(c, d.traderPublicKey),
      d.txType === "buy" ? 1 : 2,
      num(d.solAmount),
      num(d.tokenAmount),
      d.newTokenBalance == null ? "" : num(d.newTokenBalance),
      num(d.marketCapSol),
      d.vSolInBondingCurve == null ? "" : num(d.vSolInBondingCurve),
    ]);
    if (!c.metaTried && c.events.length >= META_AT) fetchMeta(c);
  } else if (d.txType === "migrate" || d.txType === "migration" || d.pool === "pump-amm" && !d.txType) {
    stats.migrations++;
    if (c.migrated_t == null) {
      c.migrated_t = t;
      c.dirtyMeta = true;
    }
  } else {
    stats.unknown++;
    if (stats.unknown <= 5) console.log("UNKNOWN", JSON.stringify(d).slice(0, 300));
  }
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

async function fetchMeta(c) {
  c.metaTried = true;
  if (!c.uri) return;
  const cid = String(c.uri).split("/ipfs/")[1];
  const urls = cid ? [`https://gateway.pinata.cloud/ipfs/${cid}`, `https://ipfs.io/ipfs/${cid}`] : [c.uri];
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const m = await r.json();
      c.meta = {
        twitter: str(m.twitter),
        telegram: str(m.telegram),
        website: str(m.website),
        description: str(m.description)?.slice(0, 400) ?? null,
      };
      c.dirtyMeta = true;
      return;
    } catch {
      /* try next gateway */
    }
  }
}

function str(x) {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

function coinRow(c) {
  return {
    mint: c.mint,
    name: c.name,
    symbol: c.symbol,
    uri: c.uri,
    created_ms: c.created_ms,
    sol_usd: c.sol_usd,
    twitter: c.meta?.twitter ?? null,
    telegram: c.meta?.telegram ?? null,
    website: c.meta?.website ?? null,
    description: c.meta?.description ?? null,
    meta_ok: !!c.meta,
    migrated_t: c.migrated_t,
  };
}

async function flush() {
  const now = Date.now();
  const rows = [];
  const evs = [];
  for (const c of coins.values()) {
    const age = now - c.created_ms;
    // checked before taking new events, so only events confirmed by an earlier flush count
    if (age > WINDOW_MS + 15_000 && (!c.uploaded || c.flushed >= c.events.length) && !c.dirtyMeta) {
      coins.delete(c.mint);
      done.add(c.mint);
      pendingUnsubs.push(c.mint);
      continue;
    }
    if (!c.uploaded && c.events.length >= MIN_EVENTS) {
      c.uploaded = true;
      rows.push(coinRow(c));
      c.dirtyMeta = false;
    } else if (c.uploaded && c.dirtyMeta) {
      rows.push(coinRow(c));
      c.dirtyMeta = false;
    }
    if (c.uploaded && c.flushed < c.events.length && evs.length < 4000) {
      const take = c.events.slice(c.flushed, c.flushed + (4000 - evs.length));
      evs.push(...take);
      c.flushed += take.length;
    }
  }
  if (!rows.length && !evs.length) return;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_ingest`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: KEY, p_coins: rows, p_events: evs }),
    });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    stats.uploadedCoins += j.coins;
    stats.uploadedEvents += j.events;
  } catch (e) {
    stats.errors++;
    console.log("FLUSH ERR", String(e.message ?? e));
    // roll back so the next flush retries these events
    for (const ev of evs) {
      const c = coins.get(ev[0]);
      if (c) c.flushed = Math.min(c.flushed, ev[1]);
    }
    for (const row of rows) {
      const c = coins.get(row.mint);
      if (c) c.dirtyMeta = true;
    }
  }
}

function pumpSubs() {
  if (!ws || ws.readyState !== 1) return;
  if (pendingSubs.length) {
    ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: pendingSubs.splice(0, 200) }));
  }
  if (pendingUnsubs.length) {
    ws.send(JSON.stringify({ method: "unsubscribeTokenTrade", keys: pendingUnsubs.splice(0, 200) }));
  }
}

await refreshSol();
connect();
setInterval(pumpSubs, 500);
setInterval(refreshSol, 5 * 60_000);
let flushing = false;
setInterval(async () => {
  if (flushing) return;
  flushing = true;
  try {
    await flush();
  } finally {
    flushing = false;
  }
}, 4000);
setInterval(() => {
  console.log(new Date().toISOString(), JSON.stringify({ ...stats, tracked: coins.size, sol: solUsd }));
}, Number(process.env.LOG_MS ?? 60_000));
