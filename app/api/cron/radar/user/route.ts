// Ricerca Radar di un singolo utente, chiamata solo dal job giornaliero (protetta da una chiave interna).
import { z } from "zod";
import { db } from "@/lib/db";
import { runRadarForUser } from "@/lib/radar-run";
import { getOrCreateSecret } from "@/lib/secrets";
import { randomBytes } from "node:crypto";

export const maxDuration = 60;

export async function POST(request: Request) {
  const key = await getOrCreateSecret("cron", () => randomBytes(24).toString("hex"));
  if (request.headers.get("x-yeppo-key") !== key) return new Response("Not found", { status: 404 });
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  // segna subito l'esecuzione, così un secondo avvio del job non la ripete
  await db().from("accounts").update({ radar_last_run_at: new Date().toISOString() }).eq("user_id", parsed.data.userId);
  try {
    return Response.json({ added: await runRadarForUser(parsed.data.userId, { notify: true }) });
  } catch (err) {
    console.error("Radar utente", err instanceof Error ? err.message : err);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
