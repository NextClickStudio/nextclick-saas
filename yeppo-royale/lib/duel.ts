// One round of a duel, rebuilt on the client from the replayed trades.
// Times are coin age in ms (0 = launch). The intel panel is what separates a rug from a runner.
import { FEE } from "./config";
import type { DuelFill, FeedRow } from "./types";

export const SUPPLY = 1e9;
export const CANDLE_MS = 5000;
const DUST = 1;

export type Candle = { time: number; open: number; high: number; low: number; close: number; buy: number; sell: number };
export type Tr = { t: number; seq: number; w: number; k: number; sol: number; tok: number; mc: number; vsol: number | null };

export type Intel = {
  mcUsd: number;
  athUsd: number;
  chg: number;
  holders: number;
  top10: number;
  dev: number;
  devSoldPct: number;
  devSold: boolean;
  snipers: number;
  buys: number;
  sells: number;
  buyVol: number;
  sellVol: number;
  txs: number;
  progress: number;
  graduated: boolean;
  dead: boolean;
};

export class RoundCoin {
  readonly off: number;
  readonly solUsd: number;
  trades: Tr[] = [];
  candles: Candle[] = [];
  private seen = new Set<number>();
  private bal = new Map<number, number>();
  private early = new Set<number>();
  devBought = 0;
  devSoldTok = 0;
  athMc = 0;
  launchMc = 0;

  constructor(off: number, solUsd: number | null) {
    this.off = off;
    this.solUsd = solUsd ?? 150;
  }

  get lastT() {
    return this.trades.length ? this.trades[this.trades.length - 1].t : -1;
  }

  /** returns the trades that were new */
  add(rows: FeedRow[]): Tr[] {
    const fresh: Tr[] = [];
    for (const [t, seq, w, k, sol, tok, , mc, vsol] of rows) {
      if (this.seen.has(seq)) continue;
      this.seen.add(seq);
      const tr: Tr = { t, seq, w, k, sol: +sol, tok: +tok, mc: +mc, vsol: vsol == null ? null : +vsol };
      if (!this.trades.length || t >= this.lastT) this.trades.push(tr);
      else {
        let i = this.trades.length;
        while (i > 0 && this.trades[i - 1].t > t) i--;
        this.trades.splice(i, 0, tr);
      }
      if (w === 0 && k !== 2) this.devBought += tr.tok;
      if (!this.launchMc) this.launchMc = tr.mc;
      const prev = this.bal.get(w) ?? 0;
      this.bal.set(w, k === 2 ? Math.max(0, prev - tr.tok) : prev + tr.tok);
      if (k === 2 && w === 0) this.devSoldTok += tr.tok;
      if (k === 1 && w !== 0 && t <= 3000) this.early.add(w);
      if (tr.mc > this.athMc) this.athMc = tr.mc;
      this.candle(tr);
      fresh.push(tr);
    }
    return fresh;
  }

  private candle(t: Tr) {
    const usd = t.mc * this.solUsd;
    const time = Math.floor(t.t / CANDLE_MS) * (CANDLE_MS / 1000);
    const last = this.candles[this.candles.length - 1];
    if (last && last.time === time) {
      last.high = Math.max(last.high, usd);
      last.low = Math.min(last.low, usd);
      last.close = usd;
      if (t.k === 2) last.sell += t.sol;
      else last.buy += t.sol;
    } else if (!last || time > last.time) {
      const open = last ? last.close : usd;
      this.candles.push({ time, open, high: Math.max(open, usd), low: Math.min(open, usd), close: usd, buy: t.k === 2 ? 0 : t.sol, sell: t.k === 2 ? t.sol : 0 });
    }
  }

  get last(): Tr | null {
    return this.trades[this.trades.length - 1] ?? null;
  }

  /** SOL per token */
  price() {
    return (this.last?.mc ?? 0) / SUPPLY;
  }

  intel(ct: number): Intel {
    const last = this.last;
    const mc = last?.mc ?? 0;
    let holders = 0;
    const balances: number[] = [];
    for (const b of this.bal.values()) {
      if (b > DUST) {
        holders++;
        balances.push(b);
      }
    }
    balances.sort((a, b) => b - a);
    let top = 0;
    for (let i = 0; i < Math.min(10, balances.length); i++) top += balances[i];
    let sn = 0;
    for (const w of this.early) sn += this.bal.get(w) ?? 0;
    let buys = 0;
    let sells = 0;
    let buyVol = 0;
    let sellVol = 0;
    for (let i = this.trades.length - 1; i >= 0 && this.trades[i].t >= ct - 60_000; i--) {
      const t = this.trades[i];
      if (t.k === 2) {
        sells++;
        sellVol += t.sol;
      } else {
        buys++;
        buyVol += t.sol;
      }
    }
    const vs = last?.vsol ?? null;
    const progress = vs == null ? 100 : Math.max(0, Math.min(100, ((vs - 30) / 85) * 100));
    return {
      mcUsd: mc * this.solUsd,
      athUsd: this.athMc * this.solUsd,
      chg: this.launchMc ? (mc / this.launchMc - 1) * 100 : 0,
      holders,
      top10: Math.min(100, (top / SUPPLY) * 100),
      dev: Math.min(100, ((this.bal.get(0) ?? 0) / SUPPLY) * 100),
      devSoldPct: this.devBought ? Math.min(100, (this.devSoldTok / this.devBought) * 100) : 0,
      devSold: this.devSoldTok > 0,
      snipers: Math.min(100, (sn / SUPPLY) * 100),
      buys,
      sells,
      buyVol,
      sellVol,
      txs: this.trades.length,
      progress,
      graduated: progress >= 99.5,
      dead: last ? ct - last.t > 120_000 : false,
    };
  }

  /** what a buy or sell would fill at right now (same formula as the server) */
  quote(side: "buy" | "sell", amount: number) {
    const last = this.last;
    if (!last || !(amount > 0)) return { tok: 0, sol: 0, impact: 0 };
    const vs = last.vsol ?? Math.max(last.mc * 0.2, 30);
    const vt = (vs * SUPPLY) / last.mc;
    const p0 = last.mc / SUPPLY;
    if (side === "buy") {
      const x = amount * (1 - FEE);
      const tok = (vt * x) / (vs + x);
      return { tok, sol: amount, impact: p0 > 0 ? (amount / tok / p0 - 1) * 100 : 0 };
    }
    const solOut = ((vs * amount) / (vt + amount)) * (1 - FEE);
    return { tok: amount, sol: solOut, impact: p0 > 0 ? (1 - solOut / amount / p0) * 100 : 0 };
  }
}

/** a player's bag in one round from their fills */
export function bag(fills: DuelFill[], slot: number, r: number, price: number) {
  let cash = 10;
  let held = 0;
  let n = 0;
  let spent = 0;
  let got = 0;
  for (const f of fills) {
    if (f[0] !== slot || f[1] !== r) continue;
    n++;
    if (f[3] === 1) {
      cash -= f[4];
      held += f[5];
      spent += f[4];
      got += f[5];
    } else {
      cash += f[4];
      held -= f[5];
    }
  }
  held = Math.max(0, held);
  return { cash, held, eq: cash + held * price, n, avgPx: got > 0 ? spent / got : null };
}

/** the ghost's bag: the same loop as yr_ghost_eq on the server */
export function ghostBag(coin: RoundCoin, gw: number, scale: number, price: number) {
  let cash = 0;
  let held = 0;
  let n = 0;
  const trades: Tr[] = [];
  for (const t of coin.trades) {
    if (t.w !== gw || t.t <= coin.off) continue;
    if (t.k === 1) {
      cash -= t.sol * scale;
      held += t.tok * scale;
      n++;
      trades.push(t);
    } else if (t.k === 2 && t.tok > 0) {
      const q = Math.min(t.tok * scale, held);
      cash += (t.sol * scale * q) / (t.tok * scale);
      held -= q;
      n++;
      trades.push(t);
    }
  }
  return { cash: 10 + cash, held, eq: 10 + cash + held * price, n, trades };
}

export type Flag = { tone: "up" | "down" | "warn"; text: string };

/** the red and green flags a good trencher reads before aping */
export function flags(i: Intel): Flag[] {
  const out: Flag[] = [];
  if (i.devSold) out.push({ tone: "down", text: i.devSoldPct >= 90 ? "Dev dumped everything" : `Dev sold ${i.devSoldPct.toFixed(0)}%` });
  else if (i.dev >= 10) out.push({ tone: "warn", text: `Dev holds ${i.dev.toFixed(1)}%` });
  else out.push({ tone: "up", text: "Dev hasn't sold" });
  if (i.top10 >= 45) out.push({ tone: "down", text: `Top 10 own ${i.top10.toFixed(0)}%` });
  else if (i.top10 >= 30) out.push({ tone: "warn", text: `Top 10 own ${i.top10.toFixed(0)}%` });
  else out.push({ tone: "up", text: `Top 10 own ${i.top10.toFixed(0)}%` });
  if (i.snipers >= 25) out.push({ tone: "down", text: `Snipers hold ${i.snipers.toFixed(0)}%` });
  else if (i.snipers >= 12) out.push({ tone: "warn", text: `Snipers hold ${i.snipers.toFixed(0)}%` });
  const flow = i.buyVol + i.sellVol;
  if (flow > 0.5) {
    const r = i.buyVol / flow;
    if (r >= 0.65) out.push({ tone: "up", text: "Buyers in control" });
    else if (r <= 0.35) out.push({ tone: "down", text: "Heavy selling" });
  }
  if (i.dead) out.push({ tone: "down", text: "No trades lately" });
  if (i.graduated) out.push({ tone: "up", text: "Graduated" });
  return out;
}

export const OUTCOME: Record<string, { label: string; cls: string }> = {
  runner: { label: "Runner", cls: "t-up" },
  rug: { label: "Rug pull", cls: "t-down" },
  pump: { label: "Pump & dump", cls: "t-warn" },
  bleed: { label: "Bled out", cls: "t-down" },
  mid: { label: "Chop", cls: "muted" },
};

export const EMOTES = ["GG", "LFG", "NGMI", "WAGMI", "Rugged", "Lucky", "🔥", "💀", "🫡", "🤡", "📉", "🚀"];
