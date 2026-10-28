import type { Metadata, Viewport } from "next";
import FxLayer from "@/components/FxLayer";
import { mono, sans } from "@/lib/fonts";
import { SITE_URL } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "yeppo — memecoin arena",
  description: "Trada memecoin reali con soldi finti. Stanze da 50 trader, mercato vero in diretta, chi chiude più in alto vince.",
  openGraph: {
    title: "yeppo — memecoin arena",
    description: "Trada memecoin reali con soldi finti. Stanze da 50, mercato live, classifica in diretta.",
    url: SITE_URL,
    siteName: "yeppo",
  },
  twitter: { card: "summary_large_image", title: "yeppo — memecoin arena" },
};

export const viewport: Viewport = { themeColor: "#050507", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <FxLayer />
      </body>
    </html>
  );
}
