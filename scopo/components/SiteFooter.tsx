import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo size={26} />
          <p>
            Scopo is a free demo and we&apos;re still building it, so things may change or break.
            Videos are hosted on YouTube and belong to their creators.
          </p>
        </div>
        <nav className="footer-links" aria-label="Legal">
          <Link href="/learn">Open the app</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/cookies">Cookie policy</Link>
          <Link href="/terms">Terms of use</Link>
        </nav>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} Scopo · Learn by scrolling</p>
    </footer>
  );
}
