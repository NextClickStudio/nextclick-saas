// yeppo.it/api/trends: the meme waves of the moment. Every pump.fun launch name of the last 24 hours is split into
// words; a word launched far more often in the last 30 minutes than usual is a wave (a trend people are piling
// into). For each wave, only its coins born in the last 15 minutes that yeppo would not call Don't buy (no rug, no
// big bundle, not dumped, above launch, no coin farm) and that buyers are piling into right now. Needs a Pro key.
// The database works it out once a minute at most: the answer is shared by everyone.
import { accessOf, DB_HEADERS, LOCKED } from "@/lib/access";
import { SUPABASE_URL } from "@/lib/config";

export const runtime = "edge";

const CORS = { "access-control-allow-origin": "*" };

/** a wave's coin that yeppo would not call Don't buy and that is alive right now: [mint, symbol, launched at, trades,
 *  price now / launch, high / launch, buys in the last 2 min, buying wallets in the last 2 min, price change in the
 *  last 2 min, launch bundle still held, seconds until the creator sold everything (null: still in)] */
export type TrendCoin = [
  string, string | null, number, number, number | null, number | null, number, number, number | null, number | null, number | null,
  boolean, // a copy: a later coin with the original's ticker and far less traction
  boolean, // finished pump.fun's curve: trades on PumpSwap now
  Dex | null, // its last 5 minutes on DexScreener, for coins that finished the curve
];
export type Dex = { b5: number; s5: number; ch5: number | null; mcUsd: number | null };
export type Trend = { theme: string; n30: number; n24: number; burst: number; coins: TrendCoin[] };

/** a coin wallets with a record are buying now (yr_smart_s): who = [wallet, wins, hit rate, SOL in] */
export type SmartCoin = {
  mint: string; sym: string | null; t0: number; n: number; mc: number; nowx: number; hix: number;
  smart: number; out: number; hit: number; first: number; who: [string, number, number, number][];
  buys2: number; sells2: number; wal2: number; ch2: number | null; bun: number | null; grad: boolean;
};
/** coins proven wallets are in that did not pass yeppo's checks, with the first reason */
export type NearCoin = { mint: string; sym: string | null; t0: number; mc: number; smart: number; hit: number; why: string };
/** past calls: best market cap within an hour against the call's (median), how many did +50% and ×2 */
export type SmartRecord = { calls: number; up50: number; up2: number; median: number };
export type Smart = { smart: SmartCoin[]; near?: NearCoin[]; record?: SmartRecord | null; wallets: number; learning: number };

let cache: { t: number; v: Trend[]; s: Smart | null } | null = null;

type Pair = { baseToken?: { address?: string }; liquidity?: { usd?: number }; txns?: { m5?: { buys: number; sells: number } }; priceChange?: { m5?: number }; marketCap?: number };

/** coins that finished the curve trade on PumpSwap, where yeppo's capture doesn't see them: their last 5 minutes from
 *  DexScreener (one call for all of them). Kept only while buyers still lead and the price holds. */
async function withDex(v: Trend[]): Promise<Trend[]> {
  const moved = [...new Set(v.flatMap((t) => t.coins.filter((c) => c[12]).map((c) => c[0])))].slice(0, 30);
  const dex = new Map<string, Dex>();
  if (moved.length) {
    try {
      const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${moved.join(",")}`, { signal: AbortSignal.timeout(4000) });
      const pairs = (await r.json()) as Pair[];
      for (const m of moved) {
        const p = (Array.isArray(pairs) ? pairs : []).filter((x) => x.baseToken?.address === m).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        if (p?.txns?.m5) dex.set(m, { b5: p.txns.m5.buys, s5: p.txns.m5.sells, ch5: p.priceChange?.m5 ?? null, mcUsd: p.marketCap ?? null });
      }
    } catch {
      /* DexScreener did not answer: the coins that finished the curve wait for the next minute */
    }
  }
  return v.map((t) => ({
    ...t,
    coins: t.coins
      .map((c) => (c[12] ? ([...c.slice(0, 13), dex.get(c[0]) ?? null] as TrendCoin) : ([...c.slice(0, 13), null] as TrendCoin)))
      .filter((c) => !c[12] || (c[13] && c[13].b5 >= 15 && c[13].b5 >= c[13].s5 * 0.8 && (c[13].ch5 ?? 0) > -10))
      .slice(0, 3),
  }));
}

/** the smart-money coins: wallets that keep getting into future runners early, buying the same coin now */
async function smart(): Promise<Smart | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_smart_s`, { method: "POST", headers: DB_HEADERS, body: "{}", signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`${r.status}`);
    return (await r.json()) as Smart;
  } catch {
    return cache?.s ?? null;
  }
}

async function trends(): Promise<{ v: Trend[]; s: Smart | null } | null> {
  if (cache && Date.now() - cache.t < 45_000) return cache;
  try {
    const [r, s] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_trends_s`, { method: "POST", headers: DB_HEADERS, body: "{}", signal: AbortSignal.timeout(8000) }),
      smart(),
    ]);
    if (!r.ok) throw new Error(`${r.status}`);
    const v = await withDex((await r.json()) as Trend[]);
    cache = { t: Date.now(), v, s };
    return cache;
  } catch {
    return cache ?? null;
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const acc = await accessOf((q.get("key") ?? "").trim().toUpperCase() || null, q.get("dev"));
  if (!acc.pro)
    return Response.json({ locked: true, reason: acc.reason ?? "nokey", why: LOCKED[acc.reason ?? "nokey"] ?? LOCKED.nokey }, { headers: { ...CORS, "cache-control": "private, no-store" } });
  const c = await trends();
  if (!c) return Response.json({ error: "yeppo is busy, retrying" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  return Response.json({ at: cache?.t ?? Date.now(), trends: c.v, smart: c.s }, { headers: { ...CORS, "cache-control": "public, s-maxage=30" } });
}
