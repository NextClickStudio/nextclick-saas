import Link from "next/link";
import { Badge, Card, EmptyState, btn } from "@/components/ui";
import { getProjects } from "@/lib/data";
import { db } from "@/lib/db";
import { COMPANIES_PER_FREE_SESSION } from "@/lib/plans";
import { availableSessions, getAccount, getCurrentUser } from "@/lib/supabase-auth";
import { formatDate } from "@/lib/types";

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const [account, projects] = await Promise.all([getAccount(user.id), getProjects(user.id)]);
  const sessions = availableSessions(account);

  // statistiche: aziende, analisi completate, report aperti
  const ids = projects.map((p) => p.id);
  const stats = { companies: 0, opened: 0, replied: 0 };
  const perProject = new Map<string, number>();
  if (ids.length > 0) {
    const { data: companies } = await db().from("companies").select("id, project_id, status").in("project_id", ids);
    for (const c of companies ?? []) {
      perProject.set(c.project_id, (perProject.get(c.project_id) ?? 0) + 1);
      stats.companies++;
      if (["report_aperto", "ha_risposto", "chiamata", "cliente"].includes(c.status)) stats.opened++;
      if (["ha_risposto", "chiamata", "cliente"].includes(c.status)) stats.replied++;
    }
  }

  const firstName = (account.full_name ?? "").split(" ")[0];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Dashboard</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Ciao{firstName ? ` ${firstName}` : ""} 👋</h1>
        </div>
        <Link href={sessions > 0 ? "/app/sessioni/nuova" : "/app/piani"} className={btn.accent}>
          + Nuova sessione
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Sessioni disponibili", value: sessions === Infinity ? "∞" : String(sessions), hint: account.free_sessions > 0 ? `di cui 1 di prova (max ${COMPANIES_PER_FREE_SESSION} aziende)` : "acquista altre sessioni in Piani" },
          { label: "Aziende trovate", value: String(stats.companies), hint: `in ${projects.length} ${projects.length === 1 ? "sessione" : "sessioni"}` },
          { label: "Hanno aperto il report", value: String(stats.opened), hint: "tracciato in automatico" },
          { label: "Conversazioni avviate", value: String(stats.replied), hint: "risposte, chiamate, clienti" },
        ].map((s) => (
          <Card key={s.label} className="relative overflow-hidden">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="mt-2 font-display text-4xl font-semibold text-white">{s.value}</p>
            <p className="mt-1 text-xs text-zinc-600">{s.hint}</p>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-4 font-display text-xl font-semibold text-white">Le tue sessioni</h2>
        {projects.length === 0 ? (
          <EmptyState>
            <p className="mb-4 text-base text-zinc-300">Nessuna sessione ancora.</p>
            <p className="mb-6">Descrivi cosa vendi: Yeppo troverà le aziende giuste, le analizzerà e ti dirà come contattarle.</p>
            <Link href={sessions > 0 ? "/app/sessioni/nuova" : "/app/piani"} className={btn.accent}>
              Crea la prima sessione
            </Link>
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/app/sessioni/${p.id}`}>
                <Card className="group h-full transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white/[0.04]">
                  <div className="mb-3 flex items-center gap-2">
                    {p.credit_used_at ? <Badge tone="green">Attiva</Badge> : <Badge tone="amber">Da avviare</Badge>}
                    {p.public_ranking_enabled && <Badge tone="accent">Classifica pubblica</Badge>}
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-[#c4b8ff]">{p.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{p.target_sector} · {p.target_country}</p>
                  <p className="mt-4 text-xs text-zinc-600">
                    {perProject.get(p.id) ?? 0}/{p.company_limit || "—"} aziende · {formatDate(p.created_at)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
