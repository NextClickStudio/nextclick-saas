import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, btn } from "@/components/ui";
import { getUserProject } from "@/lib/data";
import { getAccount, getCurrentUser } from "@/lib/supabase-auth";
import OutreachBoard from "../board";
import { outreachItems } from "../items";

export const metadata: Metadata = { title: "Outreach" };

type Props = { params: Promise<{ id: string }> };

// Outreach di una sola sessione: chi contattare, con quale messaggio e su quale canale.
export default async function SessionOutreachPage({ params }: Props) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const [project, account] = await Promise.all([getUserProject(id, user.id), getAccount(user.id)]);
  if (!project) notFound();
  const items = await outreachItems(project);
  const profileIncomplete = !account.full_name || !account.company_name;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/app/outreach" className="text-sm text-zinc-500 hover:text-white">← Tutte le sessioni</Link>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-white">Outreach · {project.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Chi contattare oggi, con quale messaggio e su quale canale. L&apos;AI scrive, tu invii con un clic. Yeppo programma i
            follow-up e ti avvisa quando un&apos;azienda apre il report.
          </p>
        </div>
        <Link href={`/app/sessioni/${project.id}`} className={btn.secondary}>Apri la sessione</Link>
      </div>

      {profileIncomplete && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Completa nome, azienda e sito in <Link href="/app/account" className="underline">Account</Link>: li uso per firmare i messaggi.
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState>
          <p className="mb-4">Nessuna azienda pronta in questa sessione: analizzale per ottenere report e messaggi.</p>
          <Link href={`/app/sessioni/${project.id}?tab=analisi`} className={btn.secondary}>Vai all&apos;analisi</Link>
        </EmptyState>
      ) : (
        <OutreachBoard items={items} unlimited={account.unlimited} />
      )}
    </div>
  );
}
