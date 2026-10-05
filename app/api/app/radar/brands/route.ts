// Profili Instagram dei brand già trovati nelle tue sessioni (da seguire nel Radar).
import { handle } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";
import type { ContactChannel } from "@/lib/types";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const { data } = await db().from("companies").select("contact_channels, projects!inner(user_id)").eq("projects.user_id", user.id).limit(500);
    const handles = new Set<string>();
    for (const c of data ?? []) {
      for (const ch of (c.contact_channels as ContactChannel[] | null) ?? []) {
        if (ch.type !== "instagram" || ch.person || !ch.url) continue;
        const h = ch.url.split("instagram.com/")[1]?.replace(/[/?#].*$/, "").toLowerCase();
        if (h && /^[a-z0-9._]{1,30}$/.test(h)) handles.add(h);
      }
    }
    return { brands: [...handles].slice(0, 40) };
  });
}
