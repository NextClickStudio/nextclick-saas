// Salva il profilo del Radar: brand Instagram da seguire, hashtag, settori e argomenti.
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { db } from "@/lib/db";
import { MAX_BRANDS, MAX_HASHTAGS, readProfile } from "@/lib/radar";
import { requireUser } from "@/lib/supabase-auth";

const text = z.string().trim().min(2).max(80);
const schema = z
  .object({
    sectors: z.array(text).max(8),
    topics: z.array(text).max(12),
    igBrands: z.array(z.string().trim().regex(/^@?[A-Za-z0-9._]{1,30}$/, "Nome profilo Instagram non valido.")).max(MAX_BRANDS),
    igHashtags: z.array(z.string().trim().regex(/^#?[\p{L}\p{N}_]{2,60}$/u, "Hashtag non valido (niente spazi).")).max(MAX_HASHTAGS),
  })
  .refine((p) => p.sectors.length + p.igBrands.length + p.igHashtags.length > 0, { message: "Indica almeno un settore target: il Radar parte da lì per scoprire brand nuovi." });

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const p = await readBody(request, schema);
    // i brand scoperti in automatico e quelli scartati restano
    const { data } = await db().from("accounts").select("radar_profile").eq("user_id", user.id).single();
    const old = readProfile(data?.radar_profile);
    const profile = {
      igDiscovered: old?.igDiscovered ?? [],
      igIgnored: old?.igIgnored ?? [],
      ...p,
      igBrands: [...new Set(p.igBrands.map((b) => b.replace(/^@/, "").toLowerCase()))],
      igHashtags: [...new Set(p.igHashtags.map((h) => h.replace(/^#/, "").toLowerCase()))],
    };
    const { error } = await db().from("accounts").update({ radar_profile: profile }).eq("user_id", user.id);
    if (error) throw error;
    return { ok: true };
  });
}
