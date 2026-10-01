"use client";

// Pagina mostrata in caso di errore imprevisto (mai errori tecnici grezzi).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="mb-2 font-display text-2xl font-semibold text-white">Qualcosa è andato storto</h1>
      <p className="mb-6 text-sm text-zinc-400">La pagina non è disponibile in questo momento. Riprova tra poco.</p>
      <button onClick={reset} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink">Riprova</button>
    </main>
  );
}
