import type { Metadata } from "next";
import { getAccount, getCurrentUser } from "@/lib/supabase-auth";
import { formatDate } from "@/lib/types";
import AccountForms from "./account-forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ benvenuto?: string }> }) {
  const { benvenuto } = await searchParams;
  const user = (await getCurrentUser())!;
  const account = await getAccount(user.id);
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Account</h1>
        <p className="mt-2 text-sm text-zinc-500">{user.email} · cliente dal {formatDate(account.created_at)}</p>
      </div>
      {benvenuto && (
        <div className="fade-in rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-[#e0daff]">
          Ultimo passo prima di iniziare: dicci chi sei. Questi dati compaiono nei report che invii e firmano i messaggi scritti dall&apos;AI.
        </div>
      )}
      <AccountForms
        fullName={account.full_name ?? ""}
        companyName={account.company_name ?? ""}
        senderRole={account.sender_role ?? ""}
        bookingUrl={account.booking_url ?? ""}
        companyWebsite={account.company_website ?? ""}
        companyOffer={account.company_offer ?? ""}
      />
    </div>
  );
}
