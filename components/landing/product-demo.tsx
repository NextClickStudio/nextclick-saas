"use client";

// Demo del prodotto nella landing: le schermate principali dell'app con dati di esempio, a rotazione automatica.
import { useEffect, useState } from "react";

const STEPS = [
  { id: "trova", label: "Trova", title: "30 aziende del tuo settore, già con il punteggio" },
  { id: "report", label: "Report", title: "Per ognuna un report privato con le prove" },
  { id: "persone", label: "Contatto", title: "La persona giusta e il primo messaggio" },
  { id: "aperta", label: "Proposta", title: "Sai chi apre la proposta, e quando" },
  { id: "radar", label: "Radar", title: "Brand nuovi su Instagram, con il commento pronto" },
] as const;

const COMPANIES = [
  { name: "lunabeauty.it", sector: "Cosmetica", score: 27, issue: "Sito lento da mobile" },
  { name: "atelier-milano.it", sector: "Moda", score: 34, issue: "Nessuna recensione visibile" },
  { name: "casa-design.it", sector: "Arredo", score: 42, issue: "Carrello senza pagamenti rapidi" },
  { name: "vinoeterra.shop", sector: "Food", score: 56, issue: "Instagram fermo da 3 mesi" },
];

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="fade-in min-h-[300px] space-y-2.5">{children}</div>;
}

function Screen({ step }: { step: (typeof STEPS)[number]["id"] }) {
  if (step === "trova")
    return (
      <Frame>
        {COMPANIES.map((c, i) => (
          <div key={c.name} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] font-mono text-[11px] text-zinc-400">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-100">{c.name}</p>
              <p className="truncate text-xs text-zinc-500">
                {c.sector} · <span className="text-amber-300/90">{c.issue}</span>
              </p>
            </div>
            <span className="font-display text-lg font-semibold tabular-nums text-white">{c.score}</span>
          </div>
        ))}
      </Frame>
    );
  if (step === "report")
    return (
      <Frame>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-xs text-zinc-500">Report privato per Luna Beauty</p>
          <p className="mt-1 font-display text-lg font-semibold text-white">Da telefono il vostro sito perde clienti</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["6,8 s", "caricamento mobile"],
              ["27/100", "punteggio"],
              ["3", "problemi trovati"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-lg bg-white/[0.04] px-2 py-2">
                <p className="font-display text-base font-semibold text-white">{v}</p>
                <p className="text-[10px] text-zinc-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
        {["La pagina prodotto supera i 6 secondi da 4G", "Nessuna recensione vicino al prezzo", "Il pulsante d'acquisto finisce sotto la piega"].map((t) => (
          <div key={t} className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
            {t}
          </div>
        ))}
      </Frame>
    );
  if (step === "persone")
    return (
      <Frame>
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/30 text-sm font-semibold text-white">GR</span>
          <div className="flex-1">
            <p className="text-sm text-zinc-100">Giulia R. · Fondatrice</p>
            <p className="text-xs text-zinc-500">Trovata su &quot;Chi siamo&quot; · contatto: Instagram</p>
          </div>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] text-emerald-300">decide lei</span>
        </div>
        <p className="pt-1 text-xs text-zinc-500">1° messaggio · aggancio, senza link</p>
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[#202c33] px-3.5 py-2.5 text-sm leading-relaxed text-zinc-100">
          Ciao Giulia! Ieri ho aperto il vostro sito dal telefono e la pagina del siero ci ha messo quasi 7 secondi a caricarsi. Lo
          sapevate? 👀
        </div>
        <p className="pt-1 text-xs text-zinc-500">Follow-up dopo la risposta · con il report</p>
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[#202c33] px-3.5 py-2.5 text-sm leading-relaxed text-zinc-300">
          Ti ho preparato un report con i 3 punti che vi fanno perdere più ordini da mobile: te lo lascio qui 👇
        </div>
      </Frame>
    );
  if (step === "aperta")
    return (
      <Frame>
        <div className="flex items-center gap-3 rounded-xl border border-cyan/30 bg-cyan/10 px-3.5 py-3">
          <span className="pulse-dot h-2 w-2 rounded-full bg-cyan" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Luna Beauty ha aperto la proposta</p>
            <p className="text-xs text-zinc-400">2 volte · ultima 4 minuti fa</p>
          </div>
          <span className="text-xs text-cyan">Scrivi ora →</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <div className="flex-1">
            <p className="text-sm text-zinc-100">Nuova richiesta di call</p>
            <p className="text-xs text-zinc-500">Giulia R. · &quot;Giovedì pomeriggio va bene?&quot;</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          {[
            ["30", "contattate"],
            ["11", "hanno aperto"],
            ["4", "call"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-lg bg-white/[0.04] px-2 py-2.5">
              <p className="font-display text-xl font-semibold text-white">{v}</p>
              <p className="text-[10px] text-zinc-500">{l}</p>
            </div>
          ))}
        </div>
      </Frame>
    );
  return (
    <Frame>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-400 to-amber-300" />
          <div>
            <p className="text-sm text-zinc-100">@verdeolivo.studio</p>
            <p className="text-[11px] text-zinc-500">brand nuovo · scoperto oggi</p>
          </div>
        </div>
        <p className="mt-2.5 text-sm text-zinc-300">&quot;Finalmente online il nostro primo shop! Ogni ordine lo prepariamo a mano 🫒&quot;</p>
        <p className="mt-1.5 text-[11px] text-zinc-500">♥ 128 · 💬 14</p>
      </div>
      <p className="pt-1 text-xs text-zinc-500">Commento suggerito dall&apos;AI · lo pubblichi tu</p>
      <div className="rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-sm text-zinc-100">
        Bellissimo lancio! Un consiglio da chi ci lavora: mettete il &quot;fatto a mano&quot; anche nella pagina prodotto, vicino al prezzo.
        Converte tantissimo 🙌
      </div>
    </Frame>
  );
}

export default function ProductDemo() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % STEPS.length), 4500);
    return () => clearInterval(timer);
  }, [paused]);

  const step = STEPS[index];
  return (
    <div
      className="glow-border overflow-hidden rounded-3xl bg-panel/90 p-4 shadow-[0_40px_120px_-30px_rgba(139,123,255,0.35)] sm:p-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => {
              setIndex(i);
              setPaused(true);
            }}
            className={`relative shrink-0 overflow-hidden rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              i === index ? "bg-white text-ink" : "bg-white/[0.05] text-zinc-400 hover:text-white"
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>
      <p className="mb-4 font-display text-lg font-semibold text-white sm:text-xl">{step.title}</p>
      <Screen key={step.id} step={step.id} />
      <p className="mt-4 text-[11px] text-zinc-600">Esempio con dati di prova: aziende e persone sono inventate.</p>
    </div>
  );
}
