// Analizza UNA azienda: visita il sito, chiede la valutazione all'AI, salva il risultato.
// Il browser chiama questa route un'azienda alla volta, così ogni chiamata resta sotto i limiti di tempo.
import { nanoid } from "nanoid";
import { z } from "zod";
import { evaluateWebsite, findPeopleOnWeb } from "@/lib/ai";
import { handle, ownedCompany, readBody, uuid } from "@/lib/api";
import { crawlSite } from "@/lib/crawler";
import { planFirst, webPeopleAsHints, withPeople } from "@/lib/people";
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
      // in parallelo alla visita del sito: ricerca Google di founder, marketing e commerciale
      // (se fallisce o è lenta si va avanti con quello che c'è sul sito)
      const webSearch = findPeopleOnWeb({ companyName: company.name, website: company.website_url, sector: project.target_sector })
        .then((people) => webPeopleAsHints(people))
        .catch((err) => {
          console.error("Ricerca persone sul web", err instanceof Error ? err.message : err);
          return null;
        });
      const { pages, channels, profiles, peopleHints } = await Promise.race([crawlSite(company.website_url), deadline]);
      const web = await Promise.race([webSearch, new Promise<null>((r) => setTimeout(() => r(null), 30_000))]);
      // persone trovate solo con Google (non sul sito): nell'app sono segnate "dal web"
      const siteText = (peopleHints.join(" ") + " " + pages.map((p) => p.content).join(" ")).toLowerCase();
      const onlyWeb = new Set([...(web?.names ?? [])].filter((n) => !siteText.includes(n)));
      const evaluation = await Promise.race([evaluateWebsite({
        companyName: company.name,
        productDescription: project.product_description,
        targetCustomer: project.target_customer,
        symptom: project.symptom || "",
        channels,
        profiles: [...profiles, ...(web?.profiles ?? [])],
        peopleHints: [...peopleHints, ...(web?.hints ?? [])],
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
        .update({ contact_channels: planFirst(withPeople(company.name, evaluation.people, channels, onlyWeb), evaluation.contact_plan), contact_plan: evaluation.contact_plan })
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
