// Esegue una ricerca del Radar (un tipo di segnale per chiamata, così resta sotto il minuto).
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { db } from "@/lib/db";
import { runRadarSignal } from "@/lib/radar-run";
import { requireUser } from "@/lib/supabase-auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { signal } = await readBody(request, z.object({ signal: z.enum(["richiesta", "lavoro", "lancio"]) }));
    const added = await runRadarSignal(user.id, signal);
    await db().from("accounts").update({ radar_last_run_at: new Date().toISOString() }).eq("user_id", user.id);
    return { added };
  });
}
