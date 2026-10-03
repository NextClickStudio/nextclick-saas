"use client";

// Radar: profilazione, ricerca e lista delle opportunità con risposta scritta dall'AI.
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, copyText } from "@/components/client-utils";
import PushButton from "@/components/push-button";
import { Badge, EmptyState, ErrorBox, btn, input, label } from "@/components/ui";
import { RADAR_PLATFORM_OPTIONS, type RadarProfileInput } from "./options";
import { formatDate } from "@/lib/types";

export type RadarItem = {
  id: string;
  url: string;
  platform: string;
  signal: string;
  author: string;
  company: string;
  posted: string;
  excerpt: string;
  why: string;
  intent: number;
  status: "nuovo" | "salvato" | "risposto" | "scartato";
  reply: string | null;
  created_at: string;
};

const SIGNAL_LABEL: Record<string, string> = {
  richiesta: "💬 Richiesta / discussione",
  discussione: "💬 Discussione",
  lavoro: "💼 Stanno assumendo",
  lancio: "🚀 Lancio / novità",
};

const SCANS = ["richiesta", "lavoro", "lancio"] as const;

export default function RadarView({
  profile,
  lastRun,
  hasOffer,
  items,
}: {
  profile: RadarProfileInput | null;
  lastRun: string | null;
  hasOffer: boolean;
  items: RadarItem[];
}) {
  const [editing, setEditing] = useState(!profile);
  const [scanning, setScanning] = useState<string[]>([]);
  const [scanMsg, setScanMsg] = useState("");
  const [view, setView] = useState<"nuovo" | "salvato" | "risposto" | "tutti">("nuovo");
  const router = useRouter();

  const groups = useMemo(
    () => ({
      nuovo: items.filter((i) => i.status === "nuovo"),
      salvato: items.filter((i) => i.status === "salvato"),
      risposto: items.filter((i) => i.status === "risposto"),
      tutti: items,
    }),
    [items],
  );

  async function scan() {
    setScanMsg("");
    setScanning([...SCANS]);
    let added = 0;
    const errors: string[] = [];
    await Promise.all(
      SCANS.map(async (signal) => {
        try {
          const res = await api<{ added: number }>("/api/app/radar/scan", { body: { signal } });
          added += res.added;
        } catch (err) {
          errors.push((err as Error).message);
        } finally {
          setScanning((s) => s.filter((x) => x !== signal));
        }
      }),
    );
    setScanMsg(
      added > 0
        ? `Trovate ${added} nuove opportunità.`
        : errors.length
          ? errors[0]
          : "Nessuna novità per ora: riprova domani o allarga argomenti e settori.",
    );
    setView("nuovo");
    router.refresh();
  }

  if (editing) return <ProfileForm initial={profile} hasOffer={hasOffer} onDone={() => { setEditing(false); router.refresh(); }} onCancel={profile ? () => setEditing(false) : undefined} />;

  return (
    <div className="space-y-6">
      <div className="glow-border flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-panel p-5">
        <div className="min-w-0">
          <p className="text-sm text-zinc-400">Monitoro: <span className="text-white">{profile!.sectors.join(", ")}</span></p>
          <p className="mt-1 text-xs text-zinc-500">
            Argomenti: {profile!.topics.join(", ")} · {lastRun ? `ultima ricerca ${formatDate(lastRun)}` : "mai cercato"} · ricerca automatica ogni mattina
          </p>
          <button className="mt-1 text-xs text-[#c4b8ff] hover:underline" onClick={() => setEditing(true)}>Modifica profilo</button>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button className={btn.accent} onClick={scan} disabled={scanning.length > 0}>
            {scanning.length > 0 ? `Cerco su Google… (${3 - scanning.length}/3)` : "🔎 Cerca ora"}
          </button>
          <PushButton />
        </div>
      </div>
      {scanMsg && <p className="text-sm text-zinc-300">{scanMsg}</p>}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
          {([
            ["nuovo", "Nuove"],
            ["salvato", "Salvate"],
            ["risposto", "Risposte inviate"],
            ["tutti", "Tutte"],
          ] as const).map(([id, text]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium ${view === id ? "bg-white text-ink" : "text-zinc-400 hover:text-white"}`}
            >
              {text} <span className="ml-1 text-xs opacity-60">{groups[id].length}</span>
            </button>
          ))}
        </div>
      </div>

      {groups[view].length === 0 ? (
        <EmptyState>
          {items.length === 0 ? (
            <>
              <p className="mb-4">Ancora nessuna opportunità: avvia la prima ricerca.</p>
              <button className={btn.accent} onClick={scan} disabled={scanning.length > 0}>🔎 Cerca ora</button>
            </>
          ) : (
            "Nessuna opportunità in questa vista."
          )}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {groups[view].map((item) => (
            <RadarCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function RadarCard({ item }: { item: RadarItem }) {
  const router = useRouter();
  const [reply, setReply] = useState(item.reply ?? "");
  const [mode, setMode] = useState<"commento" | "messaggio">(item.signal === "lavoro" || item.signal === "lancio" ? "messaggio" : "commento");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  let host = "";
  try {
    host = new URL(item.url).hostname.replace(/^www\./, "");
  } catch {
    /* link non valido */
  }

  async function write(m: typeof mode) {
    setMode(m);
    setLoading("write");
    setError("");
    try {
      const res = await api<{ text: string }>(`/api/app/radar/items/${item.id}/reply`, { body: { mode: m } });
      setReply(res.text);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  async function status(s: RadarItem["status"]) {
    setLoading(s);
    try {
      await api(`/api/app/radar/items/${item.id}`, { method: "PATCH", body: { status: s } });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading("");
    }
  }

  async function copyAndOpen() {
    setCopied(await copyText(reply));
    setTimeout(() => setCopied(false), 5000);
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fade-in rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.intent >= 3 ? "accent" : "neutral"}>{SIGNAL_LABEL[item.signal] ?? item.signal}</Badge>
        {item.intent >= 3 && <Badge tone="amber">🔥 molto caldo</Badge>}
        <span className="text-xs text-zinc-500">{[item.platform || host, item.posted].filter(Boolean).join(" · ")}</span>
      </div>
      <p className="mt-3 font-semibold text-white">
        {item.company || item.author || host}
        {item.author && item.company && item.author !== item.company && <span className="font-normal text-zinc-400"> · {item.author}</span>}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">&ldquo;{item.excerpt}&rdquo;</p>
      {item.why && <p className="mt-2 text-sm text-[#c4b8ff]">→ {item.why}</p>}

      {reply ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-zinc-500">{mode === "commento" ? "Commento da pubblicare sotto il post" : "Messaggio privato"}</p>
          <textarea className={`${input} min-h-[120px] text-sm leading-relaxed`} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button className={btn.accent} onClick={copyAndOpen}>Copia e apri il post ↗</button>
            <button className={btn.ghost} onClick={() => write(mode)} disabled={loading !== ""}>{loading === "write" ? "Scrivo…" : "↻ Riscrivi"}</button>
            <button className={btn.ghost} onClick={() => write(mode === "commento" ? "messaggio" : "commento")} disabled={loading !== ""}>
              {mode === "commento" ? "Preferisco un messaggio privato" : "Preferisco un commento pubblico"}
            </button>
            {copied && <span className="text-xs text-emerald-300">Testo copiato: incollalo e pubblica</span>}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btn.accent} onClick={() => write("commento")} disabled={loading !== ""}>
            {loading === "write" && mode === "commento" ? "Scrivo…" : "✍️ Scrivi un commento"}
          </button>
          <button className={btn.secondary} onClick={() => write("messaggio")} disabled={loading !== ""}>
            {loading === "write" && mode === "messaggio" ? "Scrivo…" : "Scrivi un messaggio privato"}
          </button>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className={btn.ghost}>Apri ↗</a>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3 text-sm">
        {item.status !== "risposto" && <button className={btn.ghost} onClick={() => status("risposto")} disabled={loading !== ""}>✓ Ho risposto</button>}
        {item.status === "nuovo" && <button className={btn.ghost} onClick={() => status("salvato")} disabled={loading !== ""}>Salva</button>}
        <button className={`${btn.ghost} ml-auto text-zinc-500`} onClick={() => status("scartato")} disabled={loading !== ""}>Scarta</button>
      </div>
    </div>
  );
}

function TagInput({ id, value, onChange, placeholder }: { id: string; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim().replace(/,$/, "");
    if (v.length >= 2 && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  }
  return (
    <div className={`${input} flex min-h-[46px] flex-wrap items-center gap-1.5 !py-2`}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-white">
          {t}
          <button type="button" className="text-zinc-400 hover:text-white" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Rimuovi ${t}`}>×</button>
        </span>
      ))}
      <input
        id={id}
        className="min-w-[160px] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
        value={draft}
        placeholder={value.length ? "" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

function ProfileForm({ initial, hasOffer, onDone, onCancel }: { initial: RadarProfileInput | null; hasOffer: boolean; onDone: () => void; onCancel?: () => void }) {
  const [p, setP] = useState<RadarProfileInput>(initial ?? { sectors: [], topics: [], roles: [], platforms: [], country: "Italia" });
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  async function suggest() {
    setLoading("suggest");
    setError("");
    try {
      const s = await api<{ sectors: string[]; topics: string[]; roles: string[] }>("/api/app/radar/suggest", { body: {} });
      setP((x) => ({ ...x, sectors: s.sectors, topics: s.topics, roles: s.roles }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading("save");
    setError("");
    try {
      await api("/api/app/radar/profile", { body: p });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setLoading("");
    }
  }

  const togglePlatform = (v: string) =>
    setP((x) => ({ ...x, platforms: x.platforms.includes(v) ? x.platforms.filter((y) => y !== v) : [...x.platforms, v] }));

  return (
    <form onSubmit={save} className="glow-border space-y-5 rounded-3xl bg-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Chi deve trovare il Radar?</h2>
          <p className="mt-1 text-sm text-zinc-400">Più sei preciso, più le opportunità sono calde. Premi Invio dopo ogni voce.</p>
        </div>
        <button type="button" className={btn.secondary} onClick={suggest} disabled={loading !== ""}>
          {loading === "suggest" ? "Ci penso…" : "✨ Compila con l'AI"}
        </button>
      </div>
      {!hasOffer && (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          Suggerimento: scrivi cosa offri in <Link href="/app/account" className="underline">Account</Link>, così l&apos;AI capisce chi ha bisogno di te.
        </p>
      )}
      <div>
        <label className={label} htmlFor="r-sectors">Settori e tipi di aziende target</label>
        <TagInput id="r-sectors" value={p.sectors} onChange={(v) => setP({ ...p, sectors: v })} placeholder="Es. e-commerce skincare, farmacie online" />
      </div>
      <div>
        <label className={label} htmlFor="r-topics">Argomenti e problemi da intercettare</label>
        <TagInput id="r-topics" value={p.topics} onChange={(v) => setP({ ...p, topics: v })} placeholder="Es. clienti indecisi sul prodotto, conversioni basse, quiz prodotto" />
      </div>
      <div>
        <label className={label} htmlFor="r-roles">Ruoli delle persone che decidono</label>
        <TagInput id="r-roles" value={p.roles} onChange={(v) => setP({ ...p, roles: v })} placeholder="Es. founder, marketing manager" />
      </div>
      <div>
        <p className={label}>Dove cercare <span className="text-zinc-600">(nessuna = tutte)</span></p>
        <div className="flex flex-wrap gap-2">
          {RADAR_PLATFORM_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => togglePlatform(o.value)}
              className={`rounded-xl border px-3 py-2 text-sm ${p.platforms.includes(o.value) ? "border-accent/60 bg-accent-soft text-white" : "border-white/10 text-zinc-400 hover:text-white"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-xs">
        <label className={label} htmlFor="r-country">Paese</label>
        <input id="r-country" className={input} value={p.country} onChange={(e) => setP({ ...p, country: e.target.value })} />
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div className="flex gap-2">
        <button type="submit" className={btn.accent} disabled={loading !== ""}>{loading === "save" ? "Salvo…" : "Salva e attiva il Radar"}</button>
        {onCancel && <button type="button" className={btn.ghost} onClick={onCancel}>Annulla</button>}
      </div>
      <p className="text-xs text-zinc-600">
        Il Radar cerca solo post pubblici su LinkedIn, Instagram, Facebook e Reddit indicizzati da Google, dove puoi commentare o scrivere. Ogni link è
        verificato. Non legge profili privati e non pubblica nulla al posto tuo.
      </p>
    </form>
  );
}
