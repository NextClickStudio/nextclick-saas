// Accetta o rifiuta una richiesta di call ricevuta da un report.
import { z } from "zod";
import { handle, readBody, uuid } from "@/lib/api";
import { db, UserError } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const { status } = await readBody(request, z.object({ status: z.enum(["accettata", "rifiutata"]) }));
    const supabase = db();
    const { data: req } = await supabase
      .from("call_requests")
      .select("id, company_id, companies!inner(project_id, projects!inner(user_id))")
      .eq("id", id)
      .eq("companies.projects.user_id", user.id)
      .maybeSingle();
    if (!req) throw new UserError("Richiesta non trovata.");

    const { error } = await supabase.from("call_requests").update({ status, handled_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    if (status === "accettata") {
      await supabase.from("companies").update({ status: "chiamata", next_followup_at: null }).eq("id", req.company_id);
      await supabase.from("events").insert({ company_id: req.company_id, type: "status_change", data: { to: "chiamata", auto: true } });
    }
    return { ok: true };
  });
}
