// Mostrato subito mentre una pagina dell'area utenti si carica.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-24 rounded bg-white/[0.06]" />
      <div className="h-9 w-72 rounded-lg bg-white/[0.08]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
    </div>
  );
}
