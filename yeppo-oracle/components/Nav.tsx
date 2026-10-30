"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/extension", label: "Extension" },
  { href: "/pricing", label: "Pricing" },
];

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="yeppo home">
      <i className="logo-mark" />
      yeppo
    </Link>
  );
}

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="nav">
      <div className="wrap">
        <Logo />
        <nav className={`nav-links ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="grow" />
        <Link href="/extension" className="btn btn-go btn-sm btn-cta">
          Add to Chrome
        </Link>
        <button className="nav-burger" aria-label="Menu" onClick={() => setOpen(!open)}>
          {open ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <Logo />
        <div className="grow" />
        <nav>
          <Link href="/extension">Extension</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/risk">Risk</Link>
        </nav>
        <p className="foot-fine">Not financial advice. Most memecoins go to zero. Only trade what you can lose.</p>
      </div>
    </footer>
  );
}
