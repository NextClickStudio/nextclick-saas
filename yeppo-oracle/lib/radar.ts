// The radar's judgement, in the browser: which of the coins launched in the last 20 minutes are worth a look now, and
// why, and which ones are traps. Pure functions over yeppo's quick read of each coin (yr_quick_row), the launches, the
// tweets of the viewer's J7Tracker feed and the meme waves. Deterministic rules, every point explained.
import { botLaunched, type Risk, top10Heavy } from "./decide";

/** yeppo's quick read of one coin (yr_quick_row): market caps in SOL, shares of the 1B supply */
export type Quick = {
  mint: string; sym: string | null; name: string | null; t0: number; n: number;
  mc: number; ath: number; b0: number; bun: number; devTok: number;
  devOut: number | null; devSold: number | null; rug: boolean; grad: boolean; farm: boolean; badDev: boolean;
  uri: string | null;
  b2: number; s2: number; w2: number; ch2: number | null;
  risk: Risk | null;
  /** how often coins like this one went ×2 and ×3 from here (yr_odds, added by /api/radar) */
  odds?: { p2: number; p3: number; n: number };
};

/** a post from the viewer's J7Tracker feed */
export type Signal = { id: string; at: number; author: string; name: string | null; followers: number; verified: boolean; text: string; url: string | null; cas: string[] };

/** a launch: from yeppo's record, or this second from PumpPortal */
export type Launch = { mint: string; sym: string | null; name: string | null; t: number };

export type Tone = "hot" | "early" | "watch" | "avoid";
export type Pick = {
  mint: string; sym: string | null; name: string | null; t0: number;
  score: number; tone: Tone; label: string;
  /** why it scores: the strongest first */
  why: string[];
  /** what to keep an eye on, without ruling it out */
  warn: string[];
  /** the trap, for coins ruled out */
  trap: string | null;
  signal: Signal | null;
  copies: number;
  original: boolean;
  q: Quick | null;
};

/** accounts whose posts start pump.fun coins, by how hard: 3 = one post launches dozens of coins within a minute.
 *  Used to weigh a post (and listed in the radar as accounts worth adding to J7Tracker). */
export const ACCOUNTS: { kind: string; tier: 1 | 2 | 3; handles: string[] }[] = [
  { kind: "Launch dozens of coins with one post", tier: 3, handles: ["elonmusk", "realDonaldTrump", "POTUS", "WhiteHouse", "cz_binance", "heyibinance", "DogeDesigner", "MrBeast", "kanyewest"] },
  { kind: "Breaking news that turns into coins", tier: 2, handles: ["MarioNawfal", "WatcherGuru", "unusual_whales", "DeItaone", "tier10k", "Cointelegraph"] },
  { kind: "Solana and pump.fun", tier: 2, handles: ["pumpdotfun", "a1lon9", "solana", "aeyakovenko", "rajgokal", "0xMert_", "VitalikButerin", "saylor"] },
  { kind: "Memecoin traders", tier: 2, handles: ["Cupseyy", "blknoiz06", "MustStopMurad", "frankdegods", "notthreadguy"] },
];
const TIER = new Map(ACCOUNTS.flatMap((g) => g.handles.map((h) => [h.toLowerCase(), g.tier] as const)));
export const tierOf = (handle: string) => TIER.get(handle.toLowerCase()) ?? 0;

/** keywords worth a J7Tracker filter: posts that hand out a coin or name a ticker */
export const KEYWORDS = ["ca:", "ca ", "contract", "pump.fun", "pumpfun", "ticker", "$", "launch", "deploy", "stealth", "memecoin", "token"];

// words too common to name a coin after a post: matching them would tie random coins to random posts
const STOP = new Set(
  ("the and for you are not this that with was has have had its his her our out who get got can now new just like will what when why how " +
    "from into over then than them they your about more most very only also even still some any all one two three big little coin token " +
    "pump sol solana meme buy sell send moon gm gn lol lmao wtf yes no dont im amp https http www com today tomorrow year years day days " +
    "time week month people man men woman women world life good great best bad first last next back home city state house white black " +
    "red blue green news says said say make made take takes going go come came see seen look know think want need love hate help real " +
    "free money cash price market crypto bitcoin btc eth usd dollar dollars million billion trump elon president america american china " +
    "russia war after before while here there where which would could should been being every other many much such same own off down " +
    "high low long short live dead die kill killed run running win won lose lost game games play team play video photo watch breaking " +
    "update report official announced announces plans plan deal first right left top hot cool nice wow omg").split(" "),
);

const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/^\$/, "").replace(/[^a-z0-9]/g, "");
const wordsOf = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9$ ]/g, " ").split(/\s+/).map((w) => w.replace(/^\$/, "")).filter(Boolean);

/** what a coin could be named after in a post: its cashtags, its uncommon words, and every 2 or 3 words run together */
export function postNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\$([A-Za-z][A-Za-z0-9]{1,15})/g)) out.add(m[1].toLowerCase());
  const w = wordsOf(text);
  for (let i = 0; i < w.length; i++) {
    if (w[i].length >= 4 && w[i].length <= 20 && !STOP.has(w[i]) && !/^\d+$/.test(w[i])) out.add(w[i]);
    if (i + 1 < w.length) out.add(w[i] + w[i + 1]);
    if (i + 2 < w.length) out.add(w[i] + w[i + 1] + w[i + 2]);
  }
  return out;
}

/** how much a post can move pump.fun, 0..1: who wrote it, how many follow them, and whether it hands out a coin */
export function postWeight(s: Signal): number {
  const reach = Math.min(1, Math.log10(Math.max(10, s.followers)) / 7.5);
  const tier = tierOf(s.author);
  let w = reach * 0.6 + tier * 0.15;
  if (s.cas.length) w += 0.25;
  if (/\$[A-Za-z][A-Za-z0-9]{1,15}\b/.test(s.text)) w += 0.1;
  return Math.min(1, w);
}

/** a post worth tying coins to: a known account, a big one, or one that hands out a coin */
export const goodPost = (s: Signal) => s.cas.length > 0 || tierOf(s.author) > 0 || s.followers >= 50_000;

/** the post a launch answers: one that names it exactly (ticker or name), posted up to 30 s after the launch and no
 *  more than 15 minutes before it; the weightiest post wins */
export function matchSignal(l: Launch, signals: Signal[]): Signal | null {
  const sym = norm(l.sym);
  const name = norm(l.name);
  let best: Signal | null = null;
  for (const s of signals) {
    if (s.cas.includes(l.mint)) return s;
    if (!goodPost(s) || l.t < s.at - 30_000 || l.t > s.at + 900_000) continue;
    const names = postNames(s.text);
    const hit = (sym.length >= 3 && !STOP.has(sym) && names.has(sym)) || (name.length >= 4 && !STOP.has(name) && names.has(name));
    if (hit && (!best || postWeight(s) > postWeight(best))) best = s;
  }
  return best;
}

/** the post behind a coin someone opened: one that hands it out, else the weightiest post of the viewer's J7 feed (last
 *  30 minutes, 2,000+ followers or a known account) that names it, by ticker or name, before or after its launch */
export function tweetFor(c: { mint: string; sym: string | null; name: string | null }, signals: Signal[]): Signal | null {
  const sym = norm(c.sym);
  const name = norm(c.name);
  let best: Signal | null = null;
  for (const s of signals) {
    if (s.cas.includes(c.mint)) return s;
    if (!(s.followers >= 2000 || tierOf(s.author) > 0)) continue;
    const names = postNames(s.text);
    const hit = (sym.length >= 3 && !STOP.has(sym) && names.has(sym)) || (name.length >= 4 && !STOP.has(name) && names.has(name));
    if (hit && (!best || postWeight(s) > postWeight(best))) best = s;
  }
  return best;
}

const pc = (v: number) => `${Math.round(v * 100)}%`;
const x = (v: number) => `×${v >= 10 ? v.toFixed(0) : v.toFixed(1)}`;
const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

/** the trap that rules a coin out, if there is one */
export function trapOf(q: Quick, now: number): string | null {
  const r = q.risk;
  const ins = insidersOf(q);
  const bot = botLaunched(q.uri);
  if (q.rug) return "The creator dumped it.";
  if ((r?.hidden ?? 0) >= 0.4) return `Hidden bundle: ${pc(r!.hidden!)} of the supply taken at launch by wallets nobody saw buy.`;
  if (q.bun >= 0.1) return `Bundled: ${pc(q.bun)} bought in the first seconds by linked wallets.`;
  if (ins >= 0.25) return `Insiders hold ${pc(ins)}: creator, bundle and snipers can dump it together.`;
  if (bot && (q.bun >= 0.1 || ins >= 0.2)) return `Launched by a tweet-deploy bot with insiders on ${pc(Math.max(ins, q.bun))}: these dump to zero in one block.`;
  if (top10Heavy(r) === "no") return `The 10 biggest wallets hold ${pc(r!.top10Held!)}, almost all in circulation.`;
  if (r?.full && r.sniperHeld >= 0.2) return `Snipers still hold ${pc(r.sniperHeld)}.`;
  if (r?.full && r.topHeld >= 0.15) return `One wallet holds ${pc(r.topHeld)}.`;
  if (q.badDev) return "The creator's past coins went bad.";
  if (q.farm) return "The creator launches dozens of coins and none take off.";
  if (q.devTok >= 0.1) return `The creator still holds ${pc(q.devTok)}.`;
  if (q.ath > q.b0 * 1.5 && q.mc < q.ath * 0.5) return `Already dumped ${pc(1 - q.mc / q.ath)} from its high.`;
  if (q.mc < q.b0 * 1.05 && now - q.t0 > 180_000) return "Back at its launch price.";
  return null;
}

/** creator + launch bundle + snipers: who can dump it at once (exact for coins under 20 minutes) */
export const insidersOf = (q: Quick) => (q.risk?.full ? Math.max(q.risk.sniperHeld, q.bun) : q.bun) + q.devTok;

/** one coin, judged: trap, score and the reasons behind it */
export function judge(a: { q: Quick | null; l: Launch; signal: Signal | null; wave: string | null; copies: number; original: boolean; now: number }): Pick {
  const { q, l, signal, wave, copies, original, now } = a;
  const base = { mint: l.mint, sym: q?.sym ?? l.sym, name: q?.name ?? l.name, t0: q?.t0 ?? l.t, signal, copies, original, q };
  const why: { p: number; s: string }[] = [];
  const warn: string[] = [];
  const age = now - (q?.t0 ?? l.t);

  if (signal) {
    const direct = signal.cas.includes(l.mint);
    why.push({ p: Math.round(40 * postWeight(signal)), s: `${direct ? "Posted" : "Named after a post"} by @${signal.author} (${k(signal.followers)} followers)` });
  }
  if (original && copies > 0) why.push({ p: 10, s: `The original: ${copies} cop${copies === 1 ? "y" : "ies"} launched after it` });
  if (wave) why.push({ p: 8, s: `Part of the "${wave}" wave` });

  if (!q) {
    const score = why.reduce((s, w) => s + w.p, 0);
    return { ...base, score, tone: "watch", label: "Reading…", why: why.sort((p, z) => z.p - p.p).map((w) => w.s), warn, trap: null };
  }

  const trap = trapOf(q, now);
  if (q.w2 > 0) why.push({ p: Math.min(25, Math.round(q.w2 * 1.2)), s: `${q.w2} buyers in 2 minutes` });
  const flow = q.b2 + q.s2 >= 6 ? q.b2 / (q.b2 + q.s2) : null;
  if (flow != null && flow >= 0.6) why.push({ p: 10, s: `Buyers lead: ${pc(flow)} of trades` });
  if (q.ath > q.b0 * 1.2 && q.mc >= q.ath * 0.8) why.push({ p: 10, s: `Holding near its high (${x(q.mc / q.b0)})` });
  if (age < 600_000) why.push({ p: 8, s: `Early: ${Math.max(1, Math.round(age / 60_000))} min old` });
  if (q.risk?.smart) why.push({ p: 8, s: `${q.risk.smart} proven wallet${q.risk.smart > 1 ? "s" : ""} in` });
  // the odds of coins like it: measured, so they weigh more than any single sign
  if (q.odds && q.odds.p2 >= 0.08) why.push({ p: q.odds.p2 >= 0.15 ? 20 : 10, s: `Coins like this went ×2 ${pc(q.odds.p2)} of the time` });

  let score = why.reduce((s, w) => s + w.p, 0);
  const r = q.risk;
  if (r?.full && r.sniperHeld >= 0.1) (warn.push(`Snipers hold ${pc(r.sniperHeld)}`), (score -= 15));
  if (r?.full && r.topHeld >= 0.08) (warn.push(`One wallet holds ${pc(r.topHeld)}`), (score -= 10));
  if (q.devTok >= 0.05) (warn.push(`Creator holds ${pc(q.devTok)}`), (score -= 10));
  if (insidersOf(q) >= 0.15) (warn.push(`Insiders hold ${pc(insidersOf(q))} together`), (score -= 15));
  if (botLaunched(q.uri)) warn.push("Launched by a tweet-deploy bot");
  if (r && r.sell2 >= 2 && r.topSell2 >= r.sell2 * 0.6) (warn.push("One wallet is doing most of the selling"), (score -= 10));
  if (q.bun >= 0.05) warn.push(`Bundle ${pc(q.bun)}`);
  if (!original && copies > 0) (warn.push("A copy: an earlier coin has this ticker"), (score -= 15));
  if (age < 60_000) warn.push("Under a minute old: wait for it to hold");
  if (q.odds && q.odds.p2 < 0.03) (warn.push(`Coins like this rarely go ×2 (${pc(q.odds.p2)})`), (score -= 10));
  score = Math.max(0, Math.min(100, score));

  let tone: Tone = "watch";
  let label = "Watch";
  if (trap) [tone, label] = ["avoid", "Avoid"];
  else if (score >= 55 && age < 600_000) [tone, label] = ["early", "Early"];
  else if (score >= 55) [tone, label] = ["hot", "Hot"];
  return { ...base, score: trap ? 0 : score, tone, label, why: why.sort((p, z) => z.p - p.p).map((w) => w.s), warn, trap };
}

/** the radar: every launch a post points to, every coin trading now, judged; picks first, traps apart */
export function buildRadar(a: { launches: Launch[]; active: Quick[]; extra: Quick[]; signals: Signal[]; waves: string[]; now: number }): { picks: Pick[]; fresh: Pick[]; traps: Pick[] } {
  const quick = new Map<string, Quick>();
  for (const q of [...a.extra, ...a.active]) quick.set(q.mint, q);
  const launches = new Map<string, Launch>();
  for (const l of a.launches) if (a.now - l.t < 1_200_000) launches.set(l.mint, l);
  for (const q of a.active) if (!launches.has(q.mint)) launches.set(q.mint, { mint: q.mint, sym: q.sym, name: q.name, t: q.t0 });

  // copies: launches with the same ticker; the original is the first
  const byTicker = new Map<string, Launch[]>();
  for (const l of launches.values()) {
    const t = norm(l.sym);
    if (!t) continue;
    byTicker.set(t, [...(byTicker.get(t) ?? []), l]);
  }
  const waves = new Set(a.waves);
  const out: Pick[] = [];
  for (const l of launches.values()) {
    const signal = matchSignal(l, a.signals);
    const q = quick.get(l.mint) ?? null;
    // only coins with something going for them: a post, or trading yeppo can read
    if (!signal && !q) continue;
    const same = byTicker.get(norm(l.sym)) ?? [l];
    const first = same.reduce((f, s) => (s.t < f.t ? s : f), same[0]);
    const wave = wordsOf(l.name).concat(wordsOf(l.sym)).find((w) => waves.has(w)) ?? null;
    out.push(judge({ q, l, signal, wave, copies: same.length - 1, original: first.mint === l.mint, now: a.now }));
  }
  // picks trade for real right now; the snipe zone is what a post started in the last 3 minutes that buyers are already
  // stepping into, before the crowd
  const picks = out.filter((p) => p.tone !== "avoid" && alive(p.q) && p.score >= 35).sort((p, z) => z.score - p.score);
  const fresh = out
    .filter((p) => p.tone !== "avoid" && p.signal && a.now - p.t0 < 180_000 && !picks.includes(p) && stirring(p.q))
    .sort((p, z) => postWeight(z.signal!) - postWeight(p.signal!) || z.t0 - p.t0);
  const traps = out.filter((p) => p.tone === "avoid").sort((p, z) => (z.q?.w2 ?? 0) - (p.q?.w2 ?? 0));
  return { picks, fresh, traps };
}

/** a launch with people in it already: 3+ different buyers, 3+ buys in the last 2 minutes, and more buys than sells */
export const stirring = (q: Quick | null) => !!q && q.w2 >= 3 && q.b2 >= 3 && q.b2 >= q.s2;

/** trading for real: 5+ different buyers and 10+ trades in the last 2 minutes */
export const alive = (q: Quick | null) => !!q && q.w2 >= 5 && q.b2 + q.s2 >= 10;

/** the launches a post points to that yeppo has not read yet (asked for through /api/quick) */
export function wanted(a: { launches: Launch[]; signals: Signal[]; known: Set<string>; now: number }): string[] {
  const out = new Set<string>();
  for (const s of a.signals) if (a.now - s.at < 900_000) for (const m of s.cas) if (!a.known.has(m)) out.add(m);
  for (const l of a.launches) if (!a.known.has(l.mint) && a.now - l.t < 1_200_000 && matchSignal(l, a.signals)) out.add(l.mint);
  return [...out].slice(0, 10);
}

/** where a coin opens: Axiom, through yeppo.it/go (it finds the coin's pool) */
export const axiomUrl = (mint: string) => `https://yeppo.it/go/${mint}`;

/** a creator's record (yr_devs_s): coins in 14 days, rugs, runners, and whether their past coins went well */
export type DevRecord = { dev: string; coins: number; rugs: number; ran: number; ok: boolean };

/** the first seconds, as the browser saw them (lib/early) */
export type EarlyRead = { buys: number; sells: number; wallets: number; solIn: number; devShare: number; devSold: boolean; hidden: number; ring: number; priceX: number; fromHigh: number };

/** a launch a post started, judged on its first seconds: trap, or a score with the reasons. No database needed but the
 *  creator's record. Null until it has 3 different buyers (nothing to read before). */
export function earlyJudge(a: { l: Launch & { dev: string | null; uri: string | null }; e: EarlyRead; dev: DevRecord | null; signal: Signal; now: number }): Pick | null {
  const { l, e, dev, signal, now } = a;
  const base = { mint: l.mint, sym: l.sym, name: l.name, t0: l.t, signal, copies: 0, original: true, q: null };
  const age = Math.round((now - l.t) / 1000);
  const label = `Early read · ${age}s`;
  const bot = botLaunched(l.uri);
  let trap: string | null = null;
  if (e.devShare >= 0.2) trap = `The creator bought ${pc(e.devShare)} at launch.`;
  else if (e.hidden >= 0.4) trap = `Hidden bundle: ${pc(e.hidden)} of the supply went out at launch without a trade anyone saw.`;
  else if (bot && (e.hidden >= 0.25 || e.devShare >= 0.15)) trap = `Launched by a tweet-deploy bot with ${pc(Math.max(e.hidden, e.devShare))} taken at launch.`;
  else if (e.ring >= 0.6) trap = `Fake demand: 3 wallets made ${pc(e.ring)} of the buying.`;
  else if (e.fromHigh <= -0.35) trap = `Already dumped ${pc(-e.fromHigh)} from its high.`;
  else if (dev && (!dev.ok || dev.rugs >= 2)) trap = `The creator's past coins went bad (${dev.rugs} rugged of ${dev.coins}).`;
  // a farm only when its coins never take off (see deadFarm in lib/decide): most farms' coins do like anyone's
  else if (dev && dev.coins >= 40 && dev.ran < dev.coins * 0.05) trap = `The creator launched ${dev.coins} coins in 14 days and none took off.`;
  if (trap) return { ...base, score: 0, tone: "avoid", label, why: [], warn: [], trap };
  if (e.wallets < 3 || e.buys < 3) return null;

  const why: { p: number; s: string }[] = [];
  why.push({ p: Math.round(40 * postWeight(signal)), s: `${signal.cas.includes(l.mint) ? "Posted" : "Named after a post"} by @${signal.author} (${k(signal.followers)} followers)` });
  why.push({ p: Math.min(25, e.wallets * 2), s: `${e.wallets} buyers in ${age}s, ${e.solIn.toFixed(1)} SOL in` });
  if (e.hidden < 0.05 && e.devShare < 0.05) why.push({ p: 15, s: `Clean launch: creator ${pc(e.devShare)}, nothing hidden (${pc(e.hidden)})` });
  if (dev && dev.ran > 0 && dev.rugs === 0) why.push({ p: 8, s: `The creator's coins ran before (${dev.ran} of ${dev.coins})` });
  if (dev && dev.coins <= 1) why.push({ p: 3, s: "The creator's first coin" });
  const warn: string[] = [];
  let score = why.reduce((s, w) => s + w.p, 0);
  if (e.hidden >= 0.05) (warn.push(`${pc(e.hidden)} taken at launch, unseen`), (score -= e.hidden >= 0.15 ? 20 : 10));
  if (e.devShare >= 0.05) (warn.push(`Creator bought ${pc(e.devShare)}`), (score -= e.devShare >= 0.1 ? 20 : 10));
  if (e.ring >= 0.45) (warn.push(`3 wallets made ${pc(e.ring)} of the buying`), (score -= 10));
  if (bot) warn.push("Launched by a tweet-deploy bot");
  if (!dev) warn.push("Creator's record still loading");
  score = Math.max(0, Math.min(100, score));
  return { ...base, score, tone: score >= 55 ? "early" : "watch", label, why: why.sort((p, z) => z.p - p.p).map((w) => w.s), warn, trap: null };
}
