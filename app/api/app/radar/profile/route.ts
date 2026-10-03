// Salva la profilazione del Radar: settori target, argomenti, ruoli, piattaforme.
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";

const list = (max: number) => z.array(z.string().trim().min(2).max(80)).max(max);
const schema = z.object({
  sectors: list(8).min(1, "Indica almeno un settore target."),
  topics: list(12).min(1, "Indica almeno un argomento."),
  roles: list(8),
  platforms: z.array(z.enum(["linkedin", "instagram", "facebook", "reddit", "lavoro", "news"])).max(6),
  country: z.string().trim().min(2).max(60),
});

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const profile = await readBody(request, schema);
    const { error } = await db().from("accounts").update({ radar_profile: profile }).eq("user_id", user.id);
    if (error) throw error;
    return { ok: true };
  });
}
