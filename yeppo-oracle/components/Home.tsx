import JsonLd from "./JsonLd";
import { SITE_URL } from "@/lib/config";
import City from "./city/City";

// The home (9 Nov 2026) is a small neon city block drawn live in 3D. No header and no buttons: the buildings are the
// links to the rest of the site.
export default function Home() {
  return (
    <main className="home-film">
      <City />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "yeppo",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Chrome, Brave, Edge, Arc",
            url: SITE_URL,
            description:
              "Chrome extension and site that checks any Solana memecoin on pump.fun, GMGN and Axiom: rug checks, launch bundles, the creator's past coins, the money behind the creator, and one verdict: Safe, Risky or Danger.",
            featureList: ["Pump.fun rug checker", "Dev wallet history", "Bundle checker", "Wallet radar", "Same-amount buy detection", "Safe, Risky or Danger verdict"],
          },
        ]}
      />
    </main>
  );
}
