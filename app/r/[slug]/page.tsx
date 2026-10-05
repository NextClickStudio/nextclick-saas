// Report privato: la pagina che riceve l'azienda. Deve sembrare un documento professionale.
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CallRequest from "@/components/call-request";
import LogoMark from "@/components/logo-mark";
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
  const weakPoints = (analysis.weak_points ?? []).slice(0, 3);
  const pages = analysis.pages_analyzed ?? [];
  const firstName = senderName.split(" ")[0];
  const website = sender?.company_website ?? null;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="bg-grid absolute inset-x-0 top-0 h-[440px]" />
      <div className="orb -top-24 left-1/2 h-72 w-72 -translate-x-1/2 bg-accent/25" />
      <main className="relative mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* 1. Il risultato, in breve */}
        <header className="fade-in">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c4b8ff]">
            Analisi gratuita · {formatDate(analysis.analyzed_at)}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            {row.name}, il tuo sito perde clienti in {weakPoints.length || 3} punti.
          </h1>
          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4">
              <p className="text-[11px] text-zinc-500">Posizione</p>
              <p className="font-display text-2xl font-semibold text-white sm:text-3xl">
                {row.position}
                <span className="text-sm text-zinc-500">/{stats.analyzed}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4">
              <p className="text-[11px] text-zinc-500">Punteggio</p>
              <p className="font-display text-2xl font-semibold text-white sm:text-3xl">
                {score}
                <span className="text-sm text-zinc-500">/100</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className={`bar-fill h-full rounded-full ${scoreColor(score)}`} style={{ width: `${score}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4">
              <p className="text-[11px] text-zinc-500">Media settore</p>
              <p className="font-display text-2xl font-semibold text-white sm:text-3xl">{stats.average}</p>
              <p className="text-[11px] text-zinc-600">migliore: {stats.best}</p>
            </div>
          </div>
          {analysis.summary && <p className="mt-5 leading-relaxed text-zinc-300">{analysis.summary}</p>}
          {inTopN && (
            <a href={`/classifica/${project.public_slug}`} className="mt-4 inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-[#d6ceff]">
              ★ Nella top {project.public_top_n} dell&apos;Indice →
            </a>
          )}
        </header>

        {/* 2. La soluzione + prenota la call (in alto) */}
        <section id="call" className="glow-border fade-in mt-8 rounded-3xl bg-panel p-5 sm:p-7" style={{ animationDelay: "120ms" }}>
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-cyan font-display text-lg font-bold text-ink">
              {(senderName || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-white">{senderName || "Il team che ha realizzato l'analisi"}</p>
              <p className="text-sm text-zinc-400">
                {[sender?.sender_role, sender?.company_name].filter(Boolean).join(" · ")}
                {website && (
                  <>
                    {" · "}
                    <a href={website} target="_blank" rel="noopener noreferrer" className="text-[#c4b8ff] hover:underline">
                      {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold leading-snug text-white sm:text-2xl">Come possiamo risolverlo</h2>
          <p className="mt-2 leading-relaxed text-zinc-300">
            {sender?.company_offer || project.product_description}
          </p>
          {weakPoints.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-300">
              {weakPoints.map((w) => (
                <li key={w.title} className="flex gap-2">
                  <span className="text-cyan">✓</span>
                  <span>{w.title}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 border-t border-white/[0.07] pt-5">
            <p className="mb-4 font-semibold text-white">
              Prenota 15 minuti con {firstName || "noi"}: ti mostriamo come sistemare questi punti.
            </p>
            <CallRequest slug={slug} senderFirstName={firstName} bookingUrl={sender?.booking_url || project.report_cta_url} defaultOpen />
          </div>
        </section>

        {/* 3. I punti, in breve */}
        {weakPoints.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-display text-xl font-semibold text-white">Cosa abbiamo trovato</h2>
            <ol className="space-y-3">
              {weakPoints.map((w, i) => (
                <li key={i} className="flex gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-ink">{i + 1}</span>
                  <div>
                    <p className="font-semibold text-white">{w.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{w.explanation}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 4. Dettaglio, chiuso di default */}
        <details className="group mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-zinc-400">
            Dettaglio dei {criteria.length} criteri e metodologia
            <span className="transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="mt-4 space-y-4">
            {criteria.map((c) => {
              const s = analysis.scores?.find((x) => x.criterion_id === c.id);
              return (
                <div key={c.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="text-zinc-200">{c.name}</span>
                    <span className="font-semibold text-white">{s ? `${s.score}/10` : "—"}</span>
                  </div>
                  <ScoreBar value={s?.score ?? 0} max={10} className="h-1.5" />
                  {s?.evidence && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{s.evidence}</p>}
                </div>
              );
            })}
            <p className="border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-zinc-500">
              Abbiamo letto {pages.length === 1 ? "una pagina pubblica" : `${pages.length} pagine pubbliche`} del sito come farebbe un visitatore e le abbiamo
              valutate su {criteria.length} criteri (0-10, con pesi diversi). Stesso metodo per tutte le {stats.analyzed} aziende analizzate nel settore{" "}
              {project.target_sector}.
            </p>
          </div>
        </details>

        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-zinc-600">Report riservato a {row.name}.</p>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400">
            Analisi realizzata con <LogoMark size={14} /> <span className="font-display font-semibold">Yeppo</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
