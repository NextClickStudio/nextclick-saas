import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <Wordmark />
      <div className="mt-auto">
        <p className="eyebrow">Phase 0</p>
        <h1 className="headline mt-3 text-5xl">The atelier opens soon.</h1>
        <p className="mt-4 text-lg leading-snug text-muted">
          The game starts only when the garments are beautiful. Step into the lab and judge them.
        </p>
        <Link
          href="/lab"
          className="mt-10 block rounded-2xl bg-ivory py-4 text-center text-lg font-bold text-bg transition-transform active:scale-[0.98]"
        >
          Enter the lab
        </Link>
      </div>
    </main>
  );
}
