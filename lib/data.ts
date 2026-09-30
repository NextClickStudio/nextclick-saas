// Letture dal database riusate da più pagine (solo lato server).
import "server-only";
import { db } from "@/lib/db";
import { rankByScore, average } from "@/lib/scoring";
import type { Analysis, Company, CompanyRow, Criterion, Project, Report } from "@/lib/types";

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await db().from("projects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Project | null;
}

export async function getCriteria(projectId: string): Promise<Criterion[]> {
  const { data, error } = await db()
    .from("criteria")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Criterion[];
}

/**
 * Tutte le aziende del progetto con: ultima analisi completata, ultimo tentativo,
 * report e posizione in classifica (solo per chi ha un'analisi completata).
 */
export async function getCompanyRows(projectId: string): Promise<CompanyRow[]> {
  const supabase = db();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const list = companies as Company[];
  if (list.length === 0) return [];

  const ids = list.map((c) => c.id);
  const [analyses, reports] = await Promise.all([fetchAnalyses(ids), fetchReports(ids)]);

  const rows: CompanyRow[] = list.map((c) => {
    const mine = analyses.filter((a) => a.company_id === c.id); // già ordinate dalla più recente
    return {
      ...c,
      analysis: mine.find((a) => a.status === "completata") ?? null,
      lastAttempt: mine[0] ?? null,
      report: reports.find((r) => r.company_id === c.id) ?? null,
      position: null,
    };
  });

  const ranked = rankByScore(
    rows.filter((r) => r.analysis).map((r) => ({ id: r.id, name: r.name, score: Number(r.analysis!.total_score ?? 0) })),
  );
  for (const r of rows) r.position = ranked.find((x) => x.id === r.id)?.position ?? null;
  return rows;
}

// Le query con molti id vanno spezzate per non superare la lunghezza massima dell'URL.
async function inChunks<T>(ids: string[], fn: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(...(await fn(ids.slice(i, i + 100))));
  return out;
}

async function fetchAnalyses(companyIds: string[]): Promise<Analysis[]> {
  const all = await inChunks(companyIds, async (chunk) => {
    const { data, error } = await db()
      .from("analyses")
      .select("*")
      .in("company_id", chunk)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Analysis[];
  });
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function fetchReports(companyIds: string[]): Promise<Report[]> {
  return inChunks(companyIds, async (chunk) => {
    const { data, error } = await db().from("reports").select("*").in("company_id", chunk);
    if (error) throw error;
    return data as Report[];
  });
}

/** Statistiche di settore usate nel report e nella classifica. */
export function sectorStats(rows: CompanyRow[]) {
  const scores = rows.filter((r) => r.analysis).map((r) => Number(r.analysis!.total_score ?? 0));
  return {
    analyzed: scores.length,
    average: average(scores),
    best: scores.length ? Math.max(...scores) : 0,
    lastUpdate: rows
      .map((r) => r.analysis?.analyzed_at)
      .filter(Boolean)
      .sort()
      .pop() as string | undefined,
  };
}
