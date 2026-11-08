import JsonLd from "./JsonLd";
import { SITE_URL } from "@/lib/config";
import { Paper } from "./Nav";
import ScrollFilm from "./film/ScrollFilm";

// The home (8 Nov 2026) is one film rendered in Blender and scrubbed by scroll, with no headlines: the objects tell how
// yeppo works and small tags pinned to them say what each one is. Its last objects lead to the extension, the radar,
// the record and the price. The films that explain the extension step by step live on the extension page.
export default function Home() {
  return (
    <Paper className="bw home">
      <ScrollFilm />
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
    </Paper>
  );
}
