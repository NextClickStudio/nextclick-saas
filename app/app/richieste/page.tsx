import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";
import { db } from "@/lib/db";
import { getAccount, getCurrentUser } from "@/lib/supabase-auth";
import RequestCard, { type CallRequestItem } from "./request-card";

export const metadata: Metadata = { title: "Richieste di call" };

export default async function RequestsPage() {
  const user = (await getCurrentUser())!;
  const [account, { data }] = await Promise.all([
    getAccount(user.id),
    db()
      .from("call_requests")
      .select("*, companies!inner(name, website_url, project_id, projects!inner(user_id, name))")
      .eq("companies.projects.user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const items = (data ?? []) as unknown as (CallRequestItem & { companies: { name: string; website_url: string; project_id: string; projects: { name: string } } })[];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">Dai tuoi report</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Richieste di call</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Quando un&apos;azienda chiede una call dal suo report, arriva qui. Accetta e rispondi con un clic sul canale che ha
          scelto: il messaggio di conferma è già pronto.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState>Nessuna richiesta ancora. Arriveranno quando le aziende leggono i report che invii da Outreach.</EmptyState>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <RequestCard
              key={r.id}
              item={{ ...r, companyName: r.companies.name, website: r.companies.website_url, sessionName: r.companies.projects.name, projectId: r.companies.project_id }}
              senderName={account.full_name ?? ""}
              senderCompany={account.company_name ?? ""}
              bookingUrl={account.booking_url ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}
