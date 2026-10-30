// Bag Guard's reading of one bag, and the Safety Net: the trader's own limits, checked against the wallet.
import { flags, MIN_N, verdict, type Flag, type Verdict } from "./oracle";
import type { Bag, Guard, Track } from "./types";

export type Alarm = "out" | "watch" | "hold" | "wait";
export type BagRead = { b: Bag; v: Verdict | null; fl: Flag[]; alarm: Alarm; why: string; value: number; pnl: number };

export const ALARM: Record<Alarm, { label: string; cls: string }> = {
  out: { label: "GET OUT", cls: "a-out" },
  watch: { label: "WATCH", cls: "a-watch" },
  hold: { label: "HOLD", cls: "a-hold" },
  wait: { label: "READING", cls: "a-wait" },
};

/** what Bag Guard says about one bag, most urgent reason first */
export function readBag(b: Bag, track: Track | null): BagRead {
  const [, , , , , share, sin, sout, , , mc, , o, pattern, dev, devSold, soon] = b;
  const sig = { ladder: !!pattern?.ladder, devSold: !!devSold, dev };
  const ready = !!o && !o.old && o.n >= MIN_N && o.odds?.k > 0;
  const v = ready && o && !o.old ? verdict(o.odds, o.base, sig, track) : null;
  const fl = flags(sig);
  const value = ((share / 100) * 1e9 * (mc ?? 0)) / 1e9; // SOL: tokens x price, price = mc / supply
  const pnl = sin > 0 ? (value + sout) / sin - 1 : 0;
  let alarm: Alarm = "wait";
  let why = "The oracle is still learning coins of this age.";
  const red = fl.find((f) => f.tone === "down");
  if (red) {
    alarm = "out";
    why = red.text;
  } else if (v && (v.tone === "down" || v.tone === "rug")) {
    alarm = "out";
    why = v.line;
  } else if (soon >= 15) {
    alarm = "out";
    why = `${soon.toFixed(1)}% of the supply sits with wallets that usually sell within a minute.`;
  } else if (v?.tone === "up") {
    alarm = "hold";
    why = v.line;
  } else if (v) {
    alarm = "watch";
    why = soon >= 6 ? `${soon.toFixed(1)}% of the supply could be sold in the next minute. ${v.line}` : v.line;
  }
  return { b, v, fl, alarm, why, value, pnl };
}

export type Limits = { risk: number; daily: number };
export const DEFAULT_LIMITS: Limits = { risk: 0.1, daily: 0.5 };

export type Safety = { state: "ok" | "slow" | "stop"; today: number; trades: number; streak: number; why: string };

/** today's result from the wallet's closed trades, and whether the trader should slow down or stop */
export function safety(g: Guard | null, lim: Limits, now: number): Safety | null {
  if (!g) return null;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = g.closed.filter((c) => c[5] >= midnight.getTime());
  const pnl = today.reduce((s, c) => s + (c[3] - c[2]), 0);
  // losing trades in a row, most recent first, each within 20 minutes of the next
  let streak = 0;
  for (let i = 0; i < g.closed.length; i++) {
    const c = g.closed[i];
    if (c[3] >= c[2] || (i > 0 && g.closed[i - 1][5] - c[5] > 20 * 60_000)) break;
    streak++;
  }
  if (pnl <= -lim.daily)
    return { state: "stop", today: pnl, trades: today.length, streak, why: `You lost ${(-pnl).toFixed(2)} SOL today, past your ${lim.daily} SOL limit. Stop for today: the next trade is the one that hurts.` };
  if (streak >= 3)
    return { state: "slow", today: pnl, trades: today.length, streak, why: `${streak} losing trades in a row. This is when traders chase losses. Take a 15 minute break.` };
  if (pnl <= -lim.daily * 0.6)
    return { state: "slow", today: pnl, trades: today.length, streak, why: `You are ${(-pnl).toFixed(2)} SOL down today, close to your ${lim.daily} SOL limit. Only take Runner calls with a plan.` };
  return {
    state: "ok",
    today: pnl,
    trades: today.length,
    streak,
    why: today.length ? `You are inside your limits today.` : "No closed trade today yet.",
  };
}
