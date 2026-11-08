"use client";

// The masthead and the colophon of yeppo.it, set like a printed report: a dateline, the stamp mark and the wordmark,
// plain links, one ink button. Pages that live on paper wrap themselves in <Paper>.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DISCORD_INVITE, INSTAGRAM } from "@/lib/discord";

const LINKS = [
  { href: "/#how", label: "How it reads" },
  { href: "/radar", label: "Radar" },
  { href: "/record", label: "Record" },
  { href: "/extension", label: "Extension" },
  { href: "/pricing", label: "Pricing" },
];

/** the stamp: an ink disc with a y cut out of it, tilted the way a stamp lands */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg className="mark-svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <g transform="rotate(-8 50 50)">
        <circle cx="50" cy="50" r="48" fill="var(--stamp, #ebe8df)" />
        <circle cx="50" cy="50" r="41" fill="none" stroke="var(--paper, #0d0e10)" strokeWidth="2" opacity=".55" />
        <path d="M30 27 L50 58 M70 27 L42 82" stroke="var(--paper, #0d0e10)" strokeWidth="11" fill="none" strokeLinecap="square" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="yeppo home">
      <Mark />
      <span className="logo-word">yeppo</span>
    </Link>
  );
}

/** the page's paper: the masthead, the page, the colophon */
export function Paper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`pp ${className ?? ""}`}>
      {/* the stamp ink: rough edges and a few missed specks, used by every stamp on the page */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id="ink-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feComponentTransfer in="n" result="speck">
            <feFuncA type="discrete" tableValues="1 1 1 0 1 1 1 1" />
          </feComponentTransfer>
          <feComposite in="d" in2="speck" operator="in" />
        </filter>
      </svg>
      <Nav />
      {children}
      <Footer />
    </div>
  );
}

function Dateline() {
  const [d, setD] = useState("");
  useEffect(() => {
    setD(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }));
  }, []);
  return (
    <div className="p-dateline">
      <span>{d || " "}</span>
      <span className="p-dl-mid">Forensic reads of Solana memecoins</span>
      <span>
        <i className="p-dot" /> Reading every pump.fun launch
      </span>
    </div>
  );
}

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className={`p-mast ${open ? "open" : ""}`}>
      <Dateline />
      <div className="p-bar">
        <Logo />
        <nav className="p-links" onClick={() => setOpen(false)}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="p-bar-r">
          <Socials />
          <Link href="/extension" className="p-btn">
            Add to Chrome
          </Link>
          <button className="p-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <i />
            <i />
          </button>
        </div>
      </div>
    </header>
  );
}

/** yeppo's Discord server and Instagram */
export function Socials() {
  return (
    <span className="soc">
      <a href={DISCORD_INVITE} target="_blank" rel="noreferrer" aria-label="yeppo on Discord" title="Join the yeppo Discord">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path
            fill="currentColor"
            d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1a15.7 15.7 0 0 0-5.8 0L8.6 4a17 17 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.3 17.1A17 17 0 0 0 6.5 19.7l1.1-1.7a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 11.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a17 17 0 0 0 5.2-2.6c.4-4.5-.7-8.4-3.1-11.8ZM8.7 14.7c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Z"
          />
        </svg>
      </a>
      <a href={INSTAGRAM} target="_blank" rel="noreferrer" aria-label="yeppo on Instagram" title="@getyeppo on Instagram">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
          <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.9" />
          <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
        </svg>
      </a>
    </span>
  );
}

export function Footer() {
  return (
    <footer className="p-colo">
      <div className="p-colo-in">
        <div className="p-colo-brand">
          <Logo />
          <p>Know the coin before you buy it: who launched it, who holds it, who paid for it, and one word.</p>
          <Socials />
        </div>
        <nav>
          <b>Product</b>
          <Link href="/extension">Extension</Link>
          <Link href="/radar">Wallet radar</Link>
          <Link href="/record">Record</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <nav>
          <b>Guides</b>
          <Link href="/learn/pump-fun-rug-checker">Pump.fun rug checker</Link>
          <Link href="/learn/dev-wallet-checker">Dev wallet checker</Link>
          <Link href="/learn/memecoin-bundle-checker">Bundle checker</Link>
          <Link href="/learn">All guides</Link>
        </nav>
        <nav>
          <b>House</b>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/risk">Risk</Link>
          <a href="mailto:info@yeppo.it">info@yeppo.it</a>
        </nav>
      </div>
      <p className="p-colo-fine">
        Not financial advice. Most memecoins go to zero. Only trade what you can lose. Set in Schibsted Grotesk and IBM Plex Mono. Read from the Solana chain and
        RugCheck.
      </p>
    </footer>
  );
}
