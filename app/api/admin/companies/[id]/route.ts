// Aggiorna stato commerciale e note di un'azienda, oppure la elimina.
import { z } from "zod";
import { handle, readBody, uuid } from "@/lib/api";
import { db, UserError } from "@/lib/db";
import { STATUS_VALUES } from "@/lib/types";

const schema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  notes: z.string().max(5000).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const id = uuid.parse((await params).id);
    const input = await readBody(request, schema);
    const supabase = db();

    const { data: company, error } = await supabase.from("companies").select("status").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!company) throw new UserError("Azienda non trovata.");

    const update: Record<string, unknown> = {};
    if (input.notes !== undefined) update.notes = input.notes.trim() || null;
    if (input.status !== undefined) update.status = input.status;
    const { error: upError } = await supabase.from("companies").update(update).eq("id", id);
    if (upError) throw upError;

    if (input.status && input.status !== company.status) {
      await supabase
        .from("events")
        .insert({ company_id: id, type: "status_change", data: { from: company.status, to: input.status } });
    }
    return { ok: true };
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const id = uuid.parse((await params).id);
    const { error } = await db().from("companies").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  });
}
