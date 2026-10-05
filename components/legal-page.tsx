import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { LEGAL } from "@/lib/legal";

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-3 text-sm text-zinc-500">Ultimo aggiornamento: {LEGAL.lastUpdate}</p>
        <div className="legal mt-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
