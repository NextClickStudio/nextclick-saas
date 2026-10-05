// Aggiorna stato commerciale e note di un'azienda, oppure la elimina.
import { z } from "zod";
import { handle, ownedCompany, readBody, uuid } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";
import { STATUS_VALUES } from "@/lib/types";

const schema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  notes: z.string().max(5000).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const company = await ownedCompany(uuid.parse((await params).id), user.id);
    const id = company.id;
    const input = await readBody(request, schema);
    const supabase = db();

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
    const user = await requireUser();
    const company = await ownedCompany(uuid.parse((await params).id), user.id);
    const { error } = await db().from("companies").delete().eq("id", company.id);
    if (error) throw error;
    return { ok: true };
  });
}
