// yr-capture: called by pg_cron every minute. For ~50s it follows every new pump.fun
// coin for its first WINDOW_MS:
//   - launches (name, symbol, creator) come from PumpPortal's free creation feed;
//   - trades come straight from the chain: pump.fun TradeEvents in the program logs,
//     read through the public Solana RPC (logsSubscribe), no API key needed.
// Wallets and tx signatures are reduced to 32-bit hashes before they are stored.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const WINDOW_MS = 20 * 60_000;
const RUN_MS = 52_000;
const FLUSH_MS = 8_000;
const MIN_EVENTS = 12;
const META_AT = 25;
const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const RPC_WS = "wss://api.mainnet-beta.solana.com";
// base64 prefix of the anchor discriminator of pump.fun's TradeEvent
const TRADE_B64 = "vdt/007mYe";
const TRADE_DISC = [189, 219, 127, 211, 78, 230, 97, 238];

type Ev = [string, number, number, number, number, number, number, number | "", number, number | ""];
type Tracked = { mint: string; hex: string; created_ms: number; uri: string | null; meta_ok: boolean; n_events: number };

function h32(bytes: ArrayLike<number>): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}
const enc = new TextEncoder();
const h32s = (s: string) => h32(enc.encode(s));

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
const num = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: keyRow } = await sb.from("yr_config").select("value").eq("key", "ingest_key").maybeSingle();
  if (!keyRow || req.headers.get("x-ingest-key") !== keyRow.value) return new Response("forbidden", { status: 403 });
  const { data: lease } = await sb.rpc("yr_take_lease", { p_ms: RUN_MS + 6_000 });
  if (!lease) return Response.json({ skipped: true });

  const started = Date.now();
  // housekeeping: launches that never got going
  await sb
    .from("yr_coins")
    .delete()
    .eq("status", "raw")
    .lt("created_ms", started - WINDOW_MS - 120_000)
    .lt("n_events", MIN_EVENTS);

  const { data: trackedRows } = await sb
    .from("yr_coins")
    .select("mint,created_ms,uri,meta_ok,n_events")
    .gt("created_ms", started - WINDOW_MS);
  // keyed by the hex of the raw mint bytes, which is what the chain events carry
  const tracked = new Map<string, Tracked>();
  for (const r of trackedRows ?? []) {
    const hx = hex(b58decode(r.mint));
    tracked.set(hx, { mint: r.mint, hex: hx, created_ms: Number(r.created_ms), uri: r.uri, meta_ok: r.meta_ok, n_events: r.n_events });
  }

  let solUsd: number | null = null;
  try {
    const r = await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=SOLUSDT");
    solUsd = Number((await r.json()).price) || null;
  } catch {
    /* market caps stay in SOL */
  }

  // coins first seen in this run wait here until they have enough activity
  const fresh = new Map<string, { row: Record<string, unknown>; sig: string; events: Ev[] }>();
  let events: Ev[] = [];
  let migr: { mint: string; t: number }[] = [];
  const stats = { creates: 0, notes: 0, trades: 0, matched: 0, stored: 0, coins: 0, errors: 0, meta: 0 };

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
      const hx = hex(b58decode(mint));
      if (!hx || tracked.has(hx) || fresh.has(hx)) return;
      stats.creates++;
      const creator = h32(b58decode(String(d.traderPublicKey ?? "")));
      const sig = String(d.signature ?? "");
      fresh.set(hx, {
        sig,
        row: {
          mint,
          name: String(d.name ?? ""),
          symbol: String(d.symbol ?? ""),
          uri: d.uri ?? null,
          created_ms: now,
          sol_usd: solUsd,
          creator_h: creator,
          init_mc: num(d.marketCapSol),
        },
        events: [[mint, h32s(sig || mint), 0, creator, 0, num(d.solAmount), num(d.initialBuy), num(d.initialBuy), num(d.marketCapSol), d.vSolInBondingCurve == null ? "" : num(d.vSolInBondingCurve)]],
      });
      return;
    }
    if (d.txType === "migrate" || d.txType === "migration") {
      const t = tracked.get(hex(b58decode(mint)));
      if (t) migr.push({ mint: t.mint, t: now - t.created_ms });
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
    if (!s.includes(TRADE_B64)) return; // most notifications carry no trade: skip before parsing
    stats.notes++;
    let v: { err: unknown; signature: string; logs: string[] };
    try {
      v = JSON.parse(s).params.result.value;
    } catch {
      return;
    }
    if (v.err) return;
    const now = Date.now();
    for (const line of v.logs) {
      if (!line.startsWith("Program data: " + TRADE_B64)) continue;
      const b = b64bytes(line.slice(14));
      if (b.length < 129) continue;
      let ok = true;
      for (let i = 0; i < 8; i++) if (b[i] !== TRADE_DISC[i]) ok = false;
      if (!ok) continue;
      stats.trades++;
      const mintHex = hex(b, 8, 40);
      const t0 = tracked.get(mintHex);
      const f = t0 ? undefined : fresh.get(mintHex);
      if (!t0 && !f) continue;
      if (f && v.signature === f.sig) continue; // the creator's first buy is already the create event
      const base = t0 ? t0.created_ms : (f!.row.created_ms as number);
      const t = now - base;
      if (t > WINDOW_MS) continue;
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const sol = Number(dv.getBigUint64(40, true)) / 1e9;
      const tok = Number(dv.getBigUint64(48, true)) / 1e6;
      const isBuy = b[56] === 1;
      const user = h32(b.subarray(57, 89));
      const vs = Number(dv.getBigUint64(97, true)) / 1e9;
      const vt = Number(dv.getBigUint64(105, true)) / 1e6;
      if (!(vt > 0)) continue;
      stats.matched++;
      const ev: Ev = [t0 ? t0.mint : (f!.row.mint as string), h32s(v.signature), t, user, isBuy ? 1 : 2, sol, tok, "", (vs / vt) * 1e9, vs];
      if (f) f.events.push(ev);
      else events.push(ev);
    }
  };
  rpc.onerror = () => {
    stats.errors++;
  };

  async function fetchMeta(): Promise<Record<string, unknown>[]> {
    const todo = [...tracked.values()].filter((c) => !c.meta_ok && c.n_events >= META_AT && c.uri).slice(0, 6);
    const out: Record<string, unknown>[] = [];
    await Promise.all(
      todo.map(async (c) => {
        const cid = String(c.uri).split("/ipfs/")[1];
        for (const u of cid ? [`https://gateway.pinata.cloud/ipfs/${cid}`, `https://ipfs.io/ipfs/${cid}`] : [String(c.uri)]) {
          try {
            const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
            if (!r.ok) continue;
            const m = await r.json();
            out.push({ mint: c.mint, twitter: str(m.twitter), telegram: str(m.telegram), website: str(m.website), description: str(m.description) });
            c.meta_ok = true;
            return;
          } catch {
            /* next gateway */
          }
        }
      }),
    );
    stats.meta += out.length;
    return out;
  }

  async function flush(final: boolean) {
    const coins: Record<string, unknown>[] = [];
    for (const [hx, f] of fresh) {
      if (f.events.length >= MIN_EVENTS || (final && f.events.length >= 3)) {
        // promote: from now on the coin is followed across runs
        coins.push(f.row);
        events.push(...f.events);
        tracked.set(hx, { mint: f.row.mint as string, hex: hx, created_ms: f.row.created_ms as number, uri: f.row.uri as string | null, meta_ok: false, n_events: f.events.length });
        fresh.delete(hx);
      }
    }
    const meta = final ? await fetchMeta() : [];
    if (!coins.length && !events.length && !meta.length && !migr.length) return;
    const batch = events;
    const mg = migr;
    events = [];
    migr = [];
    const { data, error } = await sb.rpc("yr_capture_flush", { p_coins: coins, p_events: batch, p_meta: meta, p_migr: mg });
    if (error) {
      stats.errors++;
      console.error("flush", error.message);
      return;
    }
    stats.coins += data?.coins ?? 0;
    stats.stored += data?.events ?? 0;
  }

  const timer = setInterval(() => void flush(false), FLUSH_MS);
  await new Promise((r) => setTimeout(r, RUN_MS));
  clearInterval(timer);
  for (const w of [pp, rpc]) {
    try {
      w.close();
    } catch {
      /* already closed */
    }
  }
  await flush(true);
  return Response.json({ ok: true, ms: Date.now() - started, tracked: tracked.size, fresh: fresh.size, ...stats });
});
