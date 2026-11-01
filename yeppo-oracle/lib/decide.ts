// What yeppo says about a coin, for a short-term trade: is it safe, what did its creator do before, and is
// this a good moment. Pure functions, shared by /api/read and the pages.

export const LAUNCH_MC = 27.96; // SOL, market cap of a fresh pump.fun curve

export type Check = { ok: boolean; label: string };
export type Tone = "up" | "mid" | "down" | "learn";
export type Decision = { word: "Momentum" | "Wait" | "Don't buy" | "Too early" | "Locked"; tone: Tone; why: string };


/** how one of the creator's earlier coins ended: rugged (the creator's sells crashed it in seconds), faded (died
 *  slowly, nobody dumped it), ran (×3 or more) or graduated */
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
  rugS: number | null; // seconds from launch to the dump
  rugDrop: number | null; // how far the dump took the price, 0.9 = -90%
  path: number[] | null; // price / launch, every 30 s for the first 20 minutes
};

export type Creator = {
  dev: string;
  total: number; // coins yeppo saw from this creator (14 days)
  coins: PastCoin[]; // the latest 30, newest first
  rugs: number;
  dead: number;
  ran: number;
  best: PastCoin | null;
  /** typical moment the creator sells: median of their first sells */
  sellS: number | null;
  sellX: number | null;
  line: string; // the one sentence that sums them up
};

/** this coin's creator, right now */
export type DevNow = {
  bought: boolean;
  sold: boolean;
  out: boolean;
  soldS: number | null;
  soldX: number | null;
  rugS: number | null;
  rugDrop: number | null;
};

/** the bigger picture, for coins that have been trading a while: changes over several timeframes, who leads, and
 *  whether activity is picking up or fading */
export type Outlook = {
  bias: "bullish" | "bearish" | "neutral";
  tf: { k: string; v: number | null }[]; // price changes, 0.35 = +35%
  buyShare: number | null; // buys / trades
  heat: number | null; // trade pace now / the usual pace (1 = same)
  line: string;
};

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

/** [mint, sym, t0, n, ath, ath_s, mc, dev_buy, dev_sell, sold_s, sold_mc, out_s, grad, p, mc0, rug_s, rug_drop] from yr_creator */
export type CoinRow = [
  string, string | null, number, number, number, number | null, number | null, number, number, number | null, number | null, number | null, boolean,
  number[] | null, number | null, number | null, number | null,
];

/** a coin's launch market cap: its own when yeppo saw it launch, else the usual pump.fun one (or its first price,
 *  when the curve plainly started lower) */
export function launchOf(mc0: number | null | undefined, p?: number[] | null) {
  if (mc0 && mc0 > 0) return mc0;
  if (p?.length && p[0] > 0 && p[0] < LAUNCH_MC * 0.8) return p[0];
  return LAUNCH_MC;
}

const med = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function fateOf(r: CoinRow, now: number): Fate | null {
  const [, , t0, , ath, , , , , , , , grad] = r;
  if (grad) return "grad";
  if (r[15] != null) return "rug";
  if (now - t0 < 20 * 60_000) return null; // still running: no verdict yet
  if (ath / launchOf(r[14], r[13]) >= 3) return "ran";
  return "dead";
}

export function creatorOf(dev: string, total: number, rows: CoinRow[], now: number): Creator {
  const coins: PastCoin[] = [];
  for (const r of rows) {
    const fate = fateOf(r, now);
    if (!fate) continue;
    const base = launchOf(r[14], r[13]);
    coins.push({
      mint: r[0],
      sym: r[1],
      t0: r[2],
      fate,
      peak: r[4] / base,
      peakS: r[5],
      soldS: r[9],
      soldX: r[10] != null ? r[10] / base : null,
      rugS: r[15],
      rugDrop: r[16],
      // a path that never moved carries no information (a coin nobody traded, or missing data)
      path: r[13]?.length && Math.max(...r[13]) - Math.min(...r[13]) > 0.6 ? r[13].map((v) => v / base) : null,
    });
  }
  const rugs = coins.filter((c) => c.fate === "rug").length;
  const ran = coins.filter((c) => c.fate === "ran" || c.fate === "grad").length;
  const dead = coins.length - rugs - ran;
  const best = coins.reduce<PastCoin | null>((b, c) => (c.peak > (b?.peak ?? 0) ? c : b), null);
  const sells = coins.filter((c) => c.soldS != null && c.soldS < 3600);
  const sellS = med(sells.map((c) => c.soldS!));
  const sellX = med(sells.filter((c) => c.soldX != null).map((c) => c.soldX!));
  let line: string;
  if (total >= FARM) line = `Coin farm: ${total} coins launched in 14 days.`;
  else if (!coins.length) line = total > 1 ? "Their other coins are too new to judge." : "First coin yeppo has seen from this creator.";
  else if (isRugger({ rugs, coins })) line = `Serial rugger: dumped ${rugs} of ${coins.length} coins in seconds.`;
  else {
    line = `${coins.length} coin${coins.length > 1 ? "s" : ""}: ${ran} ran, ${rugs} rugged, ${dead} faded.`;
    if (best && best.peak >= 2) line += ` Best ${x(best.peak)}${best.fate === "grad" ? ", graduated" : ""}.`;
  }
  return { dev, total, coins, rugs, dead, ran, best, sellS, sellX, line };
}

/** a wallet that launches coins nonstop is a bot farm, whatever each coin did */
const FARM = 40;
/** dumped at least two coins, and at least 40% of the ones that had time to play out */
const isRugger = (c: { rugs: number; coins: unknown[] }) => c.rugs >= 2 && c.rugs >= c.coins.length * 0.4;

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

function bias(score: number): Outlook["bias"] {
  return score >= 1.5 ? "bullish" : score <= -1.5 ? "bearish" : "neutral";
}
const pctS = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))}%`;

function outlookLine(o: Omit<Outlook, "line">, trend: string): string {
  const parts = [trend];
  if (o.buyShare != null) parts.push(o.buyShare >= 0.55 ? `Buyers lead (${Math.round(o.buyShare * 100)}%).` : o.buyShare <= 0.45 ? `Sellers lead (${Math.round((1 - o.buyShare) * 100)}%).` : "Buyers and sellers even.");
  if (o.heat != null) parts.push(o.heat >= 1.4 ? "Activity picking up." : o.heat <= 0.5 ? "Activity fading." : "");
  parts.push(o.bias === "bullish" ? "Bias: up. Dips have been bought." : o.bias === "bearish" ? "Bias: down. Bounces get sold." : "No clear trend: it's ranging.");
  return parts.filter(Boolean).join(" ");
}

/** from DexScreener: 5 m, 1 h, 6 h and 24 h */
export function outlookOutside(o: {
  ch5: number | null; ch1: number | null; ch6: number | null; ch24: number | null;
  m5: { buys: number; sells: number } | null; h1: { buys: number; sells: number } | null;
}): Outlook {
  const f = (v: number | null) => (v == null ? null : v / 100);
  const tf = [{ k: "5m", v: f(o.ch5) }, { k: "1h", v: f(o.ch1) }, { k: "6h", v: f(o.ch6) }, { k: "24h", v: f(o.ch24) }];
  const h1n = o.h1 ? o.h1.buys + o.h1.sells : 0;
  const buyShare = h1n >= 10 ? o.h1!.buys / h1n : null;
  const heat = h1n >= 12 && o.m5 ? ((o.m5.buys + o.m5.sells) * 12) / h1n : null;
  const h1 = f(o.ch1) ?? 0;
  const h6 = f(o.ch6) ?? 0;
  let score = 0;
  score += h1 >= 0.1 ? 1 : h1 <= -0.1 ? -1 : 0;
  score += h6 >= 0.2 ? 1 : h6 <= -0.2 ? -1 : 0;
  if (buyShare != null) score += buyShare >= 0.55 ? 1 : buyShare <= 0.45 ? -1 : 0;
  if (heat != null && (f(o.ch5) ?? 0) !== 0) score += (heat >= 1.4 ? 0.5 : heat <= 0.5 ? -0.5 : 0) * Math.sign(f(o.ch5)!);
  const b = { bias: bias(score), tf, buyShare, heat };
  const trend =
    o.ch1 == null && o.ch6 == null
      ? "No price history for this pool on DexScreener yet."
      : Math.abs(h1) < 0.05 && Math.abs(h6) < 0.1
        ? "Flat over the last hours."
        : `${h1 >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(h1 * 100))}% in 1h, ${pctS(h6)} in 6h.`;
  return { ...b, line: outlookLine(b, trend) };
}

/** from yeppo's own trades on the curve: the last 1, 5 and 20 minutes and since launch */
export function outlookCurve(steps: number[][], nowStep: number, priceX: number | null, athX: number | null): Outlook {
  const closeAt = (st: number) => {
    let c: number | null = null;
    for (const z of steps) if (z[0] <= st) c = z[1];
    return c;
  };
  const now = closeAt(nowStep);
  const ch = (back: number) => {
    // a coin younger than the window: from its first price
    const a = closeAt(nowStep - back) ?? steps[0]?.[1] ?? null;
    return now && a ? now / a - 1 : null;
  };
  const tf = [{ k: "1m", v: ch(6) }, { k: "5m", v: ch(30) }, { k: "20m", v: ch(120) }, { k: "launch", v: priceX != null ? priceX - 1 : null }];
  const buys = steps.reduce((q, z) => q + z[4], 0);
  const all = steps.reduce((q, z) => q + z[4] + z[5], 0);
  const buyShare = all >= 10 ? buys / all : null;
  const last = steps.filter((z) => z[0] > nowStep - 6).reduce((q, z) => q + z[4] + z[5], 0);
  const span = Math.max(6, nowStep - (steps[0]?.[0] ?? nowStep));
  const heat = all >= 12 ? (last / 6) / (all / span) : null;
  const m5 = tf[1].v ?? 0;
  const m20 = tf[2].v ?? 0;
  let score = 0;
  score += m5 >= 0.1 ? 1 : m5 <= -0.1 ? -1 : 0;
  score += m20 >= 0.2 ? 1 : m20 <= -0.2 ? -1 : 0;
  if (buyShare != null) score += buyShare >= 0.55 ? 1 : buyShare <= 0.45 ? -1 : 0;
  if (priceX != null && athX != null && athX > 1.5) score += priceX >= athX * 0.85 ? 0.5 : priceX < athX * 0.6 ? -0.5 : 0;
  const b = { bias: bias(score), tf, buyShare, heat };
  const off = priceX != null && athX != null && athX > 1.2 ? ` ${Math.round((1 - priceX / athX) * 100)}% under its high.` : "";
  const trend = `${pctS(m5)} in 5 min, ${pctS(m20)} in 20 min.${off}`;
  return { ...b, line: outlookLine(b, trend) };
}

const x = (v: number) => `×${v >= 10 ? v.toFixed(0) : v.toFixed(1)}`;
export const mins = (s: number) => (s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)}m`);

/** why a push is not a Momentum yet. From yeppo's own trades (31 Oct): pushes in a coin's first 2 minutes, in coins
 *  whose creator is already selling or whose launch bundle took 15%+, and one-minute candles of +50% or more mostly
 *  dumped within 3 minutes (median -26%, half of them -30% or worse); the pushes left (median +4%, 15% dumped) are
 *  the ones worth a Momentum. */
export function momentumBlock(a: { ageS: number | null; ch1m: number | null; devSold: boolean; bun0: number | null }): string | null {
  if (a.ageS != null && a.ageS < 120) return "Launch rush: most coins dump after their first 2 minutes. Wait until it holds.";
  if (a.ch1m != null && a.ch1m >= 0.5) return `Already +${Math.round(a.ch1m * 100)}% in a minute: don't chase the candle. Wait for a pullback.`;
  if (a.devSold && (a.ageS ?? 1e9) < 3600) return "The creator is selling: pushes get sold into. Wait.";
  if ((a.bun0 ?? 0) >= 0.15) return "The launch bundle took 15%+ at launch: they sell into pushes. Wait.";
  return null;
}

/** the call: safety first, then the creator, then the moment and the bigger picture */
export function decide(a: {
  checks: Check[];
  creator: Creator | null;
  dev: DevNow | null;
  ageS: number | null;
  priceX: number | null; // price now / launch (pump.fun coins)
  athX: number | null;
  pulse: Pulse | null;
  outlook: Outlook | null;
  outsideNo: string | null; // a market reason to stay out, for coins past the curve
  bun0?: number | null; // share the launch bundle took at launch
}): Decision {
  const bad = a.checks.find((c) => !c.ok);
  if (bad) return { word: "Don't buy", tone: "down", why: bad.label };
  if (a.dev?.rugS != null)
    return { word: "Don't buy", tone: "down", why: `The creator dumped this coin: ${pctS(-(a.dev.rugDrop ?? 0.6))} in seconds.` };
  const c = a.creator;
  if (c && c.total >= FARM) return { word: "Don't buy", tone: "down", why: `This creator launched ${c.total} coins. It's a coin farm.` };
  if (c && isRugger(c)) return { word: "Don't buy", tone: "down", why: `This creator dumped ${c.rugs} of their last ${c.coins.length} coins in seconds.` };
  if (a.outsideNo) return { word: "Don't buy", tone: "down", why: a.outsideNo };
  if (a.priceX != null && a.athX != null && a.athX > 1.5 && a.priceX < a.athX * 0.4)
    return { word: "Don't buy", tone: "down", why: `Already dumped ${Math.round((1 - a.priceX / a.athX) * 100)}% from its high.` };
  if (a.priceX != null && a.priceX < 1.05 && (a.ageS ?? 0) > 180) return { word: "Don't buy", tone: "down", why: "Back at its launch price. The buyers left." };
  if ((a.ageS ?? 1e9) < 30 || !a.pulse) return { word: "Too early", tone: "learn", why: "Just launched. Give it 30 seconds." };
  const p = a.pulse;
  const o = a.outlook;
  const devOut = !!a.dev?.out && (a.ageS ?? 1e9) < 3600;
  // the creator's habit, when there is one: where they usually sell, against where the price is now
  const habit = devOut
    ? " The creator already sold: it's the crowd now. Keep it short."
    : c?.sellX != null && c.sellS != null && a.priceX != null
      ? a.priceX >= c.sellX * 0.85
        ? ` Careful: this creator usually sells around ${x(c.sellX)}. It's at ${x(a.priceX)}.`
        : ` This creator usually sells around ${x(c.sellX)}, after ${mins(c.sellS)}.`
      : "";
  const block = momentumBlock({ ageS: a.ageS, ch1m: p.ch1m, devSold: !!a.dev?.sold, bun0: a.bun0 ?? null });
  if (block && (p.state === "hot" || (o?.bias === "bullish" && p.state !== "cooling" && p.state !== "quiet")))
    return { word: "Wait", tone: "mid", why: block };
  if (p.state === "hot") {
    const ch = p.ch1m != null ? `+${Math.round(p.ch1m * 100)}% in 1 min` : p.ch5m != null ? `+${Math.round(p.ch5m * 100)}% in 5 min` : "buyers piling in";
    const w = p.wallets1m ? `, ${p.wallets1m} wallets` : "";
    return { word: "Momentum", tone: "up", why: `Buyers are in now: ${ch}${w}.${habit}` };
  }
  // the bigger picture decides when this minute is not decisive
  if (o?.bias === "bullish" && p.state !== "cooling" && p.state !== "quiet")
    return { word: "Momentum", tone: "up", why: `Uptrend: ${o.line}${habit}` };
  if (o?.bias === "bullish")
    return { word: "Wait", tone: "mid", why: `Uptrend, pausing now. Wait for buyers to step back in. ${o.line}` };
  if (o?.bias === "bearish" && p.state !== "steady")
    return { word: "Don't buy", tone: "down", why: `Downtrend and no buyers stepping in. ${o.line}` };
  if (o?.bias === "bearish") return { word: "Wait", tone: "mid", why: `Downtrend. Wait until it turns. ${o.line}` };
  if (p.state === "quiet") return { word: "Wait", tone: "mid", why: `Almost no trades right now. Wait for volume.${o ? ` ${o.line}` : ""}` };
  return { word: "Wait", tone: "mid", why: `No clear push yet.${habit}${o ? ` ${o.line}` : ""}` };
}
