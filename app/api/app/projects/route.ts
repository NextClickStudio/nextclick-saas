// Crea una nuova sessione (progetto) con i suoi criteri. Il credito si usa dopo, con "start".
import { nanoid } from "nanoid";
import { z } from "zod";
import { criterionInput, handle, readBody } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";
import { TARGET_SIZES } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla sessione.").max(200),
  product_description: z.string().trim().min(1).max(2000),
  target_customer: z.string().trim().min(1).max(1000),
  target_sector: z.string().trim().min(1).max(300),
  target_size: z.enum(TARGET_SIZES.map((s) => s.value) as [string, ...string[]]),
  target_country: z.string().trim().min(2).max(100),
  symptom: z.string().trim().min(1, "Il sintomo non può essere vuoto.").max(1000),
  index_name: z.string().trim().max(120).optional(),
  criteria: z.array(criterionInput).min(1, "Serve almeno un criterio.").max(15, "Massimo 15 criteri."),
});

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = await readBody(request, schema);
    const supabase = db();
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: input.name,
        product_description: input.product_description,
        target_customer: input.target_customer,
        target_sector: input.target_sector,
        target_size: input.target_size,
        target_country: input.target_country,
        symptom: input.symptom,
        index_name: input.index_name || null,
        public_slug: nanoid(10).toLowerCase().replace(/[^a-z0-9]/g, "x"),
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: critError } = await supabase.from("criteria").insert(
      input.criteria.map((c, i) => ({
        project_id: project.id,
        name: c.name,
        description: c.description,
        how_to_check: c.how_to_check,
        weight: c.weight,
        position: i,
      })),
    );
    if (critError) {
      await supabase.from("projects").delete().eq("id", project.id);
      throw critError;
    }
    return { id: project.id };
  });
}
