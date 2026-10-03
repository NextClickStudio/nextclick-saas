"use client";

// Mostrato se una pagina dell'area riservata non riesce a caricare i dati.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-8 text-center">
      <h1 className="mb-2 font-display text-xl font-semibold text-white">Impossibile caricare la pagina</h1>
      <p className="mb-5 text-sm text-zinc-400">C&apos;è stato un problema temporaneo. Riprova tra qualche istante.</p>
      <button onClick={reset} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink">Riprova</button>
    </div>
  );
}
