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
  desc?: string | null;
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
    // the last 20 minutes of trades, for any coin, from the capture
    let recent = 0;
    try {
      const r = await rpc<{ ticks: TickRow[] }>("yr_ticks", { p_mints: [mint], p_since: 0 });
      for (const [, t, k, s, tok, vsol, vtok, who, sig] of r.ticks) {
        if (t <= c.lastT || !(vtok > 0)) continue;
        c.add({ sig, t, k: k === 1 ? 1 : 2, sol: s, tok, vsol, vtok, who: who ?? "" });
        recent++;
      }
    } catch {
      /* the chain lookup below covers it */
    }
    const stale = !recent && (!db || Date.now() - (db.created + (db.ev[db.ev.length - 1]?.[0] ?? 0)) > 60_000);
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
// Launches come from PumpPortal's free socket. Trades come from yeppo: the capture reads every pump.fun
// TradeEvent from the chain and writes it to yr_ticks about once a second (PumpPortal only streams a
// coin's trades with a funded API key); every visible tab asks for the coins it follows once a second.
// The socket is shared: the first tab takes a Web Lock, owns it and passes its messages to the other tabs
// over a BroadcastChannel. If the trades stop, the chain ticker reads the bonding curves from Solana.

type Msg = Record<string, unknown>;
const num = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

const CHANNEL = "yr-feed-2";
const PEER_TTL = 13_000;
const QUIET_MS = 30_000;
/** [mint, atMs, kind, sol, tokens, vSol, vTokens, wallet, signature] */
type TickRow = [string, number, number, number, number, number, number, string | null, string];
type ChanMsg =
  | { t: "m"; d: string }
  | { t: "s"; s: FeedStatus }
  | { t: "subs"; id: string; mints: string[]; fresh: boolean }
  | { t: "hello" }
  | { t: "bye"; id: string };

class Feed {
  status: FeedStatus = "off";
  /** when the last PumpPortal message arrived, in this tab */
  lastMsg = 0;
  private readonly id = Math.random().toString(36).slice(2);
  private ws: WebSocket | null = null;
  private chan: BroadcastChannel | null = null;
  private leader = false;
  private peers = new Map<string, { mints: string[]; fresh: boolean; at: number }>();
  private subbedNew = false;
  private watched = new Map<string, number>();
  private liveAt = new Map<string, number>();
  private wantNew = 0;
  private tradeL = new Set<(mint: string, t: Trade) => void>();
  private newL = new Set<(c: NewCoin) => void>();
  private migL = new Set<(mint: string) => void>();
  private statusL = new Set<(s: FeedStatus) => void>();
  private retry = 0;
  private openAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private syncT: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private tickSince = 0;
  private tickOkAt = 0;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  readonly ticker: Ticker;

  constructor() {
    this.ticker = new Ticker(
      (mint, t) => this.tradeL.forEach((f) => f(mint, t)),
      (mint) => Date.now() - (this.liveAt.get(mint) ?? 0) < 6000,
      () => this.healthy(),
    );
  }

  /** trades are flowing from yeppo */
  healthy() {
    return Date.now() - this.tickOkAt < 6000;
  }

  private start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (typeof BroadcastChannel !== "undefined" && locks?.request) {
      this.chan = new BroadcastChannel(CHANNEL);
      this.chan.onmessage = (e: MessageEvent<ChanMsg>) => this.onChan(e.data);
      // held until this tab closes; the next tab in line takes over the socket
      void locks.request(CHANNEL, () => new Promise<void>(() => this.lead())).catch(() => this.lead());
      window.addEventListener("pagehide", () => this.chan?.postMessage({ t: "bye", id: this.id } satisfies ChanMsg));
      setInterval(() => this.announce(), 4000);
      this.chan.postMessage({ t: "hello" } satisfies ChanMsg);
    } else this.lead();
    setInterval(() => this.watchdog(), 5000);
    void this.pollTicks();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || !this.tickTimer) return;
      clearTimeout(this.tickTimer);
      void this.pollTicks();
    });
  }

  private lead() {
    if (this.leader) return;
    this.leader = true;
    this.chan?.postMessage({ t: "hello" } satisfies ChanMsg);
    this.sync();
  }

  /** this tab asks yeppo for the new trades of the coins it follows, once a second while it is visible */
  private async pollTicks() {
    this.tickTimer = null;
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    const mints = [...this.watched.keys()].slice(0, 60);
    let wait = hidden ? 5000 : 1000;
    if (mints.length) {
      try {
        // a little overlap: batches can land a moment out of order, and Coin.add drops repeats
        const since = this.tickSince ? this.tickSince - 2500 : Date.now() - 10_000;
        const r = await rpc<{ now: number; ticks: TickRow[] }>("yr_ticks", { p_mints: mints, p_since: since });
        this.tickOkAt = Date.now();
        const last = r.ticks[r.ticks.length - 1];
        this.tickSince = Math.max(this.tickSince, last ? last[1] : r.now - 5000);
        this.applyTicks(r.ticks);
      } catch {
        wait = 3000;
      }
    }
    this.tickTimer = setTimeout(() => void this.pollTicks(), wait);
  }

  private applyTicks(rows: TickRow[]) {
    const now = Date.now();
    this.tickOkAt = now;
    for (const [mint, t, k, sol, tok, vsol, vtok, who, sig] of rows) {
      if (!(vtok > 0)) continue;
      const tr: Trade = { sig, t, k: k === 1 ? 1 : 2, sol, tok, vsol, vtok, who: who ?? "" };
      this.liveAt.set(mint, now);
      if (coinOf(mint).add(tr, true)) this.tradeL.forEach((f) => f(mint, tr));
    }
  }

  private onChan(m: ChanMsg) {
    if (!m || typeof m !== "object") return;
    if (m.t === "m") {
      if (!this.leader) this.onMessage(m.d);
    } else if (m.t === "s") {
      if (!this.leader) this.setStatus(m.s);
    } else if (m.t === "subs") {
      if (!this.leader) return;
      this.peers.set(m.id, { mints: m.mints, fresh: m.fresh, at: Date.now() });
      this.sync(true);
    } else if (m.t === "hello") {
      if (this.leader) this.chan?.postMessage({ t: "s", s: this.status } satisfies ChanMsg);
      else this.announce();
    } else if (m.t === "bye" && this.leader) {
      this.peers.delete(m.id);
      this.sync(true);
    }
  }

  private announce() {
    if (this.leader || !this.chan) return;
    this.chan.postMessage({ t: "subs", id: this.id, mints: [...this.watched.keys()], fresh: this.wantNew > 0 } satisfies ChanMsg);
  }

  private setStatus(s: FeedStatus) {
    this.status = s;
    if (this.leader) this.chan?.postMessage({ t: "s", s } satisfies ChanMsg);
    this.statusL.forEach((f) => f(s));
  }

  private send(o: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(o));
  }

  /** what this browser follows: this tab's coins plus every live follower's */
  private wanted() {
    const now = Date.now();
    const mints = new Set(this.watched.keys());
    let fresh = this.wantNew > 0;
    for (const [id, p] of this.peers) {
      if (now - p.at > PEER_TTL) {
        this.peers.delete(id);
        continue;
      }
      p.mints.forEach((m) => mints.add(m));
      fresh ||= p.fresh;
    }
    return { mints, fresh };
  }

  /** coalesce subscription changes into one round of messages (now: a background leader's timers can be throttled) */
  private sync(now = false) {
    this.start();
    if (now) {
      if (this.syncT) clearTimeout(this.syncT);
      this.syncT = null;
      return this.flush();
    }
    if (this.syncT) return;
    this.syncT = setTimeout(() => {
      this.syncT = null;
      this.flush();
    }, 250);
  }

  private flush() {
    if (!this.leader) return this.announce();
    const w = this.wanted();
    // the socket only carries launches and migrations; trades come from pollTicks
    if (!w.fresh) {
      if (this.ws) this.ws.close();
      return;
    }
    if (!this.ws && !this.timer) return this.connect();
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    if (w.fresh !== this.subbedNew) {
      const verb = w.fresh ? "subscribe" : "unsubscribe";
      this.send({ method: `${verb}NewToken` });
      this.send({ method: `${verb}Migration` });
      this.subbedNew = w.fresh;
    }
  }

  private connect() {
    if (this.ws || typeof WebSocket === "undefined") return;
    this.setStatus("connecting");
    const ws = new WebSocket(WS);
    this.ws = ws;
    this.subbedNew = false;
    ws.onopen = () => {
      this.retry = 0;
      this.openAt = Date.now();
      this.setStatus("live");
      this.sync();
    };
    ws.onmessage = (m) => {
      const raw = String(m.data);
      this.onMessage(raw);
      this.chan?.postMessage({ t: "m", d: raw } satisfies ChanMsg);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      const w = this.wanted();
      if (!w.fresh) {
        this.setStatus("off");
        return;
      }
      this.setStatus("connecting");
      const wait = Math.min(20_000, 1000 * 2 ** this.retry++) * (0.75 + Math.random() * 0.5);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.connect();
      }, wait);
    };
    ws.onerror = () => ws.close();
  }

  /** a socket that went silent while launches should be flowing gets reopened */
  private watchdog() {
    if (!this.leader || this.ws?.readyState !== WebSocket.OPEN) return;
    if (this.wanted().fresh && Date.now() - Math.max(this.lastMsg, this.openAt) > QUIET_MS) this.ws.close();
  }

  private onMessage(raw: string) {
    let d: Msg;
    try {
      d = JSON.parse(raw);
    } catch {
      return;
    }
    const now = Date.now();
    this.lastMsg = now;
    const mint = typeof d.mint === "string" ? d.mint : null;
    if (!mint) return;
    const tx = d.txType;
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
      this.liveAt.set(mint, now);
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
    this.start();
    return () => void this.tradeL.delete(f);
  }

  onNew(f: (c: NewCoin) => void, onMigrate?: (mint: string) => void) {
    this.newL.add(f);
    if (onMigrate) this.migL.add(onMigrate);
    this.wantNew++;
    this.sync();
    return () => {
      this.newL.delete(f);
      if (onMigrate) this.migL.delete(onMigrate);
      this.wantNew--;
      this.sync();
    };
  }

  /** follow every trade of these coins (socket and chain); returns the undo */
  watch(mints: string[]) {
    const list = [...new Set(mints)].filter(Boolean);
    for (const m of list) this.watched.set(m, (this.watched.get(m) ?? 0) + 1);
    this.sync();
    const untick = this.ticker.watch(list);
    return () => {
      for (const m of list) {
        const n = (this.watched.get(m) ?? 1) - 1;
        if (n <= 0) this.watched.delete(m);
        else this.watched.set(m, n);
      }
      untick();
      this.sync();
    };
  }
}

// ---------- the chain ticker ----------
const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

function fromB64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** reads the bonding curves of followed coins from Solana; while yeppo's trades are down, a reserve change becomes a trade */
class Ticker {
  private want = new Map<string, number>();
  private pdas = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;

  constructor(
    private emit: (mint: string, t: Trade) => void,
    private socketHas: (mint: string) => boolean,
    private socketOk: () => boolean,
  ) {}

  watch(mints: string[]) {
    for (const m of mints) this.want.set(m, (this.want.get(m) ?? 0) + 1);
    if (!this.timer && !this.busy) this.timer = setTimeout(() => void this.run(), 400);
    return () => {
      for (const m of mints) {
        const n = (this.want.get(m) ?? 1) - 1;
        if (n <= 0) this.want.delete(m);
        else this.want.set(m, n);
      }
    };
  }

  private async pdaOf(mints: string[]) {
    const missing = mints.filter((m) => !this.pdas.has(m));
    if (missing.length) {
      const { PublicKey } = await import("@solana/web3.js");
      const program = new PublicKey(PUMP_PROGRAM);
      const seed = new TextEncoder().encode("bonding-curve");
      for (const m of missing) {
        try {
          this.pdas.set(m, PublicKey.findProgramAddressSync([seed, new PublicKey(m).toBytes()], program)[0].toBase58());
        } catch {
          this.want.delete(m);
        }
      }
    }
    return mints.filter((m) => this.pdas.has(m));
  }

  private async run() {
    this.timer = null;
    if (!this.want.size) return;
    let wait = this.socketOk() ? 8000 : 1200;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") wait = 5000;
    else {
      this.busy = true;
      try {
        const mints = await this.pdaOf([...this.want.keys()].slice(0, 100));
        const r = await solRpc<{ value: ({ data: [string, string] } | null)[] }>("getMultipleAccounts", [
          mints.map((m) => this.pdas.get(m)),
          { encoding: "base64", commitment: "processed" },
        ]);
        const now = Date.now();
        r.value.forEach((acc, i) => {
          if (!acc) return;
          const b = fromB64(acc.data[0]);
          if (b.length < 49) return;
          const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
          const vtok = Number(v.getBigUint64(8, true)) / 1e6;
          const vsol = Number(v.getBigUint64(16, true)) / 1e9;
          const mint = mints[i];
          const c = coinOf(mint);
          if (b[48] === 1) {
            c.graduated = true;
            return;
          }
          if (!(vtok > 0)) return;
          if (!(c.vtok > 0)) {
            c.vsol = vsol;
            c.vtok = vtok;
            c.lastT = now;
            c.version++;
            return;
          }
          // while yeppo's trades flow they move the chart; this only fills in when they stop
          if (Math.abs(vtok - c.vtok) < 1 || this.socketOk() || this.socketHas(mint)) return;
          const k = vsol > c.vsol ? 1 : 2;
          const t: Trade = {
            sig: `rpc:${mint}:${vtok}`,
            t: now,
            k,
            sol: k === 1 ? (vsol - c.vsol) / (1 - FEE) : (c.vsol - vsol) * (1 - FEE),
            tok: Math.abs(c.vtok - vtok),
            vsol,
            vtok,
            who: "",
          };
          if (c.add(t, true)) this.emit(mint, t);
        });
      } catch {
        wait = 5000;
      } finally {
        this.busy = false;
      }
    }
    if (this.want.size) this.timer = setTimeout(() => void this.run(), wait);
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

export type CoinJson = { image: string | null; twitter: string | null; telegram: string | null; website: string | null; description: string | null };
const jsonCache = new Map<string, CoinJson | null>();
const jsonWait = new Map<string, Promise<CoinJson | null>>();
let jsonActive = 0;
const jsonQueue: (() => void)[] = [];

const gateway = (u: string) => {
  const cid = u.split("/ipfs/")[1];
  return cid ? `https://pump.mypinata.cloud/ipfs/${cid}` : u;
};
const link = (v: unknown, kind: "x" | "tg" | "web") => {
  if (typeof v !== "string" || !v.trim()) return null;
  let u = v.trim();
  if (kind === "x" && /^@?[A-Za-z0-9_]{1,15}$/.test(u)) u = `https://x.com/${u.replace(/^@/, "")}`;
  if (kind === "tg" && /^@?[A-Za-z0-9_]{4,32}$/.test(u)) u = `https://t.me/${u.replace(/^@/, "")}`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** a coin's metadata json: image, socials and description (cached, at most four lookups at a time) */
export function coinJson(uri: string | null | undefined): Promise<CoinJson | null> {
  if (!uri) return Promise.resolve(null);
  if (jsonCache.has(uri)) return Promise.resolve(jsonCache.get(uri)!);
  const busy = jsonWait.get(uri);
  if (busy) return busy;
  const p = new Promise<CoinJson | null>((resolve) => {
    const run = async () => {
      jsonActive++;
      let out: CoinJson | null = null;
      try {
        const r = await fetch(gateway(uri), { signal: AbortSignal.timeout(6000) });
        const j = (await r.json()) as Record<string, unknown>;
        const ext = (j.extensions ?? {}) as Record<string, unknown>;
        out = {
          image: typeof j.image === "string" && j.image ? gateway(j.image) : null,
          twitter: link(j.twitter ?? ext.twitter, "x"),
          telegram: link(j.telegram ?? ext.telegram, "tg"),
          website: link(j.website ?? ext.website, "web"),
          description: typeof j.description === "string" ? j.description.slice(0, 400) : null,
        };
      } catch {
        out = null;
      }
      jsonCache.set(uri, out);
      jsonActive--;
      jsonQueue.shift()?.();
      resolve(out);
    };
    if (jsonActive < 4) void run();
    else jsonQueue.push(() => void run());
  });
  jsonWait.set(uri, p);
  return p;
}

/** image url from a coin's metadata json */
export const coinImage = (uri: string | null | undefined) => coinJson(uri).then((j) => j?.image ?? null);

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
