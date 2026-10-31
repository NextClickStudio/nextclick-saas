// The crowd around a coin and how wildly it moves, for the read's "Crowd & volatility" box. Information only: the call
// (Momentum / Wait / Don't buy) never depends on it.
// Sources, all free: yeppo's own trades of the coin (yr_crowd inside yr_creator, no extra database call), RugCheck's
// insider networks, DexScreener (boosts, socials), pump.fun's public coin page data (comments, livestream) and the
// coin's X post (likes and replies through the endpoint X's own embeds read). Every outside answer is kept on this
// server for a while, so a busy coin costs those services one call every 30 s at most.
import { after } from "next/server";
import { mirrors } from "./meta";

export type CrowdDb = { w5: number; new5: number; newPrev: number; clusters: number; clWallets: number; clHeld: number; bigCluster: number };

export type Crowd = {
  /** 0-100: how many people seem to be on it right now */
  interest: number;
  level: "Quiet" | "Some interest" | "Growing" | "Lots of eyes" | "Frenzy";
  traders5: number | null;
  newBuyers5: number | null;
  /** first-time buyers of the 5 minutes before: is the crowd growing? */
  newBuyersPrev: number | null;
  comments: number | null;
  comments10: number | null;
  commenters10: number | null;
  live: boolean;
  watching: number | null;
  xLikes: number | null;
  xReplies: number | null;
  xHandle: string | null;
  boosts: number;
  socials: number;
  /** bubble map: groups of wallets that bought together (same seconds, same amount) and what they hold */
  bubbles: { groups: number; wallets: number; held: number; biggest: number; insiders: number | null; insiderWallets: number | null } | null;
  vol: Volatility | null;
  line: string;
};

export type Volatility = {
  regime: "Calm" | "Lively" | "Wild" | "Extreme";
  /** a usual 5-minute move, either way (one standard deviation) */
  move5: number;
  /** the deepest fall from a high in the last 5 minutes */
  drop5: number | null;
  /** how much a 1 SOL buy lifts the price (coins on pump.fun's curve) */
  impact1: number | null;
  liqUsd: number | null;
  source: "trades" | "dexscreener";
};

const TTL = 30_000;
const hold = <T>() => new Map<string, { t: number; v: T }>();
const pumpCache = hold<{ comments: number | null; comments10: number | null; commenters10: number | null; live: boolean; watching: number | null }>();
const xCache = hold<{ likes: number | null; replies: number | null; handle: string | null } | null>();

async function getJson<T>(url: string, ms = 2500): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: "application/json" } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(+v) ? +v : null);

/** pump.fun's own page data: comment count, the latest comments, and the livestream if the coin is live */
async function pumpfun(mint: string) {
  const hit = pumpCache.get(mint);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const [coin, replies] = await Promise.all([
    getJson<Record<string, unknown>>(`https://frontend-api-v3.pump.fun/coins/${mint}`),
    getJson<unknown>(`https://frontend-api-v3.pump.fun/replies/${mint}?limit=100&offset=0&reverseOrder=true`),
  ]);
  const list = (Array.isArray(replies) ? replies : ((replies as { replies?: unknown[] } | null)?.replies ?? [])) as Record<string, unknown>[];
  const since = Date.now() - 600_000;
  const recent = list.filter((r) => {
    const t = num(r.timestamp) ?? num(r.created_timestamp);
    return t != null && (t < 1e12 ? t * 1000 : t) > since;
  });
  const live = coin?.is_currently_live === true;
  let watching: number | null = num(coin?.num_participants) ?? num(coin?.livestream_participants);
  if (live && watching == null) {
    const ls = await getJson<Record<string, unknown>>(`https://livestream-api.pump.fun/livestream?mintId=${mint}`);
    watching = num(ls?.numParticipants) ?? num(ls?.num_participants) ?? null;
  }
  const v = {
    comments: num(coin?.reply_count),
    comments10: list.length ? recent.length : null,
    commenters10: list.length ? new Set(recent.map((r) => String(r.user ?? r.username ?? ""))).size : null,
    live,
    watching,
  };
  // nothing answered: try again on the next read rather than keep an empty answer
  if (coin || list.length) pumpCache.set(mint, { t: Date.now(), v });
  if (pumpCache.size > 500) pumpCache.clear();
  return v;
}

/** the X post the coin links to: likes and replies, from the endpoint X's embedded posts read (no key, no login) */
async function xPost(uri: string | null) {
  if (!uri) return null;
  const hit = xCache.get(uri);
  if (hit && Date.now() - hit.t < 10 * 60_000) return hit.v;
  let meta: Record<string, unknown> | null = null;
  for (const m of mirrors(uri)) {
    meta = await getJson<Record<string, unknown>>(m, 2500);
    if (meta) break;
  }
  const ext = (meta?.extensions ?? {}) as Record<string, unknown>;
  const tw = String(meta?.twitter ?? ext.twitter ?? "");
  const x = tw.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:\/status(?:es)?\/(\d+))?/);
  let v: { likes: number | null; replies: number | null; handle: string | null } | null = null;
  if (x && x[1] !== "i") {
    v = { likes: null, replies: null, handle: x[1] };
    if (x[2]) {
      const token = ((Number(x[2]) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
      const t = await getJson<{ favorite_count?: number; conversation_count?: number }>(`https://cdn.syndication.twimg.com/tweet-result?id=${x[2]}&lang=en&token=${token}`);
      v.likes = t?.favorite_count ?? null;
      v.replies = t?.conversation_count ?? null;
    }
  }
  if (meta) xCache.set(uri, { t: Date.now(), v });
  if (xCache.size > 500) xCache.clear();
  return v;
}

const sd = (a: number[]) => {
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1));
};

/** how wildly the price moves, from yeppo's 10 s steps [step, close, high, low, ...] (or DexScreener's 5-minute change) */
export function volatilityOf(steps: number[][], nowStep: number, mcSol: number | null, dex: { ch5: number | null; liq: number | null } | null): Volatility | null {
  const last = steps.filter((s) => s[0] > nowStep - 30 && s[1] > 0);
  let move5: number | null = null;
  let drop5: number | null = null;
  let source: Volatility["source"] = "trades";
  if (last.length >= 8) {
    const rets: number[] = [];
    for (let i = 1; i < last.length; i++) {
      const gap = Math.max(1, last[i][0] - last[i - 1][0]);
      rets.push(Math.log(last[i][1] / last[i - 1][1]) / Math.sqrt(gap));
    }
    move5 = Math.exp(sd(rets) * Math.sqrt(30)) - 1;
    let hi = 0;
    let dd = 0;
    for (const s of last) {
      hi = Math.max(hi, s[2] || s[1]);
      dd = Math.max(dd, 1 - (s[3] || s[1]) / hi);
    }
    drop5 = dd;
  } else if (dex?.ch5 != null) {
    move5 = Math.abs(dex.ch5) / 100;
    source = "dexscreener";
  }
  if (move5 == null) return null;
  // pump.fun's curve: constant product of about 30 SOL × 1.073 billion tokens, so its SOL depth is √(mc × 32.2)
  const vsol = mcSol && mcSol > 0 ? Math.sqrt(mcSol * 32.2) : null;
  const impact1 = vsol && source === "trades" ? (1 + 1 / vsol) ** 2 - 1 : null;
  const regime: Volatility["regime"] = move5 < 0.1 ? "Calm" : move5 < 0.25 ? "Lively" : move5 < 0.5 ? "Wild" : "Extreme";
  return { regime, move5, drop5, impact1, liqUsd: dex?.liq ?? null, source };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

type Extras = { pf: Awaited<ReturnType<typeof pumpfun>> | null; xp: Awaited<ReturnType<typeof xPost>> | null };

/** the outside sources (pump.fun, X), never waited on for more than 1.8 s: a slow one fills its cache for the next
 *  read and shows then */
export function crowdExtras(mint: string, uri: string | null, pump: boolean): Promise<Extras> {
  const all = Promise.all([pump ? pumpfun(mint) : Promise.resolve(null), xPost(uri)]).then(([pf, xp]) => ({ pf, xp }));
  const late = new Promise<Extras>((res) =>
    setTimeout(() => {
      const p = pumpCache.get(mint)?.v ?? null;
      const x = uri ? (xCache.get(uri)?.v ?? null) : null;
      res({ pf: p, xp: x });
    }, 1800),
  );
  // let a slow source finish after the answer went out, so its cache is warm for the next read
  try {
    after(() => all.then(() => undefined, () => undefined));
  } catch {
    /* outside a request */
  }
  return Promise.race([all, late]).catch(() => ({ pf: null, xp: null }));
}

/** everything together, with a plain line */
export function crowdOf(o: {
  db: CrowdDb | null;
  steps: number[][];
  nowStep: number;
  mcSol: number | null;
  dex: { ch5: number | null; liq: number | null; boosts: number; socials: number } | null;
  rug: { insiders: number; insiderWallets: number } | null;
  extras: Extras;
}): Crowd {
  const { pf, xp } = o.extras;
  const vol = volatilityOf(o.steps, o.nowStep, o.mcSol, o.dex);
  const d = o.db;
  // interest: traders and new buyers of the last 5 minutes, comments, the X post, boosts; each capped, log scaled
  const lg = (v: number | null | undefined, full: number) => (v && v > 0 ? Math.min(1, Math.log1p(v) / Math.log1p(full)) : 0);
  const parts: [number, number][] = [
    [lg(d?.w5, 400), 35],
    [lg(d?.new5, 300), 20],
    [lg(pf?.comments10, 40), 15],
    [lg(xp?.likes, 2000), 10],
    [lg(pf?.watching, 200), 10],
    [Math.min(1, (o.dex?.boosts ?? 0) / 500 + (o.dex?.socials ?? 0) / 6), 10],
  ];
  const interest = Math.round(parts.reduce((s, [v, w]) => s + v * w, 0));
  const growing = d && d.newPrev > 0 ? d.new5 / d.newPrev : null;
  const level: Crowd["level"] =
    interest >= 75 ? "Frenzy" : interest >= 55 ? "Lots of eyes" : growing != null && growing >= 1.5 && interest >= 30 ? "Growing" : interest >= 25 ? "Some interest" : "Quiet";

  const bubbles = d || o.rug
    ? { groups: d?.clusters ?? 0, wallets: d?.clWallets ?? 0, held: d?.clHeld ?? 0, biggest: d?.bigCluster ?? 0, insiders: o.rug?.insiders ?? null, insiderWallets: o.rug?.insiderWallets ?? null }
    : null;

  const parts2: string[] = [];
  if (vol)
    parts2.push(
      `${vol.regime}: moves of ±${pct(vol.move5)} in 5 min are normal here${vol.impact1 != null ? `, and a 1 SOL buy lifts it ${pct(vol.impact1)}` : ""}.`,
    );
  if (d && d.w5 > 0) parts2.push(`${d.w5} wallets traded in 5 min, ${d.new5} of them new${growing != null && growing >= 1.5 ? ", more than before" : ""}.`);
  if (pf?.comments10) parts2.push(`${pf.comments10} comments on pump.fun in 10 min.`);
  if (pf?.live) parts2.push(`Live on pump.fun${pf.watching ? ` with ${pf.watching} watching` : ""}.`);
  if (bubbles && bubbles.held >= 0.1) parts2.push(`Wallets that bought together hold ${pct(bubbles.held)}: they can move it at once.`);
  return {
    interest,
    level,
    traders5: d?.w5 ?? null,
    newBuyers5: d?.new5 ?? null,
    newBuyersPrev: d?.newPrev ?? null,
    comments: pf?.comments ?? null,
    comments10: pf?.comments10 ?? null,
    commenters10: pf?.commenters10 ?? null,
    live: !!pf?.live,
    watching: pf?.watching ?? null,
    xLikes: xp?.likes ?? null,
    xReplies: xp?.replies ?? null,
    xHandle: xp?.handle ?? null,
    boosts: o.dex?.boosts ?? 0,
    socials: o.dex?.socials ?? 0,
    bubbles,
    vol,
    line: parts2.join(" ") || "Not enough trading yet to read the crowd.",
  };
}
