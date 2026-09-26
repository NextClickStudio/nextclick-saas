import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-ink px-4 py-6 text-ivory sm:px-8">
      <div className="flex items-center justify-between border-b border-ivory/30 pb-3">
        <span className="label">Issue 00</span>
        <span className="label">Phase 0</span>
      </div>
      <h1 className="masthead mt-10 text-center text-[20.5vw] xl:text-[15rem]">Maison</h1>
      <p className="font-display mx-auto mt-10 max-w-md text-center text-2xl leading-tight italic">
        The game begins only when the garments are beautiful.
      </p>
      <Link
        href="/lab"
        className="font-poster mx-auto mt-12 bg-ivory px-10 py-4 text-2xl text-ink transition-transform hover:-translate-y-0.5"
      >
        Enter the lab
      </Link>
    </main>
  );
}
