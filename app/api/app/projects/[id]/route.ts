// Modifica o elimina una sessione (pubblicazione, impostazioni, criteri). Solo il proprietario.
import { z } from "zod";
import { criterionInput, handle, optionalUrl, ownedProjectId, readBody, uuid } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";

const schema = z.object({
  // Impostazioni
  name: z.string().trim().min(1, "Il nome non può essere vuoto.").max(200).optional(),
  product_description: z.string().trim().min(1).max(2000).optional(),
  target_customer: z.string().trim().min(1).max(1000).optional(),
  target_sector: z.string().trim().min(1).max(300).optional(),
  symptom: z.string().trim().min(1).max(1000).optional(),
  index_name: z.string().trim().max(120).optional(),
  criteria: z.array(criterionInput).min(1, "Serve almeno un criterio.").max(15).optional(),
  // Pubblicazione
  public_ranking_enabled: z.boolean().optional(),
  public_top_n: z.coerce.number().int().min(1, "La top N va da 1 a 100.").max(100, "La top N va da 1 a 100.").optional(),
  report_cta_text: z.string().trim().min(1, "Il testo della CTA non può essere vuoto.").max(200).optional(),
  report_cta_url: optionalUrl.optional(),
  sender_name: z.string().trim().max(120).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = await ownedProjectId(uuid.parse((await params).id), user.id);
    const { criteria, ...fields } = await readBody(request, schema);
    const supabase = db();

    const update: Record<string, unknown> = { ...fields };
    if (fields.index_name !== undefined) update.index_name = fields.index_name || null;
    if (fields.sender_name !== undefined) update.sender_name = fields.sender_name || null;

    if (Object.keys(update).length > 0) {
      const { error } = await supabase.from("projects").update(update).eq("id", id);
      if (error) throw error;
    }

    if (criteria) {
      // I criteri non più presenti vengono eliminati, gli altri aggiornati o creati.
      const { data: existing, error } = await supabase.from("criteria").select("id").eq("project_id", id);
      if (error) throw error;
      const keep = new Set(criteria.filter((c) => c.id).map((c) => c.id));
      const toDelete = (existing ?? []).map((c) => c.id as string).filter((cid) => !keep.has(cid));
      if (toDelete.length) {
        const { error: delError } = await supabase.from("criteria").delete().in("id", toDelete);
        if (delError) throw delError;
      }
      for (const [i, c] of criteria.entries()) {
        const row = { name: c.name, description: c.description, how_to_check: c.how_to_check, weight: c.weight, position: i };
        const { error: e } = c.id
          ? await supabase.from("criteria").update(row).eq("id", c.id).eq("project_id", id)
          : await supabase.from("criteria").insert({ ...row, project_id: id });
        if (e) throw e;
      }
    }
    return { ok: true };
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = await ownedProjectId(uuid.parse((await params).id), user.id);
    const { error } = await db().from("projects").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    return { ok: true };
  });
}
