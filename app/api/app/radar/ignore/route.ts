// "Non mi interessa questo brand": smette di seguirlo, non lo ripropone più e nasconde i suoi post.
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { db } from "@/lib/db";
import { readProfile } from "@/lib/radar";
import { requireUser } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { username } = await readBody(request, z.object({ username: z.string().trim().regex(/^@?[A-Za-z0-9._]{1,30}$/) }));
    const handle = username.replace(/^@/, "").toLowerCase();
    const { data } = await db().from("accounts").select("radar_profile").eq("user_id", user.id).single();
    const profile = readProfile(data?.radar_profile);
    if (profile) {
      await db()
        .from("accounts")
        .update({
          radar_profile: {
            ...profile,
            igBrands: profile.igBrands.filter((b) => b !== handle),
            igDiscovered: profile.igDiscovered.filter((b) => b !== handle),
            igIgnored: [...new Set([...profile.igIgnored, handle])],
          },
        })
        .eq("user_id", user.id);
    }
    await db().from("radar_items").update({ status: "scartato" }).eq("user_id", user.id).ilike("author", handle).neq("status", "risposto");
    return { ok: true };
  });
}
