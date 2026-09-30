import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="mb-2 text-sm font-semibold text-accent">404</p>
      <h1 className="mb-2 text-2xl font-bold">Pagina non trovata</h1>
      <p className="mb-6 text-sm text-gray-600">Il link potrebbe essere scaduto o non più disponibile.</p>
      <Link href="/" className="text-sm font-semibold text-accent hover:underline">
        Torna alla home
      </Link>
    </main>
  );
}
