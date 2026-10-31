// The read of one coin, for the extension and the coin page, in one call:
//  * safety: RugCheck's free report (holders, creator, insiders, mint and freeze authority, locked liquidity), plus
//    the launch bundle yeppo saw itself (wallets that bought in the first 3 seconds and what they still hold);
//  * the creator: their other coins from yeppo's index (yr_cc, 14 days) and how each one ended;
//  * the money trail: who funded the creator, and the coins of the other wallets paid by the same money
//    (information only, it never changes the call);
//  * the moment and the outlook: the last minute against the four before, and the bigger picture over several
//    timeframes, from yeppo's own trades while the coin is on pump.fun's curve, from DexScreener once it trades
//    elsewhere.
// Then one call: Momentum, Wait, Don't buy or Too early. Cached at the edge for 5 s and shared by everyone.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { type Check, type CoinRow, creatorOf, decide, type DevNow, launchOf, outlookCurve, outlookOutside, pulseOf, pulseOutside } from "@/lib/decide";
import { isMint } from "@/lib/format";
import type { Money, Read } from "@/lib/read";
import { chainChecks, rugChecks, rugReport } from "@/lib/rugcheck";

export const runtime = "edge";

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
type CreatorRpc = { now: number; dev: string | null; me: Me | null; uri: string | null; total: number; coins: CoinRow[]; steps: number[][]; from: number; w60: number };

/** the creator's money trail (yr_fund_read): null when the database does not answer in time */
async function moneyRpc(dev: string, mint: string): Promise<Money | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_fund_read`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ p_dev: dev, p_mint: mint }),
      signal: AbortSignal.timeout(2500),
    });
    return r.ok ? ((await r.json()) as Money) : null;
  } catch {
    return null;
  }
}

async function creatorRpc(mint: string, dev: string | null): Promise<CreatorRpc | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_creator`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ p_mint: mint, p_dev: dev }),
      signal: AbortSignal.timeout(3000),
    });
    return r.ok ? ((await r.json()) as CreatorRpc) : null;
  } catch {
    return null;
  }
}

const KEY = /^YEP-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$/;
const DEV = /^[0-9a-f-]{36}$/;
type Access = { pro: boolean; reason?: string };
const access = new Map<string, { t: number; v: Access }>();

/** does this key unlock yeppo on this device (yr_access)? Kept a minute per key and device. When the database does
 *  not answer, the last answer stands; with none, a well-formed key is let through and no key is not. */
async function accessOf(key: string | null, dev: string | null): Promise<Access> {
  const k = key && KEY.test(key) ? key : "";
  const d = dev && DEV.test(dev) ? dev : "";
  // no key (or a malformed one): one shared answer, so made-up device ids never reach the database
  const ck = k ? `${k}:${d}` : "";
  const hit = access.get(ck);
  if (hit && Date.now() - hit.t < 60_000) return hit.v;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_access`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ p_key: k, p_dev: d || null }),
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) throw new Error(`${r.status}`);
    const j = (await r.json()) as { pro?: boolean; reason?: string };
    const v = { pro: !!j.pro, reason: j.reason };
    if (access.size > 5000) access.clear();
    access.set(ck, { t: Date.now(), v });
    return v;
  } catch {
    return hit?.v ?? { pro: !!k, reason: k ? undefined : "nokey" };
  }
}

const LOCKED: Record<string, string> = {
  nokey: "yeppo needs a Pro key. Get one below, or paste yours.",
  unknown: "That key doesn't exist. Check it, or paste the one from your payment.",
  expired: "Your Pro key has expired. Renew it on yeppo.it/pricing: the same key keeps working.",
  devices: "This key is already used on 3 devices. Write to info@yeppo.it to move it.",
  nodevice: "Reload the extension, then try again.",
};

/** what a read without a valid key shows: nothing but the way in. No outside call and no database work. */
function lockedRead(mint: string, reason: string | undefined): Read {
  return {
    mint, symbol: null, name: null, uri: null, image: null, venue: "", url: null, t0: null, mcUsd: null, priceX: null, athX: null,
    liqUsd: null, holders: null, checks: [], pulse: null, outlook: null, creator: null, money: null, dev: null, path: [], down: [],
    decision: { word: "Locked", tone: "learn", why: LOCKED[reason ?? "nokey"] ?? LOCKED.nokey },
    pro: false, locked: true, reason: reason ?? "nokey",
  };
}

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
  info?: { imageUrl?: string };
};

/** the coin's deepest pool on DexScreener (free, public) */
async function dexscreener(mint: string) {
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
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const mint = q.get("mint") ?? "";
  const key = (q.get("key") ?? "").trim().toUpperCase() || null;
  const devId = q.get("dev");
  if (!isMint(mint)) return Response.json({ error: "That is not a coin address" }, { status: 400, headers: CORS });
  const acc = await accessOf(key, devId);
  if (!acc.pro) return Response.json(lockedRead(mint, acc.reason), { headers: { ...CORS, "cache-control": "private, no-store" } });
  // everything that does not depend on anything else, at once
  const [rug, first, sol, dex] = await Promise.all([rugReport(mint), creatorRpc(mint, null), solPrice(), dexscreener(mint)]);
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
  const onCurve = !!me && !me.grad && steps.length > 0;
  const out = onCurve ? null : dex;
  const money = cr?.dev ? await moneyRpc(cr.dev, mint) : null;
  if (!rug && !cr && !out) return Response.json({ error: "yeppo is busy, retrying" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  // what could not be read this time: yeppo never says Momentum without it
  const down: Read["down"] = [];
  if (!rug) down.push("rugcheck");
  if (!cr) down.push("history");

  const checks: Check[] = rug ? rugChecks(rug) : (chain?.checks ?? []);
  // the launch bundle, when yeppo saw the launch: buyers of the first 3 seconds still holding together
  if (me?.bun0 != null && me.bun0 >= 0.03) {
    const b = me.bun ?? 0;
    const pc = `${Math.round(b * 100)}%`;
    checks.push({ ok: b < 0.15, label: b < 0.15 ? `Launch bundle holds ${pc}` : `Launch bundle holds ${pc}. They can dump together.` });
  }
  const creator = cr?.dev ? creatorOf(cr.dev, Number(cr.total) || 0, cr.coins ?? [], now) : null;
  const t0 = me?.t0 ?? out?.born ?? null;
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
  let decision = decide({ checks, creator, dev, ageS, priceX, athX, pulse, outlook, outsideNo });
  if (down.length && decision.word === "Momentum")
    decision = {
      word: "Wait",
      tone: "mid",
      why: down.includes("rugcheck")
        ? "The holder and insider checks aren't answering right now. yeppo won't say Momentum without them."
        : "The creator's history isn't answering right now. yeppo won't say Momentum without it.",
    };

  const body: Read = {
    mint,
    symbol: me?.sym ?? out?.symbol ?? null,
    name: me?.name ?? out?.name ?? null,
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
    pro: true,
  };
  return Response.json(body, { headers: { ...CORS, "cache-control": "public, s-maxage=5, stale-while-revalidate=10" } });
}
