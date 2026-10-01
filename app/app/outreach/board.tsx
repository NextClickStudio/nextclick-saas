"use client";

// Coda di outreach: chi contattare oggi, con messaggi scritti dall'AI e invio con un clic.
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, copyText } from "@/components/client-utils";
import { Badge, EmptyState, ErrorBox, btn, input } from "@/components/ui";
import { MAX_STEP, SEND_CHANNEL_LABELS, DONE_STATUSES, groupOutreach, sendChannelsFor, sendLink, type OutreachItem, type SendChannel } from "@/lib/outreach";
import { formatDate } from "@/lib/types";

const STEP_NAMES = ["Primo contatto", "Follow-up 1", "Follow-up 2"];

type View = "oggi" | "caldi" | "nuovi" | "attesa" | "tutti";

export default function OutreachBoard({ items }: { items: OutreachItem[] }) {
  const groups = useMemo(() => groupOutreach(items), [items]);

  const [view, setView] = useState<View>("oggi");
  const list =
    view === "oggi" ? groups.today : view === "caldi" ? groups.hot : view === "nuovi" ? groups.fresh : view === "attesa" ? groups.waiting : items;

  const tabs: { id: View; label: string; count: number }[] = [
    { id: "oggi", label: "Oggi", count: groups.today.length },
    { id: "caldi", label: "🔥 Caldi", count: groups.hot.length },
    { id: "nuovi", label: "Da contattare", count: groups.fresh.length },
    { id: "attesa", label: "In attesa", count: groups.waiting.length },
    { id: "tutti", label: "Tutte", count: items.length },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Follow-up in scadenza", value: groups.due.length },
          { label: "Hanno aperto il report", value: groups.hot.length },
          { label: "Da contattare", value: groups.fresh.length },
          { label: "Conversazioni avviate", value: groups.done.filter((i) => i.status !== "non_interessata").length },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium ${view === t.id ? "bg-white text-ink" : "text-zinc-400 hover:text-white"}`}
            >
              {t.label} <span className="ml-1 text-xs opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState>{view === "oggi" ? "Per oggi hai finito. Torna domani per i follow-up 👌" : "Nessuna azienda in questa vista."}</EmptyState>
      ) : (
        <div className="space-y-4">
          {list.map((item) => (
            <OutreachCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function OutreachCard({ item }: { item: OutreachItem }) {
  const router = useRouter();
  const step = Math.min(item.step, MAX_STEP);
  const finished = item.step > MAX_STEP || DONE_STATUSES.includes(item.status);
  const channels = sendChannelsFor(item.channels, item.plan?.channel_type);
  const saved = item.drafts?.[String(step)]?.messages ?? [];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(saved);
  const [active, setActive] = useState<SendChannel>((saved[0]?.channel as SendChannel) ?? channels[0]);
  const [loading, setLoading] = useState<"" | "draft" | "sent" | "status">("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const current = messages.find((m) => m.channel === active);
  const due = item.due;

  async function draft() {
    setLoading("draft");
    setError("");
    try {
      const res = await api<{ messages: typeof messages }>("/api/app/outreach/draft", { body: { companyId: item.id, step } });
      setMessages(res.messages);
      if (!res.messages.some((m) => m.channel === active) && res.messages[0]) setActive(res.messages[0].channel as SendChannel);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  function edit(field: "body" | "subject", value: string) {
    setMessages((list) => list.map((m) => (m.channel === active ? { ...m, [field]: value } : m)));
  }

  async function openChannel() {
    if (!current) return;
    const link = sendLink(active, item.channels, current.body, current.subject ?? "", item.website);
    if (!link.prefilled) {
      const ok = await copyText(current.body);
      setCopied(ok);
      setTimeout(() => setCopied(false), 4000);
    }
    window.open(link.href, "_blank", "noopener,noreferrer");
  }

  async function markSent() {
    if (!current) return;
    setLoading("sent");
    setError("");
    try {
      await api("/api/app/outreach/sent", {
        body: { companyId: item.id, channel: active, step, subject: current.subject ?? "", body: current.body },
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  async function setStatus(status: string) {
    setLoading("status");
    try {
      await api(`/api/app/companies/${item.id}`, { method: "PATCH", body: { status } });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  return (
    <div className={`rounded-2xl border bg-white/[0.02] transition-colors ${item.views > 0 && !finished ? "border-orange-400/40" : "border-white/[0.07]"}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-4 p-5 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-white">{item.name}</p>
            {item.views > 0 && <Badge tone="amber">🔥 report aperto {item.views}×</Badge>}
            {due && !finished && <Badge tone="accent">Follow-up oggi</Badge>}
            {item.status === "da_contattare" && <Badge>Nuovo</Badge>}
            {DONE_STATUSES.includes(item.status) && <Badge tone="green">{item.status.replace("_", " ")}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {item.sessionName} · {item.website.replace(/^https?:\/\//, "")}
            {item.lastContactedAt && ` · ultimo contatto ${formatDate(item.lastContactedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] text-zinc-500">{finished ? "Sequenza" : STEP_NAMES[step]}</p>
            <p className="max-w-[220px] truncate text-sm text-zinc-300">{item.plan?.channel_label ?? "—"}</p>
          </div>
          <span className="font-display text-2xl font-semibold text-white">{item.score}</span>
          <span className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/[0.06] p-5">
          {item.plan && (
            <p className="mb-4 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-[#d6ceff]">
              <strong className="text-white">Aggancio:</strong> {item.plan.opening_angle}
            </p>
          )}

          {finished ? (
            <p className="text-sm text-zinc-400">Sequenza completata. Aggiorna lo stato quando ti rispondono.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {channels.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActive(c)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${active === c ? "border-accent/60 bg-accent-soft text-white" : "border-white/10 text-zinc-400 hover:text-white"}`}
                  >
                    {SEND_CHANNEL_LABELS[c]}
                    {item.channels?.find((x) => x.type === c)?.person && (
                      <span className="text-zinc-400"> · {item.channels.find((x) => x.type === c)!.person!.split(" ")[0]}</span>
                    )}
                    {c === channels[0] && <span className="ml-1 text-[10px] text-cyan">consigliato</span>}
                  </button>
                ))}
                {messages.length > 0 && (
                  <button className={`${btn.ghost} ml-auto`} onClick={draft} disabled={loading !== ""}>
                    {loading === "draft" ? "L'AI sta scrivendo…" : "↻ Rigenera"}
                  </button>
                )}
              </div>

              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/12 p-6 text-center">
                  <p className="mb-4 text-sm text-zinc-400">
                    L&apos;AI scrive un messaggio personalizzato per ogni canale, basato sul report di {item.name}.
                  </p>
                  <button className={btn.accent} onClick={draft} disabled={loading !== ""}>
                    {loading === "draft" ? "Sto scrivendo… (circa 15 s)" : `Scrivi ${STEP_NAMES[step].toLowerCase()}`}
                  </button>
                </div>
              ) : current ? (
                <div className="space-y-3">
                  {active === "email" && (
                    <input className={input} value={current.subject ?? ""} onChange={(e) => edit("subject", e.target.value)} placeholder="Oggetto" />
                  )}
                  <textarea className={`${input} min-h-[180px] leading-relaxed`} value={current.body} onChange={(e) => edit("body", e.target.value)} />
                  <div className="flex flex-wrap items-center gap-2">
                    <button className={btn.accent} onClick={openChannel}>
                      Apri {SEND_CHANNEL_LABELS[active]} ↗
                    </button>
                    <button className={btn.secondary} onClick={markSent} disabled={loading !== ""}>
                      {loading === "sent" ? "Salvataggio…" : "✓ Segna come inviato"}
                    </button>
                    {copied && <span className="text-xs text-emerald-300">Testo copiato: incollalo nella chat che si è aperta</span>}
                  </div>
                  <p className="text-xs text-zinc-600">
                    {sendLink(active, item.channels, "", "", item.website).prefilled
                      ? "Il messaggio si apre già scritto: controllalo e premi invia."
                      : "Il testo viene copiato e si apre la chat dell'azienda: incolla e invia."}{" "}
                    Dopo l&apos;invio premi &quot;Segna come inviato&quot;: Yeppo programma il follow-up.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Nessun messaggio per questo canale: premi Rigenera.</p>
              )}
            </>
          )}

          <ErrorBox>{error}</ErrorBox>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4 text-sm">
            <span className="text-zinc-500">Ha risposto?</span>
            <button className={btn.ghost} onClick={() => setStatus("ha_risposto")} disabled={loading !== ""}>Sì, ha risposto</button>
            <button className={btn.ghost} onClick={() => setStatus("chiamata")} disabled={loading !== ""}>Chiamata fissata</button>
            <button className={btn.ghost} onClick={() => setStatus("non_interessata")} disabled={loading !== ""}>Non interessata</button>
            <span className="ml-auto flex gap-3">
              <a href={item.reportUrl} target="_blank" className="text-xs text-[#c4b8ff] hover:underline">Report ↗</a>
              <Link href={`/app/sessioni/${item.sessionId}/aziende/${item.id}`} className="text-xs text-zinc-400 hover:text-white">Dettaglio</Link>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
