import Link from "next/link";
import { Logo } from "./Logo";
import { SiteFooter } from "./SiteFooter";

export const LEGAL_UPDATED = "October 16, 2026";

type Props = { title: string; intro: string; children: React.ReactNode };

export function LegalPage({ title, intro, children }: Props) {
  return (
    <div className="legal">
      <header className="nav nav-solid">
        <Link href="/" aria-label="Scopo home">
          <Logo />
        </Link>
        <Link href="/learn" className="btn btn-ghost btn-sm nav-cta">
          Open app
        </Link>
      </header>
      <main className="legal-main">
        <p className="kicker">Legal</p>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-meta">Last updated: {LEGAL_UPDATED}</p>
        <div className="legal-demo">
          <strong>Scopo is a free demo.</strong> We&apos;re still building it, so features and these documents may
          change. We&apos;ll publish complete legal details before any public, non-demo launch.
        </div>
        <p className="legal-intro">{intro}</p>
        <article className="legal-body">{children}</article>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Contatto: impostalo con NEXT_PUBLIC_CONTACT_EMAIL quando vuoi renderlo pubblico. */
export function Contact() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <>contact details will be published here before the public launch</>
  );
}
