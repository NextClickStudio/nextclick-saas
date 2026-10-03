// Ricerca del Radar (manuale): brand nuovi + post dei brand seguiti e degli hashtag. Massimo 2 al giorno per utente.
import { handle } from "@/lib/api";
import { db, UserError } from "@/lib/db";
import { RADAR_RUNS_PER_DAY } from "@/lib/radar";
import { runDiscovery, runRadar } from "@/lib/radar-run";
import { requireUser } from "@/lib/supabase-auth";

export const maxDuration = 60;

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    const { data: left, error } = await db().rpc("use_radar_run", { p_user: user.id, p_max: RADAR_RUNS_PER_DAY });
    if (error) throw error;
    if ((left as number) < 0) throw new UserError(`Hai già fatto le ${RADAR_RUNS_PER_DAY} ricerche di oggi: torna domani.`);
    const [mon, disc] = await Promise.allSettled([runRadar(user.id), runDiscovery(user.id)]);
    return {
      left,
      monitor: mon.status === "fulfilled" ? mon.value : { error: (mon.reason as Error).message },
      discovery: disc.status === "fulfilled" ? disc.value : { error: (disc.reason as Error).message },
    };
  });
}
