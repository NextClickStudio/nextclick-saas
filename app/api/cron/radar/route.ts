// Job giornaliero (Vercel Cron): avvia il Radar per ogni utente con il profilo compilato.
// Ogni utente gira in una chiamata separata, così ognuna resta sotto il limite di tempo.
// Chiamarlo più volte non fa danni: salta chi è già stato cercato nelle ultime 20 ore.
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/config";
import { getOrCreateSecret } from "@/lib/secrets";
import { randomBytes } from "node:crypto";

export const maxDuration = 60;

export async function GET() {
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data: accounts, error } = await db()
    .from("accounts")
    .select("user_id")
    .not("radar_profile", "is", null)
    .or(`radar_last_run_at.is.null,radar_last_run_at.lt.${since}`)
    .limit(40);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const key = await getOrCreateSecret("cron", () => randomBytes(24).toString("hex"));
  // una chiamata per utente, tutte in parallelo (ognuna dura circa 30 secondi)
  await Promise.all(
    (accounts ?? []).map((a) =>
      fetch(`${SITE_URL}/api/cron/radar/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-yeppo-key": key },
        body: JSON.stringify({ userId: a.user_id }),
        signal: AbortSignal.timeout(55_000),
      }).catch(() => null),
    ),
  );
  return Response.json({ started: accounts?.length ?? 0 });
}
