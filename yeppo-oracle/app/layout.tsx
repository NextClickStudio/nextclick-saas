import type { Metadata, Viewport } from "next";
import "./y.css";
import "./paper.css";
import { SITE_URL } from "@/lib/config";
import { display, mono, sans } from "@/lib/fonts";
import JsonLd from "@/components/JsonLd";

const DESCRIPTION =
  "yeppo is a Solana memecoin rug checker and scanner for pump.fun, GMGN and Axiom. Open any coin: in one second it checks holders, bundles, the dev wallet's past coins and the money behind it, and tells you if it's Safe, Risky or Danger.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "yeppo · pump.fun rug checker & Solana memecoin scanner",
  description: DESCRIPTION,
  applicationName: "yeppo",
  keywords: [
    "pump.fun rug checker",
    "solana memecoin scanner",
    "memecoin rug check",
    "dev wallet checker",
    "pump.fun bundle checker",
    "bubble map memecoin",
    "gmgn extension",
    "axiom extension",
    "memecoin chrome extension",
    "solana rug checker",
    "is this coin a rug",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    type: "website",
    title: "yeppo · know who made it. catch the move.",
    description: "Rug checks, the creator's past coins and the live moment of any Solana memecoin, right on pump.fun, GMGN and Axiom.",
    url: SITE_URL,
    siteName: "yeppo",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "yeppo · pump.fun rug checker", description: "Know who made it. Catch the move." },
  category: "finance",
};

export const viewport: Viewport = { themeColor: "#efeae0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <JsonLd
          data={[
            { "@context": "https://schema.org", "@type": "Organization", name: "yeppo", url: SITE_URL, logo: `${SITE_URL}/icon.svg`, email: "info@yeppo.it" },
            { "@context": "https://schema.org", "@type": "WebSite", name: "yeppo", url: SITE_URL, description: DESCRIPTION },
          ]}
        />
      </body>
    </html>
  );
}
