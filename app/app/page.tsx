import Link from "next/link";
import { connection } from "next/server";
import { Card, EmptyState, btn } from "@/components/ui";
import { getProjects } from "@/lib/data";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/types";

export default async function ProjectsPage() {
  await connection(); // dati sempre aggiornati: niente pagina pre-generata
  const projects = await getProjects();

  // numero di aziende per progetto
  const counts = new Map<string, number>();
  if (projects.length > 0) {
    const { data } = await db().from("companies").select("project_id").in("project_id", projects.map((p) => p.id));
    for (const row of data ?? []) counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Progetti</h1>
        <Link href="/app/progetti/nuovo" className={btn.primary}>
          + Nuovo progetto
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState>
          Nessun progetto ancora. <Link href="/app/progetti/nuovo" className="font-semibold text-accent">Crea il primo</Link>{" "}
          descrivendo cosa vendi e a chi.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/app/progetti/${p.id}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-gray-950">{p.name}</h2>
                  {p.public_ranking_enabled && (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                      Classifica pubblica
                    </span>
                  )}
                </div>
                <p className="mb-3 text-sm text-gray-600">{p.target_sector}</p>
                <p className="text-xs text-gray-500">
                  {counts.get(p.id) ?? 0} aziende · creato il {formatDate(p.created_at)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
