"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLearn } from "@/lib/learn/store";

const ICONS: Record<string, React.ReactNode> = {
  learn: <path d="M4 19V6a2 2 0 0 1 2-2h12v13H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h12v-4" />,
  duels: <path d="M5 4l7 7M4 20l6-6M14.5 9.5 20 4M19 20l-9-9M16 16l4 4M8 16l-4 4" />,
  leagues: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

const TABS = [
  { href: "/learn", label: "Learn", icon: "learn" },
  { href: "/duels", label: "Duels", icon: "duels" },
  { href: "/leagues", label: "Leagues", icon: "leagues" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

export function BottomNav() {
  const path = usePathname();
  const { state } = useLearn();
  const yourTurn = state?.duels.filter((d) => d.my_score === null).length ?? 0;
  return (
    <nav className="fixed right-0 bottom-0 left-0 z-40 border-t border-line bg-bg/95 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-4 px-2 pt-2">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className="relative flex flex-col items-center gap-1 py-1 active:scale-95">
              <svg viewBox="0 0 24 24" className={`h-6 w-6 ${active ? "text-ivory" : "text-muted"}`} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                {ICONS[t.icon]}
              </svg>
              {t.icon === "duels" && yourTurn > 0 && (
                <span className="absolute top-0 right-[calc(50%-18px)] grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-black text-ivory">{yourTurn}</span>
              )}
              <span className={`text-[11px] font-bold ${active ? "text-ivory" : "text-muted"}`}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
