"use client";

// The coin's trades as they happen, straight from the chain: the panel subscribes to the public Solana node for the
// one coin it shows (logsSubscribe) and reads pump.fun's TradeEvent from each transaction. Each viewer uses their own
// connection, so yeppo's servers and database do no work for it. Coins on pump.fun's curve paired with SOL only;
// anything else keeps the regular refresh.
import { useEffect, useRef, useState } from "react";
import { type Decision, momentumBlock, possible, pulseOf, type Pulse, type Top, topSelling } from "./decide";

const WS = "wss://api.mainnet-beta.solana.com";
const TRADE = "Program data: vdt/007mYe";
const DISC = [189, 219, 127, 211, 78, 230, 97, 238];
const KEEP_MS = 6 * 60_000;

export type LiveTrade = { t: number; buy: boolean; sol: number; price: number; who: string; tok: number };
/** what the server sent to start from: 10 s steps [step, close, high, low, buys, sells, SOL in, SOL out] */
export type LiveBase = { from: number; now: number; steps: number[][]; w60: number | null; sol: number; devSold?: boolean; bun0?: number | null };

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58bytes(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const v = B58.indexOf(c);
    if (v < 0) return new Uint8Array(0);
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

function parse(line: string, mint: Uint8Array): LiveTrade | null {
  let b: Uint8Array;
  try {
    b = Uint8Array.from(atob(line.slice(14)), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  if (b.length < 129) return null;
  for (let i = 0; i < 8; i++) if (b[i] !== DISC[i]) return null;
  for (let i = 0; i < 32; i++) if (b[8 + i] !== mint[i]) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const vsol = Number(dv.getBigUint64(97, true)) / 1e9;
  const vtok = Number(dv.getBigUint64(105, true)) / 1e6;
  if (!(vsol > 0) || !(vtok > 0)) return null; // a curve paired with another token: the regular refresh covers it
  let who = "";
  for (let i = 57; i < 89; i++) who += b[i].toString(16).padStart(2, "0");
  return { t: Date.now(), buy: b[56] === 1, sol: Number(dv.getBigUint64(40, true)) / 1e9, price: (vsol / vtok) * 1e9, who, tok: Number(dv.getBigUint64(48, true)) / 1e6 };
}

/** live trades of one coin while `on`; `live` is true while the connection is up */
export function useLiveTrades(mint: string, on: boolean) {
  const [state, setState] = useState<{ trades: LiveTrade[]; live: boolean }>({ trades: [], live: false });
  const buf = useRef<LiveTrade[]>([]);
  useEffect(() => {
    buf.current = [];
    setState({ trades: [], live: false });
    if (!on) return;
    const target = b58bytes(mint);
    if (target.length !== 32) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let up = false;
    const connect = () => {
      if (closed) return;
      ws = new WebSocket(WS);
      ws.onopen = () => {
        retry = 0;
        ws?.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "logsSubscribe", params: [{ mentions: [mint] }, { commitment: "confirmed" }] }));
      };
      ws.onmessage = (m) => {
        const s = String(m.data);
        if (!s.includes(TRADE)) {
          if (s.includes('"result"')) up = true;
          return;
        }
        try {
          const v = JSON.parse(s).params?.result?.value as { err: unknown; logs: string[] } | undefined;
          if (!v || v.err) return;
          for (const l of v.logs) if (l.startsWith(TRADE)) {
            const tr = parse(l, target);
            if (tr) buf.current.push(tr);
          }
        } catch {
          /* not a notification */
        }
      };
      ws.onclose = () => {
        up = false;
        if (!closed) setTimeout(connect, Math.min(15_000, 1000 * 2 ** retry++));
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    // one render a second, whatever the trade rate
    const tick = setInterval(() => {
      const cut = Date.now() - KEEP_MS;
      buf.current = buf.current.filter((x) => x.t > cut);
      setState({ trades: buf.current.slice(), live: up });
    }, 1000);
    return () => {
      closed = true;
      clearInterval(tick);
      ws?.close();
    };
  }, [mint, on]);
  return state;
}

/** the server's steps carried forward with the live trades: the last minute as it is now, not as it was at the read.
 *  skew: server clock minus this browser's clock, measured when the read arrived. */
export function livePulse(base: LiveBase, trades: LiveTrade[], skew: number): Pulse {
  const steps = base.steps.map((s) => s.slice());
  const byStep = new Map<number, number[]>(steps.map((s) => [s[0], s]));
  for (const tr of trades) {
    const ts = tr.t + skew;
    if (ts <= base.now) continue; // already in the server's steps
    const k = Math.floor((ts - base.from) / 10_000);
    let s = byStep.get(k);
    if (!s) {
      s = [k, tr.price, tr.price, tr.price, 0, 0, 0, 0];
      byStep.set(k, s);
      steps.push(s);
    }
    s[1] = tr.price;
    s[2] = Math.max(s[2], tr.price);
    s[3] = Math.min(s[3], tr.price);
    if (tr.buy) {
      s[4]++;
      s[6] += tr.sol;
    } else {
      s[5]++;
      s[7] += tr.sol;
    }
  }
  steps.sort((a, b) => a[0] - b[0]);
  const now = Date.now() + skew;
  const nowStep = Math.floor((now - base.from) / 10_000);
  // wallets of the last minute: the live ones, and the server's count while the live minute is still filling
  const fresh = trades.filter((x) => x.t + skew > now - 60_000);
  const liveWallets = new Set(fresh.map((x) => x.who)).size;
  const filling = now - base.now < 60_000;
  const wallets = filling ? Math.max(liveWallets, base.w60 ?? 0) : liveWallets;
  return pulseOf(steps, nowStep, wallets, base.sol);
}

const pct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;

/** a dump happening now, from the live trades: the price 35%+ under its high of the last 20 seconds. Rugs on pump.fun
 *  take one block, so the call turns at once instead of waiting for the next read. */
export function liveDump(trades: LiveTrade[]): Decision | null {
  const cut = Date.now() - 20_000;
  const recent = trades.filter((t) => t.t > cut);
  if (recent.length < 2) return null;
  const high = Math.max(...recent.map((t) => t.price));
  const last = recent[recent.length - 1].price;
  if (!(high > 0) || last > high * 0.65) return null;
  const sold = recent.filter((t) => !t.buy).reduce((a, t) => a + t.sol, 0);
  return { word: "Don't buy", tone: "down", why: `Dumping right now: ${pct(last / high - 1)} in seconds, ${sold.toFixed(1)} SOL sold. Stay out.` };
}

/** the call with the live minute: buyers piling in right now turn it to Momentum at once, and a Momentum whose
 *  buyers stepped back turns to Wait. Every reason to stay out (Don't buy) stands as the server said it, and so does
 *  hold: snipers or one big wallet that could dump the push keep it from being a Momentum. */
export function liveCall(server: Decision, p: Pulse, ageS: number | null, base?: LiveBase, hold?: string | null, watch?: string | null, clear = true): Decision {
  if (server.word === "Don't buy" || server.word === "Locked") return server;
  // a coin the server found something on never turns green from the trades alone
  if (!clear && p.state === "hot") return server;
  if (ageS != null && ageS < 30) return server;
  const mb = momentumBlock({ ageS, ch1m: p.ch1m, devSold: !!base?.devSold, bun0: base?.bun0 ?? null });
  const block = mb ?? hold ?? null;
  const good = server.word === "Momentum" || server.word === "Opportunity";
  if (block && (p.state === "hot" || good)) return !mb && watch ? possible(watch) : { word: "Wait", tone: "mid", why: block };
  if (p.state === "hot") {
    const ch = p.ch1m != null ? `${pct(p.ch1m)} in 1 min` : "buyers piling in";
    const w = p.wallets1m ? `, ${p.wallets1m} wallets` : "";
    return { word: "Momentum", tone: "up", why: `Buyers are in right now: ${ch}${w}.` };
  }
  // a pullback Opportunity is about the quiet minute: it stands while the coin catches its breath
  if (good && !server.pullback && (p.state === "cooling" || p.state === "quiet"))
    return { word: "Wait", tone: "mid", why: p.state === "quiet" ? "Trading just went quiet. Wait for buyers to come back." : "Buyers stepped back in the last minute. Wait for them to return." };
  return server;
}

/** the biggest holders selling, from the chain within the second: the server's top holders of 90 seconds ago,
 *  against the sells seen live since then. Null while none of them sells a real part of their bag. */
export function liveSellers(trades: LiveTrade[], tops: Top[] | undefined, since: number): string | null {
  if (!tops?.length || !trades.length) return null;
  const hex = new Map<string, Top>();
  for (const t of tops) hex.set(Array.from(b58bytes(t.w), (x) => x.toString(16).padStart(2, "0")).join(""), t);
  const sold = new Map<string, number>();
  for (const x of trades) if (!x.buy && x.t >= since && hex.has(x.who)) sold.set(x.who, (sold.get(x.who) ?? 0) + x.tok / 1e9);
  if (!sold.size) return null;
  return topSelling([...hex].map(([k, t]) => ({ had: t.h + t.s90, sold: t.s90 + (sold.get(k) ?? 0) })));
}
