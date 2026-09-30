import Link from "next/link";
import { Logo, btn } from "@/components/ui";

const steps = [
  {
    title: "Trova il sintomo visibile",
    text: "Descrivi cosa vendi e a chi. L'AI individua il segnale, visibile dall'esterno sul sito di un'azienda, che indica che ha il problema che risolvi, e lo trasforma in criteri misurabili.",
  },
  {
    title: "Analizza le aziende del settore",
    text: "Importa una lista di aziende. Zeppo visita i loro siti e assegna un punteggio per ogni criterio, con prove concrete.",
  },
  {
    title: "Apri la conversazione con un report",
    text: "Pubblica la classifica di settore su LinkedIn e invia a ogni azienda il suo report privato: posizione, punteggio e i 3 punti in cui perde clienti.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/app" className={btn.secondary}>
          Area riservata
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        <section className="py-16 sm:py-24">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">Zeppo</p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            Trova clienti B2B mostrando alle aziende un problema che possono vedere, non mandando cold email.
          </h1>
        </section>

        <section className="pb-24">
          <h2 className="mb-6 text-lg font-semibold text-gray-950">Come funziona</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-gray-200 p-5">
                <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                  {i + 1}
                </span>
                <h3 className="mb-2 font-semibold text-gray-950">{s.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-500">
        Zeppo · nessuna email automatica: il contatto lo fai tu, con un motivo concreto.
      </footer>
    </div>
  );
}
