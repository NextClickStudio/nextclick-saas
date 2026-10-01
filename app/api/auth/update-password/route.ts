import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { UserError } from "@/lib/db";
import { authClient, requireUser } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  return handle(async () => {
    await requireUser();
    const { password } = await readBody(
      request,
      z.object({ password: z.string().min(8, "La password deve avere almeno 8 caratteri.").max(72) }),
    );
    const supabase = await authClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new UserError("Non è stato possibile aggiornare la password. Riprova.");
    return { ok: true };
  });
}
