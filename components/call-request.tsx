"use client";

// Nel report: l'azienda chiede una call di 15 minuti scegliendo come essere ricontattata.
import { useState } from "react";
import { api } from "@/components/client-utils";
import { ErrorBox, btn, input, label } from "@/components/ui";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", placeholder: "+39 333 1234567" },
  { value: "telefono", label: "Telefono", placeholder: "+39 02 1234567" },
  { value: "email", label: "Email", placeholder: "nome@azienda.it" },
  { value: "instagram", label: "Instagram", placeholder: "@tuobrand" },
] as const;

export default function CallRequest({ slug, senderFirstName, bookingUrl }: { slug: string; senderFirstName: string; bookingUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", channel: "whatsapp", contact: "", preferred_time: "", message: "" });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"" | "sending" | "sent">("");
  const [error, setError] = useState("");
  const channel = CHANNELS.find((c) => c.value === form.channel)!;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      await api("/api/public/call-request", { body: { ...form, slug, consent } });
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("");
    }
  }

  if (state === "sent") {
    return (
      <div className="fade-in rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 text-sm text-emerald-100">
        <p className="font-semibold text-white">Richiesta inviata ✓</p>
        <p className="mt-1">{senderFirstName || "Ti"} ricontatterà a breve su {channel.label} per fissare la call.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setOpen(true)} className={`${btn.accent} !px-5 !py-3`}>
          Richiedi una call di 15 minuti
        </button>
        {bookingUrl && (
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className={`${btn.secondary} !px-5 !py-3`}>
            Scegli tu data e ora ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="fade-in space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="cr-name">Il tuo nome</label>
          <input id="cr-name" required className={input} value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label className={label} htmlFor="cr-role">Ruolo <span className="text-zinc-600">(facoltativo)</span></label>
          <input id="cr-role" className={input} placeholder="Titolare, marketing…" value={form.role} onChange={set("role")} />
        </div>
      </div>
      <div>
        <p className={label}>Come preferisci essere contattato?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CHANNELS.map((c) => (
            <button
              type="button"
              key={c.value}
              onClick={() => setForm({ ...form, channel: c.value })}
              className={`rounded-xl border px-3 py-2.5 text-sm ${form.channel === c.value ? "border-accent/60 bg-accent-soft text-white" : "border-white/10 text-zinc-400"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="cr-contact">{channel.label}</label>
          <input id="cr-contact" required className={input} placeholder={channel.placeholder} value={form.contact} onChange={set("contact")} />
        </div>
        <div>
          <label className={label} htmlFor="cr-time">Quando ti è comodo?</label>
          <input id="cr-time" className={input} placeholder="Es. martedì mattina" value={form.preferred_time} onChange={set("preferred_time")} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="cr-msg">Vuoi aggiungere qualcosa? <span className="text-zinc-600">(facoltativo)</span></label>
        <textarea id="cr-msg" rows={2} className={input} value={form.message} onChange={set("message")} />
      </div>
      <label className="flex items-start gap-3 text-xs text-zinc-400">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#8b7bff]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Acconsento a essere ricontattato su questo canale per fissare la call. I dati servono solo a questo scopo (
          <a href="/privacy" target="_blank" className="underline">privacy</a>).
        </span>
      </label>
      <ErrorBox>{error}</ErrorBox>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btn.accent} disabled={state === "sending" || !consent}>
          {state === "sending" ? "Invio…" : "Invia la richiesta"}
        </button>
        <button type="button" className={btn.ghost} onClick={() => setOpen(false)}>Annulla</button>
      </div>
    </form>
  );
}
