// The coin page's "in plain words" box: what is happening, who owns it, what usually comes next.
// Short sentences a first-time trader understands, built only from the numbers on the page.
import type { Odds, Xray } from "./types";

export type Plain = { icon: string; title: string; text: string; tone: "up" | "down" | "warn" | "info" };

/** "3 in 10", "1 in 10", "almost none" */
export function inTen(p: number) {
  const n = Math.round(p * 10);
  if (p > 0 && n === 0) return "almost none";
  return `${n} in 10`;
}

export function plainWords(a: {
  mcNow: number;
  mcMinuteAgo: number | null;
  buys: number;
  sells: number;
  x: Extract<Xray, { tracked: true }> | null;
  odds: Odds | null;
  soon: number;
}): Plain[] {
  const out: Plain[] = [];
  // 1. right now
  const ch = a.mcMinuteAgo && a.mcMinuteAgo > 0 ? a.mcNow / a.mcMinuteAgo - 1 : null;
  const trades = a.buys + a.sells;
  if (trades < 3) out.push({ icon: "😴", title: "Right now", text: "Almost nobody is trading it this minute.", tone: "info" });
  else if (ch != null && ch >= 0.1)
    out.push({ icon: "📈", title: "Right now", text: `Going up: +${Math.round(ch * 100)}% in the last minute, with ${a.buys} buys and ${a.sells} sells.`, tone: "up" });
  else if (ch != null && ch <= -0.1)
    out.push({ icon: "📉", title: "Right now", text: `Going down: ${Math.round(ch * 100)}% in the last minute, with ${a.sells} sells and ${a.buys} buys.`, tone: "down" });
  else out.push({ icon: "↔️", title: "Right now", text: `Moving sideways: ${a.buys} buys and ${a.sells} sells in the last minute.`, tone: "info" });

  // 2. who owns it
  if (a.x) {
    const dp = a.x.devpos;
    const dev = !dp ? "" : dp[4] > 0 && dp[1] < dp[0] * 0.1 ? " The creator already sold everything." : dp[4] > 0 ? " The creator is selling." : ` The creator still holds ${dp[1].toFixed(1)}%.`;
    const fast = a.soon >= 1 ? ` Wallets that usually sell within a minute hold ${a.soon.toFixed(0)}%.` : "";
    out.push({
      icon: "👥",
      title: "Who owns it",
      text: `${a.x.holders} wallets hold it.${dev}${fast}`,
      tone: dp && dp[4] > 0 ? "down" : a.soon >= 10 ? "warn" : "info",
    });
  }

  // 3. what usually comes next
  if (a.odds && a.odds.k) {
    const o = a.odds;
    const flat = Math.max(0, 1 - o.p50 - o.dump);
    out.push({
      icon: "🔮",
      title: "What usually comes next",
      text: `Of the ${o.k} past coins that looked just like this one: ${inTen(o.dump)} crashed by half, ${inTen(o.p50)} went up by half, ${inTen(flat)} just drifted, in the next 10 minutes.`,
      tone: o.dump >= 0.25 ? "down" : o.p50 >= 0.2 && o.dump <= 0.1 ? "up" : "info",
    });
  }
  return out;
}
