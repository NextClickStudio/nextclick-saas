// yeppo.it/api/verdicts?mints=a,b,c: yeppo's verdict (Safe, Risky, Danger, Too early) for up to 6 coins at once, for
// the lists that show many coins (Hot on X: the coins born after a post). Each coin's full read is kept a minute here,
// so a busy list costs the read route one call per coin per minute. Needs a Pro key.
import { accessOf, LOCKED } from "@/lib/access";
import { isMint } from "@/lib/format";

export const runtime = "edge";
export const preferredRegion = "dub1";
const CORS = { "access-control-allow-origin": "*" };

export type Verdict = { word: string; mcUsd: number | null };
const cache = new Map<string, { t: number; v: Verdict | null }>();

export async function GET(req: Request) {
  const u = new URL(req.url);
  const key = (u.searchParams.get("key") ?? "").trim().toUpperCase();
  const dev = u.searchParams.get("dev");
  const acc = await accessOf(key || null, dev);
  if (!acc.pro) return Response.json({ locked: true, why: LOCKED[acc.reason ?? "nokey"] ?? LOCKED.nokey }, { headers: { ...CORS, "cache-control": "no-store" } });
  const mints = [...new Set((u.searchParams.get("mints") ?? "").split(",").filter(isMint))].slice(0, 6);
  const out: Record<string, Verdict | null> = {};
  await Promise.all(
    mints.map(async (m) => {
      const hit = cache.get(m);
      if (hit && Date.now() - hit.t < 60_000) return void (out[m] = hit.v);
      try {
        const q = new URLSearchParams({ mint: m, key });
        if (dev) q.set("dev", dev);
        const r = await fetch(`${u.origin}/api/read?${q}`, { signal: AbortSignal.timeout(7000) });
        const j = (await r.json()) as { decision?: { word?: string }; mcUsd?: number | null };
        const v = j.decision?.word ? { word: j.decision.word, mcUsd: j.mcUsd ?? null } : null;
        if (cache.size > 1000) cache.clear();
        cache.set(m, { t: Date.now(), v });
        out[m] = v;
      } catch {
        out[m] = hit?.v ?? null;
      }
    }),
  );
  return Response.json(out, { headers: { ...CORS, "cache-control": "private, no-store" } });
}
