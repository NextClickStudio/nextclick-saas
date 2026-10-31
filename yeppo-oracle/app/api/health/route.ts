// yeppo.it/api/health: one URL for an uptime monitor (UptimeRobot, Better Stack: free). 200 when yeppo is
// capturing pump.fun trades and its background jobs work, 503 otherwise, with what is wrong. Never cached.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

export const runtime = "edge";

type Db = { ok: boolean; tick_age_s: number | null; cron_failed_10m: number; http_failed_10m: number; http_10m: number };

async function timed<T>(f: () => Promise<T>): Promise<{ v: T | null; ms: number }> {
  const t = Date.now();
  try {
    return { v: await f(), ms: Date.now() - t };
  } catch {
    return { v: null, ms: Date.now() - t };
  }
}

export async function GET() {
  const [db, rug] = await Promise.all([
    timed(async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_health`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, "content-type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      return (await r.json()) as Db;
    }),
    // RugCheck on a coin that always has a report: yeppo still works without it, so it never fails the check
    timed(async () => {
      const r = await fetch("https://api.rugcheck.xyz/v1/tokens/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/report/summary", {
        signal: AbortSignal.timeout(4000),
      });
      return r.ok;
    }),
  ]);
  const problems: string[] = [];
  if (!db.v) problems.push("database not answering");
  else {
    if ((db.v.tick_age_s ?? 1e9) >= 300) problems.push(`no pump.fun trade captured for ${db.v.tick_age_s ?? "?"} s`);
    if (db.v.cron_failed_10m >= 10) problems.push(`${db.v.cron_failed_10m} background jobs failed in 10 min`);
    if (db.v.http_10m > 0 && db.v.http_failed_10m * 2 >= db.v.http_10m) problems.push(`${db.v.http_failed_10m}/${db.v.http_10m} function calls failed in 10 min`);
  }
  if (db.ms > 4000) problems.push(`database slow (${db.ms} ms)`);
  const ok = problems.length === 0;
  return Response.json(
    { status: ok ? "ok" : "down", problems, db: db.v, db_ms: db.ms, rugcheck: rug.v === true ? "ok" : "down", at: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
