// yr-px: the live price of coins yeppo has no fresh curve trade for, for the paper wallet. Reads DexScreener (free,
// public) for up to 10 coins and keeps each one's market cap and SOL depth in yr_px, where yr_paper_curve finds it.
// Any pool works: SOL or dollar quoted, on a DEX or still on pump.fun's curve (whose depth follows from its price).
// Anyone may ask for a refresh; the price always comes from DexScreener, never from the caller.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL = "So11111111111111111111111111111111111111112";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type" };

type Pair = {
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  priceNative?: string;
  marketCap?: number;
  fdv?: number;
  priceUsd?: string;
  liquidity?: { usd?: number; quote?: number };
  dexId?: string;
};

/** SOL in USD: from any SOL-quoted pool in the answer, else Binance's public price */
async function solUsd(pairs: Pair[]): Promise<number> {
  for (const p of pairs) {
    const native = Number(p.priceNative);
    const usd = Number(p.priceUsd);
    if (p.quoteToken?.address === SOL && native > 0 && usd > 0) return usd / native;
  }
  try {
    const r = await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=SOLUSDT", { signal: AbortSignal.timeout(3000) });
    return Number(((await r.json()) as { price?: string }).price) || 0;
  } catch {
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  let mints: string[] = [];
  try {
    const b = (await req.json()) as { mints?: unknown };
    if (Array.isArray(b.mints)) mints = [...new Set(b.mints.filter((m): m is string => typeof m === "string" && MINT.test(m)))].slice(0, 10);
  } catch {
    /* empty body */
  }
  if (!mints.length) return Response.json({ error: "no coins" }, { status: 400, headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // a coin refreshed in the last 4 s is fresh enough
  const { data: fresh } = await sb.from("yr_px").select("mint,t").in("mint", mints);
  const now = Date.now();
  const todo = mints.filter((m) => !(fresh ?? []).some((f) => f.mint === m && now - Number(f.t) < 4000));
  if (!todo.length) return Response.json({ ok: true, fresh: mints.length }, { headers: CORS });
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${todo.join(",")}`, { signal: AbortSignal.timeout(5000) });
    const j = (await r.json()) as { pairs?: Pair[] };
    const pairs = j.pairs ?? [];
    const sol = await solUsd(pairs);
    const rows: { mint: string; mc: number; liq: number; t: number }[] = [];
    for (const m of todo) {
      // the deepest pool of this coin
      const p = pairs.filter((x) => x.baseToken?.address === m).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      const mcUsd = p?.marketCap ?? p?.fdv;
      if (!p || !mcUsd || !(sol > 0)) continue;
      const mc = mcUsd / sol;
      // the SOL side of the pool; a pump.fun curve with no depth listed: its depth follows from its price
      // (vSOL x vTokens = 30 x 1.073B at launch, so vSOL = sqrt(32.19 x market cap in SOL))
      const liq =
        p.quoteToken?.address === SOL && (p.liquidity?.quote ?? 0) > 0
          ? p.liquidity!.quote!
          : (p.liquidity?.usd ?? 0) > 0
            ? p.liquidity!.usd! / 2 / sol
            : p.dexId === "pumpfun"
              ? Math.sqrt(32.19 * mc)
              : 0;
      if (liq > 0 && mc > 0) rows.push({ mint: m, mc, liq, t: now });
    }
    if (rows.length) await sb.from("yr_px").upsert(rows);
    return Response.json({ ok: true, priced: rows.map((x) => x.mint) }, { headers: CORS });
  } catch {
    return Response.json({ error: "DexScreener did not answer" }, { status: 502, headers: CORS });
  }
});
