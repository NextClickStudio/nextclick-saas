import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { COMPANIES_PER_FREE_SESSION, COMPANIES_PER_SESSION } from "@/lib/plans";
import { availableSessions, getAccount, getCurrentUser } from "@/lib/supabase-auth";
import NewSessionWizard from "./wizard";

export const metadata: Metadata = { title: "Nuova sessione" };

export default async function NewSessionPage() {
  const user = (await getCurrentUser())!;
  const account = await getAccount(user.id);
  const available = availableSessions(account);
  if (available <= 0) redirect("/app/piani?esaurite=1");
  // la prossima sessione usata è quella di prova, se c'è ancora
  const limit = !account.unlimited && account.free_sessions > 0 ? COMPANIES_PER_FREE_SESSION : COMPANIES_PER_SESSION;
  return <NewSessionWizard available={available} limitLabel={`fino a ${limit}`} />;
}
