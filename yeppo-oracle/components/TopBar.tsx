"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Eye } from "./Bits";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/wallet", label: "Wallet" },
  { href: "/extension", label: "Extension" },
  { href: "/pricing", label: "Pricing" },
];

export default function TopBar({ live }: { live?: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="top">
      <div className="wrap">
        <Link href="/" className="logo disp">
          <Eye />
          <b>yeppo</b>
        </Link>
        <nav className={`top-nav ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="grow" />
        {live !== undefined && (
          <div className="live-pill">
            <i className={`dot ${live ? "" : "off"}`} />
            <span className="txt">{live ?? "connecting…"}</span>
          </div>
        )}
        <Link href="/extension" className="btn btn-glow btn-sm top-cta">
          Get the extension
        </Link>
        <button className="icon-btn top-burger" aria-label="Menu" onClick={() => setOpen(!open)}>
          {open ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
