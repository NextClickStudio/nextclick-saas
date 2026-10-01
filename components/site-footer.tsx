import Link from "next/link";
import { Logo } from "@/components/ui";
import { LEGAL } from "@/lib/legal";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-ink">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
            Trova clienti B2B mostrando alle aziende un problema che possono vedere, non mandando cold email.
          </p>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Prodotto</p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/#come-funziona" className="hover:text-white">Come funziona</Link></li>
            <li><Link href="/#prezzi" className="hover:text-white">Prezzi</Link></li>
            <li><Link href="/registrati" className="hover:text-white">Crea un account</Link></li>
            <li><Link href="/login" className="hover:text-white">Accedi</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Legale</p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/termini" className="hover:text-white">Termini e condizioni</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy policy</Link></li>
            <li><Link href="/cookie" className="hover:text-white">Cookie policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-zinc-600 sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Yeppo · {LEGAL.owner}{LEGAL.vat ? ` · P.IVA ${LEGAL.vat}` : " · progetto in beta"}</p>
          <p>{LEGAL.address} · {LEGAL.email}</p>
        </div>
      </div>
    </footer>
  );
}
