// yr-px: the live pool of coins past pump.fun's curve, for the paper wallet. Reads DexScreener (free, public) for
// up to 10 coins and keeps each one's market cap and SOL depth in yr_px, where yr_paper_curve finds it. Anyone may
// ask for a refresh; the price always comes from DexScreener, never from the caller.
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
};

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
    const rows: { mint: string; mc: number; liq: number; t: number }[] = [];
    for (const m of todo) {
      // the deepest SOL pool of this coin
      const p = (j.pairs ?? [])
        .filter((x) => x.baseToken?.address === m && x.quoteToken?.address === SOL && (x.liquidity?.quote ?? 0) > 0)
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      const px = Number(p?.priceNative);
      const usd = Number(p?.priceUsd);
      const mcUsd = p?.marketCap ?? p?.fdv;
      if (!p || !(px > 0) || !(usd > 0) || !mcUsd) continue;
      rows.push({ mint: m, mc: (mcUsd * px) / usd, liq: p.liquidity!.quote!, t: now });
    }
    if (rows.length) await sb.from("yr_px").upsert(rows);
    return Response.json({ ok: true, priced: rows.map((x) => x.mint) }, { headers: CORS });
  } catch {
    return Response.json({ error: "DexScreener did not answer" }, { status: 502, headers: CORS });
  }
});
