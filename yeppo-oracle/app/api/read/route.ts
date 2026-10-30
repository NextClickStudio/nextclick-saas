// The short read of one coin for the browser extension's badge: the same verdict and red flags as the
// coin page, worked out here so the extension stays tiny. Cached at the edge for 10 s, shared by everyone.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { isMint } from "@/lib/format";
import { flags, MIN_N, plan, signalsOf, verdict } from "@/lib/oracle";
import type { Future, Track, Xray } from "@/lib/types";

export const runtime = "edge";

const CORS = { "access-control-allow-origin": "*" };

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

export async function GET(req: Request) {
  const mint = new URL(req.url).searchParams.get("mint") ?? "";
  if (!isMint(mint)) return Response.json({ error: "That is not a coin address" }, { status: 400, headers: CORS });
  try {
    const [fut, xr, track] = await Promise.all([
      call<Future>("yr_future", { p_mint: mint }),
      call<Xray>("yr_xray", { p_mint: mint }),
      call<Track | null>("yr_otrack", {}).catch(() => null),
    ]);
    const tr = fut.tracked ? fut : null;
    const x = xr.tracked ? xr : null;
    const o = tr?.oracle && !tr.oracle.old ? tr.oracle : null;
    const ready = !!o && o.n >= MIN_N && o.odds?.k > 0;
    const sig = signalsOf(x);
    const v = ready && o ? verdict(o.odds, o.base, sig, track) : null;
    return Response.json(
      {
        mint,
        tracked: !!tr,
        old: !!tr?.oracle?.old,
        symbol: tr?.meta?.[1] ?? null,
        verdict: v && { label: v.label, tone: v.tone, score: v.score, line: v.line },
        odds: v && o ? { k: o.odds.k, p50: o.odds.p50, dump: o.odds.dump } : null,
        flags: x ? flags(sig) : [],
        plan: v && o?.matches?.length ? plan(o.matches) : null,
      },
      { headers: { ...CORS, "cache-control": "public, s-maxage=10, stale-while-revalidate=20" } },
    );
  } catch {
    return Response.json({ error: "The oracle is busy, retrying soon" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  }
}
