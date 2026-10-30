// What yeppo says about a coin, for a short-term trade: is it safe, what did its creator do before, and is
// this a good moment. Pure functions, shared by /api/read and the pages.

export const LAUNCH_MC = 27.96; // SOL, market cap of a fresh pump.fun curve

export type Check = { ok: boolean; label: string };
export type Tone = "up" | "mid" | "down" | "learn";
export type Decision = { word: "Momentum" | "Wait" | "Don't buy" | "Too early"; tone: Tone; why: string };

/** how one of the creator's earlier coins ended */
export type Fate = "rug" | "dead" | "ran" | "grad";

/** one earlier coin of the same creator, prices as multiples of the launch price */
export type PastCoin = {
  mint: string;
  sym: string | null;
  t0: number;
  fate: Fate;
  peak: number; // highest market cap / launch
  peakS: number | null; // seconds from launch to the peak
  soldS: number | null; // seconds from launch to the creator's first sell
  soldX: number | null; // price at that sell / launch
  path: number[] | null; // price / launch, every 30 s for the first 20 minutes
};

export type Creator = {
  dev: string;
  total: number; // coins yeppo saw from this creator (14 days)
  coins: PastCoin[]; // the latest 30, newest first
  rugs: number;
  dead: number;
  ran: number;
  /** typical moment the creator sells: median of their first sells */
  sellS: number | null;
  sellX: number | null;
  line: string; // the one sentence that sums them up
};

/** this coin's creator, right now */
export type DevNow = { bought: boolean; sold: boolean; out: boolean; soldS: number | null; soldX: number | null };

/** the last minute against the four before */
export type Pulse = {
  state: "hot" | "cooling" | "quiet" | "steady";
  ch1m: number | null; // price change over 1 minute, 0.12 = +12%
  ch5m: number | null;
  trades1m: number;
  buys1m: number;
  sells1m: number;
  wallets1m: number | null;
  vol1mUsd: number | null;
};

/** [mint, sym, t0, n, ath, ath_s, mc, dev_buy, dev_sell, sold_s, sold_mc, out_s, grad, p] from yr_creator */
export type CoinRow = [string, string | null, number, number, number, number | null, number | null, number, number, number | null, number | null, number | null, boolean, number[] | null];

const med = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function fateOf(r: CoinRow, now: number): Fate | null {
  const [, , t0, n, ath, athS, mc, , , soldS, , outS, grad] = r;
  if (grad) return "grad";
  const peak = ath / LAUNCH_MC;
  if (now - t0 < 20 * 60_000) return null; // still running: no verdict yet
  if (peak >= 3) return "ran";
  // the creator got out around the top and the price fell hard after: a rug
  if (outS != null && (athS == null || outS <= athS + 180) && (mc ?? 0) <= ath * 0.5 && peak >= 1.15) return "rug";
  if (soldS != null && outS != null && n >= 5 && (mc ?? 0) <= ath * 0.4) return "rug";
  return "dead";
}

export function creatorOf(dev: string, total: number, rows: CoinRow[], now: number): Creator {
  const coins: PastCoin[] = [];
  for (const r of rows) {
    const fate = fateOf(r, now);
    if (!fate) continue;
    coins.push({
      mint: r[0],
      sym: r[1],
      t0: r[2],
      fate,
      peak: r[4] / LAUNCH_MC,
      peakS: r[5],
      soldS: r[9],
      soldX: r[10] != null ? r[10] / LAUNCH_MC : null,
      path: r[13]?.length ? r[13].map((v) => v / LAUNCH_MC) : null,
    });
  }
  const rugs = coins.filter((c) => c.fate === "rug").length;
  const ran = coins.filter((c) => c.fate === "ran" || c.fate === "grad").length;
  const dead = coins.length - rugs - ran;
  const sells = coins.filter((c) => c.soldS != null && c.soldS < 3600);
  const sellS = med(sells.map((c) => c.soldS!));
  const sellX = med(sells.filter((c) => c.soldX != null).map((c) => c.soldX!));
  let line: string;
  if (!coins.length) line = total > 1 ? "Their other coins are too new to judge." : "First coin yeppo has seen from this creator.";
  else if (rugs >= 2 && rugs >= coins.length / 2) line = `Serial rugger: rugged ${rugs} of ${coins.length} coins.`;
  else if (ran > 0 && rugs === 0) line = `${ran} of ${coins.length} coins ran. No rugs.`;
  else line = `${coins.length} coins: ${rugs} rugged, ${dead} died, ${ran} ran.`;
  return { dev, total, coins, rugs, dead, ran, sellS, sellX, line };
}

/** the market of the last 5 minutes, from 10 s steps [step, close, high, low, buys, sells, SOL in, SOL out] */
export function pulseOf(steps: number[][], nowStep: number, wallets1m: number | null, solUsd: number): Pulse {
  const closeAt = (s: number) => {
    let c: number | null = null;
    for (const x of steps) if (x[0] <= s) c = x[1];
    return c;
  };
  const last = steps.filter((x) => x[0] > nowStep - 6);
  const prev = steps.filter((x) => x[0] > nowStep - 30 && x[0] <= nowStep - 6);
  const now = closeAt(nowStep);
  const ago1 = closeAt(nowStep - 6);
  const ago5 = closeAt(nowStep - 30) ?? steps[0]?.[1] ?? null;
  const buys1m = last.reduce((a, x) => a + x[4], 0);
  const sells1m = last.reduce((a, x) => a + x[5], 0);
  const trades1m = buys1m + sells1m;
  const prevRate = prev.reduce((a, x) => a + x[4] + x[5], 0) / 4;
  const vol = last.reduce((a, x) => a + x[6] + x[7], 0);
  const ch1m = now && ago1 ? now / ago1 - 1 : null;
  const ch5m = now && ago5 ? now / ago5 - 1 : null;
  const share = trades1m ? buys1m / trades1m : 0;
  let state: Pulse["state"] = "steady";
  if (trades1m < 4) state = "quiet";
  else if ((ch1m ?? 0) >= 0.08 && share >= 0.55 && trades1m >= Math.max(8, prevRate * 1.3) && (wallets1m ?? 99) >= 6) state = "hot";
  else if ((ch1m ?? 0) <= -0.08 || share < 0.4) state = "cooling";
  return { state, ch1m, ch5m, trades1m, buys1m, sells1m, wallets1m, vol1mUsd: solUsd ? vol * solUsd : null };
}

/** the same from DexScreener's 5-minute and 1-hour counts, for coins past pump.fun's curve */
export function pulseOutside(o: { m5: { buys: number; sells: number } | null; h1: { buys: number; sells: number } | null; ch5: number | null; vol5?: number | null }): Pulse {
  const b = o.m5?.buys ?? 0;
  const s = o.m5?.sells ?? 0;
  const n = b + s;
  const rate1h = o.h1 ? (o.h1.buys + o.h1.sells) / 12 : 0;
  const ch5 = o.ch5 != null ? o.ch5 / 100 : null;
  let state: Pulse["state"] = "steady";
  if (n < 5) state = "quiet";
  else if ((ch5 ?? 0) >= 0.08 && b >= s * 1.2 && n >= Math.max(20, rate1h * 1.3)) state = "hot";
  else if ((ch5 ?? 0) <= -0.08 || s > b * 1.5) state = "cooling";
  return { state, ch1m: null, ch5m: ch5, trades1m: Math.round(n / 5), buys1m: Math.round(b / 5), sells1m: Math.round(s / 5), wallets1m: null, vol1mUsd: o.vol5 != null ? o.vol5 / 5 : null };
}

const x = (v: number) => `×${v >= 10 ? v.toFixed(0) : v.toFixed(1)}`;
export const mins = (s: number) => (s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)}m`);

/** the call: safety first, then the creator, then the moment */
export function decide(a: {
  checks: Check[];
  creator: Creator | null;
  dev: DevNow | null;
  ageS: number | null;
  priceX: number | null; // price now / launch (pump.fun coins)
  athX: number | null;
  pulse: Pulse | null;
  outsideNo: string | null; // a market reason to stay out, for coins past the curve
}): Decision {
  const bad = a.checks.find((c) => !c.ok);
  if (bad) return { word: "Don't buy", tone: "down", why: bad.label };
  const c = a.creator;
  if (c && c.rugs >= 2 && c.rugs >= c.coins.length / 2) return { word: "Don't buy", tone: "down", why: `This creator rugged ${c.rugs} of their last ${c.coins.length} coins.` };
  if (a.dev?.out && (a.ageS ?? 1e9) < 3600) return { word: "Don't buy", tone: "down", why: "The creator already sold everything." };
  if (a.outsideNo) return { word: "Don't buy", tone: "down", why: a.outsideNo };
  if (a.priceX != null && a.athX != null && a.athX > 1.5 && a.priceX < a.athX * 0.4)
    return { word: "Don't buy", tone: "down", why: `Already dumped ${Math.round((1 - a.priceX / a.athX) * 100)}% from its high.` };
  if (a.priceX != null && a.priceX < 1.05 && (a.ageS ?? 0) > 180) return { word: "Don't buy", tone: "down", why: "Back at its launch price. The buyers left." };
  if ((a.ageS ?? 1e9) < 30 || !a.pulse) return { word: "Too early", tone: "learn", why: "Just launched. Give it 30 seconds." };
  const p = a.pulse;
  // the creator's habit, when there is one: where they usually sell, against where the price is now
  const habit =
    c?.sellX != null && c.sellS != null && a.priceX != null
      ? a.priceX >= c.sellX * 0.85
        ? ` Careful: this creator usually sells around ${x(c.sellX)}. It's at ${x(a.priceX)}.`
        : ` This creator usually sells around ${x(c.sellX)}, after ${mins(c.sellS)}.`
      : "";
  if (p.state === "hot") {
    const ch = p.ch1m != null ? `+${Math.round(p.ch1m * 100)}% in 1 min` : p.ch5m != null ? `+${Math.round(p.ch5m * 100)}% in 5 min` : "buyers piling in";
    const w = p.wallets1m ? `, ${p.wallets1m} wallets` : "";
    return { word: "Momentum", tone: "up", why: `Buyers are in now: ${ch}${w}.${habit}` };
  }
  if (p.state === "quiet") return { word: "Wait", tone: "mid", why: "Almost no trades right now. Wait for volume." };
  if (p.state === "cooling") return { word: "Wait", tone: "mid", why: `Sellers are in control. Wait for the next push.${habit}` };
  return { word: "Wait", tone: "mid", why: `No clear push yet.${habit}` };
}
