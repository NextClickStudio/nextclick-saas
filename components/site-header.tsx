import Link from "next/link";
import { Logo, btn } from "@/components/ui";
import { BETA } from "@/lib/config";

// Intestazione delle pagine pubbliche (landing e pagine legali).
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-2">
          <Logo />
          {BETA && <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#c4b8ff]">Beta</span>}
        </div>
        <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <Link href="/#come-funziona" className="hover:text-white transition-colors">Come funziona</Link>
          <Link href="/#contatto" className="hover:text-white transition-colors">Metodo di contatto</Link>
          <Link href="/#prezzi" className="hover:text-white transition-colors">Prezzi</Link>
          <Link href="/#faq" className="hover:text-white transition-colors">FAQ</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={btn.ghost}>Accedi</Link>
          <Link href="/registrati" className={`${btn.primary} !py-2`}>Inizia gratis</Link>
        </div>
      </div>
    </header>
  );
}
