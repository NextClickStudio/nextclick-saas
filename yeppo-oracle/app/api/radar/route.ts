// yeppo radar: the board's coins that pass the scam checks, ranked, with why (lib/radar.ts). One cheap read of
// the board the database builds every 20 s, the social rows yr-social fills and the memes of the hour.
// Cached at the edge for 10 s, shared by everyone.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { radar, type BoardCoin, type Meta, type SocialRow } from "@/lib/radar";
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

export async function GET() {
  try {
    const [board, social, metas, track] = await Promise.all([
      call<{ now: number; coins: BoardCoin[] }>("yr_oracle_board"),
      call<SocialRow[]>("yr_social_recent").catch(() => [] as SocialRow[]),
      call<Meta[]>("yr_metas").catch(() => [] as Meta[]),
      call<Track | null>("yr_otrack").catch(() => null),
    ]);
    return Response.json(radar(board.coins, social, metas, track, board.now), {
      headers: { "access-control-allow-origin": "*", "cache-control": "public, s-maxage=10, stale-while-revalidate=20" },
    });
  } catch {
    return Response.json({ error: "The radar is busy, retrying soon" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
