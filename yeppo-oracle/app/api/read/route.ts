// The read of one coin, for the extension and the coin page, in one call:
//  * safety: RugCheck's free report (holders, creator, insiders, mint and freeze authority, locked liquidity), plus
//    the launch bundle yeppo saw itself (wallets that bought in the first 3 seconds and what they still hold);
//  * the creator: their other coins from yeppo's index (yr_cc, 14 days) and how each one ended;
//  * the moment and the outlook: the last minute against the four before, and the bigger picture over several
//    timeframes, from yeppo's own trades while the coin is on pump.fun's curve, from DexScreener once it trades
//    elsewhere.
// Then one call: Momentum, Wait, Don't buy or Too early. Cached at the edge for 5 s and shared by everyone.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { type Check, type CoinRow, creatorOf, decide, type DevNow, launchOf, outlookCurve, outlookOutside, pulseOf, pulseOutside } from "@/lib/decide";
import { isMint } from "@/lib/format";
import type { Read } from "@/lib/read";
import { rugChecks, rugReport } from "@/lib/rugcheck";

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

async function creatorRpc(mint: string, dev: string | null): Promise<CreatorRpc | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_creator`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ p_mint: mint, p_dev: dev }),
      signal: AbortSignal.timeout(4000),
    });
    return r.ok ? ((await r.json()) as CreatorRpc) : null;
  } catch {
    return null;
  }
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
  const mint = new URL(req.url).searchParams.get("mint") ?? "";
  if (!isMint(mint)) return Response.json({ error: "That is not a coin address" }, { status: 400, headers: CORS });
  const [rug, first, sol] = await Promise.all([rugReport(mint), creatorRpc(mint, null), solPrice()]);
  // a coin yeppo did not see launch: ask again with the creator RugCheck names
  const cr = !first?.me && rug?.dev ? ((await creatorRpc(mint, rug.dev)) ?? first) : first;
  const me = cr?.me ?? null;
  const now = cr?.now ?? Date.now();
  const steps = cr?.steps ?? [];
  const onCurve = !!me && !me.grad && steps.length > 0;
  const out = onCurve ? null : await dexscreener(mint);
  if (!rug && !cr && !out) return Response.json({ error: "yeppo is busy, retrying" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });

  const checks: Check[] = rug ? rugChecks(rug) : [];
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
  const decision = decide({ checks, creator, dev, ageS, priceX, athX, pulse, outlook, outsideNo });

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
    holders: rug?.holders ?? null,
    decision,
    checks,
    pulse,
    outlook,
    creator,
    dev,
    path,
  };
  return Response.json(body, { headers: { ...CORS, "cache-control": rug ? "public, s-maxage=5, stale-while-revalidate=10" : "no-store" } });
}
