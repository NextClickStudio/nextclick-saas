import Link from "next/link";
import { Logo } from "@/components/ui";

// Cornice comune delle pagine di accesso.
export default function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div className="bg-grid absolute inset-0" />
      <div className="orb left-1/2 top-1/4 h-80 w-80 -translate-x-1/2 bg-accent/30" />
      <div className="fade-in relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="glow-border rounded-3xl bg-panel/90 p-7 backdrop-blur sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-white">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-zinc-500">{footer}</div>}
        <p className="mt-8 text-center text-xs text-zinc-600">
          <Link href="/termini" className="hover:text-zinc-400">Termini</Link> ·{" "}
          <Link href="/privacy" className="hover:text-zinc-400">Privacy</Link> ·{" "}
          <Link href="/cookie" className="hover:text-zinc-400">Cookie</Link>
        </p>
      </div>
    </main>
  );
}
