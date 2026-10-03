import Link from "next/link";
import { Badge, Card, EmptyState, btn } from "@/components/ui";
import { getProjects } from "@/lib/data";
import { db } from "@/lib/db";
import { COMPANIES_PER_FREE_SESSION } from "@/lib/plans";
import { availableSessions, getAccount, getCurrentUser, profileComplete } from "@/lib/supabase-auth";
import { formatDate } from "@/lib/types";

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const [account, projects] = await Promise.all([getAccount(user.id), getProjects(user.id)]);
  const sessions = availableSessions(account);

  // numeri per checklist e statistiche
  const ids = projects.map((p) => p.id);
  const stats = { companies: 0, analyzed: 0, opened: 0, replied: 0, due: 0, hot: 0, messages: 0, requests: 0, newRequests: 0 };
  const perProject = new Map<string, number>();
  const nowIso = new Date().toISOString();
  if (ids.length > 0) {
    const [{ data: companies }, { count: messages }, { data: requests }] = await Promise.all([
      db().from("companies").select("id, project_id, status, next_followup_at, contact_plan, reports(view_count)").in("project_id", ids),
      db()
        .from("messages")
        .select("id, companies!inner(project_id)", { count: "exact", head: true })
        .in("companies.project_id", ids),
      db().from("call_requests").select("status, companies!inner(project_id)").in("companies.project_id", ids),
    ]);
    stats.messages = messages ?? 0;
    stats.requests = (requests ?? []).length;
    stats.newRequests = (requests ?? []).filter((r) => r.status === "nuova").length;
    for (const c of companies ?? []) {
      perProject.set(c.project_id, (perProject.get(c.project_id) ?? 0) + 1);
      stats.companies++;
      if (c.contact_plan) stats.analyzed++;
      if (["report_aperto", "ha_risposto", "chiamata", "cliente"].includes(c.status)) stats.opened++;
      if (["ha_risposto", "chiamata", "cliente"].includes(c.status)) stats.replied++;
      const open = ["contattata", "report_aperto"].includes(c.status);
      if (open && c.next_followup_at && c.next_followup_at <= nowIso) stats.due++;
      const views = c.reports as unknown as { view_count: number }[] | { view_count: number } | null;
      const viewCount = Array.isArray(views) ? (views[0]?.view_count ?? 0) : (views?.view_count ?? 0);
      if (open && viewCount > 0) stats.hot++;
    }
  }

  const firstName = (account.full_name ?? "").split(" ")[0];
  const firstSession = projects.find((p) => p.credit_used_at);

  // "Primi passi": cosa fare, in ordine
  const steps = [
    {
      done: profileComplete(account),
      title: "Completa il tuo profilo",
      text: "Nome, azienda, sito e cosa offri: compaiono nei report e firmano i messaggi.",
      href: "/app/account",
      cta: "Completa",
    },
    {
      done: projects.some((p) => p.credit_used_at),
      title: "Crea la tua prima sessione",
      text: "Descrivi cosa vendi: Yeppo trova le aziende giuste per te.",
      href: sessions > 0 ? "/app/sessioni/nuova" : "/app/piani",
      cta: "Crea",
    },
    {
      done: stats.analyzed > 0,
      title: "Analizza le aziende",
      text: "Punteggio, report privato e canale di contatto per ognuna.",
      href: firstSession ? `/app/sessioni/${firstSession.id}?tab=analisi` : "/app/sessioni/nuova",
      cta: "Analizza",
    },
    {
      done: stats.messages > 0,
      title: "Invia il primo aggancio",
      text: "In Outreach l'AI scrive il messaggio: tu lo invii con un clic.",
      href: "/app/outreach",
      cta: "Apri Outreach",
    },
    {
      done: stats.requests > 0,
      title: "Ricevi la prima richiesta di call",
      text: "Quando un'azienda la chiede dal report, ti arriva in Richieste.",
      href: "/app/richieste",
      cta: "Vedi",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

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

      {/* Avvisi importanti */}
      {(stats.newRequests > 0 || stats.due > 0 || stats.hot > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {stats.newRequests > 0 && (
            <Link href="/app/richieste" className="glow-border fade-in flex items-center justify-between gap-3 rounded-2xl bg-panel p-5 hover:brightness-110">
              <div>
                <p className="font-display text-lg font-semibold text-white">📞 {stats.newRequests} {stats.newRequests === 1 ? "richiesta" : "richieste"} di call</p>
                <p className="text-sm text-zinc-400">Accetta e rispondi in DM con un clic.</p>
              </div>
              <span className={btn.accent}>Apri →</span>
            </Link>
          )}
          {(stats.due > 0 || stats.hot > 0) && (
            <Link href="/app/outreach" className="fade-in flex items-center justify-between gap-3 rounded-2xl border border-orange-400/30 bg-orange-400/[0.06] p-5 hover:brightness-110">
              <div>
                <p className="font-display text-lg font-semibold text-white">Oggi in Outreach</p>
                <p className="text-sm text-zinc-400">
                  {stats.hot > 0 && `👀 ${stats.hot} hanno aperto la proposta`}
                  {stats.hot > 0 && stats.due > 0 && " · "}
                  {stats.due > 0 && `${stats.due} follow-up da inviare`}
                </p>
              </div>
              <span className={btn.secondary}>Apri →</span>
            </Link>
          )}
        </div>
      )}

      {/* Primi passi */}
      {doneCount < steps.length && (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Primi passi</h2>
              <p className="text-sm text-zinc-500">{doneCount} di {steps.length} completati</p>
            </div>
            {next && (
              <Link href={next.href} className={btn.accent}>
                Prossimo: {next.title.toLowerCase()} →
              </Link>
            )}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="bar-fill h-full rounded-full bg-gradient-to-r from-accent to-cyan" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ol className="mt-6 grid gap-3 md:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.title} className="fade-in" style={{ animationDelay: `${i * 90}ms` }}>
                <Link
                  href={s.href}
                  className={`flex h-full flex-col rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
                    s.done ? "border-emerald-400/25 bg-emerald-400/[0.05]" : s === next ? "border-accent/50 bg-accent-soft" : "border-white/[0.07] bg-white/[0.02]"
                  }`}
                >
                  <span
                    className={`mb-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      s.done ? "bg-emerald-400 text-ink" : s === next ? "pulse-dot bg-white text-ink" : "bg-white/10 text-zinc-400"
                    }`}
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  <p className={`text-sm font-semibold ${s.done ? "text-zinc-400 line-through" : "text-white"}`}>{s.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{s.text}</p>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Sessioni disponibili", value: sessions === Infinity ? "∞" : String(sessions), hint: account.free_sessions > 0 ? `di cui 1 di prova (max ${COMPANIES_PER_FREE_SESSION} aziende)` : "altre sessioni in Piani" },
          { label: "Aziende analizzate", value: String(stats.analyzed), hint: `${stats.companies} trovate in ${projects.length} ${projects.length === 1 ? "sessione" : "sessioni"}` },
          { label: "Messaggi inviati", value: String(stats.messages), hint: `${stats.opened} hanno aperto il report` },
          { label: "Conversazioni", value: String(stats.replied), hint: `${stats.requests} richieste di call` },
        ].map((s) => (
          <Card key={s.label}>
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
