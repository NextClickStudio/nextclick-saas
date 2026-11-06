// yr-capture: called by pg_cron every 30 s and runs 45 s, so the next run is already listening well before this one
// stops (two leases), even when cron starts it late. The two hand over without a gap and without writing a trade
// twice: the new run notes when it started listening (yr_okv 'cap_start') and writes from 2 s after that; the old run,
// which checks that note at every write, keeps everything before that moment and then stops. yr_ticks needs no unique
// index (a random-order index on the signature was most of the disk work on the free database). Dust trades under
// 0.01 SOL (wallet-spam bots, ~30% of all trades) are left out, except the creator's buy in the launch transaction.
//   - launches (name, symbol, creator, and the launch's signature and block, for yr-launch) come from pump.fun's
//     CreateEvent in the program logs, with PumpPortal's free creation feed as a backup, and land in yr_obirth;
//   - trades come straight from the chain: pump.fun TradeEvents in the program logs, read through the
//     public Solana RPC (logsSubscribe), no API key needed, and land in yr_ticks every 4 seconds
//     (kept 20 minutes);
//   - graduations to PumpSwap land in yr_grad;
//   - launches both missed (3 Nov 2026: a third of the most traded coins; a launch with many bundled buys has its
//     logs cut before the CreateEvent): coins that trade but yeppo never saw launch get their name, ticker and time
//     from DexScreener and their creator from their first transaction, once per run (backfill below).
// yr_cc_roll folds all three into the creator index. The old games' per-coin tracking (yr_coins) and
// live-trader list (yr_hot_wallets) are no longer written.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const RUN_MS = 45_000;
const HANDOVER_MS = 2_000; // a new run writes from this long after it started listening: it is connected by then
const DUST_SOL = 0.01;
const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const RPC_WS = "wss://api.mainnet-beta.solana.com";
// base64 prefix of the anchor discriminator of pump.fun's TradeEvent
const TRADE_B64 = "vdt/007mYe";
const TRADE_DISC = [189, 219, 127, 211, 78, 230, 97, 238];
// and of its CreateEvent: name, symbol, uri (borsh strings), mint, bonding curve, user, creator, ...
const CREATE_B64 = "G3KpTd7rY3";
const CREATE_DISC = [27, 114, 169, 77, 222, 235, 99, 118];

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP = new Map([...B58].map((c, i) => [c, i]));
function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const v = B58_MAP.get(c);
    if (v === undefined) return new Uint8Array(0);
    n = n * 58n + BigInt(v);
  }
  const out: number[] = [];
  while (n > 0n) {
    out.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== "1") break;
    out.unshift(0);
  }
  return Uint8Array.from(out);
}
function b58encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}
function hex(b: Uint8Array, from = 0, to = b.length): string {
  let s = "";
  for (let i = from; i < to; i++) s += (b[i] < 16 ? "0" : "") + b[i].toString(16);
  return s;
}
function b64bytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Coins on pump.fun's newer curves are paired with a quote token instead of SOL. Their TradeEvents leave
// the SOL fields at 0 and carry the quote amounts after the instruction name (a borsh string at 258).
// Quote tokens priced like SOL are read as SOL; any other quote token (USDC, VVV...) is turned into SOL at its
// current price (DexScreener, refreshed every minute), so market caps and amounts stay comparable.
const SOL_LIKE = new Set(
  ["So11111111111111111111111111111111111111112", "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g"].map((m) => hex(b58decode(m))),
);
const SOL_MINT = "So11111111111111111111111111111111111111112";
const quoteSol = new Map<string, { px: number; t: number }>(); // quote mint -> SOL per token
const asking = new Set<string>();
let solUsd = 0;
let solUsdAt = 0;
async function priceQuote(mint: string) {
  if (asking.has(mint) || asking.size > 20) return;
  asking.add(mint);
  try {
    if (!solUsd || Date.now() - solUsdAt > 60_000) {
      const r = await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=SOLUSDT", { signal: AbortSignal.timeout(4000) });
      const v = Number(((await r.json()) as { price?: string }).price);
      if (v > 0) [solUsd, solUsdAt] = [v, Date.now()];
    }
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { signal: AbortSignal.timeout(4000) });
    const pairs = (await r.json()) as { baseToken?: { address?: string }; quoteToken?: { address?: string }; priceNative?: string; priceUsd?: string; liquidity?: { usd?: number } }[];
    // the deepest pool where this token is the base: SOL per token straight, else through its dollar price
    const p = (Array.isArray(pairs) ? pairs : []).filter((x) => x.baseToken?.address === mint).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    let px = 0;
    if (p?.quoteToken?.address === SOL_MINT && Number(p.priceNative) > 0) px = Number(p.priceNative);
    else if (p && Number(p.priceUsd) > 0 && solUsd > 0) px = Number(p.priceUsd) / solUsd;
    if (px > 0) quoteSol.set(mint, { px, t: Date.now() });
  } catch {
    /* tried again on a later trade */
  } finally {
    asking.delete(mint);
  }
}
function solSide(b: Uint8Array, dv: DataView): { sol: number; vsol: number } | null {
  const vsol = Number(dv.getBigUint64(97, true)) / 1e9;
  if (vsol > 0) return { sol: Number(dv.getBigUint64(40, true)) / 1e9, vsol };
  if (b.length < 262) return null;
  const n = dv.getUint32(258, true);
  const at = 262 + n;
  if (n > 64 || b.length < at + 93) return null;
  const q = hex(b, at + 37, at + 69);
  const sol = Number(dv.getBigUint64(at + 69, true)) / 1e9;
  const qv = Number(dv.getBigUint64(at + 77, true)) / 1e9;
  if (SOL_LIKE.has(q)) return { sol, vsol: qv };
  const mint = b58encode(b.slice(at + 37, at + 69));
  const known = quoteSol.get(mint);
  if (!known || Date.now() - known.t > 60_000) void priceQuote(mint);
  if (!known) return null; // the first seconds, until its price is known
  // the event reads the amounts with 9 decimals, like SOL: rescale them to the quote token's own decimals
  const dec = quoteDecimals.get(mint);
  if (dec === undefined) {
    void decimalsOf(mint);
    return null;
  }
  const k = 10 ** (9 - dec);
  return { sol: sol * k * known.px, vsol: qv * k * known.px };
}
// a quote token's decimals, from its mint account (public RPC), once per run
const quoteDecimals = new Map<string, number>();
const askingDec = new Set<string>();
async function decimalsOf(mint: string) {
  if (askingDec.has(mint)) return;
  askingDec.add(mint);
  try {
    const r = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }),
      signal: AbortSignal.timeout(4000),
    });
    const j = (await r.json()) as { result?: { value?: { data?: { parsed?: { info?: { decimals?: number } } } } } };
    const d = j.result?.value?.data?.parsed?.info?.decimals;
    if (typeof d === "number" && d >= 0 && d <= 12) quoteDecimals.set(mint, d);
  } catch {
    /* tried again on a later trade */
  } finally {
    askingDec.delete(mint);
  }
}
const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);

const dec = new TextDecoder();
function parseCreate(b: Uint8Array): { mint: string; dev: string; name: string | null; symbol: string | null; uri: string | null } | null {
  for (let i = 0; i < 8; i++) if (b[i] !== CREATE_DISC[i]) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 8;
  const text = () => {
    if (o + 4 > b.length) throw new Error("short");
    const n = dv.getUint32(o, true);
    if (n > 512 || o + 4 + n > b.length) throw new Error("bad string");
    const v = dec.decode(b.subarray(o + 4, o + 4 + n));
    o += 4 + n;
    return str(v.slice(0, 200));
  };
  try {
    const name = text();
    const symbol = text();
    const uri = text();
    if (o + 128 > b.length) return null;
    const mint = b58encode(b.slice(o, o + 32));
    const dev = b58encode(b.slice(o + 96, o + 128)); // creator (after mint, bonding curve, user)
    return { mint, dev, name, symbol, uri };
  } catch {
    return null;
  }
}

const RPC_HTTP = "https://api.mainnet-beta.solana.com";
async function rpcCall<T>(method: string, params: unknown[]): Promise<T | null> {
  try {
    const r = await fetch(RPC_HTTP, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    return (j?.result ?? null) as T | null;
  } catch {
    return null;
  }
}
/** a coin's creator: the signer of its first transaction (the launch), and when it was */
async function launchOf(mint: string): Promise<{ dev: string; t: number } | null> {
  // newest first, 1,000 a page: up to 3 pages back to the launch
  let first: { signature: string; blockTime: number | null } | null = null;
  let before: string | undefined;
  for (let page = 0; page < 3; page++) {
    const sigs = await rpcCall<{ signature: string; blockTime: number | null }[]>("getSignaturesForAddress", [mint, { limit: 1000, ...(before ? { before } : {}) }]);
    if (!sigs?.length) break;
    first = sigs[sigs.length - 1];
    if (sigs.length < 1000) break;
    before = first.signature;
    if (page === 2) return null; // more than 3,000 transactions: not worth the public node's time
  }
  if (!first) return null;
  const tx = await rpcCall<{ transaction: { message: { accountKeys: { pubkey: string; signer: boolean }[] } } }>("getTransaction", [
    first.signature,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 1, commitment: "confirmed" },
  ]);
  const dev = tx?.transaction?.message?.accountKeys?.find((k) => k.signer)?.pubkey;
  return dev ? { dev, t: (first.blockTime ?? 0) * 1000 } : null;
}

/** the X post or account a coin's metadata links: the post's author (from the link) and its id */
async function xlinkOf(uri: string): Promise<{ handle: string | null; post: string | null }> {
  try {
    const r = await fetch(uri.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/"), { signal: AbortSignal.timeout(2500) });
    const m = (await r.json()) as { twitter?: string };
    const u = new URL(String(m?.twitter ?? ""));
    if (!/(^|\.)(x|twitter)\.com$/i.test(u.hostname)) return { handle: null, post: null };
    const parts = u.pathname.split("/").filter(Boolean);
    const st = parts.indexOf("status");
    const post = st > 0 && /^\d+$/.test(parts[st + 1] ?? "") ? parts[st + 1] : null;
    const handle = parts[0] && parts[0] !== "i" && /^[A-Za-z0-9_]{1,15}$/.test(parts[0]) ? parts[0] : null;
    return { handle, post };
  } catch {
    return { handle: null, post: null };
  }
}

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: keyRow } = await sb.from("yr_config").select("value").eq("key", "ingest_key").maybeSingle();
  if (!keyRow || req.headers.get("x-ingest-key") !== keyRow.value) return new Response("forbidden", { status: 403 });
  let lease = false;
  for (const k of ["capture_lease", "capture_lease_b"]) {
    const { data } = await sb.rpc("yr_take_lease_k", { p_key: k, p_ms: RUN_MS + 3_000 });
    if (data) {
      lease = true;
      break;
    }
  }
  if (!lease) return Response.json({ skipped: true });

  const started = Date.now();
  // tell the run before this one where to stop
  await sb.from("yr_okv").upsert({ k: "cap_start", v: started });
  const from = started + HANDOVER_MS;
  let until = Infinity; // set once a newer run has taken over
  const stats = { creates: 0, notes: 0, trades: 0, errors: 0, ticks: 0 };
  // every trade of every coin (yr_ticks), every launch with its creator (yr_obirth), every graduation (yr_grad)
  let ticks: Record<string, unknown>[] = [];
  let births: Record<string, unknown>[] = [];
  let grads: { mint: string; t: number }[] = [];
  const seen = new Set<string>();

  // ---- launches (PumpPortal, free) ----
  const pp = new WebSocket("wss://pumpportal.fun/api/data");
  pp.onopen = () => {
    pp.send(JSON.stringify({ method: "subscribeNewToken" }));
    pp.send(JSON.stringify({ method: "subscribeMigration" }));
  };
  pp.onmessage = (m) => {
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(String(m.data));
    } catch {
      return;
    }
    const mint = d.mint as string | undefined;
    if (!mint) return;
    const now = Date.now();
    if (d.txType === "create") {
      if (seen.has(mint)) return;
      seen.add(mint);
      stats.creates++;
      // the launch's signature too: yr-launch reads the launch blocks from it, however busy the coin gets
      births.push({ mint, t: now, dev: str(d.traderPublicKey), name: str(d.name), symbol: str(d.symbol), uri: str(d.uri), sig: str(d.signature) });
      return;
    }
    if (d.txType === "migrate" || d.txType === "migration") {
      grads.push({ mint, t: now });
    }
  };
  pp.onerror = () => {
    stats.errors++;
  };

  // ---- trades (pump.fun program logs, public RPC) ----
  const rpc = new WebSocket(RPC_WS);
  rpc.onopen = () => {
    rpc.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "logsSubscribe", params: [{ mentions: [PUMP_PROGRAM] }, { commitment: "confirmed" }] }));
  };
  rpc.onmessage = (m) => {
    const s = String(m.data);
    const hasCreate = s.includes(CREATE_B64);
    if (!hasCreate && !s.includes(TRADE_B64)) return; // most notifications carry neither: skip before parsing
    stats.notes++;
    let v: { err: unknown; signature: string; logs: string[] };
    let slot: number | null = null;
    try {
      const res = JSON.parse(s).params.result;
      v = res.value;
      slot = typeof res.context?.slot === "number" ? res.context.slot : null;
    } catch {
      return;
    }
    if (v.err) return;
    const now = Date.now();
    if (hasCreate) {
      for (const line of v.logs) {
        if (!line.startsWith("Program data: " + CREATE_B64)) continue;
        const c = parseCreate(b64bytes(line.slice(14)));
        if (c && !seen.has(c.mint)) {
          seen.add(c.mint);
          births.push({ ...c, t: now, sig: v.signature, slot });
        }
      }
    }
    let ix = 0;
    for (const line of v.logs) {
      if (!line.startsWith("Program data: " + TRADE_B64)) continue;
      const b = b64bytes(line.slice(14));
      if (b.length < 129) continue;
      let ok = true;
      for (let i = 0; i < 8; i++) if (b[i] !== TRADE_DISC[i]) ok = false;
      if (!ok) continue;
      stats.trades++;
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const side = solSide(b, dv);
      const vtok = Number(dv.getBigUint64(105, true)) / 1e6;
      // the first seconds belong to the previous run, the last ones to the next; dust is left out, but never the
      // creator's launch buy
      if (vtok > 0 && side && now >= from && now < until && (side.sol >= DUST_SOL || hasCreate)) {
        ticks.push({
          sig: v.signature,
          ix,
          mint: b58encode(b.slice(8, 40)),
          t: now,
          k: b[56] === 1 ? 1 : 2,
          sol: side.sol,
          tok: Number(dv.getBigUint64(48, true)) / 1e6,
          vsol: side.vsol,
          vtok,
          who: b58encode(b.slice(57, 89)),
        });
      }
      ix++;
    }
  };
  rpc.onerror = () => {
    stats.errors++;
  };

  // one write at a time, so batches land in the order they were seen
  let tickChain: Promise<void> = Promise.resolve();
  function flushTicks() {
    tickChain = tickChain.then(async () => {
      // a newer run started listening: hand over at the moment it writes from
      if (until === Infinity) {
        const { data } = await sb.from("yr_okv").select("v").eq("k", "cap_start").maybeSingle();
        if (data && Number(data.v) > started) until = Number(data.v) + HANDOVER_MS;
      }
      if (grads.length) {
        const rows = grads;
        grads = [];
        const { error } = await sb.from("yr_grad").upsert(rows, { onConflict: "mint", ignoreDuplicates: true });
        if (error) stats.errors++;
      }
      if (births.length) {
        const rows = births;
        births = [];
        const { error } = await sb.from("yr_obirth").upsert(rows, { onConflict: "mint", ignoreDuplicates: true });
        if (error) stats.errors++;
      }
      if (!ticks.length) return;
      const rows = ticks.filter((x) => (x.t as number) < until);
      ticks = [];
      if (!rows.length) return;
      const { error } = await sb.from("yr_ticks").insert(rows);
      if (error) stats.errors++;
      else stats.ticks += rows.length;
    });
    return tickChain;
  }

  const tickTimer = setInterval(() => void flushTicks(), 4000);

  // coins that trade but whose launch yeppo missed: name and time from DexScreener (one call), the creator from the
  // chain (a few per run), into yr_obirth and yr_cc, so their namesakes, creator and history work like any other
  const backfill = setTimeout(async () => {
    try {
      const { data } = await sb.rpc("yr_unknown_active");
      const miss = ((data as [string, number][] | null) ?? []).slice(0, 30);
      if (!miss.length) return;
      const meta = new Map<string, { sym: string | null; name: string | null; t: number }>();
      try {
        const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${miss.map((m) => m[0]).join(",")}`, { signal: AbortSignal.timeout(5000) });
        const pairs = (await r.json()) as { baseToken?: { address?: string; symbol?: string; name?: string }; pairCreatedAt?: number }[];
        for (const p of Array.isArray(pairs) ? pairs : []) {
          const m = p.baseToken?.address;
          if (m && !meta.has(m)) meta.set(m, { sym: str(p.baseToken?.symbol)?.slice(0, 16) ?? null, name: str(p.baseToken?.name)?.slice(0, 40) ?? null, t: Number(p.pairCreatedAt) || 0 });
        }
      } catch {
        /* DexScreener did not answer: the next run tries again */
      }
      // launches yeppo did record but never folded in (the creator index was behind): straight from there
      const { data: had } = await sb.from("yr_obirth").select("mint,dev,symbol,name,t").in("mint", miss.map((m) => m[0]));
      const known = new Map((had ?? []).map((b) => [b.mint as string, b]));
      const birthsB: Record<string, unknown>[] = [];
      const coins: Record<string, unknown>[] = [];
      let looked = 0;
      for (const [mint, firstT] of miss) {
        const m = meta.get(mint);
        const k = known.get(mint);
        if (k?.dev) {
          coins.push({ mint, dev: k.dev, t0: k.t, sym: k.symbol ?? m?.sym ?? null, name: k.name ?? m?.name ?? null });
          continue;
        }
        const l = looked < 4 ? (looked++, await launchOf(mint)) : null;
        const t = m?.t || l?.t || firstT;
        if (m || l) birthsB.push({ mint, t, dev: l?.dev ?? null, name: m?.name ?? null, symbol: m?.sym ?? null, uri: null });
        if (l) coins.push({ mint, dev: l.dev, t0: t, sym: m?.sym ?? null, name: m?.name ?? null });
      }
      if (birthsB.length) await sb.from("yr_obirth").upsert(birthsB, { onConflict: "mint" });
      if (coins.length) await sb.from("yr_cc").upsert(coins, { onConflict: "mint", ignoreDuplicates: true });
      stats.creates += coins.length;
    } catch {
      stats.errors++;
    }
  }, 15_000);

  // the X links of the coins trading most right now, for the author scorecards (who posts things that coins run on)
  const xlinks = setTimeout(async () => {
    try {
      const { data } = await sb.rpc("yr_xlink_need_active");
      const need = ((data as [string, string, number][] | null) ?? []).slice(0, 20);
      if (!need.length) return;
      const rows = await Promise.all(need.map(async ([mint, uri, t]) => ({ mint, t, ...(await xlinkOf(uri)) })));
      await sb.from("yr_xlink").upsert(rows.map((r) => ({ ...r, handle: r.handle?.toLowerCase() ?? null })), { onConflict: "mint", ignoreDuplicates: true });
    } catch {
      stats.errors++;
    }
  }, 25_000);
  // run the full time, or until the next run has taken over for a few seconds
  await new Promise<void>((r) => {
    const end = setTimeout(r, RUN_MS);
    const check = setInterval(() => {
      if (Date.now() > until + 3000) {
        clearTimeout(end);
        clearInterval(check);
        r();
      }
    }, 1000);
    setTimeout(() => clearInterval(check), RUN_MS);
  });
  clearInterval(tickTimer);
  clearTimeout(backfill);
  clearTimeout(xlinks);
  for (const w of [pp, rpc]) {
    try {
      w.close();
    } catch {
      /* already closed */
    }
  }
  await flushTicks();
  await sb.from("yr_ticks").delete().lt("t", Date.now() - 20 * 60_000);
  return Response.json({ ok: true, ms: Date.now() - started, ...stats });
});
