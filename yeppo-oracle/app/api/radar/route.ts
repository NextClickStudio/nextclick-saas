// yeppo radar: the board's coins that pass the screener filters and the scam checks, ranked, with why
// (lib/radar.ts), plus the coins that just graduated to PumpSwap with their live market from DexScreener (one call
// for up to 30 coins). Cheap reads of what the database already built. Cached at the edge for 10 s.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { radar, type BoardCoin, type GradMarket, type GradRow, type Meta, type SocialRow } from "@/lib/radar";
import type { Track } from "@/lib/types";

export const runtime = "edge";

async function call<T>(fn: string): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status}`);
  return (await r.json()) as T;
}

type Pair = { chainId: string; dexId: string; url: string; baseToken: { address: string; symbol?: string; name?: string }; marketCap?: number; liquidity?: { usd?: number }; txns?: { m5?: { buys: number; sells: number } }; volume?: { m5?: number }; priceChange?: { m5?: number; h1?: number } };

/** DexScreener's live market for up to 30 coins at once: the deepest Solana pair of each */
async function markets(mints: string[]): Promise<GradMarket[]> {
  if (!mints.length) return [];
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints.slice(0, 30).join(",")}`, { signal: AbortSignal.timeout(5000) });
    const j = (await r.json()) as { pairs?: Pair[] };
    const best = new Map<string, Pair>();
    for (const p of j.pairs ?? []) {
      if (p.chainId !== "solana") continue;
      const a = p.baseToken.address;
      if ((best.get(a)?.liquidity?.usd ?? -1) < (p.liquidity?.usd ?? 0)) best.set(a, p);
    }
    return [...best.values()].map((p) => ({
      mint: p.baseToken.address,
      symbol: p.baseToken.symbol ?? null,
      name: p.baseToken.name ?? null,
      dex: p.dexId,
      url: p.url,
      mcap: p.marketCap ?? null,
      liq: p.liquidity?.usd ?? null,
      m5: p.txns?.m5 ?? null,
      vol5: p.volume?.m5 ?? null,
      ch5: p.priceChange?.m5 ?? null,
      ch1: p.priceChange?.h1 ?? null,
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const [board, social, metas, track, grads] = await Promise.all([
      call<{ now: number; coins: BoardCoin[] }>("yr_oracle_board"),
      call<SocialRow[]>("yr_social_recent").catch(() => [] as SocialRow[]),
      call<Meta[]>("yr_metas").catch(() => [] as Meta[]),
      call<Track | null>("yr_otrack").catch(() => null),
      call<GradRow[]>("yr_grads_recent").catch(() => [] as GradRow[]),
    ]);
    const live = await markets(grads.slice(0, 30).map((g) => g[0]));
    return Response.json(radar(board.coins, social, metas, track, board.now, grads.slice(0, 30), live), {
      headers: { "access-control-allow-origin": "*", "cache-control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json({ error: "The radar is busy, retrying soon" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
