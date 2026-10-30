// The read of one coin, for the extension's badge and panel: the decision (OK to buy, Risky, Don't buy), the scam
// checks, the verdict, the red flags and the Exit Plan, the same logic as the coin page.
//  * a pump.fun coin yeppo followed from its first trade: the look-alikes and the checks, then the market of the
//    last 2 minutes can still make it a no (already dumped, nobody trading, a single bot, a sell-off);
//  * any other coin (graduated to PumpSwap, or launched elsewhere): DexScreener's live market and the market rules.
// Worked out on demand for the coin that is open, cached at the edge for 5 s and shared by everyone.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { isMint } from "@/lib/format";
import { checksOf, decide, decideOutside, flags, gate, MIN_N, plan, signalsOf, verdict } from "@/lib/oracle";
import type { Future, TickRow, Track, Xray } from "@/lib/types";

export const runtime = "edge";

const CORS = { "access-control-allow-origin": "*" };
const DEX: Record<string, string> = { pumpswap: "PumpSwap", meteora: "Meteora", raydium: "Raydium", orca: "Orca", launchlab: "Raydium LaunchLab", moonshot: "Moonshot" };

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status}`);
  return (await r.json()) as T;
}

type Pair = {
  dexId: string;
  url: string;
  liquidity?: { usd?: number };
  txns?: { m5?: { buys: number; sells: number }; h1?: { buys: number; sells: number } };
  volume?: { h1?: number };
  priceChange?: { m5?: number; h1?: number };
  pairCreatedAt?: number;
  marketCap?: number;
  baseToken?: { symbol?: string; name?: string };
};

/** a coin past pump.fun's curve: DexScreener's free public data, its deepest pair */
async function outside(mint: string) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(4000) });
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
      vol1h: p.volume?.h1 ?? null,
      ch5: p.priceChange?.m5 ?? null,
      ch1: p.priceChange?.h1 ?? null,
      born: p.pairCreatedAt ?? null,
      symbol: p.baseToken?.symbol ?? null,
      name: p.baseToken?.name ?? null,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const mint = new URL(req.url).searchParams.get("mint") ?? "";
  if (!isMint(mint)) return Response.json({ error: "That is not a coin address" }, { status: 400, headers: CORS });
  const headers = { ...CORS, "cache-control": "public, s-maxage=5, stale-while-revalidate=10" };
  try {
    const [fut, xr, track, tk] = await Promise.all([
      call<Future>("yr_future", { p_mint: mint }),
      call<Xray>("yr_xray", { p_mint: mint }),
      call<Track | null>("yr_otrack", {}).catch(() => null),
      call<{ now: number; ticks: TickRow[] }>("yr_ticks", { p_mints: [mint], p_since: Date.now() - 120_000 }).catch(() => null),
    ]);
    const tr = fut.tracked ? fut : null;
    const sig = signalsOf(xr.tracked ? xr : null);
    const o = tr?.oracle && !tr.oracle.old ? tr.oracle : null;
    const ready = !!o && o.n >= MIN_N && o.odds?.k > 0;
    const v = ready && o ? verdict(o.odds, o.base, sig, track) : null;
    const checks = checksOf(o?.f, sig);
    const path = tr?.path ?? [];
    const ticks = (tk?.ticks ?? []).filter((t) => t[1] > (tk?.now ?? Date.now()) - 120_000);
    const last = ticks[ticks.length - 1];
    const mc = last && last[6] > 0 ? (last[5] / last[6]) * 1e9 : path.length ? path[path.length - 1][1] : 0;
    const market = tr
      ? {
          mc,
          ath: Math.max(tr.ath ?? 0, ...path.map((b) => b[2])),
          ageS: (Date.now() - tr.t0) / 1000,
          trades2: ticks.length,
          buys2: ticks.filter((t) => t[2] === 1).length,
          wallets2: new Set(ticks.map((t) => t[7])).size,
        }
      : null;

    let decision = null;
    let out = null;
    if (tr && !tr.oracle?.old) {
      decision = decide(v, checks);
      const g = decision.tone === "down" || !market ? null : gate(market);
      if (g) decision = { word: "Don't buy" as const, tone: "down" as const, why: g };
    } else {
      out = await outside(mint);
      if (out) decision = decideOutside(out, DEX[out.dex] ?? out.dex);
    }
    return Response.json(
      {
        mint,
        tracked: !!tr,
        old: !!tr?.oracle?.old,
        src: "live",
        symbol: tr?.meta?.[1] ?? out?.symbol ?? null,
        name: tr?.meta?.[0] ?? out?.name ?? null,
        uri: tr?.meta?.[2] ?? null,
        t0: tr?.t0 ?? out?.born ?? null,
        mc: tr ? mc : null,
        market,
        decision,
        checks,
        verdict: v && { label: v.label, tone: v.tone, score: v.score, line: v.line },
        odds: v && o ? o.odds : null,
        flags: flags(sig),
        plan: v && o?.matches?.length ? plan(o.matches) : null,
        outside: out,
      },
      { headers },
    );
  } catch {
    return Response.json({ error: "The oracle is busy, retrying soon" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  }
}
