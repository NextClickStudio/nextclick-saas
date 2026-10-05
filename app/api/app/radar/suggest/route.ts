// L'AI propone settori, argomenti e ruoli da monitorare partendo da cosa vendi.
import { suggestRadarProfile } from "@/lib/ai";
import { handle } from "@/lib/api";
import { db, UserError } from "@/lib/db";
import { getAccount, requireUser } from "@/lib/supabase-auth";
import { consumeAiQuota } from "@/lib/quota";

export const maxDuration = 60;

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    const account = await getAccount(user.id);
    await consumeAiQuota(user.id, "suggest");
    const { data: projects } = await db().from("projects").select("product_description, target_sector").eq("user_id", user.id).limit(5);
    const offer = account.company_offer || projects?.[0]?.product_description;
    if (!offer) throw new UserError("Scrivi prima cosa offri in Account (o crea una sessione): il Radar parte da lì.");
    return suggestRadarProfile({ offer, sectors: [...new Set((projects ?? []).map((p) => p.target_sector as string))] });
  });
}
