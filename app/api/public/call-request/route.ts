// Pubblica: l'azienda che legge il report chiede di essere ricontattata per una call.
// Crea una richiesta che l'utente vede (con notifica) nella sua area "Richieste".
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { db, UserError } from "@/lib/db";

const schema = z.object({
  slug: z.string().regex(/^[A-Za-z0-9_-]{6,40}$/),
  name: z.string().trim().min(2, "Inserisci il tuo nome.").max(120),
  role: z.string().trim().max(120).optional().default(""),
  channel: z.enum(["whatsapp", "telefono", "email", "instagram"]),
  contact: z.string().trim().min(3, "Indica dove possiamo contattarti.").max(200),
  preferred_time: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
  consent: z.literal(true, { message: "Serve il consenso per essere ricontattato." }),
});

export async function POST(request: Request) {
  return handle(async () => {
    const input = await readBody(request, schema);
    if (input.channel === "email" && !/^\S+@\S+\.\S+$/.test(input.contact)) throw new UserError("Email non valida.");
    if ((input.channel === "whatsapp" || input.channel === "telefono") && input.contact.replace(/\D/g, "").length < 8) {
      throw new UserError("Numero di telefono non valido.");
    }

    const supabase = db();
    const { data: report } = await supabase.from("reports").select("company_id").eq("slug", input.slug).maybeSingle();
    if (!report) throw new UserError("Report non trovato.");

    // anti-abuso: al massimo 3 richieste al giorno per azienda
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("call_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", report.company_id)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) throw new UserError("Abbiamo già ricevuto la tua richiesta: ti ricontatteremo a breve.");

    const { error } = await supabase.from("call_requests").insert({
      company_id: report.company_id,
      name: input.name,
      role: input.role || null,
      channel: input.channel,
      contact: input.contact,
      preferred_time: input.preferred_time || null,
      message: input.message || null,
    });
    if (error) throw error;

    // l'azienda ha risposto: aggiorna lo stato commerciale e lo storico
    const { data: company } = await supabase.from("companies").select("status").eq("id", report.company_id).single();
    if (company && ["da_contattare", "contattata", "report_aperto"].includes(company.status)) {
      await supabase.from("companies").update({ status: "ha_risposto", next_followup_at: null }).eq("id", report.company_id);
      await supabase.from("events").insert({
        company_id: report.company_id,
        type: "status_change",
        data: { from: company.status, to: "ha_risposto", auto: true },
      });
    }
    await supabase.from("events").insert({ company_id: report.company_id, type: "call_request", data: { channel: input.channel } });
    return { ok: true };
  });
}
