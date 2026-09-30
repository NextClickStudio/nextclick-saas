// Importa una lista di aziende (max 200 per volta). I duplicati vengono saltati.
import { z } from "zod";
import { handle, readBody, uuid } from "@/lib/api";
import { db } from "@/lib/db";
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
    const { projectId, companies } = await readBody(request, schema);
    const supabase = db();

    const { data: existing, error } = await supabase.from("companies").select("website_url").eq("project_id", projectId);
    if (error) throw error;
    const seen = new Set((existing ?? []).map((c) => c.website_url as string));

    const rows: { project_id: string; name: string; website_url: string }[] = [];
    let skipped = 0;
    for (const c of companies) {
      const url = normalizeUrl(c.url);
      if (!url || isBlockedHostname(new URL(url).hostname) || seen.has(url)) {
        skipped++;
        continue;
      }
      seen.add(url);
      rows.push({ project_id: projectId, name: c.name, website_url: url });
    }
    if (rows.length > 0) {
      const { error: insError } = await supabase.from("companies").insert(rows);
      if (insError) throw insError;
    }
    return { imported: rows.length, skipped };
  });
}
