// Report privato: la pagina che riceve l'azienda. Deve sembrare un documento professionale.
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CallRequest from "@/components/call-request";
import { ScoreBar, scoreColor } from "@/components/ui";
import { db } from "@/lib/db";
import { getReportData, isBot } from "@/lib/report";
import { getCurrentUser } from "@/lib/supabase-auth";
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
  const { project, criteria, row, analysis, stats, inTopN, sender } = data;
  const senderName = sender?.full_name || project.sender_name || "";

  // Conta la visita, ma non se la apre chi ha creato la sessione o un bot/anteprima link.
  const viewer = await getCurrentUser();
  const ua = (await headers()).get("user-agent");
  if (viewer?.id !== project.user_id && !isBot(ua)) {
    const { error } = await db().rpc("register_report_view", { p_slug: slug });
    if (error) console.error("Registrazione visita fallita", error);
  }

  const score = Number(analysis.total_score ?? 0);
  const weakPoints = analysis.weak_points ?? [];
  const pages = analysis.pages_analyzed ?? [];

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="bg-grid absolute inset-x-0 top-0 h-[520px]" />
      <div className="orb -top-20 left-1/2 h-72 w-72 -translate-x-1/2 bg-accent/25" />
      <main className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="fade-in mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#c4b8ff]">{project.index_name || "Analisi di settore"}</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">Report per {row.name}</h1>
          <p className="mt-3 text-sm text-zinc-500">
            {project.target_sector} · analisi del {formatDate(analysis.analyzed_at)}
          </p>
        </header>

        {/* Posizione e punteggio */}
        <section className="glow-border fade-in mb-8 rounded-3xl bg-panel/90 p-6 sm:p-8" style={{ animationDelay: "100ms" }}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-zinc-500">Posizione</p>
              <p className="font-display text-5xl font-semibold tracking-tight text-white">
                {row.position}
                <span className="text-xl font-medium text-zinc-500"> su {stats.analyzed}</span>
              </p>
              <p className="mt-1 text-sm text-zinc-400">aziende analizzate nel settore {project.target_sector}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-zinc-500">Punteggio</p>
              <p className="font-display text-5xl font-semibold tracking-tight text-white">
                {score}
                <span className="text-xl font-medium text-zinc-500">/100</span>
              </p>
            </div>
          </div>
          <div className="mt-7 h-3 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div className={`bar-fill h-full rounded-full ${scoreColor(score)}`} style={{ width: `${score}%` }} />
          </div>
          {inTopN && (
            <a
              href={`/classifica/${project.public_slug}`}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1.5 text-sm font-semibold text-[#d6ceff]"
            >
              ★ Nella top {project.public_top_n} dell&apos;Indice · vedi la classifica →
            </a>
          )}
        </section>

        {analysis.summary && <p className="mb-12 text-lg leading-relaxed text-zinc-300">{analysis.summary}</p>}

        {weakPoints.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight text-white">I 3 punti in cui il tuo sito perde clienti</h2>
            <ol className="space-y-4">
              {weakPoints.map((w, i) => (
                <li key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                  <div className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-ink">{i + 1}</span>
                    <div>
                      <h3 className="mb-1.5 font-semibold text-white">{w.title}</h3>
                      <p className="mb-3 text-sm leading-relaxed text-zinc-300">{w.explanation}</p>
                      <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-zinc-400">
                        <span className="font-semibold text-zinc-300">Cosa abbiamo osservato: </span>
                        {w.evidence}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mb-12">
          <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight text-white">Il dettaglio, criterio per criterio</h2>
          <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {criteria.map((c) => {
              const s = analysis.scores?.find((x) => x.criterion_id === c.id);
              return (
                <div key={c.id} className="p-5">
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <h3 className="font-semibold text-white">{c.name}</h3>
                    <span className="shrink-0 font-display text-sm font-semibold text-white">{s ? `${s.score}/10` : "—"}</span>
                  </div>
                  <ScoreBar value={s?.score ?? 0} max={10} className="mb-2" />
                  <p className="text-sm leading-relaxed text-zinc-400">{s?.evidence ?? "Criterio aggiunto dopo l'analisi."}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight text-white">Il confronto con il settore</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Il tuo sito", value: score, strong: true },
              { label: "Media del settore", value: stats.average },
              { label: "Prima classificata", value: stats.best },
            ].map((b) => (
              <div key={b.label} className={`rounded-2xl border p-4 ${b.strong ? "border-accent/50 bg-accent-soft" : "border-white/[0.08] bg-white/[0.02]"}`}>
                <p className="text-xs text-zinc-400">{b.label}</p>
                <p className="font-display text-3xl font-semibold text-white">{b.value}</p>
                <ScoreBar value={b.value} className="mt-2 h-1.5" />
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-sm text-zinc-400">
          <h2 className="mb-2 font-semibold text-white">Metodologia</h2>
          <p className="mb-2 leading-relaxed">
            Il {formatDate(analysis.analyzed_at)} abbiamo letto {pages.length === 1 ? "una pagina pubblica" : `${pages.length} pagine pubbliche`} del sito, come
            farebbe un visitatore, e le abbiamo valutate su {criteria.length} criteri, ciascuno da 0 a 10, con un peso diverso. Il punteggio
            finale è la media ponderata su scala 0-100. Lo stesso metodo è applicato a tutte le {stats.analyzed} aziende analizzate.
          </p>
          {pages.length > 0 && (
            <ul className="list-inside list-disc text-xs text-zinc-500">
              {pages.map((p) => (
                <li key={p.url} className="truncate">{p.url.replace(/^https?:\/\//, "")}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="glow-border rounded-3xl bg-panel p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c4b8ff]">Chi ha preparato questa analisi</p>
          <div className="mt-4 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-cyan font-display text-lg font-bold text-ink">
              {(senderName || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-white">{senderName || "Il team che ha realizzato l'analisi"}</p>
              {(sender?.sender_role || sender?.company_name) && (
                <p className="text-sm text-zinc-400">{[sender?.sender_role, sender?.company_name].filter(Boolean).join(" · ")}</p>
              )}
              {sender?.company_offer && <p className="mt-2 text-sm leading-relaxed text-zinc-300">{sender.company_offer}</p>}
              {sender?.company_website && (
                <a href={sender.company_website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-[#c4b8ff] hover:underline">
                  {sender.company_website.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
                </a>
              )}
            </div>
          </div>
          <p className="mb-5 mt-6 font-display text-xl font-semibold leading-snug text-white">{project.report_cta_text}</p>
          <CallRequest slug={slug} senderFirstName={(senderName || "").split(" ")[0]} bookingUrl={sender?.booking_url || project.report_cta_url} />
        </section>

        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="text-xs text-zinc-600">Report riservato a {row.name}. Non condividere questo link.</p>
          <Link href="/" className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400">
            Analisi realizzata con
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-accent to-cyan text-[10px] font-bold text-ink">Y</span>
            <span className="font-display font-semibold text-zinc-400">Yeppo</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
