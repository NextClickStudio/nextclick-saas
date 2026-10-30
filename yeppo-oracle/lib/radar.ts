// yeppo radar: the board's coins ranked by what a fast trader looks at (who is buying right now, whether the
// coin rides a post on X or a meme people are launching, what similar coins did), after the scam checks threw
// out what fails them. The weights are a first guess, labelled experimental: on yeppo's replay the momentum and
// look-alike parts picked coins that pumped 50% more often than random picks in one half of the data and no
// more often in the other. The social parts have no history yet; yeppo records them from now on.
import { checksOf, decide, MIN_N, plan, verdict, type Decision, type Plan, type Signals } from "./oracle";
import type { DevHist, Oracle, Pattern, Track } from "./types";

export type BoardCoin = [string, string | null, string | null, string | null, number, number | null, number, number, number, number,
  Oracle | null, Pattern | null, DevHist | null, boolean?];
/** [mint, tweet id, X handle, X author, post text, has website, has Telegram, launcher, boost, paid profile, X link] */
export type SocialRow = [string, string | null, string | null, string | null, string | null, boolean, boolean, string | null, number, boolean, string | null];
/** [word, launches in the last hour, their trades, best market cap (SOL)] */
export type Meta = [string, number, number, number];

export type Chip = { icon: string; text: string; tone: "up" | "mid" | "down" | "info" };
export type RadarCoin = {
  mint: string;
  symbol: string | null;
  name: string | null;
  uri: string | null;
  ageS: number;
  mc: number | null;
  trades2: number;
  buys2: number;
  vol2: number;
  score: number;
  parts: { momentum: number; attention: number; lookalike: number; fresh: number };
  decision: Decision;
  chips: Chip[];
  post: { handle: string | null; author: string | null; text: string | null; url: string | null } | null;
  plan: Plan | null;
};
export type Radar = { now: number; picks: RadarCoin[]; rejected: { n: number; reasons: [string, number][] }; metas: Meta[]; scanned: number };

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const words = (s: string | null) => (s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

export function radar(coins: BoardCoin[], social: SocialRow[], metas: Meta[], track: Track | null, now: number): Radar {
  const soc = new Map(social.map((s) => [s[0], s]));
  // how many coins of the last 3 hours ride the same post, or the same X account
  const perPost = new Map<string, number>();
  const perHandle = new Map<string, number>();
  for (const s of social) {
    if (s[1]) perPost.set(s[1], (perPost.get(s[1]) ?? 0) + 1);
    if (s[2]) perHandle.set(s[2].toLowerCase(), (perHandle.get(s[2].toLowerCase()) ?? 0) + 1);
  }
  const hot = new Map(metas.filter((m) => m[1] >= 3).map((m) => [m[0], m]));
  const topTrades = Math.max(1, ...metas.map((m) => m[2]));
  // within a post's coins, the most traded one carries the post
  const leader = new Map<string, { mint: string; n: number }>();
  for (const c of coins) {
    const id = soc.get(c[0])?.[1];
    if (id && (leader.get(id)?.n ?? -1) < c[7]) leader.set(id, { mint: c[0], n: c[7] });
  }

  const all: RadarCoin[] = [];
  for (const c of coins) {
    const o = c[10] && !c[10].old ? c[10] : null;
    const ready = !!o && o.n >= MIN_N && o.odds?.k > 0;
    const sig: Signals = { ladder: !!c[11]?.ladder, devSold: !!c[13], dev: c[12] ?? null };
    const v = ready && o ? verdict(o.odds, o.base, sig, track) : null;
    const checks = checksOf(o?.f, sig);
    const d = decide(v, checks);
    const f = o?.f;
    const s = soc.get(c[0]);
    const chips: Chip[] = [];

    // momentum: trades and buyers right now (0-40)
    const trades2 = c[7];
    const buys2 = c[8];
    const share = trades2 ? buys2 / trades2 : 0.5;
    const flow = f ? f[6] : 0;
    const momentum = 40 * clamp(0.55 * clamp(Math.log1p(trades2) / Math.log1p(300)) + 0.3 * clamp((share - 0.4) / 0.35) + 0.15 * clamp((flow + 0.2) / 0.6));
    if (trades2 >= 60) chips.push({ icon: "🔥", text: `${trades2} trades in 2 min`, tone: "up" });
    if (share >= 0.65 && trades2 >= 20) chips.push({ icon: "🟢", text: `${Math.round(share * 100)}% buys`, tone: "up" });

    // attention: a post on X, a meme people are launching, paid promotion, socials (0-35)
    let attention = 0;
    let post: RadarCoin["post"] = null;
    if (s) {
      if (s[1]) {
        attention += 10;
        post = { handle: s[2], author: s[3], text: s[4], url: s[10] };
        const n = perPost.get(s[1]) ?? 1;
        const lead = leader.get(s[1])?.mint === c[0];
        if (n > 1 && lead) attention += 8;
        chips.push({ icon: "𝕏", text: n > 1 ? `post by @${s[2]} · ${n} coins, ${lead ? "this one leads" : "not the leader"}` : `launched from a post by @${s[2]}`, tone: lead || n === 1 ? "up" : "mid" });
      } else if (s[2]) {
        attention += 3;
        const n = perHandle.get(s[2].toLowerCase()) ?? 1;
        chips.push({ icon: "𝕏", text: n > 1 ? `links @${s[2]} like ${n - 1} other coins` : `links @${s[2]}`, tone: "info" });
      }
      if (s[8] > 0 || s[9]) {
        attention += 5;
        chips.push({ icon: "💸", text: s[8] > 0 ? `paid a DexScreener boost (${s[8]})` : "paid a DexScreener profile", tone: "info" });
      }
      if (s[5] || s[6]) attention += 2;
    }
    const meme = [...new Set([...words(c[1]), ...words(c[2])])].map((w) => hot.get(w)).filter((m): m is Meta => !!m).sort((a, b) => b[2] - a[2])[0];
    if (meme) {
      attention += 10 * clamp(Math.log1p(meme[2]) / Math.log1p(topTrades));
      chips.push({ icon: "🧠", text: `"${meme[0]}" meme: ${meme[1]} coins this hour`, tone: "up" });
    }
    attention = Math.min(35, attention);

    // look-alikes, kept light: no two coins are the same (0-15)
    const lookalike = o && ready ? 15 * clamp((o.odds.p50 - o.odds.dump + 0.2) / 0.6) : 5;
    // fresh coins move first (0-10)
    const ageS = Math.max(0, Math.round((now - c[4]) / 1000));
    const fresh = ageS < 300 ? 10 : ageS < 900 ? 6 : ageS < 1800 ? 3 : 1;

    all.push({
      mint: c[0],
      symbol: c[2],
      name: c[1],
      uri: c[3],
      ageS,
      mc: c[5],
      trades2,
      buys2,
      vol2: c[9],
      score: Math.round(momentum + attention + lookalike + fresh),
      parts: { momentum: Math.round(momentum), attention: Math.round(attention), lookalike: Math.round(lookalike), fresh },
      decision: d,
      chips,
      post,
      plan: v && o?.matches?.length ? plan(o.matches) : null,
    });
  }
  const picks = all.filter((c) => c.decision.tone !== "down").sort((a, b) => b.score - a.score);
  const out = all.filter((c) => c.decision.tone === "down");
  const reasons = new Map<string, number>();
  for (const c of out) reasons.set(c.decision.why, (reasons.get(c.decision.why) ?? 0) + 1);
  return { now, picks, rejected: { n: out.length, reasons: [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 5) }, metas: metas.slice(0, 12), scanned: all.length };
}
