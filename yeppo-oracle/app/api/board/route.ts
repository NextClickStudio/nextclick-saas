// The verdict and Exit Plan of every coin on the hot board, in one call, for yeppo's paper bots. The board
// is built every 20 s in the database (yr_oracle_hot_build); this reads that copy, with the same logic as
// the coin page and /api/read. Cached at the edge for 15 s, so the bots cost the database one cheap read.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { MIN_N, plan, verdict } from "@/lib/oracle";
import type { DevHist, Hot, Oracle, Pattern, Track } from "@/lib/types";

export const runtime = "edge";

type FullCoin = [string, string | null, string | null, string | null, number, number | null, number, number, number, number,
  Oracle | null, Pattern | null, DevHist | null, boolean?];

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

export async function GET() {
  try {
    const [board, track] = await Promise.all([
      call<Omit<Hot, "coins"> & { coins: FullCoin[] }>("yr_oracle_board"),
      call<Track | null>("yr_otrack").catch(() => null),
    ]);
    const coins = board.coins.map((c) => {
      const o = c[10] && !c[10].old ? c[10] : null;
      const ready = !!o && o.n >= MIN_N && o.odds?.k > 0;
      const sig = { ladder: !!c[11]?.ladder, devSold: !!c[13], dev: c[12] ?? null };
      const v = ready && o ? verdict(o.odds, o.base, sig, track) : null;
      return {
        mint: c[0],
        symbol: c[2],
        verdict: v && { label: v.label, tone: v.tone, score: v.score },
        plan: v && o?.matches?.length ? plan(o.matches) : null,
        f: o?.f ?? null,
        ladder: sig.ladder,
      };
    });
    return Response.json({ now: board.now, coins }, { headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=15" } });
  } catch {
    return Response.json({ error: "The oracle is busy, retrying soon" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
