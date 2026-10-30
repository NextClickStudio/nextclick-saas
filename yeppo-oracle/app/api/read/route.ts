// The short read of one coin, for the extension's badge and panel: the decision (OK to buy, Risky, Don't buy),
// the scam checks, the verdict, the red flags and the Exit Plan, the same logic as the coin page.
// Fast: a coin on the board (the 40 most traded young coins, worked out every 20 s in the database) is answered
// from that copy; any other coin is worked out here. Cached at the edge for 5 s, shared by everyone.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { isMint } from "@/lib/format";
import { checksOf, decide, flags, MIN_N, plan, signalsOf, verdict, type Signals } from "@/lib/oracle";
import type { DevHist, Future, Oracle, Pattern, Track, Xray } from "@/lib/types";

export const runtime = "edge";

const CORS = { "access-control-allow-origin": "*" };

type BoardCoin = [string, string | null, string | null, string | null, number, number | null, number, number, number, number,
  Oracle | null, Pattern | null, DevHist | null, boolean?];

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

function answer(mint: string, o: Oracle | null, sig: Signals, track: Track | null, meta: { symbol: string | null; name: string | null; uri: string | null; t0: number | null; mc: number | null }, extra: { tracked: boolean; old: boolean; src: string }) {
  const live = o && !o.old ? o : null;
  const ready = !!live && live.n >= MIN_N && live.odds?.k > 0;
  const v = ready && live ? verdict(live.odds, live.base, sig, track) : null;
  const checks = checksOf(live?.f, sig);
  const d = extra.tracked && !extra.old ? decide(v, checks) : null;
  return {
    mint,
    ...extra,
    ...meta,
    decision: d,
    checks,
    verdict: v && { label: v.label, tone: v.tone, score: v.score, line: v.line },
    odds: v && live ? live.odds : null,
    flags: flags(sig),
    plan: v && live?.matches?.length ? plan(live.matches) : null,
  };
}

export async function GET(req: Request) {
  const mint = new URL(req.url).searchParams.get("mint") ?? "";
  if (!isMint(mint)) return Response.json({ error: "That is not a coin address" }, { status: 400, headers: CORS });
  const headers = { ...CORS, "cache-control": "public, s-maxage=5, stale-while-revalidate=10" };
  try {
    const trackP = call<Track | null>("yr_otrack", {}).catch(() => null);
    const one = await call<{ now: number; coin: BoardCoin | null } | null>("yr_oracle_one", { p_mint: mint }).catch(() => null);
    const c = one?.coin;
    if (c) {
      const sig = { ladder: !!c[11]?.ladder, devSold: !!c[13], dev: c[12] ?? null };
      const meta = { symbol: c[2], name: c[1], uri: c[3], t0: c[4], mc: c[5] };
      return Response.json(answer(mint, c[10], sig, await trackP, meta, { tracked: true, old: !!c[10]?.old, src: "board" }), { headers });
    }
    const [fut, xr, track] = await Promise.all([call<Future>("yr_future", { p_mint: mint }), call<Xray>("yr_xray", { p_mint: mint }), trackP]);
    const tr = fut.tracked ? fut : null;
    const sig = signalsOf(xr.tracked ? xr : null);
    const meta = {
      symbol: tr?.meta?.[1] ?? null,
      name: tr?.meta?.[0] ?? null,
      uri: tr?.meta?.[2] ?? null,
      t0: tr?.t0 ?? null,
      mc: tr?.path?.length ? tr.path[tr.path.length - 1][1] : null,
    };
    return Response.json(answer(mint, tr?.oracle ?? null, sig, track, meta, { tracked: !!tr, old: !!tr?.oracle?.old, src: "live" }), { headers });
  } catch {
    return Response.json({ error: "The oracle is busy, retrying soon" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  }
}
