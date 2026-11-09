// yeppo.it/go/<coin>: opens the coin on Axiom. Axiom's page is keyed by the coin's pool (pump.fun's curve, PumpSwap,
// Raydium...), so the deepest pool comes from DexScreener (free, public, kept a minute); a coin DexScreener doesn't
// list yet opens by its own address.
import { isMint } from "@/lib/format";

export const runtime = "edge";

const pools = new Map<string, { t: number; pool: string | null }>();

async function poolOf(mint: string): Promise<string | null> {
  const hit = pools.get(mint);
  if (hit && Date.now() - hit.t < 60_000) return hit.pool;
  let pool: string | null = null;
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { signal: AbortSignal.timeout(3000) });
    const pairs = (await r.json()) as { baseToken?: { address?: string }; pairAddress?: string; liquidity?: { usd?: number } }[];
    pool =
      (Array.isArray(pairs) ? pairs : [])
        .filter((p) => p.baseToken?.address === mint && p.pairAddress)
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]?.pairAddress ?? null;
  } catch {
    /* DexScreener did not answer: the coin's own address */
  }
  if (pool && !isMint(pool)) pool = null;
  if (pools.size > 2000) pools.clear();
  pools.set(mint, { t: Date.now(), pool });
  return pool;
}

export async function GET(_req: Request, { params }: { params: Promise<{ mint: string }> }) {
  const mint = (await params).mint.trim();
  if (!isMint(mint)) return Response.redirect("https://axiom.trade/", 302);
  const pool = await poolOf(mint);
  return Response.redirect(`https://axiom.trade/meme/${pool ?? mint}`, 302);
}
