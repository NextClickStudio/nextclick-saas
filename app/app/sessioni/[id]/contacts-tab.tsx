"use client";

// Per ogni azienda analizzata: il canale diretto consigliato, i passi e l'aggancio personalizzato.
import Link from "next/link";
import { useState } from "react";
import { CopyButton, StatusSelect } from "@/components/company-controls";
import FindPeopleButton from "@/components/find-people-button";
import { Badge, EmptyState, btn } from "@/components/ui";
import { keyPeople } from "@/lib/types";
import type { TabProps } from "./tabs";

const CHANNEL_ICONS: Record<string, string> = {
  instagram: "◎",
  whatsapp: "✆",
  chat_live: "💬",
  linkedin: "in",
  facebook: "f",
  tiktok: "♪",
  youtube: "▶",
  telegram: "✈",
  pagina_partner: "🤝",
  pagina_contatti: "✉",
  form_contatti: "✎",
  lavora_con_noi: "★",
  pagina_stampa: "❝",
};

export default function ContactsTab({ project, rows, siteUrl }: TabProps) {
  const [filter, setFilter] = useState<"priorita" | "tutte">("priorita");
  const analyzed = rows
    .filter((r) => r.analysis && r.contact_plan)
    .sort((a, b) => Number(a.analysis!.total_score) - Number(b.analysis!.total_score));
  const list = filter === "priorita" ? analyzed.filter((r) => ["da_contattare", "contattata", "report_aperto"].includes(r.status)) : analyzed;

  if (analyzed.length === 0) {
    return <EmptyState>Il metodo di contatto appare dopo l&apos;analisi delle aziende (tab Analisi).</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-400">
          In cima le aziende con il sintomo più forte. Per ognuna: il canale più diretto pubblicato sul loro sito, i passi e
          l&apos;aggancio. Il primo messaggio è sempre il report gratuito, mai una vendita.
        </p>
        <Link href="/app/outreach" className={btn.accent}>Scrivi e invia i messaggi →</Link>
        <div className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-0.5 text-sm">
          {(["priorita", "tutte"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 ${filter === f ? "bg-white text-ink" : "text-zinc-400"}`}>
              {f === "priorita" ? "Da lavorare" : "Tutte"}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 && <EmptyState>Nessuna azienda da lavorare: ottimo lavoro! Guarda la vista &quot;Tutte&quot;.</EmptyState>}

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((r, i) => {
          const plan = r.contact_plan!;
          const channel = (r.contact_channels ?? []).find((c) => c.type === plan.channel_type);
          return (
            <div key={r.id} className="flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:border-white/15">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-600">#{i + 1} priorità</p>
                  <Link href={`/app/sessioni/${project.id}/aziende/${r.id}`} className="font-semibold text-white hover:text-[#c4b8ff]">
                    {r.name}
                  </Link>
                  <p className="truncate text-xs text-zinc-500">{r.website_url.replace(/^https?:\/\//, "")}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-semibold text-white">{r.analysis!.total_score}</p>
                  <p className="text-[11px] text-zinc-600">/100</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-accent/25 bg-accent-soft p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-xs">{CHANNEL_ICONS[plan.channel_type] ?? "→"}</span>
                    {plan.channel_label}
                  </p>
                  {channel?.url && (
                    <a href={channel.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#c4b8ff] hover:underline">
                      Apri canale ↗
                    </a>
                  )}
                </div>
                {plan.person_name && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Scrivi a <span className="text-white">{plan.person_name}</span>
                    {plan.person_role && ` · ${plan.person_role}`}
                  </p>
                )}
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{plan.why}</p>
              </div>

              <ol className="mt-4 space-y-2 text-sm text-zinc-300">
                {plan.steps.map((s, k) => (
                  <li key={k} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] text-zinc-400">{k + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-4 rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Aggancio</p>
                <p className="mt-1 text-sm italic leading-relaxed text-zinc-200">{plan.opening_angle}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">
                  {keyPeople(r.contact_channels).length > 0
                    ? `Persone: ${keyPeople(r.contact_channels).map((p) => `${p.name} (${p.role})`).join(", ")}`
                    : "Nessuna persona chiave trovata"}
                </p>
                <FindPeopleButton companyId={r.id} small />
              </div>

              {(r.contact_channels ?? []).length > 1 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(r.contact_channels ?? []).map((c, k) =>
                    c.url ? (
                      <a key={k} href={c.url} target="_blank" rel="noopener noreferrer">
                        <Badge>{c.label}</Badge>
                      </a>
                    ) : (
                      <Badge key={k}>{c.label}</Badge>
                    ),
                  )}
                </div>
              )}

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4 mt-5">
                <StatusSelect companyId={r.id} value={r.status} />
                {r.report && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-500">{r.report.view_count} visite</span>
                    <CopyButton text={`${siteUrl}/r/${r.report.slug}`} label="Copia link report" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
