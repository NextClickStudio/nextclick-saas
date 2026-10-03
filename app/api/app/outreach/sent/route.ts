// Registra un messaggio come inviato e programma il follow-up successivo.
import { z } from "zod";
import { handle, ownedCompany, readBody, uuid } from "@/lib/api";
import { db } from "@/lib/db";
import { FOLLOWUP_DAYS, MAX_STEP } from "@/lib/outreach";
import { requireUser } from "@/lib/supabase-auth";

const schema = z.object({
  companyId: uuid,
  channel: z.string().trim().min(1).max(40),
  step: z.number().int().min(0).max(MAX_STEP),
  subject: z.string().max(300).optional(),
  body: z.string().trim().min(1).max(5000),
});

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = await readBody(request, schema);
    const company = await ownedCompany(input.companyId, user.id);
    const supabase = db();

    const { error } = await supabase.from("messages").insert({
      company_id: company.id,
      channel: input.channel,
      step: input.step,
      subject: input.subject || null,
      body: input.body,
    });
    if (error) throw error;

    const now = new Date();
    const next =
      input.step < MAX_STEP ? new Date(now.getTime() + FOLLOWUP_DAYS[input.step] * 24 * 60 * 60 * 1000).toISOString() : null;
    const update: Record<string, unknown> = {
      last_contacted_at: now.toISOString(),
      followup_step: input.step + 1,
      next_followup_at: next,
    };
    if (company.status === "da_contattare") update.status = "contattata";
    const { error: upError } = await supabase.from("companies").update(update).eq("id", company.id);
    if (upError) throw upError;

    await supabase.from("events").insert({
      company_id: company.id,
      type: "message_sent",
      data: { channel: input.channel, step: input.step },
    });
    if (company.status === "da_contattare") {
      await supabase.from("events").insert({ company_id: company.id, type: "status_change", data: { from: "da_contattare", to: "contattata" } });
    }
    return { ok: true, next_followup_at: next };
  });
}
