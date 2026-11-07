// The read of one coin, for the extension and the coin page, in one call:
//  * safety: RugCheck's free report (holders, creator, insiders, mint and freeze authority, locked liquidity), plus
//    the launch bundle yeppo saw itself (wallets that bought in the first 3 seconds and what they still hold);
//  * the creator: their other coins from yeppo's index (yr_cc, 14 days) and how each one ended;
//  * the money trail: who funded the creator, and the coins of the other wallets paid by the same money
//    (information only, it never changes the call);
//  * who could dump it: snipers of the first 15 seconds and what they still hold, the biggest single wallet, a big
//    early holder selling now (yr_risk, from yeppo's own trades) and RugCheck's biggest holder;
//  * the moment and the outlook: the last minute against the four before, and the bigger picture over several
//    timeframes, from yeppo's own trades while the coin is on pump.fun's curve, from DexScreener once it trades
//    elsewhere.
// Then one call: Momentum, Opportunity, Wait, Don't buy or Too early. Kept 2.5 s on each server and shared by everyone; the panel
// follows the coin's trades itself in between.
import { after } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { botLaunched, type Check, type Decision, type CoinRow, creatorOf, decide, type DevNow, exitOf, holderBlock, holderChecks, launchOf, outlookCurve, outlookOutside, pulseOf, pulseOutside, type Risk } from "@/lib/decide";
import { accessOf, DB_HEADERS, LOCKED } from "@/lib/access";
import { isMint } from "@/lib/format";
import { oddsOf } from "@/lib/odds";
import { oddsTable } from "@/lib/oddsTable";
import { originOf } from "@/lib/origin";
import { launchRead } from "@/lib/launch";
import { xSignals } from "@/lib/xsignals";
import { nameWord, theCoin } from "@/lib/thecoin";
import { wave } from "@/lib/wave";
import { deepData, deepRead } from "@/lib/deep";
import type { Money, Read } from "@/lib/read";
import { chainChecks, chainPrefetch, rugChecks, rugReport } from "@/lib/rugcheck";

export const runtime = "edge";
// next to the database (eu-west-1): one server region for every user, so the same coin's read is shared by all of
// them for a few seconds, and the four database calls of a read don't each cross Europe
export const preferredRegion = "dub1";

const CORS = { "access-control-allow-origin": "*" };
const DEX: Record<string, string> = { pumpfun: "pump.fun", pumpswap: "PumpSwap", meteora: "Meteora", raydium: "Raydium", orca: "Orca", launchlab: "LaunchLab", moonshot: "Moonshot" };

type Me = {
  t0: number;
  sym: string | null;
  name: string | null;
  n: number;
  mc: number | null;
  ath: number;
  dev_buy: number;
  dev_sell: number;
  dev_tok: number;
  dev_max: number;
  sold_s: number | null;
  sold_mc: number | null;
  out_s: number | null;
  grad: boolean;
  p: number[] | null;
  mc0: number | null;
  rug_s: number | null;
  rug_drop: number | null;
  bun: number | null;
  bun0: number | null;
};
type CreatorRpc = { now: number; dev: string | null; me: Me | null; uri: string | null; birth?: { sym: string | null; name: string | null; t: number } | null; total: number; coins: CoinRow[]; steps: number[][]; from: number; w60: number; risk?: Risk | null; seen?: boolean };

/** the creator's money trail (yr_fund_read): null when the database does not answer in time. A traced trail is kept
 *  a minute per coin on each server: it changes rarely, and the panel reads every 3 s */
const moneyCache = new Map<string, { t: number; v: Money }>();
async function moneyRpc(dev: string, mint: string): Promise<Money | null> {
  const hit = moneyCache.get(mint);
  if (hit && Date.now() - hit.t < 60_000) return hit.v;
  const v = await moneyFetch(dev, mint);
  if (v?.checked) {
    if (moneyCache.size > 500) moneyCache.clear();
    moneyCache.set(mint, { t: Date.now(), v });
  }
  return v;
}
async function moneyFetch(dev: string, mint: string): Promise<Money | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_fund_read_s`, {
      method: "POST",
      headers: DB_HEADERS,
      body: JSON.stringify({ p_dev: dev, p_mint: mint }),
      signal: AbortSignal.timeout(2500),
    });
    return r.ok ? ((await r.json()) as Money) : null;
  } catch {
    return null;
  }
}

/** a creator yeppo has not traced yet: yr-fund traces their money in the background (only yeppo's server may ask,
 *  with the secret), once a minute at most per creator on this instance; the next read shows the result */
const traced = new Map<string, number>();
function traceLater(dev: string, mint: string) {
  const t = traced.get(dev);
  if (t && Date.now() - t < 60_000) return;
  if (traced.size > 2000) traced.clear();
  traced.set(dev, Date.now());
  after(() =>
    fetch(`${SUPABASE_URL}/functions/v1/yr-fund`, {
      method: "POST",
      headers: DB_HEADERS,
      body: JSON.stringify({ dev, mint }),
      signal: AbortSignal.timeout(30_000),
    }).then(
      () => undefined,
      () => undefined,
    ),
  );
}

async function creatorRpc(mint: string, dev: string | null): Promise<CreatorRpc | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_creator_s`, {
      method: "POST",
      headers: DB_HEADERS,
      body: JSON.stringify({ p_mint: mint, p_dev: dev }),
      signal: AbortSignal.timeout(3000),
    });
    return r.ok ? ((await r.json()) as CreatorRpc) : null;
  } catch {
    return null;
  }
}

/** tokens these wallets sold in yeppo's 20-minute window (yr_sold_by) */
async function soldBy(mint: string, whos: string[]): Promise<Record<string, number> | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_sold_by`, { method: "POST", headers: DB_HEADERS, body: JSON.stringify({ p_mint: mint, p_whos: whos }), signal: AbortSignal.timeout(1500) });
    return r.ok ? ((await r.json()) as Record<string, number>) : null;
  } catch {
    return null;
  }
}

/** which of these wallets yeppo saw buy the coin (yr_seen_buyers); null when the database does not answer */
async function seenBuyers(mint: string, whos: string[]): Promise<Set<string> | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_seen_buyers`, {
      method: "POST",
      headers: DB_HEADERS,
      body: JSON.stringify({ p_mint: mint, p_whos: whos }),
      signal: AbortSignal.timeout(1500),
    });
    return r.ok ? new Set((await r.json()) as string[]) : null;
  } catch {
    return null;
  }
}

/** the call this server showed on a coin, once per coin and word (yr_calls: yeppo's record) */
const logged = new Set<string>();
function logCall(mint: string, word: string, ageS: number | null, priceX: number | null, p2: number | null) {
  if (ageS == null || priceX == null || ageS > 7200 || !["Momentum", "Opportunity", "Wait", "Don't buy"].includes(word)) return;
  const k = `${mint}:${word}`;
  if (logged.has(k)) return;
  if (logged.size > 20_000) logged.clear();
  logged.add(k);
  after(() =>
    fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_call_log`, {
      method: "POST",
      headers: DB_HEADERS,
      body: JSON.stringify({ p_mint: mint, p_word: word, p_age: Math.round(ageS), p_x: priceX, p_p2: p2 }),
      signal: AbortSignal.timeout(3000),
    }).then(
      () => undefined,
      () => undefined,
    ),
  );
}

/** a call that holds: one read's noise doesn't flip it. A Don't buy shows at once (a red flag is a red flag); any other
 *  change, and leaving a Don't buy, shows once the new call has held for 4 seconds of reads. From the coins opened on
 *  4 Nov 2026: Wait → Momentum → Don't buy within 15 s, Don't buy → Wait → Momentum → Opportunity within a minute */
const shownCall = new Map<string, { d: Decision; t: number; next?: { word: string; t: number } }>();
function steady(mint: string, d: Decision): Decision {
  const now = Date.now();
  const s = shownCall.get(mint);
  if (shownCall.size > 5000) shownCall.clear();
  if (!s || now - s.t > 60_000 || d.word === s.d.word || d.word === "Don't buy" || d.word === "Too early" || d.word === "Locked") {
    shownCall.set(mint, { d, t: now });
    return d;
  }
  // a different call: shown once it has held for 4 seconds of reads, the last one shown meanwhile (kept fresh)
  if (s.next?.word === d.word && now - s.next.t >= 4000) {
    shownCall.set(mint, { d, t: now });
    return d;
  }
  shownCall.set(mint, { ...s, t: now, next: s.next?.word === d.word ? s.next : { word: d.word, t: now } });
  return s.d;
}

/** what a read without a valid key shows: nothing but the way in. No outside call and no database work. */
function lockedRead(mint: string, reason: string | undefined): Read {
  return {
    mint, symbol: null, name: null, uri: null, image: null, venue: "", url: null, t0: null, mcUsd: null, priceX: null, athX: null,
    liqUsd: null, holders: null, checks: [], pulse: null, outlook: null, creator: null, money: null, dev: null, path: [], down: [],
    decision: { word: "Locked", tone: "learn", why: LOCKED[reason ?? "nokey"] ?? LOCKED.nokey },
    pro: false, locked: true, reason: reason ?? "nokey",
  };
}

const EMPTY_RISK: Risk = { full: false, snipers: 0, sniperHeld: 0, sniperTook: 0, topHeld: 0, dumpers: 0, dumped: 0, sell2: 0, topSell2: 0, smart: 0, hidden: null };

// RugCheck has been failing: read the chain right away instead of waiting for it first
let rugDownUntil = 0;
// the same coin's read, shared by every key on this server instance for a few seconds
const readCache = new Map<string, { t: number; body: Read }>();

let solUsd = 0;
let solAt = 0;
async function solPrice() {
  if (solUsd && Date.now() - solAt < 60_000) return solUsd;
  try {
    const r = await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=SOLUSDT", { signal: AbortSignal.timeout(2500) });
    const p = Number(((await r.json()) as { price?: string }).price);
    if (p > 0) [solUsd, solAt] = [p, Date.now()];
  } catch {
    /* keep the last price */
  }
  return solUsd;
}

type Pair = {
  dexId: string;
  url: string;
  liquidity?: { usd?: number };
  txns?: { m5?: { buys: number; sells: number }; h1?: { buys: number; sells: number } };
  volume?: { m5?: number; h1?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  pairCreatedAt?: number;
  marketCap?: number;
  baseToken?: { symbol?: string; name?: string };
  info?: { imageUrl?: string; socials?: { type?: string; url?: string }[]; websites?: { url?: string }[] };
  boosts?: { active?: number };
};

/** the coin's deepest pool on DexScreener (free, public, 300 calls a minute): kept 10 s per coin on each server */
const dexCache = new Map<string, { t: number; v: Awaited<ReturnType<typeof dexFetch>> }>();
async function dexscreener(mint: string) {
  const hit = dexCache.get(mint);
  if (hit && Date.now() - hit.t < 10_000) return hit.v;
  const v = await dexFetch(mint);
  if (dexCache.size > 500) dexCache.clear();
  dexCache.set(mint, { t: Date.now(), v });
  return v;
}
async function dexFetch(mint: string) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(3500) });
    const j = (await r.json()) as { pairs?: Pair[] };
    const p = j.pairs?.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    if (!p) return null;
    return {
      dex: p.dexId,
      url: p.url,
      liq: p.liquidity?.usd ?? null,
      mcap: p.marketCap ?? null,
      m5: p.txns?.m5 ?? null,
      h1: p.txns?.h1 ?? null,
      vol5: p.volume?.m5 ?? null,
      ch5: p.priceChange?.m5 ?? null,
      ch1: p.priceChange?.h1 ?? null,
      ch6: p.priceChange?.h6 ?? null,
      ch24: p.priceChange?.h24 ?? null,
      born: p.pairCreatedAt ?? null,
      symbol: p.baseToken?.symbol ?? null,
      name: p.baseToken?.name ?? null,
      image: p.info?.imageUrl ?? null,
      boosts: p.boosts?.active ?? 0,
      socialList: p.info?.socials ?? [],
      siteList: p.info?.websites ?? [],
      socials: (p.info?.socials?.length ?? 0) + (p.info?.websites?.length ?? 0),
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const mint = (q.get("mint") ?? "").trim();
  const key = (q.get("key") ?? "").trim().toUpperCase() || null;
  const devId = q.get("dev");
  if (!isMint(mint)) return Response.json({ error: "That is not a coin address" }, { status: 400, headers: CORS });
  const acc = await accessOf(key, devId);
  if (!acc.pro) return Response.json(lockedRead(mint, acc.reason), { headers: { ...CORS, "cache-control": "private, no-store" } });
  // everything that does not depend on anything else, at once
  const hot = readCache.get(mint);
  if (hot && Date.now() - hot.t < 2500) return Response.json(hot.body, { headers: { ...CORS, "cache-control": "private, max-age=2" } });
  if (Date.now() < rugDownUntil) void chainPrefetch(mint);
  // the coins with the same name start loading as soon as yeppo knows the name (its launch, from the first answer)
  const firstP = creatorRpc(mint, null);
  const namedP = firstP.then((f) => {
    const w = nameWord(f?.me?.sym ?? f?.birth?.sym ?? null);
    return /^[a-z0-9]{3,20}$/.test(w) ? wave(w, 30_000) : null;
  });
  // and its X origin as soon as the launch's metadata and DexScreener's listing are known
  const dexP = dexscreener(mint);
  const originP = Promise.all([firstP, dexP]).then(([f, d]) => originOf(mint, f?.uri ?? null, d?.socialList ?? [], d?.siteList ?? []));
  const [rug, first, sol, dex, oddsT, named0, origin] = await Promise.all([rugReport(mint), firstP, solPrice(), dexP, oddsTable(), namedP, originP]);
  rugDownUntil = rug ? 0 : Date.now() + 120_000;
  // the deeper checks (same-amount buys, fresh holders, serial creator, copied ticker...) run alongside the rest
  const deepP = deepData(mint, (rug?.tops ?? []).map((t) => t.owner));
  // a coin yeppo did not see launch: ask again with the creator RugCheck names; RugCheck down: the basic checks
  // straight from the chain
  const [second, chain] = await Promise.all([
    !first?.me && rug?.dev ? creatorRpc(mint, rug.dev) : null,
    rug ? null : chainChecks(mint, first?.dev ?? null),
  ]);
  const cr = second ?? first;
  const me = cr?.me ?? null;
  const now = cr?.now ?? Date.now();
  const steps = cr?.steps ?? [];
  // graduation reaches yeppo's record a minute or two late: a coin DexScreener already sees trading in another pool
  // (PumpSwap, Raydium...) has left the curve, and its curve trades have stopped
  const moved = !!dex && dex.dex !== "pumpfun" && (dex.m5?.buys ?? 0) + (dex.m5?.sells ?? 0) > 0;
  const onCurve = !!me && !me.grad && !moved && steps.length > 0;
  const out = onCurve ? null : dex;
  const money = cr?.dev ? await moneyRpc(cr.dev, mint) : null;
  if (cr?.dev && money && !money.checked) traceLater(cr.dev, mint);
  if (!rug && !cr && !out) return Response.json({ error: "yeppo is busy, retrying" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  // what could not be read this time: yeppo never says Momentum without it
  const down: Read["down"] = [];
  if (!rug) down.push("rugcheck");
  if (!cr) down.push("history");

  const checks: Check[] = rug ? rugChecks(rug) : (chain?.checks ?? []);
  const creator = cr?.dev ? creatorOf(cr.dev, Number(cr.total) || 0, cr.coins ?? [], now) : null;
  const t0 = me?.t0 ?? cr?.birth?.t ?? out?.born ?? null;
  const ageS = t0 ? (now - t0) / 1000 : null;
  const base = launchOf(me?.mc0, me?.p);
  const dev: DevNow | null = me
    ? {
        bought: me.dev_buy > 0,
        sold: me.sold_s != null,
        out: me.out_s != null,
        soldS: me.sold_s,
        soldX: me.sold_mc != null ? me.sold_mc / base : null,
        rugS: me.rug_s,
        rugDrop: me.rug_drop,
      }
    : null;

  // the coin's own first 20 minutes, as multiples of the launch price
  let path: [number, number][] = [];
  if (me?.p?.length) path = me.p.map((v, i) => [(i + 1) * 30, v / base]);
  else if (me && cr && cr.from === me.t0) path = steps.map((s) => [(s[0] + 1) * 10, s[1] / base]);

  const nowStep = cr ? Math.floor((now - cr.from) / 10_000) : 0;
  const pulse = onCurve ? pulseOf(steps, nowStep, cr?.w60 ?? null, sol) : out ? pulseOutside(out) : null;
  const priceMc = onCurve ? (steps[steps.length - 1]?.[1] ?? me?.mc ?? null) : null;
  // a pump.fun coin trading elsewhere now: its price from DexScreener, its high from what yeppo saw
  const mcSol = priceMc ?? (out?.mcap && sol ? out.mcap / sol : null);
  const priceX = me && mcSol != null ? mcSol / base : null;
  const athX = me && mcSol != null ? Math.max(me.ath, mcSol) / base : null;
  const outlook = onCurve ? outlookCurve(steps, nowStep, priceX, athX) : out ? outlookOutside(out) : null;

  let outsideNo: string | null = null;
  if (out && !onCurve) {
    const n = out.m5 ? out.m5.buys + out.m5.sells : 0;
    if (out.liq != null && out.liq < 10_000) outsideNo = "Liquidity under $10K. Hard to sell.";
    else if (out.ch1 != null && out.ch1 <= -50) outsideNo = `Down ${Math.round(-out.ch1)}% in the last hour.`;
    else if (n < 5 && (ageS ?? 1e9) > 600) outsideNo = "Nobody is trading it.";
  }
  // who could dump it: yeppo's own view of the coin's trades, and RugCheck's biggest holder for coins of any age
  // insiders together: what the first 15 s buyers still hold (the bundle among them) plus the creator's bag
  // Who holds it NOW, on real balances where the chain has them. yeppo misses some trades (launches and bot trades
  // whose logs are cut), so what it counted from trades alone could be off both ways ($ticker: creator 0% counted,
  // 9% real, then a rug; $GRANDPA: bundle 53% counted, 38% real).
  // - the creator: the larger of yeppo's count and the real balance (RugCheck)
  const devHeld = Math.max(me ? Math.max(0, me.dev_tok) / 1e9 : 0, rug?.creator ?? 0);
  // - the launch bundle: the first-3-second buyers still holding (yeppo), or the top holders RugCheck links by funding
  const linked = rug ? rug.tops.filter((t) => t.insider).reduce((a, t) => a + t.pct, 0) : 0;
  // - the launch bundle read from the chain (free public node): the wallets of the first 2 blocks, and what they hold now: their
  //   real balance when they are among the top holders, else what they bought less what yeppo saw them sell
  const lr = onCurve || (ageS ?? 1e9) < 7200 ? await launchRead(mint, ageS) : null;
  const launch = lr?.launch ?? null;
  let launchNow: number | null = null;
  if (launch?.wallets.length) {
    const sold = (await soldBy(mint, launch.wallets.map((w) => w[0]))) ?? {};
    const real = new Map((rug?.tops ?? []).map((t) => [t.owner, t.pct]));
    launchNow = launch.wallets.reduce((a, [w, took]) => a + (real.get(w) ?? Math.max(0, took - (sold[w] ?? 0) / 1e9)), 0);
  }
  // (RugCheck's "linked" wallets, its bubble map, count as big wallets below, not as a launch bundle, 4 Nov 2026)
  void linked;
  const bun = launchNow ?? me?.bun ?? 0;
  // - supply nobody was seen buying: only as much as real top holders yeppo never saw buy actually hold (not needed
  //   once the launch bundle is read from the chain)
  let hidden = launch ? null : (cr?.risk?.hidden ?? null);
  if (hidden != null && hidden > 0 && rug?.tops.length) {
    const seen = await seenBuyers(mint, rug.tops.map((t) => t.owner));
    if (seen) hidden = Math.min(hidden, rug.tops.filter((t) => !seen.has(t.owner)).reduce((a, t) => a + t.pct, 0));
  }
  const snipers = cr?.risk?.full ? cr.risk.sniperHeld : 0;
  // the biggest holders yeppo watches for sells: only wallets the chain shows among the real top holders, with their
  // real share (yeppo misses some of their buys, so from its trades alone profit-taking looked like dumping)
  const realTop = new Map((rug?.tops ?? []).map((t) => [t.owner, t.pct]));
  const tops = (cr?.risk?.tops ?? []).filter((t) => realTop.has(t.w)).map((t) => ({ ...t, h: realTop.get(t.w)! }));
  // one picture of who holds it: where the chain has real balances (RugCheck's top holders), the biggest wallet, the
  // top 10 and "a big holder dumping" come from them, not from yeppo's own count of trades (which misses some)
  const real = rug
    ? { topHeld: rug.top1, top10Held: rug.top10, dumpers: 0, dumped: 0 }
    : {};
  // the launch bundle check, on the same number the holder bar shows
  if (launch || (me?.bun0 != null && me.bun0 >= 0.03)) {
    const pc = `${Math.round(bun * 100)}%`;
    checks.push({ ok: bun < 0.2, label: bun < 0.2 ? `Launch bundle holds ${pc}` : `Launch bundle holds ${pc}. They can dump together.` });
  }
  // big wallets: real top holders with 3%+ of the supply that aren't the creator or the launch bundle. They can move the
  // price like insiders (4 Nov 2026: big wallets selling together sank a coin with insiders at 14%), so they count in
  const inLaunch = new Set((launch?.wallets ?? []).map((w) => w[0]));
  // and the wallets RugCheck links together (its bubble map: same funder, moving together) count as one big wallet:
  // many small wallets of one hand can dump like a whale. The verdict waits for them ("Checking"), so it doesn't flip
  const big = (rug?.tops ?? [])
    .filter((t) => (t.pct >= 0.03 || t.insider) && t.owner !== (cr?.dev ?? rug?.dev) && !inLaunch.has(t.owner))
    .reduce((a, t) => a + t.pct, 0);
  const risk: Risk | null =
    cr?.risk || rug
      ? {
          ...(cr?.risk ?? EMPTY_RISK),
          ...real,
          tops,
          hidden,
          top1: rug?.top1 ?? null,
          bun,
          bot: botLaunched(cr?.uri),
          dev: devHeld,
          big,
          insiders: devHeld + Math.max(bun, hidden ?? 0) + snipers + big,
        }
      : null;
  let decision = decide({ checks, creator, dev, ageS, priceX, athX, pulse, outlook, outsideNo, bun0: bun, risk });
  // a pump.fun coin yeppo has no trade of at all: nobody can say who got its supply at launch, so no Momentum
  if (!cr?.risk && mint.endsWith("pump") && !me?.grad && decision.word === "Momentum")
    decision = { word: "Wait", tone: "mid", why: "yeppo hasn't seen this coin trade yet, so it can't check who got the supply at launch. Wait a minute." };
  // the facts that say get out now: a Momentum never stands on them
  // (the Exit alert is gone, 4 Nov 2026: yeppo is for finding the coin, and holders' sells reach it too late to time an
  // exit; a big holder dumping still shows in who holds it and in the checks)
  const exit: string | null = null;
  // a bounce after a big drop is not a Momentum: more than 40% under its high, the push has to rebuild first
  const fell = priceX != null && athX != null && athX > 1.5 ? 1 - priceX / athX : 0;
  const bounce = fell > 0.4 ? `Bouncing after a ${Math.round(fell * 100)}% drop from its high. Wait for it to hold.` : null;
  if (bounce && decision.word === "Momentum") decision = { word: "Wait", tone: "mid", why: bounce };
  // shown under Safety after the call: some of them only hold Momentum back, they don't make it a Don't buy
  checks.push(...holderChecks(risk));
  // the holders could not be read this time (RugCheck down and the public node busy): the call stands, with a note
  const holdersKnown = !!rug || !!chain?.hasHolders;
  if (!holdersKnown && checks.length) decision = { ...decision, why: `${decision.why} Top holders couldn't be read right now: check them on the chart.` };
  if (!cr) decision = { ...decision, why: `${decision.why} The creator's history isn't answering right now.` };


  // the other coins with this name (last 2 hours): is it THE coin? The list is kept 30 s per name on this server
  const sym = me?.sym ?? cr?.birth?.sym ?? out?.symbol ?? null;
  const word = nameWord(sym);
  const named = named0 ?? (/^[a-z0-9]{3,20}$/.test(word) ? await wave(word, 30_000) : null);
  const xs = await xSignals(mint, t0, origin, (named ?? []).filter((c) => c.match >= 1).map((c) => c.mint));
  const live1m = (pulse?.trades1m ?? 0) > 0 || (out?.m5 ? out.m5.buys + out.m5.sells > 0 : false);
  const thecoin = named
    ? theCoin(mint, sym, named, {
        mcUsd: priceMc != null && sol ? priceMc * sol : (out?.mcap ?? null),
        nowx: priceX,
        hix: athX,
        w2: pulse?.wallets1m ?? cr?.w60 ?? null,
        n: me?.n ?? steps.reduce((q, z) => q + (z[4] ?? 0) + (z[5] ?? 0), 0),
        live: live1m,
        t0,
      })
    : null;

  // the odds of coins like this one, on pump.fun's curve in its first 16 minutes
  const odds = onCurve ? oddsOf(oddsT, { ageS, priceX, creator, dev }) : null;

  // nothing in the way: no failed check, no holder warning, no reason to exit. Only then can the call go green, here
  // or in the panel's live read (which follows the trades between reads), so it doesn't say Momentum and then, a read
  // later, Don't buy
  const clear = !checks.some((c) => !c.ok) && !holderBlock(risk) && !exit && decision.word !== "Don't buy";
  // the odds of coins like this one, when they are in the best fifth (×2 for 15%+ of them from here, checked on days
  // the table was not built from): a clean coin in that group is an Opportunity
  if (clear && decision.word === "Wait" && odds && odds.p2 >= 0.15 && (ageS ?? 0) >= 30 && pulse && pulse.state !== "quiet" && pulse.state !== "cooling")
    decision = { word: "Opportunity", tone: "up", why: `Clean so far, and coins like this went ×2 ${Math.round(odds.p2 * 100)}% of the time from here.` };
  // a pullback Opportunity needs coins like this one to have run at least now and then (×2 for 8%+ of them from here)
  if (decision.pullback && odds && odds.p2 < 0.08)
    decision = { word: "Wait", tone: "mid", why: `Pullback in an uptrend, but coins like this rarely ran from here (×2 ${Math.round(odds.p2 * 100)}% of the time). Wait for buyers to step back in.` };
  // real balances not in yet (RugCheck slow): no green call until they are
  if (!rug && (decision.word === "Momentum" || decision.word === "Opportunity"))
    decision = { word: "Wait", tone: "learn", why: "Checking the real holders on chain. A second." };
  decision = steady(mint, decision);
  // the verdict shown: is the coin safe, not when to get in (4 Nov 2026, the user's call). Danger: any red flag (failed
  // check, rugger creator, insiders 35%+, a hidden bundle, a dumped coin); Risky: something to watch in who holds it
  // (insiders 20%+, one big wallet, a big holder selling); Safe: nothing wrong found. The timing call above still feeds
  // the Record
  const timing = decision;
  const safe = decide({ checks, creator, dev, ageS: 1e6, priceX, athX, pulse: null, outlook: null, outsideNo, bun0: bun, risk });
  const hbNow = holderBlock(risk);
  const insPc = risk?.insiders != null ? `insiders ${Math.round(risk.insiders * 100)}%` : null;
  // no verdict before the facts it rests on: the real holders and the launch bundle. A Safe that turns Risky 5 seconds
  // later is worse than a few seconds of "Checking"
  const settled = holdersKnown && lr?.state !== "reading";
  if (timing.word === "Locked") decision = timing;
  else if (safe.word === "Don't buy") decision = { word: "Danger", tone: "down", why: safe.why };
  else if (hbNow) decision = { word: "Risky", tone: "mid", why: hbNow.why };
  else if (!settled) decision = { word: "Too early", tone: "learn", why: "Checking the real holders and the launch bundle on chain. The verdict in a few seconds." };
  else
    decision = {
      word: "Safe",
      tone: "up",
      why: `Nothing wrong found${[insPc, creator ? (creator.total <= 1 ? "creator's first coin" : `creator: ${creator.total} coins, ${creator.rugs} rugged`) : null, `${checks.filter((c) => c.ok).length}/${checks.length} checks safe`].filter(Boolean).length ? `: ${[insPc, creator ? (creator.total <= 1 ? "creator's first coin" : `creator: ${creator.total} coins, ${creator.rugs} rugged`) : null, `${checks.filter((c) => c.ok).length}/${checks.length} checks safe`].filter(Boolean).join(", ")}` : ""}.${!rug ? " Real holders still loading." : ""}`,
    };
  logCall(mint, timing.word, ageS, priceX, odds?.p2 ?? null);

  const mcNow = priceMc != null && sol ? priceMc * sol : (out?.mcap ?? null);
  const deep = deepRead(await deepP, {
    tops: rug?.tops ?? [],
    ageS,
    mcUsd: mcNow,
    social: (!!origin && origin.kind !== "none") || (dex?.socialList?.length ?? 0) > 0,
  });
  const body: Read = {
    mint,
    symbol: me?.sym ?? cr?.birth?.sym ?? out?.symbol ?? null,
    name: me?.name ?? cr?.birth?.name ?? out?.name ?? null,
    uri: cr?.uri ?? null,
    image: out?.image ?? null,
    venue: onCurve ? "pump.fun" : out ? (DEX[out.dex] ?? out.dex) : me?.grad ? "PumpSwap" : "pump.fun",
    url: out?.url ?? null,
    t0,
    mcUsd: priceMc != null && sol ? priceMc * sol : (out?.mcap ?? null),
    priceX,
    athX,
    liqUsd: out?.liq ?? null,
    holders: rug?.holders ?? chain?.holders ?? null,
    decision,
    checks,
    pulse,
    outlook,
    creator,
    money,
    dev,
    path,
    down,
    risk,
    hold: holderBlock(risk)?.why ?? bounce,
    watch: holderBlock(risk)?.watch ?? null,
    exit,
    clear,
    odds,
    thecoin,
    origin,
    xs,
    deep,
    launch: launch ? { wallets: launch.wallets.length, took: launch.took, now: launchNow } : null,
    // the launch bundle still on its way from the chain: about how many seconds until it is in
    // where the launch read stands: in (exact insiders), reading (countdown, attempt), unavailable (said plainly), null
    launchState: lr?.state ?? null,
    launchEta: lr?.eta ?? null,
    launchTry: lr?.attempt ?? null,
    // which parts of this read are in for real: the panel shows the call only once they all are (or after 10 s)
    // (a coin in its first 30 s opens on the early read right away: its holders and launch are still landing, and the
    // panel shows them as "Checking" until they do)
    ready: {
      holders: holdersKnown || (ageS ?? 1e9) < 30,
      creator: !!cr,
      launch: lr?.state !== "reading" || (ageS ?? 1e9) < 30,
      x: !origin || origin.kind === "none" || xs != null || (ageS ?? 1e9) < 30,
    },
    boosts: dex?.boosts ?? 0,
    pro: true,
    // the starting point for the panel's live trades (coins on pump.fun's curve)
    live: onCurve && cr ? { from: cr.from, now, steps, w60: cr.w60 ?? null, sol, devSold: !!dev?.sold, bun0: bun } : null,
  };
  if (readCache.size > 300) readCache.clear();
  readCache.set(mint, { t: Date.now(), body });
  return Response.json(body, { headers: { ...CORS, "cache-control": "public, s-maxage=2" } });
}
