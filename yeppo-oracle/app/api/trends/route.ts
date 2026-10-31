// yeppo.it/api/trends: the meme waves of the moment. Every pump.fun launch name of the last 24 hours is split into
// words; a word launched far more often in the last 30 minutes than usual is a wave (a trend people are piling
// into), and for each wave the coins that already trade best, with yeppo's quick flags. Needs a Pro key.
// The database works it out once a minute at most: the answer is shared by everyone.
import { accessOf, DB_HEADERS, LOCKED } from "@/lib/access";
import { SUPABASE_URL } from "@/lib/config";

export const runtime = "edge";

const CORS = { "access-control-allow-origin": "*" };

/** [mint, symbol, launched at, trades, price now / launch, high / launch, rugged, launch bundle, creator first sold (s), graduated] */
export type TrendCoin = [string, string | null, number, number, number | null, number | null, boolean, number | null, number | null, boolean];
export type Trend = { theme: string; n30: number; n24: number; burst: number; coins: TrendCoin[] };

let cache: { t: number; v: Trend[] } | null = null;

async function trends(): Promise<Trend[] | null> {
  if (cache && Date.now() - cache.t < 60_000) return cache.v;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_trends_s`, {
      method: "POST",
      headers: DB_HEADERS,
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`${r.status}`);
    const v = (await r.json()) as Trend[];
    cache = { t: Date.now(), v };
    return v;
  } catch {
    return cache?.v ?? null;
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const acc = await accessOf((q.get("key") ?? "").trim().toUpperCase() || null, q.get("dev"));
  if (!acc.pro)
    return Response.json({ locked: true, reason: acc.reason ?? "nokey", why: LOCKED[acc.reason ?? "nokey"] ?? LOCKED.nokey }, { headers: { ...CORS, "cache-control": "private, no-store" } });
  const v = await trends();
  if (!v) return Response.json({ error: "yeppo is busy, retrying" }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  return Response.json({ at: cache?.t ?? Date.now(), trends: v }, { headers: { ...CORS, "cache-control": "public, s-maxage=30" } });
}
