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
  const inTopN = project.public_ranking_enabled && row.position !== null && row.position <= project.public_top_n;
  return { report: report as Report, project, criteria, row, analysis: row.analysis, stats, inTopN };
}

/** User-agent di anteprime link e crawler: non contano come visite. */
export function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|preview|linkedin|facebookexternalhit|slack|whatsapp|telegram|discord|skype|embedly|headless|curl|wget|python|axios|node-fetch/i.test(
    userAgent,
  );
}
