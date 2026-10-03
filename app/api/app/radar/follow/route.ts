// Aggiunge un profilo Instagram ai brand seguiti dal Radar.
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { db, UserError } from "@/lib/db";
import { MAX_BRANDS, readProfile } from "@/lib/radar";
import { requireUser } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { username } = await readBody(request, z.object({ username: z.string().trim().regex(/^@?[A-Za-z0-9._]{1,30}$/) }));
    const handle = username.replace(/^@/, "").toLowerCase();
    const { data } = await db().from("accounts").select("radar_profile").eq("user_id", user.id).single();
    const profile = readProfile(data?.radar_profile) ?? { sectors: [] as string[], topics: [] as string[], igBrands: [] as string[], igHashtags: [] as string[], igDiscovered: [] as string[], igIgnored: [] as string[] };
    if (profile.igBrands.includes(handle)) return { ok: true };
    if (profile.igBrands.length >= MAX_BRANDS) throw new UserError(`Puoi seguire al massimo ${MAX_BRANDS} brand: togline qualcuno dal profilo del Radar.`);
    const { error } = await db().from("accounts").update({ radar_profile: { ...profile, igBrands: [...profile.igBrands, handle] } }).eq("user_id", user.id);
    if (error) throw error;
    return { ok: true };
  });
}
