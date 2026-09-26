"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGame } from "@/lib/game/store";

const ICONS: Record<string, React.ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  market: <path d="M4 17l5-5 4 3 7-8M15 7h5v5" />,
  maison: (
    <>
      <rect x="4.5" y="6" width="10" height="14" rx="2" />
      <path d="M9 3.5h8.5a2 2 0 0 1 2 2V17" />
    </>
  ),
  ranks: <path d="M6 20V11M12 20V5M18 20v-6" />,
};

const TABS = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/market", label: "Market", icon: "market" },
  { href: "/pack", label: "Pack", icon: "pack" },
  { href: "/maison", label: "Maison", icon: "maison" },
  { href: "/ranks", label: "Ranks", icon: "ranks" },
];

export function BottomNav() {
  const path = usePathname();
  const { state } = useGame();
  const packReady = !!state && state.house.last_pack_day !== state.today;
  const callsLeft = state ? state.forecast.filter((f) => !f.dir).length : 0;
  return (
    <nav className="fixed right-0 bottom-0 left-0 z-40 border-t border-line bg-bg/95 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-2">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          if (t.icon === "pack") {
            return (
              <Link key={t.href} href={t.href} prefetch className="flex flex-col items-center">
                <span className="relative -mt-6 grid h-14 w-14 place-items-center rounded-[18px] bg-ivory text-lg font-black text-bg shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform active:scale-95">
                  M
                  {packReady && <span className="absolute -top-1 -right-1 h-3.5 w-3.5 animate-pulse rounded-full bg-accent ring-2 ring-bg" />}
                </span>
                <span className={`mt-1 text-[11px] font-bold ${active ? "text-ivory" : "text-muted"}`}>{t.label}</span>
              </Link>
            );
          }
          return (
            <Link key={t.href} href={t.href} prefetch className="relative flex flex-col items-center gap-1 py-1 active:scale-95">
              <svg viewBox="0 0 24 24" className={`h-6 w-6 ${active ? "text-ivory" : "text-muted"}`} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                {ICONS[t.icon]}
              </svg>
              {t.icon === "today" && callsLeft > 0 && (
                <span className="absolute top-0 right-[calc(50%-18px)] grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-black text-ivory">{callsLeft}</span>
              )}
              <span className={`text-[11px] font-bold ${active ? "text-ivory" : "text-muted"}`}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
