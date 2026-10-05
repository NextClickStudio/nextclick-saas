// Cambia lo stato di un'opportunità del Radar (salvata, risposto, scartata).
import { z } from "zod";
import { handle, readBody, uuid } from "@/lib/api";
import { db, UserError } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const { status } = await readBody(request, z.object({ status: z.enum(["nuovo", "salvato", "risposto", "scartato"]) }));
    const { data, error } = await db().from("radar_items").update({ status }).eq("id", id).eq("user_id", user.id).select("id");
    if (error) throw error;
    if (!data?.length) throw new UserError("Opportunità non trovata.");
    return { ok: true };
  });
}
