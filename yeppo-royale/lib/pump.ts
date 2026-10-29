// The live pump.fun market in the browser: PumpPortal's free websocket for launches and trades,
// bonding-curve math, and one Coin per mint that merges captured history with live trades.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { rpc } from "./supabase";

export const SUPPLY = 1e9;
export const FEE = 0.01;
const VTOK_GAP = 279_900_000; // virtual minus real tokens on every pump.fun curve
const CURVE_TOKENS = 793_100_000; // tokens sold on the curve before it graduates
const WS = "wss://pumpportal.fun/api/data";
export const RPC_URL = "https://solana-rpc.publicnode.com";
export const SOL_MINT = "So11111111111111111111111111111111111111112";

export type Trade = { sig: string; t: number; k: 1 | 2; sol: number; tok: number; vsol: number; vtok: number; who: string };
export type NewCoin = { mint: string; name: string; symbol: string; uri: string | null; t: number; vsol: number; vtok: number; creator: string };
export type FeedStatus = "off" | "connecting" | "live";

export const pxOf = (vsol: number, vtok: number) => (vtok > 0 ? vsol / vtok : 0);
export const progressOf = (vtok: number) => Math.max(0, Math.min(100, 100 * (1 - (vtok - VTOK_GAP) / CURVE_TOKENS)));
export const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());
export const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

/** what a buy of `sol` gets on this curve, with pump.fun's 1% fee */
export function quoteBuy(vsol: number, vtok: number, sol: number) {
  const x = sol * (1 - FEE);
  const tok = (vtok * x) / (vsol + x);
  const before = pxOf(vsol, vtok);
  const after = pxOf(vsol + x, vtok - tok);
  return { tok, avg: tok > 0 ? sol / tok : 0, impact: before > 0 ? (after / before - 1) * 100 : 0 };
}

export function quoteSell(vsol: number, vtok: number, tok: number) {
  const gross = (vsol * tok) / (vtok + tok);
  const before = pxOf(vsol, vtok);
  const after = pxOf(vsol - gross, vtok + tok);
  return { sol: gross * (1 - FEE), impact: before > 0 ? (1 - after / before) * 100 : 0 };
}

// ---------- coins ----------

export type CoinMeta = {
  name: string | null;
  symbol: string | null;
  uri: string | null;
  created: number | null;
  creator: string | null;
  x?: string | null;
  tg?: string | null;
  web?: string | null;
};

export class Coin {
  readonly mint: string;
  meta: CoinMeta = { name: null, symbol: null, uri: null, created: null, creator: null };
  trades: Trade[] = [];
  vsol = 0;
  vtok = 0;
  lastT = 0;
  ath = 0;
  graduated = false;
  loaded: "none" | "loading" | "db" | "chain" | "live" = "none";
  version = 0;
  private sigs = new Set<string>();

  constructor(mint: string) {
    this.mint = mint;
  }

  get sym() {
    return (this.meta.symbol || this.meta.name || shortAddr(this.mint)).replace(/^\$/, "").slice(0, 12);
  }
  price() {
    return pxOf(this.vsol, this.vtok);
  }
  /** market cap in SOL */
  mc() {
    return this.price() * SUPPLY;
  }
  progress() {
    return this.graduated ? 100 : progressOf(this.vtok);
  }

  add(tr: Trade, live = false) {
    if (this.sigs.has(tr.sig)) return false;
    this.sigs.add(tr.sig);
    const n = this.trades.length;
    if (!n || tr.t >= this.trades[n - 1].t) this.trades.push(tr);
    else {
      let i = n;
      while (i > 0 && this.trades[i - 1].t > tr.t) i--;
      this.trades.splice(i, 0, tr);
    }
    if (tr.t >= this.lastT && tr.vtok > 0) {
      this.lastT = tr.t;
      this.vsol = tr.vsol;
      this.vtok = tr.vtok;
    }
    const mc = pxOf(tr.vsol, tr.vtok) * SUPPLY;
    if (mc > this.ath) this.ath = mc;
    if (live && this.loaded === "none") this.loaded = "live";
    this.version++;
    return true;
  }

  /** buys, sells and volume over the last `ms`, and the price change */
  stats(now: number, ms = 300_000) {
    let buys = 0;
    let sells = 0;
    let vol = 0;
    let first = 0;
    for (let i = this.trades.length - 1; i >= 0; i--) {
      const t = this.trades[i];
      if (t.t < now - ms) break;
      if (t.k === 1) buys++;
      else sells++;
      vol += t.sol;
      first = pxOf(t.vsol, t.vtok);
    }
    const p = this.price();
    return { buys, sells, vol, chg: first > 0 && p > 0 ? (p / first - 1) * 100 : 0 };
  }
}

const coins = new Map<string, Coin>();
export function coinOf(mint: string) {
  let c = coins.get(mint);
  if (!c) {
    c = new Coin(mint);
    coins.set(mint, c);
  }
  return c;
}
export const peekCoin = (mint: string) => coins.get(mint);

type DbCoin = {
  mint: string;
  name: string | null;
  symbol: string | null;
  uri: string | null;
  created: number;
  sol_usd: number | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  migrated_t: number | null;
  /** [msAfterLaunch, wallet, kind, sol, tokens, mcSol, vSol] */
  ev: [number, number, number, number, number, number, number | null][];
};
type ChainCoin = {
  mint: string;
  name: string | null;
  symbol: string | null;
  uri: string | null;
  curve: { vtok: number; vsol: number; complete: boolean; creator: string };
  /** [atMs, kind, sol, tokens, vSol, vTokens, wallet] */
  trades: [number, number, number, number, number, number, string][];
  error?: string;
};

export async function termCall<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/yr-term`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error || "The terminal is not reachable");
  return j;
}

const loading = new Map<string, Promise<Coin>>();

/** history of a coin: what yeppo captured since launch, topped up with its latest trades from the chain */
export function loadCoin(mint: string): Promise<Coin> {
  const c = coinOf(mint);
  if (c.loaded === "db" || c.loaded === "chain") return Promise.resolve(c);
  const busy = loading.get(mint);
  if (busy) return busy;
  const p = (async () => {
    c.loaded = "loading";
    let db: DbCoin | null = null;
    try {
      db = await rpc<DbCoin | null>("yr_t_coin", { p_mint: mint });
    } catch {
      db = null;
    }
    if (db) {
      c.meta = { ...c.meta, name: db.name, symbol: db.symbol, uri: db.uri, created: db.created, x: db.twitter, tg: db.telegram, web: db.website };
      if (db.migrated_t != null) c.graduated = true;
      db.ev.forEach(([t, w, k, solAmt, tok, mc, vs], i) => {
        if (k === 0 || !(mc > 0)) return;
        const vsol = vs ?? Math.max(30, mc * 0.03);
        c.add({ sig: `db${i}:${t}`, t: db!.created + t, k: k === 1 ? 1 : 2, sol: solAmt, tok, vsol, vtok: (vsol * SUPPLY) / mc, who: `w${w}` });
      });
    }
    const stale = !db || Date.now() - (db.created + (db.ev[db.ev.length - 1]?.[0] ?? 0)) > 60_000;
    if (stale) {
      try {
        const ch = await termCall<ChainCoin>({ action: "coin", mint });
        c.meta = { ...c.meta, name: c.meta.name ?? ch.name, symbol: c.meta.symbol ?? ch.symbol, uri: c.meta.uri ?? ch.uri, creator: ch.curve.creator };
        if (ch.curve.complete) c.graduated = true;
        for (const [t, k, s, tok, vsol, vtok, who] of ch.trades) {
          if (t <= c.lastT) continue;
          c.add({ sig: `ch${t}:${k}:${s}`, t, k: k === 1 ? 1 : 2, sol: s, tok, vsol, vtok, who });
        }
        if (!c.trades.length && ch.curve.vtok > 0) {
          c.vsol = ch.curve.vsol;
          c.vtok = ch.curve.vtok;
          c.lastT = Date.now();
        }
        c.loaded = "chain";
      } catch (e) {
        if (!db) {
          c.loaded = "none";
          throw e;
        }
        c.loaded = "db";
      }
    } else c.loaded = "db";
    c.version++;
    return c;
  })().finally(() => loading.delete(mint));
  loading.set(mint, p);
  return p;
}

// ---------- the live feed ----------

type Msg = Record<string, unknown>;
const num = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

class Feed {
  status: FeedStatus = "off";
  private ws: WebSocket | null = null;
  private watched = new Map<string, number>();
  private wantNew = 0;
  private tradeL = new Set<(mint: string, t: Trade) => void>();
  private newL = new Set<(c: NewCoin) => void>();
  private migL = new Set<(mint: string) => void>();
  private statusL = new Set<(s: FeedStatus) => void>();
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private setStatus(s: FeedStatus) {
    this.status = s;
    this.statusL.forEach((f) => f(s));
  }

  private send(o: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(o));
  }

  private get needed() {
    return this.wantNew > 0 || this.watched.size > 0 || this.tradeL.size > 0;
  }

  private connect() {
    if (this.ws || typeof WebSocket === "undefined") return;
    this.setStatus("connecting");
    const ws = new WebSocket(WS);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus("live");
      if (this.wantNew) {
        this.send({ method: "subscribeNewToken" });
        this.send({ method: "subscribeMigration" });
      }
      if (this.watched.size) this.send({ method: "subscribeTokenTrade", keys: [...this.watched.keys()] });
    };
    ws.onmessage = (m) => this.onMessage(m.data);
    ws.onclose = () => {
      this.ws = null;
      if (!this.needed) {
        this.setStatus("off");
        return;
      }
      this.setStatus("connecting");
      const wait = Math.min(15_000, 800 * 2 ** this.retry++);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.connect();
      }, wait);
    };
    ws.onerror = () => ws.close();
  }

  private ensure() {
    if (!this.ws && !this.timer) this.connect();
  }

  private onMessage(raw: unknown) {
    let d: Msg;
    try {
      d = JSON.parse(String(raw));
    } catch {
      return;
    }
    const mint = typeof d.mint === "string" ? d.mint : null;
    if (!mint) return;
    const tx = d.txType;
    const now = Date.now();
    if (tx === "create") {
      const c: NewCoin = {
        mint,
        name: String(d.name ?? ""),
        symbol: String(d.symbol ?? ""),
        uri: typeof d.uri === "string" ? d.uri : null,
        t: now,
        vsol: num(d.vSolInBondingCurve),
        vtok: num(d.vTokensInBondingCurve),
        creator: String(d.traderPublicKey ?? ""),
      };
      const coin = coinOf(mint);
      coin.meta = { ...coin.meta, name: c.name, symbol: c.symbol, uri: c.uri, created: now, creator: c.creator };
      if (c.vtok > 0) {
        coin.add({ sig: String(d.signature ?? `c${now}`), t: now, k: 1, sol: num(d.solAmount), tok: num(d.initialBuy), vsol: c.vsol, vtok: c.vtok, who: c.creator }, true);
      }
      this.newL.forEach((f) => f(c));
    } else if (tx === "buy" || tx === "sell") {
      const t: Trade = {
        sig: String(d.signature ?? `${now}${Math.random()}`),
        t: now,
        k: tx === "buy" ? 1 : 2,
        sol: num(d.solAmount),
        tok: num(d.tokenAmount),
        vsol: num(d.vSolInBondingCurve),
        vtok: num(d.vTokensInBondingCurve),
        who: String(d.traderPublicKey ?? ""),
      };
      if (!(t.vtok > 0)) return;
      if (coinOf(mint).add(t, true)) this.tradeL.forEach((f) => f(mint, t));
    } else if (tx === "migrate" || tx === "migration") {
      coinOf(mint).graduated = true;
      this.migL.forEach((f) => f(mint));
    }
  }

  onStatus(f: (s: FeedStatus) => void) {
    this.statusL.add(f);
    f(this.status);
    return () => void this.statusL.delete(f);
  }

  onTrade(f: (mint: string, t: Trade) => void) {
    this.tradeL.add(f);
    this.ensure();
    return () => void this.tradeL.delete(f);
  }

  onNew(f: (c: NewCoin) => void, onMigrate?: (mint: string) => void) {
    this.newL.add(f);
    if (onMigrate) this.migL.add(onMigrate);
    if (this.wantNew++ === 0) {
      this.send({ method: "subscribeNewToken" });
      this.send({ method: "subscribeMigration" });
    }
    this.ensure();
    return () => {
      this.newL.delete(f);
      if (onMigrate) this.migL.delete(onMigrate);
      if (--this.wantNew === 0) {
        this.send({ method: "unsubscribeNewToken" });
        this.send({ method: "unsubscribeMigration" });
      }
    };
  }

  /** follow every trade of these coins; returns the undo */
  watch(mints: string[]) {
    const fresh = [...new Set(mints)].filter((m) => {
      const n = this.watched.get(m) ?? 0;
      this.watched.set(m, n + 1);
      return n === 0;
    });
    if (fresh.length) this.send({ method: "subscribeTokenTrade", keys: fresh });
    this.ensure();
    return () => {
      const gone = [...new Set(mints)].filter((m) => {
        const n = (this.watched.get(m) ?? 1) - 1;
        if (n <= 0) this.watched.delete(m);
        else this.watched.set(m, n);
        return n <= 0;
      });
      if (gone.length) this.send({ method: "unsubscribeTokenTrade", keys: gone });
    };
  }
}

let feed: Feed | null = null;
export function getFeed() {
  if (!feed) feed = new Feed();
  return feed;
}

// ---------- SOL price ----------

let solUsd = 150;
let solAt = 0;
export function solPrice() {
  return solUsd;
}
export async function refreshSolPrice() {
  if (Date.now() - solAt < 60_000) return solUsd;
  solAt = Date.now();
  try {
    const r = await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=SOLUSDT");
    const p = Number((await r.json()).price);
    if (p > 0) solUsd = p;
  } catch {
    /* keep the last price */
  }
  return solUsd;
}
export function setSolPrice(p: number | null | undefined) {
  if (p && p > 0 && Date.now() - solAt > 60_000) solUsd = p;
}

// ---------- coin images ----------

const imgCache = new Map<string, string | null>();
const imgWait = new Map<string, Promise<string | null>>();
let imgActive = 0;
const imgQueue: (() => void)[] = [];

const gateway = (u: string) => {
  const cid = u.split("/ipfs/")[1];
  return cid ? `https://pump.mypinata.cloud/ipfs/${cid}` : u;
};

/** image url from a coin's metadata json (cached, at most four lookups at a time) */
export function coinImage(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return Promise.resolve(null);
  if (imgCache.has(uri)) return Promise.resolve(imgCache.get(uri)!);
  const busy = imgWait.get(uri);
  if (busy) return busy;
  const p = new Promise<string | null>((resolve) => {
    const run = async () => {
      imgActive++;
      let out: string | null = null;
      try {
        const r = await fetch(gateway(uri), { signal: AbortSignal.timeout(6000) });
        const j = (await r.json()) as { image?: string };
        out = typeof j.image === "string" && j.image ? gateway(j.image) : null;
      } catch {
        out = null;
      }
      imgCache.set(uri, out);
      imgActive--;
      imgQueue.shift()?.();
      resolve(out);
    };
    if (imgActive < 4) void run();
    else imgQueue.push(() => void run());
  });
  imgWait.set(uri, p);
  return p;
}

// ---------- holders ----------

export type Holder = { account: string; owner: string | null; amount: number; pct: number; curve: boolean };

async function solRpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message ?? "rpc error");
  return j.result as T;
}
export { solRpc };

/** the 20 biggest holders straight from the chain; the curve's own account is flagged */
export async function topHolders(c: Coin): Promise<Holder[]> {
  const big = await solRpc<{ value: { address: string; uiAmount: number | null }[] }>("getTokenLargestAccounts", [c.mint, { commitment: "confirmed" }]);
  const accs = big.value.slice(0, 20);
  let owners: (string | null)[] = accs.map(() => null);
  try {
    const info = await solRpc<{ value: ({ data: { parsed?: { info?: { owner?: string } } } } | null)[] }>("getMultipleAccounts", [
      accs.map((a) => a.address),
      { encoding: "jsonParsed" },
    ]);
    owners = info.value.map((v) => v?.data?.parsed?.info?.owner ?? null);
  } catch {
    /* amounts are enough */
  }
  const left = c.vtok - VTOK_GAP;
  return accs.map((a, i) => {
    const amount = a.uiAmount ?? 0;
    return { account: a.address, owner: owners[i], amount, pct: (amount / SUPPLY) * 100, curve: !c.graduated && left > 0 && Math.abs(amount - left) / left < 0.03 };
  });
}
