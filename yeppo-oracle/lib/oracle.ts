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
