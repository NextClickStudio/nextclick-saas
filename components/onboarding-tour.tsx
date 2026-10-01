"use client";

// Guida introduttiva animata: spiega in 5 passi come funziona Yeppo.
// Si apre da sola al primo accesso e si può riaprire con "Guida" nel menu.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-utils";
import LogoMark from "@/components/logo-mark";
import { btn } from "@/components/ui";

const SLIDES = [
  {
    title: "Benvenuto in Yeppo 👋",
    text: "Yeppo è il tuo commerciale AI: trova le aziende giuste, scopre dove perdono clienti e ti prepara il messaggio perfetto per contattarle. Senza cold email.",
    art: "intro",
  },
  {
    title: "1 · Descrivi cosa vendi",
    text: "Crei una sessione: cosa offri, a chi, in che settore e di che dimensione. L'AI trova il “sintomo visibile”, il segnale sul sito di un'azienda che rivela che ha bisogno di te.",
    art: "form",
  },
  {
    title: "2 · Yeppo trova e analizza le aziende",
    text: "Cerca le aziende adatte, verifica i siti, li legge e dà un punteggio con prove concrete. Ogni azienda riceve un report privato con i 3 punti in cui perde clienti.",
    art: "scan",
  },
  {
    title: "3 · L'AI scrive, tu invii con un clic",
    text: "In Outreach trovi ogni giorno chi contattare: messaggio personalizzato per Instagram, WhatsApp, LinkedIn o email, già pronto. Yeppo programma i follow-up.",
    art: "message",
  },
  {
    title: "4 · Loro ti chiedono la call",
    text: "Dal report l'azienda può chiederti una call. Ti arriva la notifica in Richieste: accetti e rispondi in DM con un clic. Prima però dicci chi sei: compare nei report che invii.",
    art: "call",
  },
];

function Art({ kind }: { kind: string }) {
  if (kind === "intro")
    return (
      <div className="relative flex h-40 items-center justify-center">
        <div className="orb h-32 w-32 bg-accent/50" />
        <LogoMark size={88} className="relative drop-shadow-[0_0_40px_rgba(139,123,255,0.8)]" />
      </div>
    );
  if (kind === "form")
    return (
      <div className="mx-auto h-40 w-full max-w-xs space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {["Cosa vendi", "A chi lo vendi", "Settore"].map((l, i) => (
          <div key={l} className="fade-in" style={{ animationDelay: `${i * 250}ms` }}>
            <p className="mb-1 text-[10px] text-zinc-500">{l}</p>
            <div className="h-6 overflow-hidden rounded-lg bg-white/[0.06]">
              <div className="bar-fill h-full rounded-lg bg-accent/40" style={{ width: `${85 - i * 15}%`, animationDelay: `${300 + i * 300}ms` }} />
            </div>
          </div>
        ))}
      </div>
    );
  if (kind === "scan")
    return (
      <div className="relative mx-auto h-40 w-full max-w-xs space-y-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-accent/30 to-transparent" />
        {[34, 78, 52, 27].map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 truncate text-[10px] text-zinc-400">azienda-{i + 1}.it</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`bar-fill h-full rounded-full ${v > 60 ? "bg-emerald-400" : v > 45 ? "bg-amber-400" : "bg-rose-500"}`} style={{ width: `${v}%`, animationDelay: `${i * 250}ms` }} />
            </div>
            <span className="w-5 text-right text-[10px] text-white">{v}</span>
          </div>
        ))}
      </div>
    );
  if (kind === "message")
    return (
      <div className="mx-auto h-40 w-full max-w-xs space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex gap-1.5">
          {["Instagram", "WhatsApp", "Email"].map((c, i) => (
            <span key={c} className={`rounded-md px-2 py-0.5 text-[10px] ${i === 0 ? "bg-accent-soft text-white" : "text-zinc-500"}`}>{c}</span>
          ))}
        </div>
        <div className="fade-in rounded-xl rounded-tl-sm bg-white/[0.07] p-2.5 text-[11px] leading-relaxed text-zinc-200" style={{ animationDelay: "200ms" }}>
          Ciao! Ho analizzato il vostro sito: le schede prodotto hanno una sola foto… ecco il report gratuito 👉
        </div>
        <div className="fade-in ml-auto w-fit rounded-lg bg-gradient-to-r from-accent to-cyan px-3 py-1 text-[11px] font-semibold text-ink" style={{ animationDelay: "700ms" }}>
          Invia ↗
        </div>
      </div>
    );
  return (
    <div className="mx-auto h-40 w-full max-w-xs space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="fade-in flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft p-2.5">
        <span className="pulse-dot h-2 w-2 rounded-full bg-cyan" />
        <span className="text-[11px] text-white">Nuova richiesta di call · Atelier Rossi</span>
      </div>
      <div className="fade-in flex gap-2" style={{ animationDelay: "500ms" }}>
        <span className="rounded-lg bg-white px-3 py-1 text-[11px] font-semibold text-ink">✓ Accetta</span>
        <span className="rounded-lg border border-white/10 px-3 py-1 text-[11px] text-zinc-300">Rispondi su WhatsApp ↗</span>
      </div>
      <div className="fade-in rounded-xl rounded-tr-sm bg-emerald-400/15 p-2 text-[11px] text-emerald-100" style={{ animationDelay: "900ms" }}>
        Perfetto, sentiamoci martedì alle 10!
      </div>
    </div>
  );
}

export default function OnboardingTour({ autoOpen, profileComplete }: { autoOpen: boolean; profileComplete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [i, setI] = useState(0);

  // il pulsante "Guida" nel menu riapre la guida
  useEffect(() => {
    const show = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("yeppo:guida", show);
    return () => window.removeEventListener("yeppo:guida", show);
  }, []);

  async function finish(goToProfile: boolean) {
    setOpen(false);
    try {
      await api("/api/app/account", { body: {} });
    } catch {
      /* non bloccante */
    }
    if (goToProfile) router.push("/app/account?benvenuto=1");
    else router.refresh();
  }

  if (!open) return null;
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-md">
      <div className="glow-border fade-in relative w-full max-w-lg overflow-hidden rounded-3xl bg-panel p-7">
        <button onClick={() => finish(false)} className="absolute right-4 top-4 text-sm text-zinc-500 hover:text-white" aria-label="Chiudi">
          Salta
        </button>
        <div key={i} className="fade-in">
          <Art kind={slide.art} />
          <h2 className="mt-6 font-display text-2xl font-semibold text-white">{slide.title}</h2>
          <p className="mt-3 leading-relaxed text-zinc-400">{slide.text}</p>
        </div>
        <div className="mt-7 flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((_, k) => (
              <button
                key={k}
                onClick={() => setI(k)}
                className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-gradient-to-r from-accent to-cyan" : "w-1.5 bg-white/20"}`}
                aria-label={`Passo ${k + 1}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && <button className={btn.ghost} onClick={() => setI(i - 1)}>Indietro</button>}
            {last ? (
              <button className={btn.accent} onClick={() => finish(!profileComplete)}>
                {profileComplete ? "Inizia" : "Completa il profilo →"}
              </button>
            ) : (
              <button className={btn.primary} onClick={() => setI(i + 1)}>Avanti</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pulsante "Guida" del menu. */
export function GuideButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("yeppo:guida"))}
      className="hidden rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:text-white sm:block"
      title="Rivedi la guida"
    >
      ? Guida
    </button>
  );
}
