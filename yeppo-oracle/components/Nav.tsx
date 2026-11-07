"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DISCORD_INVITE, INSTAGRAM } from "@/lib/discord";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/radar", label: "Radar" },
  { href: "/record", label: "Record" },
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
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`nav ${scrolled ? "nav-s" : ""} ${open ? "nav-open" : ""}`}>
      <div className="nav-in">
        <Logo />
        <nav className="nav-links" onClick={() => setOpen(false)}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-r">
          <Socials />
          <span className="nav-live" title="yeppo is reading every pump.fun launch right now">
            <i />
            Live
          </span>
          <Link href="/extension" className="btn-chrome">
            <ChromeMark />
            <span>Add to Chrome</span>
          </Link>
          <button className="nav-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <i />
            <i />
          </button>
        </div>
      </div>
    </header>
  );
}

/** yeppo's Discord server and Instagram: two small glowing marks */
export function Socials() {
  return (
    <span className="soc">
      <a href={DISCORD_INVITE} target="_blank" rel="noreferrer" className="soc-dc" aria-label="Yeppo on Discord" title="Join the Yeppo Discord">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path
            fill="currentColor"
            d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1a15.7 15.7 0 0 0-5.8 0L8.6 4a17 17 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.3 17.1A17 17 0 0 0 6.5 19.7l1.1-1.7a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 11.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a17 17 0 0 0 5.2-2.6c.4-4.5-.7-8.4-3.1-11.8ZM8.7 14.7c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Z"
          />
        </svg>
      </a>
      <a href={INSTAGRAM} target="_blank" rel="noreferrer" className="soc-ig" aria-label="Yeppo on Instagram" title="@getyeppo on Instagram">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
          <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.9" />
          <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
        </svg>
      </a>
    </span>
  );
}

/** a plain chrome-like ring, drawn in yeppo's colours (not Google's logo) */
function ChromeMark() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" opacity=".55" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <Logo />
        <div className="grow" />
        <Socials />
        <nav>
          <Link href="/extension">Extension</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/learn/pump-fun-rug-checker">Pump.fun rug checker</Link>
          <Link href="/learn/dev-wallet-checker">Dev wallet checker</Link>
          <Link href="/learn/memecoin-bundle-checker">Bundle checker</Link>
          <Link href="/learn">Learn</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/risk">Risk</Link>
          <a href="mailto:info@yeppo.it">info@yeppo.it</a>
        </nav>
        <p className="foot-fine">Not financial advice. Most memecoins go to zero. Only trade what you can lose.</p>
      </div>
    </footer>
  );
}
