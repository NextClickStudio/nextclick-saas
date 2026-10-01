// Registrazione: crea l'utente (già confermato), il profilo con la sessione di prova, e fa il login.
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { db, UserError } from "@/lib/db";
import { authClient } from "@/lib/supabase-auth";

const schema = z.object({
  full_name: z.string().trim().min(2, "Inserisci nome e cognome.").max(120),
  company_name: z.string().trim().max(160).optional(),
  email: z.string().trim().toLowerCase().email("Email non valida."),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri.").max(72),
  accept_terms: z.literal(true, { message: "Devi accettare Termini e Privacy per continuare." }),
});

export async function POST(request: Request) {
  return handle(async () => {
    const input = await readBody(request, schema);
    const { data, error } = await db().auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (error || !data.user) {
      if (error && /already|registered|exists/i.test(error.message)) {
        throw new UserError("Esiste già un account con questa email. Accedi o recupera la password.");
      }
      console.error("Registrazione", error);
      throw new UserError("Registrazione non riuscita. Riprova tra poco.");
    }
    const { error: accError } = await db().from("accounts").insert({
      user_id: data.user.id,
      full_name: input.full_name,
      company_name: input.company_name || null,
      accepted_terms_at: new Date().toISOString(),
    });
    if (accError) throw accError;

    const supabase = await authClient();
    await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
    return { ok: true };
  });
}
