import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="mb-2 text-sm font-semibold text-[#c4b8ff]">404</p>
      <h1 className="mb-2 font-display text-3xl font-semibold text-white">Pagina non trovata</h1>
      <p className="mb-6 text-sm text-zinc-400">Il link potrebbe essere scaduto o non più disponibile.</p>
      <Link href="/" className="text-sm font-semibold text-[#c4b8ff] hover:underline">
        Torna alla home
      </Link>
    </main>
  );
}
