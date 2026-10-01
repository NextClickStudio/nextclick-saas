import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { UserError } from "@/lib/db";
import { authClient } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  return handle(async () => {
    const { email, password } = await readBody(
      request,
      z.object({ email: z.string().trim().toLowerCase().email("Email non valida."), password: z.string().min(1).max(200) }),
    );
    const supabase = await authClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await new Promise((r) => setTimeout(r, 800)); // rallenta i tentativi a raffica
      throw new UserError("Email o password non corretti.");
    }
    return { ok: true };
  });
}
