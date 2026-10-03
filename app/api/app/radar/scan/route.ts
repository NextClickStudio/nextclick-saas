// Cerca ora su Instagram i nuovi post dei brand seguiti e degli hashtag del Radar.
import { handle } from "@/lib/api";
import { runRadarForUser } from "@/lib/radar-run";
import { requireUser } from "@/lib/supabase-auth";

export const maxDuration = 60;

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    return { added: await runRadarForUser(user.id) };
  });
}
