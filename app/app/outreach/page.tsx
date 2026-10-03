import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, btn } from "@/components/ui";
import { getProjects } from "@/lib/data";
import { groupOutreach } from "@/lib/outreach";
import { getCurrentUser } from "@/lib/supabase-auth";
import { outreachItems } from "./items";

export const metadata: Metadata = { title: "Outreach" };

// Elenco delle sessioni: ognuna ha il suo Outreach, con quello che c'è da fare oggi.
export default async function OutreachPage() {
  const user = (await getCurrentUser())!;
  const projects = (await getProjects(user.id)).filter((p) => p.credit_used_at);
  const sessions = await Promise.all(
    projects.map(async (p) => {
      const items = await outreachItems(p);
      return { project: p, total: items.length, groups: groupOutreach(items) };
    }),
  );
  // prima le sessioni con più risposte e follow-up da seguire
  sessions.sort((a, b) => b.groups.replied.length + b.groups.followup.length - (a.groups.replied.length + a.groups.followup.length));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">Il tuo commerciale AI</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Outreach</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">Ogni sessione ha il suo Outreach: scegli quella su cui lavorare oggi.</p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState>
          <p className="mb-4">Nessuna sessione avviata: crea una sessione e analizza le aziende per ottenere report e messaggi.</p>
          <Link href="/app" className={btn.secondary}>Vai alle sessioni</Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map(({ project, total, groups }, i) => (
            <Link
              key={project.id}
              href={`/app/outreach/${project.id}`}
              className="group fade-in flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-white group-hover:text-[#c4b8ff]">{project.name}</h2>
                  <p className="text-xs text-zinc-500">{project.target_sector} · {total} aziende pronte</p>
                </div>
                {groups.fresh.length + groups.followup.length > 0 ? <Badge tone="accent">{groups.fresh.length + groups.followup.length} da seguire</Badge> : <Badge>In pari</Badge>}
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Agganci", value: groups.fresh.length },
                  { label: "Risposte", value: groups.replied.length },
                  { label: "Follow-up", value: groups.followup.length },
                  { label: "👀 Aperta", value: groups.hot.length },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/[0.03] px-1 py-2">
                    <p className="font-display text-xl font-semibold text-white">{s.value}</p>
                    <p className="text-[10px] text-zinc-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <span className="mt-4 text-sm font-medium text-[#c4b8ff]">Apri Outreach →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
