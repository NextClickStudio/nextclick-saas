// Analizza UNA azienda: visita il sito, chiede la valutazione all'AI, salva il risultato.
// Il browser chiama questa route un'azienda alla volta, così ogni chiamata resta sotto i limiti di tempo.
import { nanoid } from "nanoid";
import { z } from "zod";
import { evaluateWebsite, type Evaluation } from "@/lib/ai";
import { handle, ownedCompany, readBody, uuid } from "@/lib/api";
import { crawlSite, type ContactChannel } from "@/lib/crawler";
import { db, friendlyError, UserError } from "@/lib/db";
import { getCriteria, getUserProject } from "@/lib/data";
import { requireUser } from "@/lib/supabase-auth";
import { computeTotalScore } from "@/lib/scoring";

export const maxDuration = 90;

/**
 * Canali delle persone chiave prima di quelli aziendali: chi apre WhatsApp o Instagram
 * scrive così alla persona che decide. Chi non ha profili sul sito resta come "persona"
 * con una ricerca LinkedIn pronta.
 */
function withPeople(companyName: string, people: Evaluation["people"], channels: ContactChannel[]): ContactChannel[] {
  const personal: ContactChannel[] = [];
  for (const p of people) {
    const who = { person: p.name, role: p.role };
    if (p.whatsapp_url) personal.push({ type: "whatsapp", label: `WhatsApp di ${p.name} (${p.role})`, url: p.whatsapp_url, ...who });
    if (p.instagram_url) personal.push({ type: "instagram", label: `Instagram di ${p.name} (${p.role})`, url: p.instagram_url, ...who });
    if (p.linkedin_url) personal.push({ type: "linkedin", label: `LinkedIn di ${p.name} (${p.role})`, url: p.linkedin_url, ...who });
    if (!p.whatsapp_url && !p.instagram_url && !p.linkedin_url) {
      const q = encodeURIComponent(`${p.name} ${companyName}`);
      personal.push({ type: "persona", label: `${p.name} (${p.role})`, url: `https://www.linkedin.com/search/results/people/?keywords=${q}`, ...who });
    }
  }
  // stesso URL già presente come canale aziendale (es. WhatsApp unico): resta solo la versione con la persona
  const urls = new Set(personal.map((c) => c.url));
  return [...personal, ...channels.filter((c) => !c.url || !urls.has(c.url))];
}

/** Mette per primo il canale scelto dal piano (stesso tipo e stessa persona): i link "apri canale" usano il primo del tipo. */
function planFirst(channels: ContactChannel[], plan: Evaluation["contact_plan"]): ContactChannel[] {
  const i = channels.findIndex((c) => c.type === plan.channel_type && (c.person ?? "") === (plan.person_name ?? ""));
  return i > 0 ? [channels[i], ...channels.slice(0, i), ...channels.slice(i + 1)] : channels;
}

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
      const { pages, channels, profiles, peopleHints } = await Promise.race([crawlSite(company.website_url), deadline]);
      const evaluation = await Promise.race([evaluateWebsite({
        companyName: company.name,
        productDescription: project.product_description,
        targetCustomer: project.target_customer,
        symptom: project.symptom || "",
        channels,
        profiles,
        peopleHints,
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
        .update({ contact_channels: planFirst(withPeople(company.name, evaluation.people, channels), evaluation.contact_plan), contact_plan: evaluation.contact_plan })
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
