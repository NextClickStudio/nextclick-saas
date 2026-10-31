import type { Metadata, Viewport } from "next";
import "./globals.css";
import { mono, sans } from "@/lib/fonts";
import { SITE_URL } from "@/lib/config";
import AppProvider from "@/components/AppProvider";
import FxLayer from "@/components/FxLayer";
import Onboarding from "@/components/Onboarding";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "yeppo 1v1 · memecoin trading duels",
  description:
    "1v1 trading duels on real pump.fun launches. Same coin, same bag, best of 3. Or put your own wallet on the line in a real duel, verified on-chain. Free to play.",
  openGraph: {
    title: "yeppo 1v1 · 1v1 me.",
    description: "Memecoin trading duels on real pump.fun launches. Free to play.",
    url: SITE_URL,
    siteName: "yeppo",
  },
  twitter: { card: "summary_large_image", title: "yeppo 1v1 · 1v1 me.", description: "Memecoin trading duels on real pump.fun launches." },
};

export const viewport: Viewport = { themeColor: "#08090b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <AppProvider>
          {children}
          <Onboarding />
        </AppProvider>
        <FxLayer />
      </body>
    </html>
  );
}
