"use client";

// Link del menu che si evidenzia quando sei nella sua sezione.
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children, compact = false }: { href: string; children: React.ReactNode; compact?: boolean }) {
  const pathname = usePathname();
  const active = href === "/app" ? pathname === "/app" || pathname.startsWith("/app/sessioni") : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`relative rounded-lg ${compact ? "px-3 py-1" : "px-3 py-1.5"} transition-colors ${
        active ? "bg-white/[0.07] text-white" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
