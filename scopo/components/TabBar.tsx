"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Barra in basso, come un'app: Esplora e Libreria. */
export function TabBar() {
  const pathname = usePathname();
  const tabs = [
    {
      href: "/learn",
      label: "Explore",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" />
        </svg>
      ),
    },
    {
      href: "/library",
      label: "Library",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path d="M5 4h4v16H5zM10.5 4h4v16h-4zM16 5.2l3.7-1 3.1 15.5-3.7 1z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => {
        const on = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} className={`tab ${on ? "is-on" : ""}`} aria-current={on ? "page" : undefined}>
            {t.icon}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
