import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, btn } from "@/components/ui";
import { SITE_URL } from "@/lib/config";
import { getCompanyRows, getProjects } from "@/lib/data";
import { getAccount, getCurrentUser } from "@/lib/supabase-auth";
import OutreachBoard, { type OutreachItem } from "./board";

export const metadata: Metadata = { title: "Outreach" };

function isDue(iso: string | null): boolean {
  return Boolean(iso) && new Date(iso!).getTime() <= Date.now();
}

export default async function OutreachPage() {
  const user = (await getCurrentUser())!;
  const [projects, account] = await Promise.all([getProjects(user.id), getAccount(user.id)]);

  const items: OutreachItem[] = [];
  for (const p of projects) {
    if (!p.credit_used_at) continue;
    const rows = await getCompanyRows(p.id);
    const analyzed = rows.filter((r) => r.analysis).length;
    for (const r of rows) {
      if (!r.analysis || !r.report) continue;
      items.push({
        id: r.id,
        name: r.name,
        website: r.website_url,
        sessionId: p.id,
        sessionName: p.name,
        score: Number(r.analysis.total_score ?? 0),
        position: r.position,
        total: analyzed,
        status: r.status,
        channels: r.contact_channels,
        plan: r.contact_plan,
        reportUrl: `${SITE_URL}/r/${r.report.slug}`,
        views: r.report.view_count,
        lastViewedAt: r.report.last_viewed_at,
        step: r.followup_step,
        nextFollowupAt: r.next_followup_at,
        lastContactedAt: r.last_contacted_at,
        drafts: r.drafts,
        due: isDue(r.next_followup_at),
      });
    }
  }

  const profileIncomplete = !account.full_name || !account.company_name;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Il tuo commerciale AI</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Outreach</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Ogni giorno: chi contattare, con quale messaggio e su quale canale. L&apos;AI scrive, tu invii con un clic. Yeppo
            programma i follow-up e ti avvisa quando un&apos;azienda apre il report.
          </p>
        </div>
      </div>

      {profileIncomplete && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Completa nome, azienda e link per prenotare in <Link href="/app/account" className="underline">Account</Link>: li uso per firmare i
          messaggi.
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState>
          <p className="mb-4">Nessuna azienda pronta: analizza le aziende di una sessione per ottenere report e messaggi.</p>
          <Link href="/app" className={btn.secondary}>Vai alle sessioni</Link>
        </EmptyState>
      ) : (
        <OutreachBoard items={items} />
      )}
    </div>
  );
}
