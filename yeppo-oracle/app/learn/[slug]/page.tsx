import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import Nav, { Footer } from "@/components/Nav";
import { SITE_URL } from "@/lib/config";
import { GUIDES, guide } from "@/lib/guides";

type P = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const g = guide((await params).slug);
  if (!g) return {};
  return {
    title: `${g.seo} · yeppo`,
    description: g.description,
    keywords: g.keywords,
    alternates: { canonical: `/learn/${g.slug}` },
    openGraph: { type: "article", title: g.seo, description: g.description, url: `${SITE_URL}/learn/${g.slug}` },
  };
}

export default async function Page({ params }: P) {
  const g = guide((await params).slug);
  if (!g) notFound();
  const others = GUIDES.filter((o) => o.slug !== g.slug).slice(0, 4);
  return (
    <>
      <Nav />
      <main className="page wrap" style={{ maxWidth: 760 }}>
        <nav className="crumbs mute small" aria-label="Breadcrumb">
          <Link href="/">yeppo</Link> / <Link href="/learn">Learn</Link>
        </nav>
        <div className="page-head">
          <span className="label">Guide</span>
          <h1>{g.title}</h1>
          <p>{g.intro}</p>
        </div>
        <article className="doc">
          <p className="upd">Updated {g.updated}</p>
          {g.body.map((b, i) => (
            <section key={i}>
              {b.h && <h2>{b.h}</h2>}
              {b.p?.map((t, j) => <p key={j}>{t}</p>)}
              {b.list && (
                <ul>
                  {b.list.map((t, j) => (
                    <li key={j}>{t}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <h2>Questions</h2>
          {g.faq.map(([q, a]) => (
            <details key={q} className="faq">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
          <div className="card learn-cta">
            <b>Run every check in one second.</b>
            <span>yeppo reads the coin you open on pump.fun, GMGN, Axiom and DexScreener. It never touches your wallet.</span>
            <Link href="/extension" className="btn btn-go btn-sm">
              Add to Chrome
            </Link>
          </div>
          <p className="mute small">Not financial advice. Most memecoins go to zero. Only trade what you can lose.</p>
        </article>
        <div className="learn-grid" style={{ marginTop: 28 }}>
          {others.map((o) => (
            <Link key={o.slug} href={`/learn/${o.slug}`} className="card learn-card">
              <h2>{o.title}</h2>
              <span className="learn-more">Read →</span>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: g.title,
            description: g.description,
            keywords: g.keywords.join(", "),
            dateModified: "2026-10-31",
            author: { "@type": "Organization", name: "yeppo", url: SITE_URL },
            publisher: { "@type": "Organization", name: "yeppo", url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` } },
            mainEntityOfPage: `${SITE_URL}/learn/${g.slug}`,
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: g.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "yeppo", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Learn", item: `${SITE_URL}/learn` },
              { "@type": "ListItem", position: 3, name: g.title, item: `${SITE_URL}/learn/${g.slug}` },
            ],
          },
        ]}
      />
    </>
  );
}
