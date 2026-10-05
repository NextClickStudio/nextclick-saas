// Dati per il report privato di un'azienda.
import "server-only";
import { db } from "@/lib/db";
import { getCompanyRows, getCriteria, getProject, sectorStats } from "@/lib/data";
import type { Report } from "@/lib/types";

export async function getReportData(slug: string) {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(slug)) return null;
  const { data: report } = await db().from("reports").select("*").eq("slug", slug).maybeSingle();
  if (!report) return null;

  const { data: company } = await db().from("companies").select("project_id").eq("id", report.company_id).maybeSingle();
  if (!company) return null;
  const project = await getProject(company.project_id);
  if (!project) return null;

  const [criteria, rows] = await Promise.all([getCriteria(project.id), getCompanyRows(project.id)]);
  const row = rows.find((r) => r.id === report.company_id);
  if (!row?.analysis) return null; // nessuna analisi completata: il report non è ancora pronto

  const stats = sectorStats(rows);
  // chi ha preparato l'analisi (profilo dell'utente proprietario della sessione)
  const { data: sender } = await db()
    .from("accounts")
    .select("full_name, company_name, sender_role, company_website, company_offer, booking_url")
    .eq("user_id", project.user_id)
    .maybeSingle();
  const inTopN = project.public_ranking_enabled && row.position !== null && row.position <= project.public_top_n;
  return {
    report: report as Report,
    project,
    criteria,
    row,
    analysis: row.analysis,
    stats,
    inTopN,
    sender: sender as {
      full_name: string | null;
      company_name: string | null;
      sender_role: string | null;
      company_website: string | null;
      company_offer: string | null;
      booking_url: string | null;
    } | null,
  };
}

/**
 * User-agent di anteprime link e crawler: non contano come visite.
 * Attenzione a non escludere i browser interni delle app (LinkedIn, Instagram...): lì apre una persona vera;
 * i loro bot di anteprima hanno "bot" nel nome (LinkedInBot, Pinterestbot...).
 */
export function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|preview|facebookexternalhit|meta-externalagent|slack|whatsapp|telegram|discord|skype|embedly|iframely|pagerenderer|headless|curl|wget|python|axios|node-fetch/i.test(
    userAgent,
  );
}
