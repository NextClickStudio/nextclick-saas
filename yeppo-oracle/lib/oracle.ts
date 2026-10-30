import { mult, pct } from "./format";
import type { Base, Kind, Match, Odds, Xray } from "./types";

export type Tone = "up" | "mid" | "down" | "rug";
export type Verdict = { score: number; tone: Tone; label: string; line: string; sub: string };

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** one number, one word and one sentence from the look-alikes' odds */
export function verdict(o: Odds, base: Base, devSold: boolean): Verdict {
  const k = o.k || 1;
  const n50 = Math.round(o.p50 * k);
  const n2 = Math.round(o.p2x * k);
  const nd = Math.round(o.dump * k);
  // the typical result 10 minutes later, on a log scale: x2 and -50% weigh the same
  const drift = clamp(Math.log(Math.max(o.med, 0.05)), -1, 1);
  let score = Math.round(clamp(50 + (o.p50 - o.dump) * 55 + drift * 45, 1, 99));
  const quiet = o.p50 + o.dump < 0.1 && Math.abs(o.med - 1) < 0.1;
  let tone: Tone = quiet ? "mid" : score >= 60 ? "up" : score >= 42 ? "mid" : "down";
  if (devSold && (o.dump >= 0.4 || o.med < 0.6)) {
    tone = "rug";
    score = Math.min(score, 25);
  }
  const label = quiet ? "Sideways" : tone === "up" ? "Strong setup" : tone === "mid" ? "Coin flip" : tone === "down" ? "Likely dump" : "Rug risk";
  const line = quiet
    ? `The ${k} coins that looked like this barely moved in the next 10 minutes.`
    : tone === "up"
      ? n50 >= Math.max(3, nd)
        ? `${n50} of the ${k} coins that looked like this went up 50%+ in the next 10 minutes${n2 ? `, ${n2} doubled` : ""}.`
        : `The typical look-alike was ${mult(o.med)} 10 minutes later.`
      : tone === "mid"
        ? `${n50} of the ${k} look-alikes pumped 50%, ${nd} dumped 50%. The typical one ended ${mult(o.med)}.`
        : tone === "down"
          ? nd >= Math.max(3, n50)
            ? `${nd} of the ${k} coins that looked like this fell 50% within 10 minutes.`
            : `Most look-alikes bled out: the typical one was ${mult(o.med)} 10 minutes later.`
          : `The dev already sold, and the typical look-alike was ${mult(o.med)} 10 minutes later.`;
  const sub = `An average coin at this age: ${pct(base.p50)} pump 50%, ${pct(base.dump)} dump 50%.`;
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
