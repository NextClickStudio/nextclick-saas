"use client";

// Radar: profilazione, ricerca e lista delle opportunità con risposta scritta dall'AI.
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, copyText } from "@/components/client-utils";
import PushButton from "@/components/push-button";
import { Badge, EmptyState, ErrorBox, btn, input, label } from "@/components/ui";
import { MAX_BRANDS, MAX_HASHTAGS, type RadarProfileInput } from "./options";
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
  likes: number | null;
  comments: number | null;
  created_at: string;
};

const SIGNAL_LABEL: Record<string, string> = {
  scoperto: "🆕 Brand scoperto",
  brand: "⭐ Brand che segui",
  hashtag: "# Da hashtag",
};


export default function RadarView({
  profile,
  lastRun,
  hasOffer,
  instagram,
  metaReady,
  flash,
  items,
}: {
  profile: RadarProfileInput | null;
  lastRun: string | null;
  hasOffer: boolean;
  instagram: { username: string; expiringSoon: boolean } | null;
  metaReady: boolean;
  flash: { ok: boolean; text: string } | null;
  items: RadarItem[];
}) {
  const [editing, setEditing] = useState(Boolean(instagram) && !profile);
  const [scanning, setScanning] = useState(false);
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
    setScanning(true);
    type Mon = { added: number; read: number; hashtagChecked: number; authorsFound: number; droppedPeople: number; droppedUnknown: number; errors: string[] };
    type Disc = { added: number; proposed: number; verified: number; brands: number; sample: string[]; errors: string[] };
    const [mon, disc] = await Promise.allSettled([
      api<Mon>("/api/app/radar/scan", { body: {} }),
      api<Disc>("/api/app/radar/discover", { body: {} }),
    ]);
    const parts: string[] = [];
    let added = 0;
    if (disc.status === "fulfilled") {
      added += disc.value.added;
      parts.push(
        disc.value.brands > 0
          ? `🆕 ${disc.value.brands} brand nuovi scoperti (su ${disc.value.proposed} controllati)`
          : `nessun brand nuovo verificato (${disc.value.proposed} proposti, ${disc.value.verified} trovati su Instagram)`,
      );
      if (disc.value.verified === 0 && disc.value.sample.length) parts.push(`proposti: ${disc.value.sample.map((h) => "@" + h).join(", ")}`);
      if (disc.value.errors.length) parts.push(`errori Instagram: ${disc.value.errors.join(" | ")}`);
    } else parts.push(`scoperta brand: ${(disc.reason as Error).message}`);
    if (mon.status === "fulfilled") {
      added += mon.value.added;
      if (mon.value.read > 0) parts.push(`${mon.value.read} post letti da brand seguiti e hashtag`);
      if (mon.value.hashtagChecked > 0) parts.push(`autori trovati ${mon.value.authorsFound}/${mon.value.hashtagChecked} post da hashtag`);
      if (mon.value.droppedPeople + mon.value.droppedUnknown > 0) parts.push(`${mon.value.droppedPeople + mon.value.droppedUnknown} post di persone o autori non verificabili scartati`);
      if (mon.value.errors.length) parts.push(`errori anteprima: ${mon.value.errors.join(" | ")}`);
    } else parts.push((mon.reason as Error).message);
    setScanMsg(`${added > 0 ? `Trovati ${added} nuovi post di brand da commentare.` : "Nessun post nuovo da commentare per ora."} ${parts.join(" · ")}`);
    setView("nuovo");
    setScanning(false);
    router.refresh();
  }

  async function disconnect() {
    if (!confirm("Scollegare Instagram? Il Radar smetterà di cercare finché non lo ricolleghi.")) return;
    await api("/api/app/instagram/connect", { method: "DELETE" });
    router.refresh();
  }

  const banner = flash && (
    <p className={`rounded-xl px-4 py-3 text-sm ${flash.ok ? "border border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border border-red-400/25 bg-red-400/10 text-red-100"}`}>
      {flash.text}
    </p>
  );

  if (!instagram) return <div className="space-y-4">{banner}<ConnectCard metaReady={metaReady} /></div>;

  if (editing)
    return (
      <div className="space-y-4">
        {banner}
        <ProfileForm
          initial={profile}
          hasOffer={hasOffer}
          onDone={() => {
            setEditing(false);
            router.refresh();
          }}
          onCancel={profile ? () => setEditing(false) : undefined}
        />
      </div>
    );

  if (!profile)
    return (
      <div className="space-y-4">
        {banner}
        <EmptyState>
          <p className="mb-4">Instagram collegato (@{instagram.username}). Ora indica il tuo settore: il Radar scoprirà i brand per te.</p>
          <button className={btn.accent} onClick={() => setEditing(true)}>Imposta il Radar</button>
        </EmptyState>
      </div>
    );

  return (
    <div className="space-y-6">
      {banner}
      <div className="glow-border flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-panel p-5">
        <div className="min-w-0">
          <p className="text-sm text-zinc-400">
            Collegato come <span className="text-white">@{instagram.username}</span> · segui{" "}
            <span className="text-white">{profile.igBrands.length} brand</span> e{" "}
            <span className="text-white">{profile.igHashtags.length} hashtag</span>
            {(profile.igDiscovered?.length ?? 0) > 0 && (
              <>
                {" "}· <span className="text-white">{profile.igDiscovered!.length} brand scoperti</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {lastRun ? `Ultima ricerca ${formatDate(lastRun)}` : "Mai cercato"} · ricerca automatica ogni mattina
            {instagram.expiringSoon && " · ⚠️ collegamento in scadenza: ricollega Instagram"}
          </p>
          <div className="mt-1 flex gap-3 text-xs">
            <button className="text-[#c4b8ff] hover:underline" onClick={() => setEditing(true)}>Modifica brand e hashtag</button>
            <a href="/api/app/instagram/connect" className="text-zinc-500 hover:text-white">Ricollega</a>
            <button className="text-zinc-500 hover:text-white" onClick={disconnect}>Scollega</button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button className={btn.accent} onClick={scan} disabled={scanning}>
            {scanning ? "Cerco brand e post… (fino a 50 s)" : "🔎 Cerca brand e post"}
          </button>
          <PushButton />
        </div>
      </div>
      {scanMsg && <p className="text-sm text-zinc-300">{scanMsg}</p>}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
          {([
            ["nuovo", "Nuovi"],
            ["salvato", "Salvati"],
            ["risposto", "Commentati"],
            ["tutti", "Tutti"],
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
              <p className="mb-4">Ancora nessun post: avvia la prima ricerca.</p>
              <button className={btn.accent} onClick={scan} disabled={scanning}>🔎 Cerca ora</button>
            </>
          ) : (
            "Nessun post in questa vista."
          )}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {groups[view].map((item) => (
            <RadarCard key={item.id} item={item} followed={profile.igBrands.includes(item.author)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectCard({ metaReady }: { metaReady: boolean }) {
  return (
    <div className="glow-border rounded-3xl bg-panel p-6 sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-white">Collega il tuo Instagram</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Il Radar usa l&apos;API ufficiale di Instagram: legge i nuovi post dei brand che segui e degli hashtag del tuo settore. Solo
        lettura: Yeppo non pubblica, non mette like e non scrive nulla al posto tuo.
      </p>
      <ul className="mt-5 space-y-2 text-sm text-zinc-300">
        {[
          "Profilo Instagram professionale (Business o Creator): Impostazioni → Tipo di account e strumenti",
          "Collegato a una Pagina Facebook: Instagram → Modifica profilo → Pagina",
          "Accedi con l'account Facebook che gestisce quella Pagina",
        ].map((t, i) => (
          <li key={t} className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px]">{i + 1}</span>
            {t}
          </li>
        ))}
      </ul>
      {metaReady ? (
        <a href="/api/app/instagram/connect" className={`${btn.accent} mt-6`}>Collega Instagram</a>
      ) : (
        <p className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Il collegamento sarà disponibile a breve: stiamo completando l&apos;attivazione con Meta.
        </p>
      )}
    </div>
  );
}

function RadarCard({ item, followed }: { item: RadarItem; followed: boolean }) {
  const router = useRouter();
  const [reply, setReply] = useState(item.reply ?? "");
  const [mode, setMode] = useState<"commento" | "messaggio">("commento");
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

  const [following, setFollowing] = useState(followed);
  async function ignoreBrand() {
    if (!confirm(`Non vedere più @${item.author}?`)) return;
    setLoading("ignore");
    try {
      await api("/api/app/radar/ignore", { body: { username: item.author } });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading("");
    }
  }
  async function follow() {
    setLoading("follow");
    setError("");
    try {
      await api("/api/app/radar/follow", { body: { username: item.author } });
      setFollowing(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
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
        {item.intent >= 3 && <Badge tone="amber">🔥 parla del tuo tema</Badge>}
        <span className="text-xs text-zinc-500">{[item.company, item.posted ? formatDate(item.posted) : ""].filter(Boolean).join(" · ")}</span>
      </div>
      <p className="mt-3 font-semibold text-white">
        {item.author ? (
          <a href={`https://instagram.com/${item.author}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#c4b8ff]">@{item.author}</a>
        ) : (
          item.company || host
        )}
        {item.author && (item.signal === "hashtag" || item.signal === "scoperto") && (
          following ? (
            <span className="ml-2 text-xs font-normal text-emerald-300">✓ segui già</span>
          ) : (
            <button className="ml-2 rounded-full border border-accent/40 px-2 py-0.5 text-xs font-normal text-[#c4b8ff] hover:bg-accent-soft" onClick={follow} disabled={loading !== ""}>
              {loading === "follow" ? "…" : "+ Segui questo brand"}
            </button>
          )
        )}
        {(item.likes != null || item.comments != null) && (
          <span className="ml-2 text-xs font-normal text-zinc-500">
            {item.likes != null && `♥ ${item.likes}`} {item.comments != null && `· 💬 ${item.comments}`}
          </span>
        )}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">&ldquo;{item.excerpt}&rdquo;</p>
      {item.why && <p className="mt-2 text-sm text-[#c4b8ff]">→ {item.why}</p>}

      {reply ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-zinc-500">{mode === "commento" ? "Commento da pubblicare sotto il post" : "Messaggio privato (DM al brand)"}</p>
          <textarea className={`${input} min-h-[120px] text-sm leading-relaxed`} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button className={btn.accent} onClick={copyAndOpen}>Copia e apri su Instagram ↗</button>
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
            {loading === "write" && mode === "messaggio" ? "Scrivo…" : "Scrivi un DM"}
          </button>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className={btn.ghost}>Apri ↗</a>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3 text-sm">
        {item.status !== "risposto" && <button className={btn.ghost} onClick={() => status("risposto")} disabled={loading !== ""}>✓ Ho commentato</button>}
        {item.status === "nuovo" && <button className={btn.ghost} onClick={() => status("salvato")} disabled={loading !== ""}>Salva</button>}
        {item.author && (
          <button className={`${btn.ghost} ml-auto text-zinc-500`} onClick={ignoreBrand} disabled={loading !== ""}>
            Non mi interessa questo brand
          </button>
        )}
        <button className={`${btn.ghost} ${item.author ? "" : "ml-auto"} text-zinc-500`} onClick={() => status("scartato")} disabled={loading !== ""}>Scarta post</button>
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
  const [p, setP] = useState<RadarProfileInput>(initial ?? { sectors: [], topics: [], igBrands: [], igHashtags: [] });
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function suggest() {
    setLoading("suggest");
    setError("");
    try {
      const s = await api<{ sectors: string[]; topics: string[]; igHashtags: string[] }>("/api/app/radar/suggest", { body: {} });
      setP((x) => ({ ...x, sectors: s.sectors, topics: s.topics, igHashtags: s.igHashtags.slice(0, MAX_HASHTAGS) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading("");
    }
  }

  async function importBrands() {
    setLoading("brands");
    setError("");
    setInfo("");
    try {
      const { brands } = await api<{ brands: string[] }>("/api/app/radar/brands");
      setP((x) => ({ ...x, igBrands: [...new Set([...x.igBrands, ...brands])].slice(0, MAX_BRANDS) }));
      setInfo(brands.length ? `Aggiunti ${brands.length} brand dalle tue sessioni.` : "Nessun profilo Instagram trovato nelle tue sessioni: aggiungili a mano.");
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

  return (
    <form onSubmit={save} className="glow-border space-y-5 rounded-3xl bg-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Chi deve scoprire il Radar su Instagram?</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Il Radar scopre da solo brand nuovi del tuo settore. Brand e hashtag qui sotto sono facoltativi: servono se ne conosci già qualcuno. Premi Invio dopo ogni voce.
          </p>
        </div>
        <button type="button" className={btn.secondary} onClick={suggest} disabled={loading !== ""}>
          {loading === "suggest" ? "Ci penso…" : "✨ Compila con l'AI"}
        </button>
      </div>
      {!hasOffer && (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          Suggerimento: scrivi cosa offri in <Link href="/app/account" className="underline">Account</Link>, così l&apos;AI capisce quali post sono occasioni per te.
        </p>
      )}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className={label} htmlFor="r-brands">Brand che conosci già <span className="text-zinc-600">(facoltativo, max {MAX_BRANDS})</span></label>
          <button type="button" className="mb-1.5 text-xs text-[#c4b8ff] hover:underline" onClick={importBrands} disabled={loading !== ""}>
            {loading === "brands" ? "Importo…" : "+ Importa dalle mie sessioni"}
          </button>
        </div>
        <TagInput id="r-brands" value={p.igBrands} onChange={(v) => setP({ ...p, igBrands: v.map((x) => x.replace(/^@/, "").toLowerCase()).slice(0, MAX_BRANDS) })} placeholder="Es. belladerma_it" />
        {info && <p className="mt-1 text-xs text-zinc-400">{info}</p>}
        <p className="mt-1 text-xs text-zinc-600">Funziona con profili Business o Creator (quasi tutti i brand lo sono).</p>
      </div>
      <div>
        <label className={label} htmlFor="r-tags">Hashtag del settore <span className="text-zinc-600">(max {MAX_HASHTAGS}, senza #)</span></label>
        <TagInput id="r-tags" value={p.igHashtags} onChange={(v) => setP({ ...p, igHashtags: v.map((x) => x.replace(/^#/, "").replace(/\s+/g, "").toLowerCase()).slice(0, MAX_HASHTAGS) })} placeholder="Es. skincareitaliana, cosmeticanaturale" />
        <p className="mt-1 text-xs text-zinc-600">Usa hashtag di nicchia usati dai brand, non quelli generici dei consumatori. Instagram permette 30 hashtag diversi a settimana.</p>
      </div>
      <div>
        <label className={label} htmlFor="r-sectors">Settori target <span className="text-zinc-600">(da qui il Radar scopre i brand nuovi)</span></label>
        <TagInput id="r-sectors" value={p.sectors} onChange={(v) => setP({ ...p, sectors: v })} placeholder="Es. brand skincare italiani" />
      </div>
      <div>
        <label className={label} htmlFor="r-topics">Argomenti legati a quello che vendi</label>
        <TagInput id="r-topics" value={p.topics} onChange={(v) => setP({ ...p, topics: v })} placeholder="Es. routine personalizzata, clienti indecisi" />
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div className="flex gap-2">
        <button type="submit" className={btn.accent} disabled={loading !== ""}>{loading === "save" ? "Salvo…" : "Salva e attiva il Radar"}</button>
        {onCancel && <button type="button" className={btn.ghost} onClick={onCancel}>Annulla</button>}
      </div>
    </form>
  );
}
