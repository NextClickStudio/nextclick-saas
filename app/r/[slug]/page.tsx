// Report privato: la pagina che riceve l'azienda. Deve sembrare un documento professionale.
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ScoreBar, scoreColor } from "@/components/ui";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getReportData, isBot } from "@/lib/report";
import { formatDate } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getReportData((await params).slug);
  return {
    title: data ? `Report per ${data.row.name}` : "Report",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function ReportPage({ params }: Props) {
  const { slug } = await params;
  const data = await getReportData(slug);
  if (!data) notFound();
  const { project, criteria, row, analysis, stats, inTopN } = data;

  // Conta la visita, ma non se la pagina è aperta da te (area riservata) o da un bot/anteprima link.
  const isAdmin = await verifySessionToken((await cookies()).get(AUTH_COOKIE)?.value);
  const ua = (await headers()).get("user-agent");
  if (!isAdmin && !isBot(ua)) {
    const { error } = await db().rpc("register_report_view", { p_slug: slug });
    if (error) console.error("Registrazione visita fallita", error);
  }

  const score = Number(analysis.total_score ?? 0);
  const weakPoints = analysis.weak_points ?? [];
  const pages = analysis.pages_analyzed ?? [];

  return (
    <div className="bg-gray-50 flex-1">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Intestazione */}
        <header className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
            {project.index_name || "Analisi di settore"}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">Report per {row.name}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {project.target_sector} · analisi del {formatDate(analysis.analyzed_at)}
          </p>
        </header>

        {/* Posizione e punteggio */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-600">Posizione</p>
              <p className="text-4xl font-bold tracking-tight text-gray-950">
                {row.position}
                <span className="text-lg font-medium text-gray-500"> su {stats.analyzed}</span>
              </p>
              <p className="mt-1 text-sm text-gray-600">aziende analizzate nel settore {project.target_sector}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-gray-600">Punteggio</p>
              <p className="text-4xl font-bold tracking-tight">
                {score}
                <span className="text-lg font-medium text-gray-500">/100</span>
              </p>
            </div>
          </div>
          <div className="relative mt-6">
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${scoreColor(score)}`} style={{ width: `${score}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>0</span>
              <span>100</span>
            </div>
          </div>
          {inTopN && (
            <a
              href={`/classifica/${project.public_slug}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent"
            >
              ★ Nella top {project.public_top_n} dell&apos;Indice · vedi la classifica →
            </a>
          )}
        </section>

        {/* Riassunto */}
        {analysis.summary && (
          <section className="mb-8">
            <p className="text-lg leading-relaxed text-gray-800">{analysis.summary}</p>
          </section>
        )}

        {/* I 3 punti deboli */}
        {weakPoints.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-xl font-bold tracking-tight">I 3 punti in cui il tuo sito perde clienti</h2>
            <ol className="space-y-4">
              {weakPoints.map((w, i) => (
                <li key={i} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-950 text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-950">{w.title}</h3>
                      <p className="mb-3 text-sm leading-relaxed text-gray-700">{w.explanation}</p>
                      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
                        <span className="font-semibold">Cosa abbiamo osservato: </span>
                        {w.evidence}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Criteri */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold tracking-tight">Il dettaglio, criterio per criterio</h2>
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {criteria.map((c) => {
              const s = analysis.scores?.find((x) => x.criterion_id === c.id);
              return (
                <div key={c.id} className="p-5">
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <h3 className="font-semibold text-gray-950">{c.name}</h3>
                    <span className="shrink-0 text-sm font-bold">{s ? `${s.score}/10` : "—"}</span>
                  </div>
                  <ScoreBar value={s?.score ?? 0} max={10} className="mb-2" />
                  <p className="text-sm leading-relaxed text-gray-600">{s?.evidence ?? "Criterio aggiunto dopo l'analisi."}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Confronto */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold tracking-tight">Il confronto con il settore</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Il tuo sito", value: score, strong: true },
              { label: "Media del settore", value: stats.average },
              { label: "Prima classificata", value: stats.best },
            ].map((b) => (
              <div key={b.label} className={`rounded-2xl border p-4 ${b.strong ? "border-accent bg-accent-soft" : "border-gray-200 bg-white"}`}>
                <p className="text-xs text-gray-600">{b.label}</p>
                <p className="text-2xl font-bold">{b.value}</p>
                <ScoreBar value={b.value} className="mt-2 h-1.5" />
              </div>
            ))}
          </div>
        </section>

        {/* Metodologia */}
        <section className="mb-10 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
          <h2 className="mb-2 font-semibold text-gray-950">Metodologia</h2>
          <p className="mb-2">
            Il {formatDate(analysis.analyzed_at)} abbiamo letto {pages.length === 1 ? "una pagina pubblica" : `${pages.length} pagine pubbliche`} del
            sito, come farebbe un visitatore, e le abbiamo valutate su {criteria.length} criteri, ciascuno da 0 a 10, con
            un peso diverso. Il punteggio finale è la media ponderata su scala 0-100. Lo stesso metodo è applicato a tutte
            le {stats.analyzed} aziende analizzate.
          </p>
          {pages.length > 0 && (
            <ul className="list-inside list-disc text-xs text-gray-500">
              {pages.map((p) => (
                <li key={p.url} className="truncate">{p.url.replace(/^https?:\/\//, "")}</li>
              ))}
            </ul>
          )}
        </section>

        {/* CTA */}
        <section className="rounded-2xl bg-gray-950 p-6 text-white sm:p-8">
          <p className="mb-4 text-lg font-semibold leading-snug">{project.report_cta_text}</p>
          {project.report_cta_url && (
            <a
              href={project.report_cta_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-dark"
            >
              {project.report_cta_text.length <= 40 ? project.report_cta_text : "Prenota ora"}
            </a>
          )}
          {project.sender_name && <p className="mt-4 text-sm text-gray-300">— {project.sender_name}</p>}
        </section>

        <p className="mt-8 text-center text-xs text-gray-400">Report riservato a {row.name}. Non condividere questo link.</p>
      </main>
    </div>
  );
}
