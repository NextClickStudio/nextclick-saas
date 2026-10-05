// Aggiunge aziende a mano (max il limite della sessione). I duplicati vengono saltati.
import { z } from "zod";
import { handle, ownedProjectId, readBody, uuid } from "@/lib/api";
import { getUserProject } from "@/lib/data";
import { db, UserError } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";
import { isBlockedHostname, normalizeUrl } from "@/lib/url";

const schema = z.object({
  projectId: uuid,
  companies: z
    .array(z.object({ name: z.string().trim().min(1).max(200), url: z.string().trim().min(1).max(500) }))
    .min(1, "Nessuna azienda da importare.")
    .max(200, "Puoi importare al massimo 200 aziende per volta."),
});

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { projectId, companies } = await readBody(request, schema);
    await ownedProjectId(projectId, user.id);
    const project = (await getUserProject(projectId, user.id))!;
    if (!project.credit_used_at) throw new UserError("Avvia prima la sessione.");

    const { data: existing, error } = await db().from("companies").select("website_url").eq("project_id", projectId);
    if (error) throw error;
    const seen = new Set((existing ?? []).map((c) => c.website_url as string));
    let room = project.company_limit - seen.size;

    const rows: { project_id: string; name: string; website_url: string; source: string }[] = [];
    let skipped = 0;
    for (const c of companies) {
      const url = normalizeUrl(c.url);
      if (!url || isBlockedHostname(new URL(url).hostname) || seen.has(url) || room <= 0) {
        skipped++;
        continue;
      }
      seen.add(url);
      room--;
      rows.push({ project_id: projectId, name: c.name, website_url: url, source: "manuale" });
    }
    if (rows.length > 0) {
      const { error: insError } = await db().from("companies").insert(rows);
      if (insError) throw insError;
    }
    return { imported: rows.length, skipped };
  });
}
