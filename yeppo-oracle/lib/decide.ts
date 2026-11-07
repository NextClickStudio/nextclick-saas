// What yeppo says about a coin, for a short-term trade: is it safe, what did its creator do before, and is
// this a good moment. Pure functions, shared by /api/read and the pages.

export const LAUNCH_MC = 27.96; // SOL, market cap of a fresh pump.fun curve

export type Check = { ok: boolean; label: string };
export type Tone = "up" | "mid" | "down" | "learn";
export type Decision = {
  word: "Safe" | "Risky" | "Danger" | "Momentum" | "Opportunity" | "Wait" | "Don't buy" | "Too early" | "Locked";
  tone: Tone;
  why: string;
  /** an Opportunity on a pullback in an uptrend: the quiet minute is the point, so the live read keeps it */
  pullback?: boolean;
};


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

/** who could dump the coin on a buyer (yr_risk), shares of the 1B supply. full: the coin is under 20 minutes old and
 *  yeppo saw every trade, so the holdings are exact; older coins only get the dumpers and the sellers. top1: the
 *  biggest single holder RugCheck sees (pools and lockers left out), for coins of any age. */
export type Risk = {
  full: boolean;
  /** real top holders with 3%+ that aren't the creator or the launch bundle: they count in the insiders */
  big?: number;
  snipers: number; // wallets whose first buy landed within 15 s of launch (the creator left out)
  sniperHeld: number; // what they still hold
  sniperTook: number; // what they bought
  topHeld: number; // the biggest wallet yeppo saw buy, the creator left out
  dumpers: number; // wallets that bought 3%+ and sold half or more of it in the last 3 minutes
  dumped: number;
  sell2: number; // SOL sold in the last 2 minutes
  topSell2: number; // by the biggest seller
  smart: number; // proven wallets holding it
  top10Held?: number; // the 10 biggest wallets yeppo saw buy, the creator left out
  out?: number | null; // supply that has left the curve: what all holders together can hold
  /** supply that left pump.fun's curve without anyone seen buying it: held by a launch bundle, however many wallets */
  hidden?: number | null;
  top1?: number | null;
  /** creator + bundle + snipers together: who can dump it at once (filled by the read) */
  insiders?: number | null;
  /** launched by a tweet-deploy bot (J7Tracker, uxento, rapidlaunch...): bundled two times out of three */
  bot?: boolean;
  bun?: number | null; // launch bundle share
  /** what the creator still holds (filled by the read) */
  dev?: number | null;
  /** top traders (kolscan, best 30 days) and yeppo-proven wallets that bought it in yeppo's 20-minute window */
  kols?: Kol[];
  /** the 10 biggest holders of 90 seconds ago: address, share bought, held now, sold in the last 90 s */
  tops?: Top[];
};

export type Top = { w: string; b: number; h: number; s90: number };

/** the biggest holders selling a real part of their bag right now (half a percent of the supply and a quarter of
 *  what they had, at least): the plain words for it, or null */
export function topSelling(tops: { had: number; sold: number }[]): string | null {
  // a real exit, not profit-taking: 1% of the supply and 40% of the bag in 90 s; several at once, 3%+ together
  const s = tops.filter((t) => t.sold >= 0.01 && t.sold >= t.had * 0.4);
  if (!s.length) return null;
  const pc = (v: number) => `${Math.max(1, Math.round(v * 100))}%`;
  const sold = s.reduce((a, t) => a + t.sold, 0);
  if (s.length > 1 && sold < 0.03) return null;
  if (s.length > 1) return `${s.length} of the 10 biggest holders are selling: ${pc(sold)} of the supply just now.`;
  const t = s[0];
  return t.sold >= t.had * 0.95
    ? `A top holder just sold everything: ${pc(t.sold)} of the supply.`
    : `A top holder is selling: ${pc(t.sold / t.had)} of their bag (${pc(t.sold)} of the supply).`;
}

/** a top trader on the coin: name ("" for a yeppo-proven wallet), SOL put in, share of their buy still held, seconds
 *  after launch they came in */
export type Kol = { n: string; sol: number; left: number; s: number | null };

/** the moment to get out, from facts only: the creator selling now, a big early holder dumping, or every top trader
 *  who came in gone. Null while none of them is true. */
export function exitOf(r: Risk | null | undefined, dev: DevNow | null, ageS: number | null): string | null {
  if (dev?.soldS != null && !dev.out && ageS != null && ageS - dev.soldS < 120 && (r?.dev ?? 0) >= 0.03)
    return `Possible creator sell: at the last check they still held ${Math.round((r?.dev ?? 0) * 100)}%.`;
  const tops = topSelling((r?.tops ?? []).map((t) => ({ had: t.h + t.s90, sold: t.s90 })));
  if (tops) return tops;
  if (r && r.dumpers > 0 && r.dumped >= 0.03)
    return `A big early holder is selling: ${Math.round(r.dumped * 100)}% of the supply sold in 3 minutes.`;
  const named = (r?.kols ?? []).filter((k) => k.n && k.sol >= 0.5);
  if (named.length && named.every((k) => k.left <= 0.2)) {
    const who = named.slice(0, 3).map((k) => k.n).join(", ");
    return `${named.length > 1 ? "Every top trader is" : `Top trader ${who} is`} out${named.length > 1 ? ` (${who})` : ""}.`;
  }
  return null;
}

/** metadata hosts of the tools that launch coins from posts in one click */
export const BOT_HOSTS = /(^|\.)(j7tracker\.io|uxento\.io|rapidlaunch\.io|thecompanysol\.fun|sdfgsdfsdf\.uk|levitatingbananatree\.xyz|mwmwmwmwmwmwmwmwmw\.uk|gg\.sc)$/i;
export const botLaunched = (uri: string | null | undefined) => {
  try {
    return !!uri && BOT_HOSTS.test(new URL(uri).hostname);
  } catch {
    return false;
  }
};

/** the top 10 against what is in circulation: on a coin that ran, 65% of the supply is out of the curve and early
 *  buyers holding 38% of it is normal (Valerie, +657%); a top 10 holding nearly all of it is not */
export function top10Heavy(r: Risk | null | undefined): "no" | "wait" | null {
  if (!r?.full || r.top10Held == null) return null;
  const share = r.out && r.out > 0.05 ? Math.min(1, r.top10Held / r.out) : null;
  if (share == null) return r.top10Held >= 0.5 ? "no" : null;
  if (r.top10Held >= 0.35 && share >= 0.75) return "no";
  if (r.top10Held >= 0.25 && share >= 0.65) return "wait";
  return null;
}

/** a reason the coin can't be a Momentum because of who holds it: snipers, one big wallet, a big holder selling */
export function holderBlock(r: Risk | null | undefined): { no: boolean; why: string; watch?: string } | null {
  if (!r) return null;
  const pc = (v: number) => `${Math.round(v * 100)}%`;
  const ins = r.insiders ?? 0;
  if ((r.hidden ?? 0) >= 0.4)
    return { no: true, why: `Hidden bundle: ${pc(r.hidden!)} of the supply was taken at launch by wallets nobody saw buy. They can dump it in one block.` };
  // under 20% held by insiders (creator, bundle, snipers, on real balances) is the safe zone; 35%+ can crash it at once
  if (ins >= 0.35) return { no: true, why: `Insiders hold ${pc(ins)}: creator, launch bundle and snipers can dump it together.` };
  if (r.bot && ((r.bun ?? 0) >= 0.1 || ins >= 0.2))
    return { no: true, why: `Launched by a tweet-deploy bot with insiders on ${pc(Math.max(ins, r.bun ?? 0))}. These dump to zero in one block.` };
  const t10 = top10Heavy(r);
  if (t10 === "no") return { no: true, why: `The 10 biggest wallets hold ${pc(r.top10Held!)}, almost all of what is in circulation. They can crash it at once.` };
  // a big early holder selling is a reason to wait (and the Exit alert), not a trap: what they sold is already out
  if (r.dumpers > 0 && r.dumped >= 0.03)
    return {
      no: false,
      why: `A big early holder is selling: ${r.dumpers > 1 ? `${r.dumpers} wallets` : "one wallet"} sold ${pc(r.dumped)} of the supply in 3 minutes. Wait until it's done.`,
      watch: `A big early holder took profit (${pc(r.dumped)} of the supply).`,
    };
  if (r.full && r.sniperHeld >= 0.25) return { no: true, why: `Snipers still hold ${pc(r.sniperHeld)}: ${r.snipers} wallets bought in the first 15 seconds and sell into the first push.` };
  const top = Math.max(r.full ? r.topHeld : 0, r.top1 ?? 0);
  if (top >= 0.15) return { no: true, why: `One wallet holds ${pc(top)}. It can crash the price on its own.` };
  if (r.sell2 >= 2 && r.topSell2 >= r.sell2 * 0.6) return { no: false, why: `One wallet made ${pc(r.topSell2 / r.sell2)} of the selling in the last 2 minutes. Wait until it's done.` };
  // snipers count inside the insiders: under 20% all together is the safe zone, whoever holds it (4 Nov 2026: a coin
  // with snipers at 16% and insiders under 20% showed "safe zone" and a Wait at once)
  if (ins >= 0.2) return { no: false, why: `Insiders hold ${pc(ins)}. Wait: they can dump a push together.` };
  if ((r.hidden ?? 0) >= 0.2) return { no: false, why: `${pc(r.hidden!)} of the supply was taken at launch by wallets nobody saw buy. Wait.` };
  if (t10 === "wait")
    return { no: false, why: `The 10 biggest wallets hold ${pc(r.top10Held!)}, most of what is in circulation. Wait.`, watch: `The 10 biggest wallets hold ${pc(r.top10Held!)}: yeppo tells you the second one sells.` };
  if (top >= 0.08) return { no: false, why: `One wallet holds ${pc(top)}. Wait: it can dump a push.`, watch: `One wallet holds ${pc(top)}: yeppo tells you the second it sells.` };
  return null;
}

/** the holder checks shown under Safety */
export function holderChecks(r: Risk | null | undefined): Check[] {
  if (!r) return [];
  const pc = (v: number) => `${Math.round(v * 100)}%`;
  const out: Check[] = [];
  if (r.full)
    out.push(
      r.snipers === 0
        ? { ok: true, label: "No snipers in the first 15 seconds" }
        : r.sniperHeld < 0.15
          ? { ok: true, label: `Snipers hold ${pc(r.sniperHeld)} (${r.snipers} wallets, took ${pc(r.sniperTook)})` }
          : (r.insiders ?? 0) < 0.2 && r.sniperHeld < 0.25
            ? { ok: true, label: `Snipers hold ${pc(r.sniperHeld)} (${r.snipers} wallets): inside the safe zone, watch them on the first push` }
            : { ok: false, label: `Snipers hold ${pc(r.sniperHeld)} (${r.snipers} wallets). They dump into pushes.` },
    );
  const top = Math.max(r.full ? r.topHeld : 0, r.top1 ?? 0);
  if (r.full || r.top1 != null) out.push({ ok: top < 0.08, label: top < 0.08 ? `Biggest wallet holds ${pc(top)}` : `One wallet holds ${pc(top)}. It can crash it.` });
  if (r.hidden != null) out.push({ ok: r.hidden < 0.2, label: r.hidden < 0.2 ? `No hidden launch bundle (${pc(r.hidden)})` : `Hidden launch bundle: ${pc(r.hidden)} of the supply. Can dump in one block.` });
  if (r.insiders != null) out.push({ ok: r.insiders < 0.2, label: r.insiders < 0.2 ? `Insiders hold ${pc(r.insiders)} together` : `Insiders hold ${pc(r.insiders)} together. They can dump at once.` });
  if (r.full && r.top10Held != null) out.push({ ok: top10Heavy(r) == null, label: `Top 10 wallets hold ${pc(r.top10Held)}${r.out ? ` of ${pc(r.out)} in circulation` : ""}` });
  if (r.bot) out.push({ ok: (r.bun ?? 0) < 0.1 && (r.insiders ?? 0) < 0.2, label: "Launched by a tweet-deploy bot" });
  if (r.dumpers > 0 && r.dumped >= 0.03) out.push({ ok: false, label: `Big holder selling: ${pc(r.dumped)} sold in 3 min.` });
  if (r.smart > 0) out.push({ ok: true, label: `${r.smart} proven wallet${r.smart > 1 ? "s" : ""} hold${r.smart > 1 ? "" : "s"} it` });
  return out;
}

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
  if (total >= FARM) {
    const hits = farmHits(coins);
    line = deadFarm({ total, coins })
      ? `Coin farm: ${total} coins in 14 days, none of them took off.`
      : `Coin farm: ${total} coins in 14 days, ${hits} of the last ${coins.length} went ×5 or graduated.`;
  }
  else if (!coins.length) line = total > 1 ? "Their other coins are too new to judge." : "First coin yeppo has seen from this creator.";
  else if (isRugger({ rugs, coins })) line = `Serial rugger: dumped ${rugs} of ${coins.length} coins in seconds.`;
  else {
    line = `${coins.length} coin${coins.length > 1 ? "s" : ""}: ${ran} ran, ${rugs} rugged, ${dead} faded.`;
    if (best && best.peak >= 2) line += ` Best ${x(best.peak)}${best.fate === "grad" ? ", graduated" : ""}.`;
  }
  return { dev, total, coins, rugs, dead, ran, best, sellS, sellX, line };
}

/** a wallet that launches coins nonstop: a bot farm */
const FARM = 40;
const farmHits = (coins: PastCoin[]) => coins.filter((c) => c.fate === "grad" || c.peak >= 5).length;
/** a farm whose coins never take off. Not every farm: measured on 14 days of coins (3 Nov 2026), farms whose coins went
 *  ×5 or graduated at least 1 time in 20 made ×5 9.0% of the time and graduated 2.2% (other creators: 10.8% and 3.4%);
 *  farms below that made ×5 1-5% of the time and graduated 0.3-1.1%. Only those are a Don't buy. */
export const deadFarm = (c: { total: number; coins: PastCoin[] }) =>
  c.total >= FARM && c.coins.length >= 10 && farmHits(c.coins) < c.coins.length * 0.05;
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
  if (a.ageS == null) return "yeppo can't tell how old this coin is yet, so it can't check its launch. Wait a minute.";
  // (the "launch rush" wait of a coin's first 2 minutes is gone, 4 Nov 2026: the user found it held good coins back;
  // insiders, snipers and the chase rule below still guard those minutes)
  if (a.ch1m != null && a.ch1m >= 0.5) return `Already +${Math.round(a.ch1m * 100)}% in a minute: don't chase the candle. Wait for a pullback.`;
  // the creator selling is not a reason on its own (3 Nov 2026, 1,750 coins: at 60 s, coins whose creator sold ran ×2
  // 12% of the time against 8%, and fell 50% 27% against 31%): it only kept good coins at Wait
  if ((a.bun0 ?? 0) >= 0.2) return "Possible bundle selling: the launch bundle took 20%+ and may sell into pushes. Wait.";
  return null;
}

/** a clean coin with buyers in and one holder to keep an eye on: an Opportunity, not a Wait */
export const possible = (watch: string): Decision => ({ word: "Opportunity", tone: "up", why: `Clean coin, buyers are in. One thing to watch: ${watch.charAt(0).toLowerCase()}${watch.slice(1)}` });

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
  risk?: Risk | null; // who could dump it: snipers, one big wallet, a big holder selling
}): Decision {
  const bad = a.checks.find((c) => !c.ok);
  if (bad) return { word: "Don't buy", tone: "down", why: bad.label };
  if (a.dev?.rugS != null)
    return { word: "Don't buy", tone: "down", why: `The creator dumped this coin: ${pctS(-(a.dev.rugDrop ?? 0.6))} in seconds.` };
  const c = a.creator;
  // a coin farm is information, not a verdict: the creator line says it, and the odds of coins like this one (lower for
  // farms whose coins never take off) weigh it
  if (c && isRugger(c)) return { word: "Don't buy", tone: "down", why: `This creator dumped ${c.rugs} of their last ${c.coins.length} coins in seconds.` };
  if (a.outsideNo) return { word: "Don't buy", tone: "down", why: a.outsideNo };
  if (a.priceX != null && a.athX != null && a.athX > 1.5 && a.priceX < a.athX * 0.4)
    return { word: "Don't buy", tone: "down", why: `Already dumped ${Math.round((1 - a.priceX / a.athX) * 100)}% from its high.` };
  if (a.priceX != null && a.priceX < 1.05 && (a.ageS ?? 0) > 180) return { word: "Don't buy", tone: "down", why: "Back at its launch price. The buyers left." };
  const hb = holderBlock(a.risk);
  if (hb?.no) return { word: "Don't buy", tone: "down", why: hb.why };
  // the real call as soon as the coin trades (every red flag above has already said Don't buy); only before its first
  // trades, or in its first 8 seconds (its second block may still be landing), an early read of what is known
  if ((a.ageS ?? 1e9) < 8 || !a.pulse) {
    const s = a.ageS != null ? Math.max(0, Math.round(a.ageS)) : null;
    const ins = a.risk?.insiders;
    const parts = [
      ins != null ? `insiders ${Math.round(ins * 100)}% so far` : null,
      c ? (c.total <= 1 ? "creator's first coin" : `creator: ${c.total} coins, ${c.ran} ran, ${c.rugs} rugged`) : null,
      hb?.watch ?? null,
    ].filter(Boolean);
    return {
      word: "Too early",
      tone: "learn",
      why: `Early read${s != null ? ` (${s}s)` : ""}: nothing wrong so far${parts.length ? `: ${parts.join(", ")}` : ""}. The full call comes with its first trades, in a few seconds.`,
    };
  }
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
  const mb = momentumBlock({ ageS: a.ageS, ch1m: p.ch1m, devSold: !!a.dev?.sold, bun0: a.bun0 ?? null });
  const block = mb ?? hb?.why ?? null;
  if (block && (p.state === "hot" || (o?.bias === "bullish" && p.state !== "cooling" && p.state !== "quiet")))
    // only who holds it holds it back, and not as insiders: a good coin with one thing to watch
    return !mb && hb?.watch ? possible(hb.watch) : { word: "Wait", tone: "mid", why: block };
  if (p.state === "hot") {
    const ch = p.ch1m != null ? `+${Math.round(p.ch1m * 100)}% in 1 min` : p.ch5m != null ? `+${Math.round(p.ch5m * 100)}% in 5 min` : "buyers piling in";
    const w = p.wallets1m ? `, ${p.wallets1m} wallets` : "";
    return { word: "Momentum", tone: "up", why: `Buyers are in now: ${ch}${w}.${habit}` };
  }
  // the bigger picture decides when this minute is not decisive
  if (o?.bias === "bullish" && p.state !== "cooling" && p.state !== "quiet")
    return { word: "Momentum", tone: "up", why: `Uptrend: ${o.line}${habit}` };
  // a pullback in an uptrend on a clean coin is where buyers get in, not a reason to wait: 12-50% under its high, dips
  // bought so far and buyers still ahead (past 60% under the high it's a dump, caught above)
  const under = a.priceX != null && a.athX != null && a.athX > 0 ? 1 - a.priceX / a.athX : null;
  if (o?.bias === "bullish" && !block && under != null && under >= 0.12 && under <= 0.5 && (o.buyShare == null || o.buyShare >= 0.5))
    return {
      word: "Opportunity",
      tone: "up",
      why: `Pullback in an uptrend: ${Math.round(under * 100)}% under its high, and every dip has been bought so far. A better entry than chasing the candle.${habit}`,
      pullback: true,
    };
  if (o?.bias === "bullish")
    return { word: "Wait", tone: "mid", why: `Uptrend, pausing now. Wait for buyers to step back in. ${o.line}` };
  if (o?.bias === "bearish" && p.state !== "steady")
    return { word: "Don't buy", tone: "down", why: `Downtrend and no buyers stepping in. ${o.line}` };
  if (o?.bias === "bearish") return { word: "Wait", tone: "mid", why: `Downtrend. Wait until it turns. ${o.line}` };
  if (p.state === "quiet") return { word: "Wait", tone: "mid", why: `Almost no trades right now. Wait for volume.${o ? ` ${o.line}` : ""}` };
  return { word: "Wait", tone: "mid", why: `No clear push yet.${habit}${o ? ` ${o.line}` : ""}` };
}
