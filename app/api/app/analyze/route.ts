// Analizza UNA azienda: visita il sito, chiede la valutazione all'AI, salva il risultato.
// Il browser chiama questa route un'azienda alla volta, così ogni chiamata resta sotto i limiti di tempo.
import { nanoid } from "nanoid";
import { z } from "zod";
import { evaluateWebsite } from "@/lib/ai";
import { handle, ownedCompany, readBody, uuid } from "@/lib/api";
import { crawlSite } from "@/lib/crawler";
import { db, friendlyError, UserError } from "@/lib/db";
import { getCriteria, getUserProject } from "@/lib/data";
import { requireUser } from "@/lib/supabase-auth";
import { computeTotalScore } from "@/lib/scoring";

export const maxDuration = 90;

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { companyId } = await readBody(request, z.object({ companyId: uuid }));
    const supabase = db();
    const company = await ownedCompany(companyId, user.id);

    const project = await getUserProject(company.project_id, user.id);
    if (!project) throw new UserError("Sessione non trovata.");
    if (!project.credit_used_at) throw new UserError("Avvia prima la sessione.");

    // limite di sicurezza sui costi: al massimo 2 analisi per azienda in media
    const { count } = await supabase
      .from("analyses")
      .select("id, companies!inner(project_id)", { count: "exact", head: true })
      .eq("companies.project_id", project.id);
    if ((count ?? 0) >= project.company_limit * 2) {
      throw new UserError("Hai raggiunto il numero massimo di analisi per questa sessione.");
    }
    const criteria = await getCriteria(project.id);
    if (criteria.length === 0) throw new UserError("Il progetto non ha criteri: aggiungili nelle Impostazioni.");

    const { data: analysis, error: insError } = await supabase
      .from("analyses")
      .insert({ company_id: company.id, status: "in_corso" })
      .select("id")
      .single();
    if (insError) throw insError;

    try {
      // tetto di sicurezza: se l'analisi supera 75 secondi si ferma con un errore chiaro
      // (altrimenti Vercel interrompe la funzione e l'analisi resterebbe "in corso" per sempre)
      const deadline = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new UserError("L'analisi ha richiesto troppo tempo (sito lento o AI molto richiesta). Riprova.")), 75_000),
      );
      const { pages, channels } = await Promise.race([crawlSite(company.website_url), deadline]);
      const evaluation = await Promise.race([evaluateWebsite({
        companyName: company.name,
        productDescription: project.product_description,
        targetCustomer: project.target_customer,
        symptom: project.symptom || "",
        channels,
        criteria,
        pages,
      }), deadline]);
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

      await supabase
        .from("companies")
        .update({ contact_channels: channels, contact_plan: evaluation.contact_plan })
        .eq("id", company.id);

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
