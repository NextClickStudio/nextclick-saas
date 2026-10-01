// Invia l'email per reimpostare la password (risponde sempre "ok", per non rivelare chi è registrato).
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { authClient } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  return handle(async () => {
    const { email } = await readBody(request, z.object({ email: z.string().trim().toLowerCase().email("Email non valida.") }));
    const supabase = await authClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/auth/callback?next=/reimposta-password`,
    });
    if (error) console.error("Recupero password", error.message);
    return { ok: true };
  });
}
