// Esegue le ricerche del Radar per un utente, salva le novità e manda la notifica.
import "server-only";
import { db, UserError } from "@/lib/db";
import { sendPush } from "@/lib/push";
import { RADAR_SIGNALS, readProfile, searchRadarSignal, signalEnabled, type RadarSignal } from "@/lib/radar";

async function context(userId: string) {
  const { data: account, error } = await db().from("accounts").select("radar_profile, company_offer").eq("user_id", userId).single();
  if (error) throw error;
  const profile = readProfile(account.radar_profile);
  if (!profile) throw new UserError("Completa prima il profilo del Radar.");
  const { data: projects } = await db().from("projects").select("product_description").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
  const offer = account.company_offer || projects?.[0]?.product_description || profile.topics.join(", ");
  return { profile, offer };
}

/** Una ricerca (un tipo di segnale). Restituisce quante opportunità nuove sono state salvate. */
export async function runRadarSignal(userId: string, signal: RadarSignal): Promise<number> {
  const { profile, offer } = await context(userId);
  if (!signalEnabled(signal, profile)) return 0;
  const found = await searchRadarSignal(signal, profile, offer);
  if (found.length === 0) return 0;
  const { data, error } = await db()
    .from("radar_items")
    .upsert(
      found.map((f) => ({
        user_id: userId,
        url: f.url,
        platform: f.platform.slice(0, 60),
        signal: f.signal,
        author: f.author,
        company: f.company,
        posted: f.date,
        excerpt: f.excerpt,
        why: f.why,
        intent: f.intent,
      })),
      { onConflict: "user_id,url", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Tutte le ricerche in parallelo + notifica se ci sono novità (usato dal job giornaliero). */
export async function runRadarForUser(userId: string): Promise<number> {
  const results = await Promise.allSettled(RADAR_SIGNALS.map((s) => runRadarSignal(userId, s.signal)));
  const added = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value : 0), 0);
  await db().from("accounts").update({ radar_last_run_at: new Date().toISOString() }).eq("user_id", userId);
  if (added > 0) {
    await sendPush(userId, {
      title: `Radar: ${added} ${added === 1 ? "nuova opportunità" : "nuove opportunità"}`,
      body: "Aziende del tuo target che stanno parlando proprio di quello che fai. Rispondi per primo.",
    });
  }
  return added;
}
