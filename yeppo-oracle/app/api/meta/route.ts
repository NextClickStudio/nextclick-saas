// A coin's metadata json, fetched server-side: most IPFS gateways and launchpad hosts do not allow
// browsers to read them (no CORS), so the page asks here. Cached at the edge for a day.
import { mirrors } from "@/lib/meta";

export const runtime = "edge";

const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u") ?? "";
  if (!/^https?:\/\//i.test(u) || u.length > 400) return Response.json({ error: "bad uri" }, { status: 400 });
  for (const m of mirrors(u)) {
    try {
      const r = await fetch(m, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
      if (!r.ok) continue;
      const j = (await r.json()) as Record<string, unknown>;
      const ext = (j.extensions ?? {}) as Record<string, unknown>;
      return Response.json(
        {
          image: pick(j.image),
          twitter: pick(j.twitter ?? ext.twitter),
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
