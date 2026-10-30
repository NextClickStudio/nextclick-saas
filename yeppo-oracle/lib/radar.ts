// yeppo radar: the coins a memecoin trader would look at right now. First the filters traders set on pump.fun
// screeners (market cap, holders, trades, distinct wallets, buys over sells, not dumped: FILTERS below), then the
// scam checks; what is left is ranked by who is buying right now, whether the coin rides a post on X or a meme
// people are launching, and what similar coins did. Coins that just graduated to PumpSwap get their own list,
// from DexScreener's live market (yeppo does not see their trades). The weights are a first guess, labelled experimental: on yeppo's replay the momentum and
// look-alike parts picked coins that pumped 50% more often than random picks in one half of the data and no
// more often in the other. The social parts have no history yet; yeppo records them from now on.
import { checksOf, decide, MIN_N, plan, verdict, type Decision, type Plan, type Signals } from "./oracle";
import type { DevHist, Oracle, Pattern, Track } from "./types";

/** the board's coin: [mint, name, symbol, uri, born, market cap (SOL), high (SOL), trades 2 min, buys 2 min,
 *  SOL traded 2 min, oracle, pattern, dev record, dev sold, wallets that traded in 2 min, holders] */
export type BoardCoin = [string, string | null, string | null, string | null, number, number | null, number, number, number, number,
  Oracle | null, Pattern | null, DevHist | null, boolean?, number?, number?];
/** a graduation: [mint, graduated at, born at, name, symbol, uri, creator's rugs, creator's coins] */
export type GradRow = [string, number, number | null, string | null, string | null, string | null, number | null, number | null];
/** the live market of a graduated coin, from DexScreener */
export type GradMarket = { mint: string; symbol: string | null; name: string | null; dex: string; url: string; mcap: number | null; liq: number | null; m5: { buys: number; sells: number } | null; vol5: number | null; ch5: number | null; ch1: number | null };

/** the screener filters, the same kind pump.fun traders set on Axiom Pulse or GMGN. Market caps in SOL. */
export const FILTERS = { mcSol: 60, holders: 40, trades2: 30, wallets2: 15, buyShare: 0.5, vol2Sol: 3, fromHigh: 0.5 };
export const GRAD_FILTERS = { mcUsd: 40_000, mcMaxUsd: 20_000_000, liqUsd: 15_000, trades5: 40, ch1: -40 };
/** [mint, tweet id, X handle, X author, post text, has website, has Telegram, launcher, boost, paid profile, X link,
 *  post likes, post replies, verified author, posted at (ms)] */
export type SocialRow = [string, string | null, string | null, string | null, string | null, boolean, boolean, string | null, number, boolean, string | null,
  (number | null)?, (number | null)?, (boolean | null)?, (number | null)?];
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
  stage: "curve" | "graduated";
  holders: number | null;
  wallets2: number | null;
  mcUsd?: number | null;
  liqUsd?: number | null;
  url?: string;
  chips: Chip[];
  post: { handle: string | null; author: string | null; text: string | null; url: string | null; likes: number | null; replies: number | null; verified: boolean } | null;
  plan: Plan | null;
};
export type Radar = {
  now: number;
  picks: RadarCoin[];
  graduated: RadarCoin[];
  rejected: { n: number; reasons: [string, number][] };
  quiet: { n: number; reasons: [string, number][] };
  metas: Meta[];
  scanned: number;
  filters: typeof FILTERS;
};

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
// the same words the board leaves out (yr_oracle_hot_build): slurs and worse never show as a meme
const BAD = /(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn|nsfw|dick|cock|pussy|fuck|cunt|whore|slut|isis|jihad)/i;
const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
const words = (s: string | null) => (s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

/** what makes a board coin a no whatever its checks say: already dumped, back under its launch price, or traded by
 *  a single bot (pump.fun's Mayhem agent trades its coin by itself). The radar lists only coins people buy now. */
export function gateOf(c: BoardCoin, now: number): string | null {
  const mc = c[5] ?? 0;
  const wallets = c[14];
  if (c[6] > 0 && mc < c[6] * 0.4) return `Already dumped: ${Math.round((1 - mc / c[6]) * 100)}% below its high`;
  if (mc < 30 && (now - c[4]) / 1000 > 120) return "Back under its launch price: the buyers left";
  if (wallets != null && wallets < 8) return `Only ${wallets} wallets traded it in 2 minutes: bots, not people`;
  if (wallets != null && c[7] / Math.max(1, wallets) > 8) return "A few wallets trade it over and over: a bot, not demand";
  return null;
}

/** the first screener filter a coin fails, or null when it passes them all */
export function floorOf(c: BoardCoin): string | null {
  const mc = c[5] ?? 0;
  if (mc < FILTERS.mcSol) return `market cap under ${FILTERS.mcSol} SOL`;
  if (c[15] != null && c[15] < FILTERS.holders) return `under ${FILTERS.holders} holders`;
  if (c[7] < FILTERS.trades2) return `under ${FILTERS.trades2} trades in 2 min`;
  if (c[14] != null && c[14] < FILTERS.wallets2) return `under ${FILTERS.wallets2} wallets trading`;
  if (c[7] && c[8] / c[7] < FILTERS.buyShare) return "more sells than buys";
  if (c[9] < FILTERS.vol2Sol) return `under ${FILTERS.vol2Sol} SOL traded in 2 min`;
  if (c[6] > 0 && mc < c[6] * FILTERS.fromHigh) return "more than half off its high";
  return null;
}

export function radar(coins: BoardCoin[], social: SocialRow[], metas: Meta[], track: Track | null, now: number, grads: GradRow[] = [], markets: GradMarket[] = []): Radar {
  const soc = new Map(social.map((s) => [s[0], s]));
  // how many coins of the last 3 hours ride the same post, or the same X account
  const perPost = new Map<string, number>();
  const perHandle = new Map<string, number>();
  for (const s of social) {
    if (s[1]) perPost.set(s[1], (perPost.get(s[1]) ?? 0) + 1);
    if (s[2]) perHandle.set(s[2].toLowerCase(), (perHandle.get(s[2].toLowerCase()) ?? 0) + 1);
  }
  metas = metas.filter((m) => !BAD.test(m[0]));
  const hot = new Map(metas.filter((m) => m[1] >= 3).map((m) => [m[0], m]));
  const topTrades = Math.max(1, ...metas.map((m) => m[2]));
  // within a post's coins, the most traded one carries the post
  const leader = new Map<string, { mint: string; n: number }>();
  for (const c of coins) {
    const id = soc.get(c[0])?.[1];
    if (id && (leader.get(id)?.n ?? -1) < c[7]) leader.set(id, { mint: c[0], n: c[7] });
  }

  // attention: a post on X, a meme people are launching, paid promotion, socials (0-35)
  const attentionOf = (mint: string, name: string | null, symbol: string | null, s: SocialRow | undefined, chips: Chip[]) => {
    let attention = 0;
    let post: RadarCoin["post"] = null;
    if (s) {
      if (s[1]) {
        const likes = s[11] ?? null;
        const replies = s[12] ?? null;
        attention += 8;
        // how far the post reached: likes on a log scale, 1,000 likes earn the most
        if (likes) attention += 8 * clamp(Math.log10(1 + likes) / 3);
        post = { handle: s[2], author: s[3], text: s[4], url: s[10], likes, replies, verified: !!s[13] };
        const n = perPost.get(s[1]) ?? 1;
        const lead = leader.get(s[1])?.mint === mint;
        if (n > 1 && lead) attention += 6;
        const reach = likes != null ? ` · ${k(likes)} likes${replies ? `, ${k(replies)} replies` : ""}` : "";
        chips.push({
          icon: "𝕏",
          text: `${n > 1 ? `post by @${s[2]}${s[13] ? " ✓" : ""} · ${n} coins, ${lead ? "this one leads" : "not the leader"}` : `launched from a post by @${s[2]}${s[13] ? " ✓" : ""}`}${reach}`,
          tone: lead || n === 1 ? "up" : "mid",
        });
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
    const meme = [...new Set([...words(name), ...words(symbol)])].map((w) => hot.get(w)).filter((m): m is Meta => !!m).sort((a, b) => b[2] - a[2])[0];
    if (meme) {
      attention += 10 * clamp(Math.log1p(meme[2]) / Math.log1p(topTrades));
      chips.push({ icon: "🧠", text: `"${meme[0]}" meme: ${meme[1]} coins this hour`, tone: "up" });
    }
    attention = Math.min(35, attention);

    return { attention, post };
  };

  const all: RadarCoin[] = [];
  const floors = new Set<string>();
  for (const c of coins) {
    const o = c[10] && !c[10].old ? c[10] : null;
    const ready = !!o && o.n >= MIN_N && o.odds?.k > 0;
    const sig: Signals = { ladder: !!c[11]?.ladder, devSold: !!c[13], dev: c[12] ?? null };
    const v = ready && o ? verdict(o.odds, o.base, sig, track) : null;
    const checks = checksOf(o?.f, sig);
    let d = decide(v, checks);
    const gate = gateOf(c, now);
    if (gate) d = { word: "Don't buy", tone: "down", why: gate };
    const floor = d.tone === "down" ? null : floorOf(c);
    if (floor) floors.add(c[0]);
    const f = o?.f;
    const chips: Chip[] = [];

    // momentum: trades and buyers right now (0-40)
    const trades2 = c[7];
    const buys2 = c[8];
    const share = trades2 ? buys2 / trades2 : 0.5;
    const flow = f ? f[6] : 0;
    const momentum = 40 * clamp(0.55 * clamp(Math.log1p(trades2) / Math.log1p(300)) + 0.3 * clamp((share - 0.4) / 0.35) + 0.15 * clamp((flow + 0.2) / 0.6));
    if (trades2 >= 60) chips.push({ icon: "🔥", text: `${trades2} trades in 2 min`, tone: "up" });
    if (c[15] != null) chips.push({ icon: "👥", text: `${c[15]} holders · ${c[14] ?? "?"} wallets trading`, tone: "info" });
    if (share >= 0.65 && trades2 >= 20) chips.push({ icon: "🟢", text: `${Math.round(share * 100)}% buys`, tone: "up" });

    const { attention, post } = attentionOf(c[0], c[1], c[2], soc.get(c[0]), chips);
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
      decision: floor ? { ...d, why: floor } : d,
      stage: "curve",
      holders: c[15] ?? null,
      wallets2: c[14] ?? null,
      chips,
      post,
      plan: v && o?.matches?.length ? plan(o.matches) : null,
    });
  }
  const failed = new Set(all.filter((c) => c.decision.tone !== "down" && floors.has(c.mint)).map((c) => c.mint));
  const picks = all.filter((c) => c.decision.tone !== "down" && !failed.has(c.mint)).sort((a, b) => b.score - a.score);
  const out = all.filter((c) => c.decision.tone === "down");
  const count = (l: RadarCoin[]) => {
    const m = new Map<string, number>();
    for (const c of l) m.set(c.decision.why, (m.get(c.decision.why) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  // just graduated to PumpSwap: their live market from DexScreener, the graduation filters, the same attention
  const byMint = new Map(markets.map((m) => [m.mint, m]));
  const graduated: RadarCoin[] = [];
  for (const g of grads) {
    const m = byMint.get(g[0]);
    if (!m || !m.m5) continue;
    const trades5 = m.m5.buys + m.m5.sells;
    const rugger = (g[6] ?? 0) >= 2 && (g[6] ?? 0) / Math.max(1, g[7] ?? 0) >= 0.5;
    if (rugger || (m.mcap ?? 0) < GRAD_FILTERS.mcUsd || (m.mcap ?? 0) > GRAD_FILTERS.mcMaxUsd || (m.liq ?? 0) < GRAD_FILTERS.liqUsd || trades5 < GRAD_FILTERS.trades5 || (m.ch1 ?? 0) < GRAD_FILTERS.ch1) continue;
    const share = trades5 ? m.m5.buys / trades5 : 0.5;
    if (share < 0.45) continue;
    const chips: Chip[] = [{ icon: "🎓", text: `graduated ${Math.max(1, Math.round((now - g[1]) / 60000))} min ago`, tone: "up" }];
    chips.push({ icon: "🔥", text: `${trades5} trades in 5 min, ${Math.round(share * 100)}% buys`, tone: share >= 0.6 ? "up" : "info" });
    if (m.ch5 != null) chips.push({ icon: m.ch5 >= 0 ? "📈" : "📉", text: `${m.ch5 >= 0 ? "+" : ""}${m.ch5.toFixed(0)}% in 5 min`, tone: m.ch5 >= 0 ? "up" : "mid" });
    const name = g[3] ?? m.name;
    const symbol = g[4] ?? m.symbol;
    const { attention, post } = attentionOf(g[0], name, symbol, soc.get(g[0]), chips);
    const momentum = 40 * clamp(0.6 * clamp(Math.log1p(trades5) / Math.log1p(1500)) + 0.4 * clamp((share - 0.4) / 0.35));
    const fresh = now - g[1] < 600_000 ? 10 : now - g[1] < 1_800_000 ? 6 : 3;
    graduated.push({
      mint: g[0],
      symbol,
      name,
      uri: g[5],
      ageS: g[2] ? Math.round((now - g[2]) / 1000) : Math.round((now - g[1]) / 1000),
      mc: null,
      mcUsd: m.mcap,
      liqUsd: m.liq,
      url: m.url,
      trades2: trades5,
      buys2: m.m5.buys,
      vol2: m.vol5 ?? 0,
      score: Math.round(momentum + attention + 5 + fresh),
      parts: { momentum: Math.round(momentum), attention: Math.round(attention), lookalike: 5, fresh },
      decision: { word: "Risky", tone: "mid", why: "Graduated to PumpSwap: past the curve's scam checks, so only the market can be read." },
      stage: "graduated",
      holders: null,
      wallets2: null,
      chips,
      post,
      plan: null,
    });
  }
  graduated.sort((a, b) => b.score - a.score);

  return {
    now,
    picks,
    graduated: graduated.slice(0, 10),
    rejected: { n: out.length, reasons: count(out) },
    quiet: { n: failed.size, reasons: count(all.filter((c) => failed.has(c.mint))) },
    metas: metas.slice(0, 12),
    scanned: all.length,
    filters: FILTERS,
  };
}
