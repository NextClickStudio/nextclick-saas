// yeppo.it/api/hot?w=word:since,...&cas=mint,...: the coins launched AFTER the posts that matter in the viewer's J7
// feed whose ticker or name is one of their words (each word with the time of its post), the first three born per
// word, and the coins the posts hand out when yeppo saw them launch in the last day; with yeppo's quick numbers.
// Fresh coins to snipe, not old ones sharing a word. Needs a Pro key. Kept 15 s per question on each server.
import { accessOf, DB_HEADERS, LOCKED } from "@/lib/access";
import { SUPABASE_URL } from "@/lib/config";
import { isMint } from "@/lib/format";
import { solPrice } from "@/lib/meta";

export const runtime = "edge";
// next to the database (eu-west-1): one server for everyone, so its cache is shared
export const preferredRegion = "dub1";
const CORS = { "access-control-allow-origin": "*" };

/** [word ("" for a coin handed out in a post), mint, ticker, launched at, market cap SOL, high × launch, trades, rugged] */
export type HotCoin = [string, string, string | null, number, number, number, number, boolean];

const cache = new Map<string, { t: number; v: HotCoin[] }>();

/** a post on X that coins launched from in the last hour: [handle, post id, first coin at, coins] with each coin
 *  [mint, ticker, launched at, trades, market cap SOL, high × launch] (yr_xfeed_s) */
export type XPost = [string, string | null, number, [string, string | null, number, number, number, number | null][]];
let feed: { t: number; v: XPost[] } | null = null;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const acc = await accessOf((q.get("key") ?? "").trim().toUpperCase() || null, q.get("dev"));
  if (!acc.pro) return Response.json({ locked: true, why: LOCKED[acc.reason ?? "nokey"] ?? LOCKED.nokey }, { headers: { ...CORS, "cache-control": "no-store" } });
  // ?feed=1: the posts on X coins launched from in the last hour, from yeppo's own link of each coin to its post
  // (no J7 needed). One answer for everyone, kept 20 s
  if (q.get("feed")) {
    if (!feed || Date.now() - feed.t > 20_000) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_xfeed_s`, { method: "POST", headers: DB_HEADERS, body: "{}", signal: AbortSignal.timeout(5000) });
        if (r.ok) feed = { t: Date.now(), v: (await r.json()) as XPost[] };
      } catch {
        /* the last answer stands */
      }
    }
    return Response.json({ posts: feed?.v ?? [], sol: await solPrice() }, { headers: { ...CORS, "cache-control": "private, max-age=10" } });
  }
  // each word once, with the earliest post it came from (rounded to the minute, so the same feed asks the same thing)
  const since = new Map<string, number>();
  for (const part of (q.get("w") ?? "").toLowerCase().split(",")) {
    const [raw, at] = part.split(":");
    const w = (raw ?? "").replace(/[^a-z0-9]/g, "");
    const t = Math.floor(Number(at) / 60_000) * 60_000;
    if (w.length < 3 || w.length > 20 || !Number.isFinite(t) || t <= 0) continue;
    since.set(w, Math.min(since.get(w) ?? t, t));
  }
  const words = [...since.keys()].sort().slice(0, 20);
  const cas = [...new Set((q.get("cas") ?? "").split(",").map((m) => m.trim()).filter(isMint))].sort().slice(0, 20);
  if (!words.length && !cas.length) return Response.json({ coins: [], sol: 0 }, { headers: CORS });
  const k = `${words.map((w) => `${w}:${since.get(w)}`).join(",")}|${cas.join(",")}`;
  let hit = cache.get(k);
  if (!hit || Date.now() - hit.t > 15_000) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_hot_s`, {
        method: "POST",
        headers: DB_HEADERS,
        body: JSON.stringify({ p_words: words, p_since: words.map((w) => since.get(w)), p_mints: cas }),
        signal: AbortSignal.timeout(4000),
      });
      if (r.ok) {
        hit = { t: Date.now(), v: (await r.json()) as HotCoin[] };
        if (cache.size > 300) cache.clear();
        cache.set(k, hit);
      }
    } catch {
      /* the last answer stands */
    }
  }
  return Response.json({ coins: hit?.v ?? [], sol: await solPrice() }, { headers: { ...CORS, "cache-control": "private, max-age=5" } });
}
