// Ricerca del Radar (manuale): brand nuovi + post dei brand seguiti e degli hashtag.
// Limite dal piano: Basic 1 al giorno, Pro/Agency 2; in prova gratuita 3 ricerche in tutto.
import { handle } from "@/lib/api";
import { RADAR_ENABLED } from "@/lib/config";
import { db, UserError } from "@/lib/db";
import { FREE_RADAR_RUNS, radarAllowance } from "@/lib/plans";
import { runDiscovery, runRadar } from "@/lib/radar-run";
import { consumeAiQuota } from "@/lib/quota";
import { getAccount, requireUser } from "@/lib/supabase-auth";

export const maxDuration = 60;

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    const account = await getAccount(user.id);
    if (!RADAR_ENABLED && !account.unlimited) throw new UserError("Il Radar non è disponibile.");
    const allowance = radarAllowance(account);
    let left: number;
    if ("daily" in allowance) {
      const { data, error } = await db().rpc("use_radar_run", { p_user: user.id, p_max: allowance.daily });
      if (error) throw error;
      left = data as number;
      if (left < 0) throw new UserError(`Hai già fatto ${allowance.daily === 1 ? "la ricerca" : `le ${allowance.daily} ricerche`} di oggi: torna domani.`);
    } else {
      const { data, error } = await db().rpc("use_radar_free_run", { p_user: user.id });
      if (error) throw error;
      left = data as number;
      if (left < 0) throw new UserError(`Hai usato le ${FREE_RADAR_RUNS} ricerche di prova: scegli un piano per continuare.`);
    }
    await consumeAiQuota(user.id, "radar"); // conteggio per i costi (pagina admin)
    const [mon, disc] = await Promise.allSettled([runRadar(user.id), runDiscovery(user.id)]);
    if (mon.status === "rejected" && disc.status === "rejected") {
      // niente è andato a buon fine: restituisco la ricerca all'utente
      const col = "daily" in allowance ? "radar_runs_count" : "radar_free_runs_left";
      const { data: acc } = await db().from("accounts").select(col).eq("user_id", user.id).single();
      const cur = Number((acc as Record<string, unknown> | null)?.[col] ?? 0);
      await db().from("accounts").update({ [col]: "daily" in allowance ? Math.max(0, cur - 1) : cur + 1 }).eq("user_id", user.id);
      throw mon.reason instanceof UserError ? mon.reason : new UserError("Ricerca non riuscita: non è stata conteggiata. Riprova tra poco.");
    }
    return {
      left,
      monitor: mon.status === "fulfilled" ? mon.value : { error: (mon.reason as Error).message },
      discovery: disc.status === "fulfilled" ? disc.value : { error: (disc.reason as Error).message },
    };
  });
}
