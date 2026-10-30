import { mult, pct } from "./format";
import type { Base, DevHist, Kind, Match, Odds, Track, Xray } from "./types";

export type Tone = "up" | "mid" | "flat" | "down" | "rug";
export type Verdict = { score: number; tone: Tone; label: string; line: string; sub: string };
export type Signals = { ladder: boolean; devSold: boolean; dev: DevHist | null };
export type Flag = { icon: string; text: string; tone: "down" | "up" | "warn" };

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export const MIN_N = 25; // look-alike pool needed before odds are shown

export const TONE_COLOR = { up: "#22e39a", mid: "#ffb547", flat: "#8d95a9", down: "#ff4d6d", rug: "#ff4d6d", learn: "#8b5cff" } as const;

/** a dev who rugged at least two coins and most of the ones yeppo followed, or dumped two live ones */
export const isRugger = (d: DevHist | null) => !!d && ((d.rugs >= 2 && d.rugs / Math.max(1, d.coins) >= 0.5) || d.live_sold >= 2);

/** the red-flag inputs from a coin's x-ray: the dev counts as sold once less than 10% of their buy is left */
export function signalsOf(x: Extract<Xray, { tracked: true }> | null): Signals {
  const dp = x?.devpos;
  return { ladder: !!x?.pattern?.ladder, devSold: !!dp && dp[4] > 0 && dp[1] < dp[0] * 0.1, dev: x?.devhist ?? null };
}

/** red (and green) flags a trader must see before anything else */
export function flags(sig: Signals): Flag[] {
  const out: Flag[] = [];
  const d = sig.dev;
  if (sig.ladder) out.push({ icon: "🪜", text: "Bot ladder: a straight climb made only of buys. Coins that climb like this almost always dump.", tone: "down" });
  if (d && isRugger(d)) {
    const parts = [d.rugs ? `rugged ${d.rugs} of ${d.coins} coins yeppo followed` : "", d.live_sold ? `already dumped ${d.live_sold} other coin${d.live_sold > 1 ? "s" : ""} today` : ""].filter(Boolean);
    out.push({ icon: "🚩", text: `Serial rugger: this dev ${parts.join(" and ")}.`, tone: "down" });
  }
  if (sig.devSold) out.push({ icon: "🚨", text: "The dev sold their bag.", tone: "down" });
  if (d && !isRugger(d) && d.coins >= 3 && d.rugs === 0 && d.grads >= 1)
    out.push({ icon: "✅", text: `Clean dev: ${d.grads} of ${d.coins} coins went big, no rugs.`, tone: "up" });
  if (d && d.live >= 3 && !isRugger(d)) out.push({ icon: "🏭", text: `This dev launched ${d.live} other coins in the last hours.`, tone: "warn" });
  return out;
}

export type Check = { ok: boolean; label: string };
export type Decision = { word: "OK to buy" | "Risky" | "Don't buy" | "Too early"; tone: "up" | "mid" | "down" | "learn"; why: string };

/** the scam checks expert traders run before a buy, on the coin's features (yr_ofeat, 0-based: f[9] creator's
 *  share, f[10] top 10 wallets' share, f[11] snipers' share). On yeppo's coins, failing one of the first three
 *  meant a 50% crash within 10 minutes 35 to 54% of the time, against 28% for any coin. */
export function checksOf(f: number[] | null | undefined, sig: Signals): Check[] {
  if (!f || f.length < 12) return [];
  const p = (x: number) => `${Math.round(Math.max(0, x) * 100)}%`;
  const rugger = isRugger(sig.dev);
  return [
    { ok: f[10] < 0.25, label: f[10] < 0.25 ? `Top 10 wallets hold ${p(f[10])}: spread out` : `Top 10 wallets hold ${p(f[10])}: a few can crash it` },
    { ok: f[9] < 0.05, label: f[9] < 0.05 ? `Creator holds ${p(f[9])}` : `Creator still holds ${p(f[9])}: can dump on you` },
    { ok: f[11] < 0.15, label: f[11] < 0.15 ? `Snipers hold ${p(f[11])}` : `Snipers hold ${p(f[11])}: early bots waiting to sell` },
    { ok: !rugger, label: rugger ? "Creator rugged their earlier coins" : "Creator has no rug record" },
    { ok: !sig.ladder, label: sig.ladder ? "Fake climb: bots buying in a straight line" : "No fake bot climb" },
  ];
}

/** the answer a trader needs: buy, careful, or no. A failed scam check or a dump call is always a no; a yes
 *  needs every check passed and the look-alikes going up. */
export function decide(v: Verdict | null, checks: Check[]): Decision {
  const bad = checks.find((c) => !c.ok);
  if (v?.tone === "rug")
    return { word: "Don't buy", tone: "down", why: bad?.label ?? "The creator sold out, and coins like this one usually got dumped on buyers." };
  if (bad) return { word: "Don't buy", tone: "down", why: bad.label };
  if (v?.tone === "down") return { word: "Don't buy", tone: "down", why: "Coins like this one usually crashed in the next 10 minutes." };
  if (!v) return { word: "Too early", tone: "learn", why: "Too few trades to judge yet. Wait a minute." };
  if (v.tone === "up") return { word: "OK to buy", tone: "up", why: "No scam signs, and coins like this one usually went up. Follow the exit plan." };
  return { word: "Risky", tone: "mid", why: "No scam signs, but no clear upside. If you buy, buy small and keep the stop." };
}

/** what the market of a coin says right now, whatever its checks: [market cap and high in SOL, age, trades,
 *  buys and different wallets in the last 2 minutes] */
export type Market = { mc: number; ath: number; ageS: number; trades2: number; buys2: number; wallets2: number };

/** the market reasons a coin is a no: already dumped, back under its launch price, nobody trading it, traded by
 *  a bot (pump.fun's Mayhem agent trades its coin by itself), or being sold off right now */
export function gate(m: Market): string | null {
  if (m.ath > 0 && m.mc < m.ath * 0.4) return `Already dumped: ${Math.round((1 - m.mc / m.ath) * 100)}% below its high`;
  if (m.mc < 30 && m.ageS > 120) return "Back under its launch price: the buyers left";
  if (m.ageS < 60) return null;
  if (m.trades2 < 5) return "Almost nobody traded it in the last 2 minutes: you may not find a buyer when you sell";
  if (m.wallets2 < 8) return `Only ${m.wallets2} wallets traded it in 2 minutes: bots, not people`;
  if (m.trades2 / Math.max(1, m.wallets2) > 8) return "A few wallets trade it over and over: a bot, not demand";
  if (m.trades2 >= 20 && m.buys2 / m.trades2 < 0.35) return "Heavy selling right now: far more sells than buys";
  return null;
}

/** a coin past pump.fun's curve (graduated, or from another launchpad): no scam checks, only its market */
export function decideOutside(o: { liq: number | null; m5: { buys: number; sells: number } | null; ch1: number | null }, where: string): Decision {
  if (o.liq != null && o.liq < 10_000) return { word: "Don't buy", tone: "down", why: "Liquidity under $10K: selling will cost you a lot, or be impossible." };
  if (o.ch1 != null && o.ch1 <= -50) return { word: "Don't buy", tone: "down", why: `Already dumped: ${Math.round(-o.ch1)}% down in the last hour.` };
  const n = o.m5 ? o.m5.buys + o.m5.sells : 0;
  if (n < 5) return { word: "Don't buy", tone: "down", why: "Almost nobody traded it in the last 5 minutes: you may not find a buyer when you sell." };
  if (o.m5 && n >= 20 && o.m5.sells > o.m5.buys * 2) return { word: "Don't buy", tone: "down", why: "Heavy selling right now: far more sells than buys." };
  return { word: "Risky", tone: "mid", why: `It trades on ${where}, past pump.fun's curve: yeppo can't run its scam checks, only read the market. Buy small and keep a stop.` };
}

/** one word and one sentence, from the look-alikes and the red flags */
export function verdict(o: Odds, base: Base, sig: Signals, track?: Track | null): Verdict {
  const k = o.k || 1;
  const n50 = Math.round(o.p50 * k);
  const n2 = Math.round(o.p2x * k);
  const nd = Math.round(o.dump * k);
  const drift = clamp(Math.log(Math.max(o.med, 0.05)), -1, 1);
  let score = Math.round(clamp(50 + (o.p50 - o.dump) * 55 + drift * 45, 1, 99));
  const rugger = isRugger(sig.dev);
  const red = sig.ladder || rugger || (sig.devSold && o.dump >= 0.15);
  // thresholds from the backtest: a look-alike dump rate of 25%+ meant a real dump about half the time,
  // a pump rate of 20%+ with few dumps meant a real +50% about 4x more often than an average coin
  const danger = red || o.dump >= 0.25;
  const runner = !danger && o.p50 >= 0.2 && o.dump <= 0.1;
  const quiet = !danger && !runner && o.p50 + o.dump < 0.1;
  const tone: Tone = red ? "rug" : danger ? "down" : runner ? "up" : quiet ? "flat" : "mid";
  if (danger) score = Math.min(score, 30);
  if (runner) score = Math.max(score, 65);
  const label = sig.ladder ? "Bot ladder" : rugger ? "Serial rugger" : red ? "Rug risk" : danger ? "Likely dump" : runner ? "Runner potential" : quiet ? "Going nowhere" : "Coin flip";
  const line = sig.ladder
    ? "A straight climb made only of buys: fake volume from bots. Coins that climb like this almost always dump."
    : rugger
      ? `This dev rugged before${sig.dev?.coins ? `: ${sig.dev.rugs} of ${sig.dev.coins} coins yeppo followed` : ""}.`
      : red
        ? `The dev sold, and ${nd} of the ${k} look-alikes fell 50% within 10 minutes.`
        : danger
          ? `${nd} of the ${k} coins that looked like this fell 50% within 10 minutes.`
          : runner
            ? `${n50} of the ${k} look-alikes went up 50%+ in the next 10 minutes${n2 ? ` (${n2} doubled)` : ""}, only ${nd} dumped.`
            : quiet
              ? "The look-alikes barely moved in the next 10 minutes: most likely fading out."
              : `${n50} of the ${k} look-alikes pumped 50%, ${nd} dumped 50%. No edge either way.`;
  let sub = `An average coin at this age: ${pct(base.p50)} pump 50%, ${pct(base.dump)} dump 50%.`;
  if (track && danger && track.down?.n >= 20 && track.down.dump50 != null)
    sub = `When yeppo said this, ${pct(track.down.dump50)} of coins really dumped 50% (any coin: ${pct(track.all.dump50)}).`;
  if (track && runner && track.up?.n >= 20 && track.up.hit50 != null)
    sub = `When yeppo said this, ${pct(track.up.hit50)} of coins really went +50% (any coin: ${pct(track.all.hit50)}).`;
  return { score, tone, label, line, sub };
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 1;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export type Cone = { q10: number[]; q25: number[]; q50: number[]; q75: number[]; q90: number[] };
/** percentiles of the look-alikes' futures, step by step (20 s each) */
export function cone(matches: Match[]): Cone {
  const steps = matches[0]?.[4].length ?? 0;
  const out: Cone = { q10: [], q25: [], q50: [], q75: [], q90: [] };
  for (let i = 0; i < steps; i++) {
    const col = matches.map((m) => m[4][i]).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    out.q10.push(quantile(col, 0.1));
    out.q25.push(quantile(col, 0.25));
    out.q50.push(quantile(col, 0.5));
    out.q75.push(quantile(col, 0.75));
    out.q90.push(quantile(col, 0.9));
  }
  return out;
}

export const KIND: Record<Kind, { label: string; color: string; icon: string; hint: string }> = {
  dev: { label: "Dev", color: "#ff4d6d", icon: "👤", hint: "The wallet that launched the coin" },
  sniper: { label: "Snipers", color: "#ffb547", icon: "🎯", hint: "Bought in the first 2 seconds, usually bots" },
  flipper: { label: "Flippers", color: "#ff7a45", icon: "⚡", hint: "Usually sell within 90 seconds" },
  smart: { label: "Smart money", color: "#22e39a", icon: "🧠", hint: "Win more than half of their trades and are up overall" },
  trader: { label: "Traders", color: "#38bdf8", icon: "🧑", hint: "Known wallets with mixed habits" },
  fresh: { label: "New wallets", color: "#8b93a7", icon: "🌱", hint: "No closed trades yeppo has seen yet" },
};

export type ExitView = { overdue: number; s30: number; s60: number; s120: number; s300: number; later: number; known: number };
/** supply (in %) held by wallets with known habits, by when they usually sell */
export function exitView(x: Extract<Xray, { tracked: true }>): ExitView {
  const v: ExitView = { overdue: 0, s30: 0, s60: 0, s120: 0, s300: 0, later: 0, known: 0 };
  for (const [s, share] of x.exit ?? []) {
    v.known += share;
    if (s < 0) v.overdue += share;
    else if (s < 30) v.s30 += share;
    else if (s < 60) v.s60 += share;
    else if (s < 120) v.s120 += share;
    else if (s < 300) v.s300 += share;
    else v.later += share;
  }
  return v;
}

export const tradeLinks = (mint: string) => [
  { label: "pump.fun", href: `https://pump.fun/coin/${mint}` },
  { label: "GMGN", href: `https://gmgn.ai/sol/token/${mint}` },
  { label: "DexScreener", href: `https://dexscreener.com/solana/${mint}` },
  { label: "𝕏 search", href: `https://x.com/search?q=${mint}&f=live` },
];

/** A trade plan read off the 30 look-alikes: where to take profit, where to cut, how long to stay, and how
 *  that exact plan did on those 30 coins (after about 2% of fees). Not a promise: a plan from past coins. */
export type Plan = {
  go: boolean;
  tp: number;
  stop: number;
  minutes: number;
  wins: number;
  losses: number;
  even: number;
  avg: number;
  /** look-alikes that fell to the stop and came back above the entry */
  back: number;
};

export function plan(matches: Match[]): Plan | null {
  const paths = matches.map((m) => m[4]).filter((p) => p.length >= 10);
  if (paths.length < 10) return null;
  const peaks = paths.map((p) => {
    let mx = 1;
    let at = 0;
    p.forEach((v, i) => {
      if (v > mx) [mx, at] = [v, i];
    });
    return { mx, at };
  });
  // the stop: the smallest drop after which at most 1 in 5 look-alikes came back above the entry
  let stop = 0.6;
  let back = 0;
  for (const s of [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6]) {
    const hit = paths.filter((p) => p.some((v) => v <= s));
    if (hit.length < 3) continue;
    const came = hit.filter((p) => p.slice(p.findIndex((v) => v <= s)).some((v) => v >= 1.05)).length;
    if (came / hit.length <= 0.2) {
      [stop, back] = [s, came / hit.length];
      break;
    }
  }
  // the target: a level that 6 in 10 of the look-alikes that went up reached
  const ups = peaks.filter((x) => x.mx >= 1.25);
  const tp = ups.length >= 3 ? clamp(quantile(ups.map((x) => x.mx).sort((a, b) => a - b), 0.4), 1.2, 3) : 1.3;
  const atQ = ups.length ? quantile(ups.map((x) => x.at).sort((a, b) => a - b), 0.6) : 14;
  const last = Math.min(29, Math.max(2, Math.round(atQ) + 1));
  let wins = 0;
  let losses = 0;
  let even = 0;
  let sum = 0;
  for (const p of paths) {
    let r = p[Math.min(last, p.length - 1)];
    for (let i = 0; i <= last && i < p.length; i++) {
      if (p[i] >= tp) {
        r = tp;
        break;
      }
      if (p[i] <= stop) {
        r = stop;
        break;
      }
    }
    const net = r * 0.98 - 1;
    sum += net;
    if (net > 0.03) wins++;
    else if (net < -0.03) losses++;
    else even++;
  }
  const avg = sum / paths.length;
  return { go: avg > 0.02 && wins > losses, tp, stop, minutes: Math.max(1, Math.round(((last + 1) * 20) / 60)), wins, losses, even, avg, back };
}

/** the most to buy so that hitting the stop loses no more than the trader's own limit */
export const maxBuy = (risk: number, stop: number) => risk / Math.max(0.05, 1 - stop);
