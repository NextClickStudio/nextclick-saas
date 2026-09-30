import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisBadge, CopyButton, NotesInput, StatusSelect } from "@/components/company-controls";
import { Card, EmptyState, ScoreBar } from "@/components/ui";
import { getCompanyRows, getCriteria, getProject } from "@/lib/data";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { formatDate, statusLabel } from "@/lib/types";
import ReanalyzeButton from "./reanalyze-button";

type Props = { params: Promise<{ id: string; companyId: string }> };

export const metadata: Metadata = { title: "Dettaglio azienda" };

type EventRow = { id: string; type: string; data: Record<string, unknown> | null; created_at: string };

function describeEvent(e: EventRow): string {
  switch (e.type) {
    case "report_view":
      return "Ha aperto il report";
    case "status_change":
      return `Stato: ${statusLabel(String(e.data?.from ?? ""))} → ${statusLabel(String(e.data?.to ?? ""))}${e.data?.auto ? " (automatico)" : ""}`;
    case "analysis_done":
      return `Analisi completata (${e.data?.total_score ?? "?"}/100)`;
    case "analysis_error":
      return `Analisi non riuscita: ${e.data?.message ?? ""}`;
    default:
      return e.type;
  }
}

export default async function CompanyPage({ params }: Props) {
  const { id, companyId } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [criteria, rows, site] = await Promise.all([getCriteria(id), getCompanyRows(id), siteUrl()]);
  const row = rows.find((r) => r.id === companyId);
  if (!row) notFound();

  const { data: events } = await db()
    .from("events")
    .select("id, type, data, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);

  const a = row.analysis;
  const reportUrl = row.report ? `${site}/r/${row.report.slug}` : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/progetti/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {project.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{row.name}</h1>
            <a href={row.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:underline">
              {row.website_url}
            </a>
          </div>
          <ReanalyzeButton companyId={row.id} label={a ? "Rianalizza" : "Analizza"} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-600">Punteggio</p>
          <p className="text-3xl font-bold">{a ? `${a.total_score}` : "—"}<span className="text-base text-gray-500">/100</span></p>
          <p className="text-sm text-gray-600">{row.position ? `Posizione ${row.position} su ${rows.filter((r) => r.analysis).length}` : "Non in classifica"}</p>
          <div className="mt-2"><AnalysisBadge row={row} /></div>
          {row.lastAttempt?.status === "errore" && <p className="mt-1 text-xs text-red-700">{row.lastAttempt.error_message}</p>}
        </Card>
        <Card>
          <p className="mb-2 text-sm text-gray-600">Stato commerciale</p>
          <StatusSelect companyId={row.id} value={row.status} />
          <p className="mt-3 text-sm text-gray-600">Visite al report: <strong>{row.report?.view_count ?? 0}</strong></p>
          {row.report?.last_viewed_at && <p className="text-xs text-gray-500">Ultima: {formatDate(row.report.last_viewed_at, true)}</p>}
        </Card>
        <Card>
          <p className="mb-2 text-sm text-gray-600">Report privato</p>
          {reportUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <a href={reportUrl} target="_blank" className="text-sm font-medium text-accent hover:underline">Apri report</a>
              <CopyButton text={reportUrl} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">Disponibile dopo la prima analisi completata.</p>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-semibold">Note</h2>
        <NotesInput companyId={row.id} value={row.notes} multiline />
      </Card>

      {!a ? (
        <EmptyState>Nessuna analisi completata per questa azienda.</EmptyState>
      ) : (
        <>
          <Card>
            <h2 className="mb-2 font-semibold">Riassunto</h2>
            <p className="text-sm text-gray-700">{a.summary}</p>
            <h3 className="mb-1 mt-4 text-sm font-semibold">Pagine analizzate ({formatDate(a.analyzed_at, true)})</h3>
            <ul className="text-sm">
              {(a.pages_analyzed ?? []).map((p) => (
                <li key={p.url} className="truncate">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{p.title}</a>{" "}
                  <span className="text-xs text-gray-500">{p.url}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Punti deboli</h2>
            <ol className="space-y-3">
              {(a.weak_points ?? []).map((w, i) => (
                <li key={i} className="text-sm">
                  <p className="font-semibold">{i + 1}. {w.title}</p>
                  <p className="text-gray-700">{w.explanation}</p>
                  <p className="text-xs text-gray-500">Prova: {w.evidence}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Punteggi per criterio</h2>
            <div className="space-y-4">
              {criteria.map((c) => {
                const s = a.scores?.find((x) => x.criterion_id === c.id);
                return (
                  <div key={c.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{c.name} <span className="text-xs text-gray-500">(peso {c.weight})</span></span>
                      <span className="font-semibold">{s ? `${s.score}/10` : "—"}</span>
                    </div>
                    <ScoreBar value={s?.score ?? 0} max={10} />
                    <p className="mt-1 text-xs text-gray-600">{s?.evidence ?? "Criterio aggiunto dopo l'analisi: rianalizza per valutarlo."}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          {row.report && (
            <Card>
              <h2 className="mb-3 font-semibold">Anteprima del report</h2>
              <p className="mb-3 text-xs text-gray-500">Le tue aperture non vengono conteggiate come visite.</p>
              <iframe src={`/r/${row.report.slug}`} className="h-[640px] w-full rounded-lg border border-gray-200" title="Anteprima report" />
            </Card>
          )}
        </>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">Storico eventi</h2>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Nessun evento ancora.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(events as EventRow[]).map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-44 shrink-0 text-gray-500">{formatDate(e.created_at, true)}</span>
                <span>{describeEvent(e)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
