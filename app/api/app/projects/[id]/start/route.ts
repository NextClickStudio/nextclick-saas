// Avvia la sessione usando 1 credito (o la sessione di prova). Se è già avviata non scala nulla.
import { handle, ownedProjectId, uuid } from "@/lib/api";
import { db, UserError } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const id = await ownedProjectId(uuid.parse((await params).id), user.id);
    const { data, error } = await db().rpc("use_session_credit", { p_user: user.id, p_project: id });
    if (error) throw error;
    const limit = Number(data ?? 0);
    if (limit <= 0) throw new UserError("Non hai sessioni disponibili. Scegli un piano per continuare.");
    return { ok: true, company_limit: limit };
  });
}
