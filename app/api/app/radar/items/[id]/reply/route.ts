// Scrive con l'AI la risposta a un'opportunità del Radar (commento pubblico o messaggio privato).
import { z } from "zod";
import { generateRadarReply } from "@/lib/ai";
import { handle, readBody, uuid } from "@/lib/api";
import { db, UserError } from "@/lib/db";
import { getAccount, requireUser } from "@/lib/supabase-auth";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const { mode } = await readBody(request, z.object({ mode: z.enum(["commento", "messaggio"]) }));
    const { data: item } = await db().from("radar_items").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!item) throw new UserError("Opportunità non trovata.");
    const account = await getAccount(user.id);
    const text = await generateRadarReply({
      mode,
      platform: item.platform,
      signal: item.signal,
      author: item.author,
      company: item.company,
      excerpt: item.excerpt,
      offer: account.company_offer || "",
      senderName: account.full_name ?? "",
      senderRole: account.sender_role ?? "",
      senderCompany: account.company_name ?? "",
    });
    await db().from("radar_items").update({ reply: text }).eq("id", id);
    return { text };
  });
}
