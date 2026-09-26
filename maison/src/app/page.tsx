import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="label text-warm">Phase 0 — Atelier</p>
      <h1 className="font-display mt-6 text-5xl tracking-[0.18em] uppercase sm:text-7xl">Maison</h1>
      <p className="mt-6 max-w-sm text-sm leading-relaxed text-warm">
        The game begins only when the garments are beautiful. Step into the lab.
      </p>
      <Link href="/lab" className="label mt-12 border border-ink px-8 py-4 transition-colors hover:bg-ink hover:text-ivory">
        Enter the lab
      </Link>
    </main>
  );
}
