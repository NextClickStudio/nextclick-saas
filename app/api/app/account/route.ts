// Profilo dell'utente: modifica dati ed eliminazione definitiva dell'account (diritto all'oblio).
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { db } from "@/lib/db";
import { authClient, requireUser } from "@/lib/supabase-auth";

export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = await readBody(
      request,
      z.object({
        full_name: z.string().trim().min(2, "Inserisci nome e cognome.").max(120),
        company_name: z.string().trim().max(160),
        sender_role: z.string().trim().max(120).optional().default(""),
        booking_url: z
          .string()
          .trim()
          .max(500)
          .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Il link deve iniziare con https://")
          .optional()
          .default(""),
      }),
    );
    const { error } = await db()
      .from("accounts")
      .update({
        full_name: input.full_name,
        company_name: input.company_name || null,
        sender_role: input.sender_role || null,
        booking_url: input.booking_url || null,
      })
      .eq("user_id", user.id);
    if (error) throw error;
    return { ok: true };
  });
}

export async function DELETE() {
  return handle(async () => {
    const user = await requireUser();
    // le sessioni, le aziende, le analisi e i report vengono eliminati a cascata
    const { error } = await db().auth.admin.deleteUser(user.id);
    if (error) throw error;
    const supabase = await authClient();
    await supabase.auth.signOut();
    return { ok: true };
  });
}
