// yeppo.it/api/news?q=word: the latest headlines behind a narrative, from Google News' public RSS (free, no key).
// Kept 15 minutes per word and shared by everyone. Only the headline, the outlet and the link are passed on.
export const runtime = "edge";
const CORS = { "access-control-allow-origin": "*" };

export type Headline = { title: string; source: string | null; url: string; at: number | null };
const cache = new Map<string, { t: number; v: Headline[] }>();

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().slice(0, 40);
  if (q.length < 3) return Response.json([], { headers: CORS });
  const hit = cache.get(q);
  if (hit && Date.now() - hit.t < 15 * 60_000) return Response.json(hit.v, { headers: { ...CORS, "cache-control": "public, s-maxage=600" } });
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:1d&hl=en-US&gl=US&ceid=US:en`, { signal: AbortSignal.timeout(4000) });
    const xml = await r.text();
    const v: Headline[] = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 3).map((m) => {
      const it = m[1];
      const pick = (tag: string) => decode(it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "");
      const at = Date.parse(pick("pubDate"));
      return { title: pick("title").replace(/ - [^-]+$/, ""), source: pick("source") || null, url: pick("link"), at: Number.isFinite(at) ? at : null };
    }).filter((h) => h.title && /^https:\/\//.test(h.url));
    if (cache.size > 300) cache.clear();
    cache.set(q, { t: Date.now(), v });
    return Response.json(v, { headers: { ...CORS, "cache-control": "public, s-maxage=600" } });
  } catch {
    return Response.json(hit?.v ?? [], { headers: CORS });
  }
}
