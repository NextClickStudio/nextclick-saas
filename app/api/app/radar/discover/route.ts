// Scopre brand nuovi del settore su Instagram (verificati con l'API ufficiale) e porta i loro post nel Radar.
import { handle } from "@/lib/api";
import { runDiscovery } from "@/lib/radar-run";
import { requireUser } from "@/lib/supabase-auth";

export const maxDuration = 60;

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    return runDiscovery(user.id);
  });
}
