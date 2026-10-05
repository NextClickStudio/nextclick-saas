// Copioni dei meme "chat con il bro" per i social di Yeppo: solo per gli account interni (illimitati).
import { z } from "zod";
import { generateBroMemes } from "@/lib/ai";
import { handle, readBody } from "@/lib/api";
import { UserError } from "@/lib/db";
import { consumeAiQuota } from "@/lib/quota";
import { getAccount, requireUser } from "@/lib/supabase-auth";

export const maxDuration = 60;

const schema = z.object({
  count: z.number().int().min(1).max(8),
  topic: z.string().trim().max(200).default(""),
  avoid: z.array(z.string().max(120)).max(60).default([]),
});

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    if (!(await getAccount(user.id)).unlimited) throw new UserError("Funzione non disponibile.");
    const input = await readBody(request, schema);
    await consumeAiQuota(user.id, "meme");
    return { memes: await generateBroMemes(input) };
  });
}
