import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisBadge, CopyButton, NotesInput, StatusSelect } from "@/components/company-controls";
import { Card, EmptyState, ScoreBar } from "@/components/ui";
import { getCompanyRows, getCriteria, getUserProject } from "@/lib/data";
import { getCurrentUser } from "@/lib/supabase-auth";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { formatDate, statusLabel, keyPeople } from "@/lib/types";
import FindPeopleButton from "@/components/find-people-button";
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
    case "message_sent":
      return `Messaggio inviato su ${e.data?.channel ?? "?"} (${Number(e.data?.step ?? 0) === 0 ? "primo contatto" : `follow-up ${e.data?.step}`})`;
    case "call_request":
      return `📞 Ha chiesto una call dal report (${e.data?.channel ?? ""})`;
    case "analysis_error":
      return `Analisi non riuscita: ${e.data?.message ?? ""}`;
    default:
      return e.type;
  }
}

export default async function CompanyPage({ params }: Props) {
  const { id, companyId } = await params;
  const user = (await getCurrentUser())!;
  const project = await getUserProject(id, user.id);
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
        <Link href={`/app/sessioni/${id}`} className="text-sm text-zinc-500 hover:text-white">
          ← {project.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white">{row.name}</h1>
            <a href={row.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-400 hover:underline">
              {row.website_url}
            </a>
          </div>
          <ReanalyzeButton companyId={row.id} label={a ? "Rianalizza" : "Analizza"} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-400">Punteggio</p>
          <p className="text-3xl font-bold">{a ? `${a.total_score}` : "—"}<span className="text-base text-zinc-500">/100</span></p>
          <p className="text-sm text-zinc-400">{row.position ? `Posizione ${row.position} su ${rows.filter((r) => r.analysis).length}` : "Non in classifica"}</p>
          <div className="mt-2"><AnalysisBadge row={row} /></div>
          {row.lastAttempt?.status === "errore" && <p className="mt-1 text-xs text-red-300">{row.lastAttempt.error_message}</p>}
        </Card>
        <Card>
          <p className="mb-2 text-sm text-zinc-400">Stato commerciale</p>
          <StatusSelect companyId={row.id} value={row.status} />
          <p className="mt-3 text-sm text-zinc-400">Visite al report: <strong>{row.report?.view_count ?? 0}</strong></p>
          {row.report?.last_viewed_at && <p className="text-xs text-zinc-500">Ultima: {formatDate(row.report.last_viewed_at, true)}</p>}
        </Card>
        <Card>
          <p className="mb-2 text-sm text-zinc-400">Report privato</p>
          {reportUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <a href={reportUrl} target="_blank" className="text-sm font-medium text-[#c4b8ff] hover:underline">Apri report</a>
              <CopyButton text={reportUrl} />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Disponibile dopo la prima analisi completata.</p>
          )}
        </Card>
      </div>

      {row.contact_plan && (
        <div className="glow-border rounded-2xl bg-panel p-6">
          <p className="text-xs uppercase tracking-wider text-[#c4b8ff]">Metodo di contatto consigliato</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">{row.contact_plan.channel_label}</h2>
              {row.contact_plan.person_name && (
                <p className="text-sm text-zinc-400">
                  Scrivi a <span className="text-white">{row.contact_plan.person_name}</span>
                  {row.contact_plan.person_role && ` · ${row.contact_plan.person_role}`}
                </p>
              )}
            </div>
            {(row.contact_channels ?? []).find((c) => c.type === row.contact_plan!.channel_type)?.url && (
              <a
                href={(row.contact_channels ?? []).find((c) => c.type === row.contact_plan!.channel_type)!.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[#c4b8ff] hover:underline"
              >
                Apri canale ↗
              </a>
            )}
          </div>
          <p className="mt-2 text-sm text-zinc-300">{row.contact_plan.why}</p>
          <ol className="mt-4 space-y-2 text-sm text-zinc-300">
            {row.contact_plan.steps.map((s, k) => (
              <li key={k} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px]">{k + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-xl bg-white/[0.04] p-3 text-sm italic text-zinc-200">“{row.contact_plan.opening_angle}”</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">
              {keyPeople(row.contact_channels).length > 0
                ? "Persone chiave (dal sito e da Google)"
                : "Nessuna persona chiave trovata sul sito: cercala su Google."}
            </p>
            <FindPeopleButton companyId={row.id} small />
          </div>
          {keyPeople(row.contact_channels).length > 0 && (
            <div className="mt-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {keyPeople(row.contact_channels).map((p) => (
                  <div key={p.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm font-semibold text-white">
                      {p.name}
                      {p.channels.every((c) => c.source === "web") && <span className="ml-1.5 text-[10px] font-normal text-amber-300">dal web · verifica</span>}
                    </p>
                    <p className="text-xs text-zinc-500">{p.role}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.channels.map((c, i) => (
                        <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-[#d6ceff] hover:brightness-125">
                          {c.type === "persona" ? "Cerca su LinkedIn" : c.type === "whatsapp" ? "WhatsApp" : c.type === "instagram" ? "Instagram" : "LinkedIn"} ↗
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(row.contact_channels ?? []).some((c) => !c.person) && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-zinc-500">Canali dell&apos;azienda</p>
              <div className="flex flex-wrap gap-2">
                {(row.contact_channels ?? []).filter((c) => !c.person).map((c, i) =>
                  c.url ? (
                    <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300 hover:border-accent/50">
                      {c.label} ↗
                    </a>
                  ) : (
                    <span key={i} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">{c.label}</span>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
            <p className="text-sm text-zinc-300">{a.summary}</p>
            <h3 className="mb-1 mt-4 text-sm font-semibold">Pagine analizzate ({formatDate(a.analyzed_at, true)})</h3>
            <ul className="text-sm">
              {(a.pages_analyzed ?? []).map((p) => (
                <li key={p.url} className="truncate">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[#c4b8ff] hover:underline">{p.title}</a>{" "}
                  <span className="text-xs text-zinc-500">{p.url}</span>
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
                  <p className="text-zinc-300">{w.explanation}</p>
                  <p className="text-xs text-zinc-500">Prova: {w.evidence}</p>
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
                      <span className="font-medium">{c.name} <span className="text-xs text-zinc-500">(peso {c.weight})</span></span>
                      <span className="font-semibold">{s ? `${s.score}/10` : "—"}</span>
                    </div>
                    <ScoreBar value={s?.score ?? 0} max={10} />
                    <p className="mt-1 text-xs text-zinc-400">{s?.evidence ?? "Criterio aggiunto dopo l'analisi: rianalizza per valutarlo."}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          {row.report && (
            <Card>
              <h2 className="mb-3 font-semibold">Anteprima del report</h2>
              <p className="mb-3 text-xs text-zinc-500">Le tue aperture non vengono conteggiate come visite.</p>
              <iframe src={`/r/${row.report.slug}`} className="h-[640px] w-full rounded-xl border border-white/[0.08] bg-ink" title="Anteprima report" />
            </Card>
          )}
        </>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">Storico eventi</h2>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-zinc-500">Nessun evento ancora.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(events as EventRow[]).map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-44 shrink-0 text-zinc-500">{formatDate(e.created_at, true)}</span>
                <span>{describeEvent(e)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
