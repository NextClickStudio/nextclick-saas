"use client";

// Mostrato se una pagina dell'area riservata non riesce a caricare i dati.
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center">
      <h1 className="mb-2 text-lg font-semibold">Impossibile caricare la pagina</h1>
      <p className="mb-4 text-sm text-gray-600">
        Controlla che il database sia configurato (SUPABASE_SERVICE_ROLE_KEY su Vercel) e che lo schema sia stato
        creato. Poi riprova.
      </p>
      <button onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
        Riprova
      </button>
    </div>
  );
}
