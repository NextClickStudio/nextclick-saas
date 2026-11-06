// A coin's metadata json, fetched server-side: most IPFS gateways and launchpad hosts do not allow
// browsers to read them (no CORS), so the page asks here. When its X link is a post, the post's author and text come
// along through X's official oEmbed (no key, public posts only). Cached at the edge for a day. Post text and
// descriptions are untrusted: shown as text, never followed.
import { mirrors } from "@/lib/meta";

export const runtime = "edge";

const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);

/** a public X post's author and text, from X's oEmbed */
async function xPost(url: string | null): Promise<{ author: string; text: string } | null> {
  if (!url || !/^https?:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+/i.test(url)) return null;
  try {
    const r = await fetch(`https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { author_name?: string; html?: string };
    // the post's text is the first paragraph of the embed's html
    const text = (j.html ?? "").match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]?.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    return j.author_name && text ? { author: j.author_name.slice(0, 60), text: text.slice(0, 280) } : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u") ?? "";
  if (!/^https?:\/\//i.test(u) || u.length > 400) return Response.json({ error: "bad uri" }, { status: 400 });
  // public web hosts only: no bare IP addresses, no local names
  let host = "";
  try {
    host = new URL(u).hostname.toLowerCase();
  } catch {
    /* not a URL */
  }
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[") || /(^|\.)(localhost|local|internal)$/.test(host))
    return Response.json({ error: "bad uri" }, { status: 400 });
  for (const m of mirrors(u)) {
    try {
      const r = await fetch(m, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
      if (!r.ok) continue;
      const j = (await r.json()) as Record<string, unknown>;
      const ext = (j.extensions ?? {}) as Record<string, unknown>;
      const twitter = pick(j.twitter ?? ext.twitter);
      return Response.json(
        {
          image: pick(j.image),
          twitter,
          post: await xPost(twitter),
          telegram: pick(j.telegram ?? ext.telegram),
          website: pick(j.website ?? ext.website),
          description: pick(j.description),
        },
        { headers: { "cache-control": "public, s-maxage=86400, max-age=3600" } },
      );
    } catch {
      /* next mirror */
    }
  }
  return Response.json({ error: "not found" }, { status: 404, headers: { "cache-control": "public, s-maxage=600" } });
}
