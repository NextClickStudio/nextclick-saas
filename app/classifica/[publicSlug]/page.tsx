// Classifica pubblica: mostra SOLO le prime N aziende. Pensata per essere condivisa su LinkedIn.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ScoreBar } from "@/components/ui";
import { getCompanyRows, getCriteria, sectorStats } from "@/lib/data";
import { db } from "@/lib/db";
import { formatDate, type Project } from "@/lib/types";

type Props = { params: Promise<{ publicSlug: string }> };

// cache(): la stessa richiesta non interroga il database due volte (metadata + pagina)
const loadRanking = cache(async (slug: string) => {
  if (!/^[a-z0-9]{4,40}$/.test(slug)) return null;
  const { data } = await db().from("projects").select("*").eq("public_slug", slug).maybeSingle();
  const project = data as Project | null;
  if (!project || !project.public_ranking_enabled) return null;

  const [criteria, rows] = await Promise.all([getCriteria(project.id), getCompanyRows(project.id)]);
  const ranked = rows
    .filter((r) => r.analysis && r.position !== null)
    .sort((a, b) => a.position! - b.position! || a.name.localeCompare(b.name, "it"));
  // mai oltre la top N
  const top = ranked
    .filter((r) => r.position! <= project.public_top_n)
    .slice(0, project.public_top_n)
    .map((r) => ({ position: r.position!, name: r.name, score: Number(r.analysis!.total_score ?? 0) }));

  const title = `${project.index_name || "Indice di settore"} — ${project.target_sector}`;
  return { project, criteria, top, title, stats: sectorStats(rows) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadRanking((await params).publicSlug);
  if (!data) return { title: "Classifica non trovata" };
  const description = `Le ${data.top.length} aziende migliori su ${data.stats.analyzed} analizzate nel settore ${data.project.target_sector}. Aggiornato al ${formatDate(data.stats.lastUpdate)}.`;
  return {
    title: data.title,
    description,
    openGraph: { title: data.title, description, type: "article", locale: "it_IT" },
    twitter: { card: "summary", title: data.title, description },
  };
}

export default async function PublicRankingPage({ params }: Props) {
  const data = await loadRanking((await params).publicSlug);
  if (!data) notFound();
  const { project, criteria, top, title, stats } = data;
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1;

  return (
    <div className="flex-1 bg-white">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent">Classifica · Top {top.length}</p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-gray-600">
            {stats.analyzed} aziende analizzate · aggiornato al {formatDate(stats.lastUpdate)}
          </p>
        </header>

        {top.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
            La classifica sarà disponibile a breve.
          </p>
        ) : (
          <ol className="mb-12 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
            {top.map((r) => (
              <li key={r.name} className="flex items-center gap-4 px-4 py-4 sm:px-6">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    r.position <= 3 ? "bg-accent text-white" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {r.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-950">{r.name}</p>
                  <ScoreBar value={r.score} className="mt-2 max-w-xs h-1.5" />
                </div>
                <span className="text-xl font-bold tabular-nums">
                  {r.score}
                  <span className="text-xs font-medium text-gray-500">/100</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <section className="rounded-2xl bg-gray-50 p-6 text-sm text-gray-700">
          <h2 className="mb-2 text-lg font-bold text-gray-950">Metodologia</h2>
          <p className="mb-4">
            Per ogni azienda abbiamo letto fino a 3 pagine pubbliche del sito (homepage, una pagina prodotto e una
            categoria) e assegnato un punteggio da 0 a 10 su ciascun criterio. Il punteggio finale è la media ponderata
            per peso, su scala 0-100. Vengono pubblicate solo le prime {project.public_top_n} aziende.
          </p>
          <ul className="space-y-3">
            {criteria.map((c) => (
              <li key={c.id}>
                <p className="font-semibold text-gray-950">
                  {c.name} <span className="font-normal text-gray-500">· peso {Math.round((c.weight / totalWeight) * 100)}%</span>
                </p>
                <p className="text-gray-600">{c.description}</p>
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-8 text-center text-xs text-gray-400">
          {project.sender_name ? `Una ricerca di ${project.sender_name}` : "Classifica realizzata con Zeppo"}
        </p>
      </main>
    </div>
  );
}
