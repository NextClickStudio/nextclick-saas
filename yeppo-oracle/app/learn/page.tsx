import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { Paper } from "@/components/Nav";
import { SITE_URL } from "@/lib/config";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Learn: memecoin safety, rug checks and timing · yeppo",
  description:
    "Plain guides to trading Solana memecoins safely: how to check a pump.fun coin for a rug, spot bundles, read a dev wallet, use bubble maps, and when momentum lies. Backed by yeppo's own data.",
  alternates: { canonical: "/learn" },
};

export default function Page() {
  return (
    <>
      <Paper>
      <main className="page wrap" style={{ maxWidth: 860 }}>
        <div className="page-head">
          <span className="label">Learn</span>
          <h1>Trade memecoins with your eyes open.</h1>
          <p>Short guides to the checks that matter, with numbers from yeppo&apos;s own record of every pump.fun launch.</p>
        </div>
        <div className="learn-grid">
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/learn/${g.slug}`} className="card learn-card">
              <h2>{g.title}</h2>
              <p>{g.description}</p>
              <span className="learn-more">Read →</span>
            </Link>
          ))}
        </div>
      </main>
      </Paper>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "yeppo Learn",
          url: `${SITE_URL}/learn`,
          hasPart: GUIDES.map((g) => ({ "@type": "Article", headline: g.title, url: `${SITE_URL}/learn/${g.slug}` })),
        }}
      />
    </>
  );
}
