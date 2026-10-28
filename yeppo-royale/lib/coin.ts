// Client-side view of one coin in a match, rebuilt from the replayed trades.
// The intel panel (holders, dev, snipers, flow) is what separates a rug from a runner.
import { FEE } from "./config";
import type { FeedEv } from "./types";

export const SUPPLY = 1e9;
export const CANDLE_MS = 3000;
const DUST = 1;

export type Candle = { time: number; open: number; high: number; low: number; close: number; buy: number; sell: number };
export type Trade = { ms: number; w: number; k: number; sol: number; tok: number; mc: number; vsol: number | null };

export type Intel = {
  mc: number;
  mcUsd: number;
  launchUsd: number;
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
  traders: number;
  ageMs: number;
  progress: number;
  graduated: boolean;
  dead: boolean;
};

export class CoinState {
  readonly ci: number;
  readonly at: number;
  readonly solUsd: number;
  readonly speed: number;
  trades: Trade[] = [];
  candles: Candle[] = [];
  private seen = new Set<number>();
  private bal = new Map<number, number>();
  private early = new Set<number>();
  creator: number | null = null;
  devBought = 0;
  devSoldTok = 0;
  athMc = 0;
  launchMc = 0;
  version = 0;

  constructor(ci: number, at: number, solUsd: number | null, speed: number) {
    this.ci = ci;
    this.at = at;
    this.solUsd = solUsd ?? 180;
    this.speed = speed;
  }

  /** coin age (in the coin's own time) at a given match time */
  coinMs(matchMs: number) {
    return Math.max(0, (matchMs - this.at) * this.speed);
  }

  add(e: FeedEv) {
    const [, ms, seq, w, k, solAmt, tok, , mc, vsol] = e;
    if (this.seen.has(seq)) return;
    this.seen.add(seq);
    const t: Trade = { ms, w, k, sol: +solAmt, tok: +tok, mc: +mc, vsol: vsol == null ? null : +vsol };
    if (!this.trades.length || ms >= this.trades[this.trades.length - 1].ms) this.trades.push(t);
    else {
      let i = this.trades.length;
      while (i > 0 && this.trades[i - 1].ms > ms) i--;
      this.trades.splice(i, 0, t);
    }
    if (k === 0) {
      this.creator = w;
      this.devBought += t.tok;
      this.launchMc = this.launchMc || t.mc;
    } else if (!this.launchMc) this.launchMc = t.mc;
    const prev = this.bal.get(w) ?? 0;
    const next = k === 2 ? Math.max(0, prev - t.tok) : prev + t.tok;
    this.bal.set(w, next);
    if (k === 2 && w === this.creator) this.devSoldTok += t.tok;
    if (k === 1 && w !== this.creator && this.coinMs(ms) <= 3000) this.early.add(w);
    if (t.mc > this.athMc) this.athMc = t.mc;
    this.candle(t);
    this.version++;
  }

  private candle(t: Trade) {
    const usd = t.mc * this.solUsd;
    const time = Math.floor(t.ms / CANDLE_MS) * (CANDLE_MS / 1000);
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

  get last(): Trade | null {
    return this.trades[this.trades.length - 1] ?? null;
  }

  launched(matchMs: number) {
    return matchMs >= this.at && this.trades.length > 0;
  }

  /** SOL per token */
  price() {
    return (this.last?.mc ?? 0) / SUPPLY;
  }

  intel(matchMs: number): Intel {
    const last = this.last;
    const mc = last?.mc ?? 0;
    let holders = 0;
    const balances: number[] = [];
    for (const [w, b] of this.bal) {
      if (b > DUST) {
        holders++;
        balances.push(b);
      }
      void w;
    }
    balances.sort((a, b) => b - a);
    let top = 0;
    for (let i = 0; i < Math.min(10, balances.length); i++) top += balances[i];
    let sn = 0;
    for (const w of this.early) sn += this.bal.get(w) ?? 0;
    // flow over the last 60s of the coin's life
    const from = matchMs - 60_000 / this.speed;
    let buys = 0;
    let sells = 0;
    let buyVol = 0;
    let sellVol = 0;
    for (let i = this.trades.length - 1; i >= 0 && this.trades[i].ms >= from; i--) {
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
    const devNow = this.creator == null ? 0 : (this.bal.get(this.creator) ?? 0);
    const lastAge = last ? matchMs - last.ms : 0;
    return {
      mc,
      mcUsd: mc * this.solUsd,
      launchUsd: this.launchMc * this.solUsd,
      athUsd: this.athMc * this.solUsd,
      chg: this.launchMc ? (mc / this.launchMc - 1) * 100 : 0,
      holders,
      top10: Math.min(100, (top / SUPPLY) * 100),
      dev: Math.min(100, (devNow / SUPPLY) * 100),
      devSoldPct: this.devBought ? Math.min(100, (this.devSoldTok / this.devBought) * 100) : 0,
      devSold: this.devSoldTok > 0,
      snipers: Math.min(100, (sn / SUPPLY) * 100),
      buys,
      sells,
      buyVol,
      sellVol,
      txs: this.trades.length,
      traders: this.bal.size,
      ageMs: this.coinMs(matchMs),
      progress,
      graduated: progress >= 99.5,
      dead: lastAge * this.speed > 120_000,
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

export type Flag = { tone: "up" | "down" | "warn"; text: string };

/** the red and green flags a good trencher reads before aping */
export function flags(i: Intel): Flag[] {
  const out: Flag[] = [];
  if (i.devSold) out.push({ tone: "down", text: i.devSoldPct >= 90 ? "Dev dumped everything" : `Dev sold ${i.devSoldPct.toFixed(0)}%` });
  else if (i.dev >= 10) out.push({ tone: "warn", text: `Dev holds ${i.dev.toFixed(1)}%` });
  else out.push({ tone: "up", text: "Dev hasn't sold" });
  if (i.top10 >= 45) out.push({ tone: "down", text: `Top 10 own ${i.top10.toFixed(0)}%` });
  else if (i.top10 >= 30) out.push({ tone: "warn", text: `Top 10 own ${i.top10.toFixed(0)}%` });
  else out.push({ tone: "up", text: `Spread out: top 10 own ${i.top10.toFixed(0)}%` });
  if (i.snipers >= 25) out.push({ tone: "down", text: `Snipers hold ${i.snipers.toFixed(0)}%` });
  else if (i.snipers >= 12) out.push({ tone: "warn", text: `Snipers hold ${i.snipers.toFixed(0)}%` });
  const flow = i.buyVol + i.sellVol;
  if (flow > 0.5) {
    const r = i.buyVol / flow;
    if (r >= 0.65) out.push({ tone: "up", text: "Buyers in control" });
    else if (r <= 0.35) out.push({ tone: "down", text: "Heavy selling" });
  }
  if (i.holders >= 60) out.push({ tone: "up", text: `${i.holders} holders` });
  if (i.dead) out.push({ tone: "down", text: "No trades lately" });
  if (i.graduated) out.push({ tone: "up", text: "Graduated" });
  return out;
}
