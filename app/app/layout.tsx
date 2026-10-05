import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import NavLink from "@/components/nav-link";
import NavProgress from "@/components/nav-progress";
import { Logo } from "@/components/ui";
import OnboardingTour, { GuideButton } from "@/components/onboarding-tour";
import PlanBanner from "@/components/plan-banner";
import { RADAR_ENABLED } from "@/lib/config";
import { db } from "@/lib/db";
import { availableSessions, getAccount, getCurrentUser, profileComplete } from "@/lib/supabase-auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const account = await getAccount(user.id);
  const sessions = availableSessions(account);
  // richieste di call nuove (notifica nel menu)
  const { count: newRequests } = await db()
    .from("call_requests")
    .select("id, companies!inner(projects!inner(user_id))", { count: "exact", head: true })
    .eq("companies.projects.user_id", user.id)
    .eq("status", "nuova");
  // opportunità nuove del Radar (notifica nel menu)
  const showRadar = RADAR_ENABLED || account.unlimited;
  const { count: newRadar } = showRadar
    ? await db().from("radar_items").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "nuovo")
    : { count: 0 };

  return (
    <div className="flex flex-1 flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo href="/app" />
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              <NavLink href="/app">Dashboard</NavLink>
              {showRadar && (
<NavLink href="/app/radar">
                Radar
                {(newRadar ?? 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                    {newRadar}
                  </span>
                )}
              </NavLink>
)}
              <NavLink href="/app/outreach">Outreach</NavLink>
              <NavLink href="/app/richieste">
                Richieste
                {(newRequests ?? 0) > 0 && (
                  <span className="pulse-dot absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan px-1 text-[10px] font-bold text-ink">
                    {newRequests}
                  </span>
                )}
              </NavLink>
              {account.unlimited && <NavLink href="/app/meme">Meme</NavLink>}
              {account.unlimited && <NavLink href="/app/admin">Admin</NavLink>}
              <NavLink href="/app/piani">Piani</NavLink>
              <NavLink href="/app/account">Account</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <GuideButton />
            <Link
              href="/app/piani"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300 hover:border-accent/50"
              title="Sessioni disponibili"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${sessions > 0 ? "bg-cyan pulse-dot" : "bg-red-400"}`} />
              {sessions === Infinity ? "Sessioni illimitate" : `${sessions} ${sessions === 1 ? "sessione" : "sessioni"}`}
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/[0.05] hover:text-white">Esci</button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-white/[0.04] px-4 py-1.5 text-sm sm:hidden">
          <NavLink href="/app" compact>Dashboard</NavLink>
          {showRadar && <NavLink href="/app/radar" compact>Radar{(newRadar ?? 0) > 0 ? ` (${newRadar})` : ""}</NavLink>}
          <NavLink href="/app/outreach" compact>Outreach</NavLink>
          <NavLink href="/app/richieste" compact>
            Richieste{(newRequests ?? 0) > 0 ? ` (${newRequests})` : ""}
          </NavLink>
          {account.unlimited && <NavLink href="/app/meme" compact>Meme</NavLink>}
          {account.unlimited && <NavLink href="/app/admin" compact>Admin</NavLink>}
          <NavLink href="/app/piani" compact>Piani</NavLink>
          <NavLink href="/app/account" compact>Account</NavLink>
        </nav>
      </header>
      <PlanBanner account={account} />
      <NavProgress />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <OnboardingTour autoOpen={!account.onboarded_at} profileComplete={profileComplete(account)} />
    </div>
  );
}
