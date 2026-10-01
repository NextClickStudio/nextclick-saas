import type { Metadata } from "next";
import { getAccount, getCurrentUser } from "@/lib/supabase-auth";
import { formatDate } from "@/lib/types";
import AccountForms from "./account-forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = (await getCurrentUser())!;
  const account = await getAccount(user.id);
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Account</h1>
        <p className="mt-2 text-sm text-zinc-500">{user.email} · cliente dal {formatDate(account.created_at)}</p>
      </div>
      <AccountForms fullName={account.full_name ?? ""} companyName={account.company_name ?? ""} />
    </div>
  );
}
