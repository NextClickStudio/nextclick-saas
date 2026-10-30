// yr-social: the social side of the board's coins, for yeppo's radar. Called by pg_cron every minute with the
// ingest key. For each board coin not read yet it fetches the coin's metadata file (name, description, X link,
// website, Telegram) and, when the X link is a post, the post's author and text through X's public oEmbed
// endpoint (no key, no login). Every run it also notes which coins paid DexScreener for a boost or a profile
// (DexScreener's free public API). Metadata, posts and descriptions are untrusted text: they are stored and
// shown, never followed.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const GATEWAYS = ["https://4everland.io/ipfs/", "https://gateway.pinata.cloud/ipfs/"];
const MAX_READS = 40;

type Meta = { twitter?: unknown; website?: unknown; telegram?: unknown; description?: unknown };
const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

async function getJson<T>(url: string, ms = 5000): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), redirect: "follow" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** the metadata file, through gateways that still serve IPFS (ipfs.io no longer does) */
async function metaOf(uri: string): Promise<Meta | null> {
  const cid = uri.match(/\/ipfs\/([A-Za-z0-9]+)/)?.[1];
  if (!cid) return uri.startsWith("https://") ? await getJson<Meta>(uri) : null;
  for (const g of GATEWAYS) {
    const m = await getJson<Meta>(g + cid);
    if (m) return m;
  }
  return null;
}

/** a post's author and text from X's oEmbed: the text sits in the embed's first paragraph */
async function postOf(handle: string, id: string) {
  const o = await getJson<{ author_name?: string; author_url?: string; html?: string }>(
    `https://publish.twitter.com/oembed?url=${encodeURIComponent(`https://twitter.com/${handle}/status/${id}`)}&omit_script=1&dnt=1`,
  );
  if (!o) return null;
  const p = o.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";
  const text = p
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .trim();
  return { author: o.author_name?.slice(0, 80) ?? null, handle: o.author_url?.split("/").pop() ?? handle, text: text.slice(0, 280) || null };
}

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: cfg } = await sb.from("yr_config").select("value").eq("key", "ingest_key").single();
  if (req.headers.get("x-ingest-key") !== cfg?.value) return new Response("forbidden", { status: 403 });

  const { data: board } = await sb.rpc("yr_oracle_board");
  const coins = ((board?.coins ?? []) as unknown[][]).map((c) => ({ mint: c[0] as string, uri: (c[3] as string | null) ?? "" }));
  if (!coins.length) return Response.json({ ok: true, coins: 0 });

  // who paid DexScreener: boosts (latest and top) and token profiles
  const [latest, top, profiles] = await Promise.all([
    getJson<{ chainId: string; tokenAddress: string; amount?: number; totalAmount?: number }[]>("https://api.dexscreener.com/token-boosts/latest/v1"),
    getJson<{ chainId: string; tokenAddress: string; amount?: number; totalAmount?: number }[]>("https://api.dexscreener.com/token-boosts/top/v1"),
    getJson<{ chainId: string; tokenAddress: string }[]>("https://api.dexscreener.com/token-profiles/latest/v1"),
  ]);
  const boost = new Map<string, number>();
  for (const b of [...(latest ?? []), ...(top ?? [])])
    if (b.chainId === "solana") boost.set(b.tokenAddress, Math.max(boost.get(b.tokenAddress) ?? 0, b.totalAmount ?? b.amount ?? 0));
  const paid = new Set((profiles ?? []).filter((p) => p.chainId === "solana").map((p) => p.tokenAddress));

  const { data: seen } = await sb.from("yr_social").select("mint").in("mint", coins.map((c) => c.mint));
  const known = new Set((seen ?? []).map((s) => s.mint as string));
  const now = Date.now();
  const rows: Record<string, unknown>[] = [];

  const fresh = coins.filter((c) => !known.has(c.mint)).slice(0, MAX_READS);
  for (let i = 0; i < fresh.length; i += 8) {
    const part = await Promise.all(
      fresh.slice(i, i + 8).map(async (c) => {
        const m = c.uri ? await metaOf(c.uri) : null;
        const twitter = str(m?.twitter, 300);
        const x = twitter?.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:\/status(?:es)?\/(\d+))?/);
        const handle = x && x[1] !== "i" && x[1] !== "home" ? x[1] : null;
        const id = handle && x?.[2] ? x[2] : null;
        const post = handle && id ? await postOf(handle, id) : null;
        let launcher: string | null = null;
        try {
          launcher = c.uri ? (c.uri.includes("/ipfs/") ? "pump.fun" : new URL(c.uri).hostname.replace(/^(metadata|meta|md|api)\./, "")) : null;
        } catch {
          launcher = null;
        }
        return {
          mint: c.mint,
          at: now,
          twitter,
          tweet_id: id,
          x_handle: post?.handle ?? handle,
          x_author: post?.author ?? null,
          tweet: post?.text ?? null,
          website: str(m?.website, 200),
          telegram: str(m?.telegram, 200),
          launcher,
          descr: str(m?.description, 200),
          boost: boost.get(c.mint) ?? 0,
          dex_paid: paid.has(c.mint),
        };
      }),
    );
    rows.push(...part);
  }
  if (rows.length) await sb.from("yr_social").upsert(rows);

  // coins already read: only the paid signals can change
  for (const c of coins) {
    if (!known.has(c.mint) || (!boost.has(c.mint) && !paid.has(c.mint))) continue;
    await sb.from("yr_social").update({ boost: boost.get(c.mint) ?? 0, dex_paid: paid.has(c.mint) }).eq("mint", c.mint);
  }
  return Response.json({ ok: true, coins: coins.length, read: rows.length, posts: rows.filter((r) => r.tweet).length });
});
