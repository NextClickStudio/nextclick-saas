// Analizza UNA azienda: visita il sito, chiede la valutazione all'AI, salva il risultato.
// Il browser chiama questa route un'azienda alla volta, così ogni chiamata resta sotto i 60 secondi.
import { nanoid } from "nanoid";
import { z } from "zod";
import { evaluateWebsite } from "@/lib/ai";
import { handle, readBody, uuid } from "@/lib/api";
import { crawlSite } from "@/lib/crawler";
import { db, friendlyError, UserError } from "@/lib/db";
import { getCriteria, getProject } from "@/lib/data";
import { computeTotalScore } from "@/lib/scoring";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handle(async () => {
    const { companyId } = await readBody(request, z.object({ companyId: uuid }));
    const supabase = db();

    const { data: company, error } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
    if (error) throw error;
    if (!company) throw new UserError("Azienda non trovata.");

    const project = await getProject(company.project_id);
    if (!project) throw new UserError("Progetto non trovato.");
    const criteria = await getCriteria(project.id);
    if (criteria.length === 0) throw new UserError("Il progetto non ha criteri: aggiungili nelle Impostazioni.");

    const { data: analysis, error: insError } = await supabase
      .from("analyses")
      .insert({ company_id: company.id, status: "in_corso" })
      .select("id")
      .single();
    if (insError) throw insError;

    try {
      const pages = await crawlSite(company.website_url);
      const evaluation = await evaluateWebsite({
        productDescription: project.product_description,
        symptom: project.symptom || "",
        criteria,
        pages,
      });
      const total = computeTotalScore(criteria, evaluation.scores);
      const now = new Date().toISOString();

      const { error: upError } = await supabase
        .from("analyses")
        .update({
          status: "completata",
          // si salvano solo URL e titolo delle pagine, mai il testo
          pages_analyzed: pages.map((p) => ({ url: p.url, title: p.title })),
          scores: evaluation.scores,
          weak_points: evaluation.weak_points,
          summary: evaluation.summary,
          total_score: total,
          analyzed_at: now,
        })
        .eq("id", analysis.id);
      if (upError) throw upError;

      // crea il report (link segreto) se non esiste ancora
      await supabase
        .from("reports")
        .upsert({ company_id: company.id, slug: nanoid(12) }, { onConflict: "company_id", ignoreDuplicates: true });
      await supabase.from("events").insert({ company_id: company.id, type: "analysis_done", data: { total_score: total } });

      return { ok: true, total_score: total };
    } catch (err) {
      if (!(err instanceof UserError)) console.error("Analisi fallita", err);
      const message = friendlyError(err, "Analisi non riuscita per un errore imprevisto.");
      await supabase.from("analyses").update({ status: "errore", error_message: message }).eq("id", analysis.id);
      await supabase.from("events").insert({ company_id: company.id, type: "analysis_error", data: { message } });
      // risposta 200: per il client è un risultato "normale", passa alla prossima azienda
      return { ok: false, error: message };
    }
  });
}
